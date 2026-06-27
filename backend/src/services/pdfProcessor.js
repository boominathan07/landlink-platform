const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v2: cloudinary } = require('cloudinary');
const { renderPdfPageToPng } = require('./pdfRender');

const useCloudinary = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const getUploadsDir = () => {
  const dir = path.join(__dirname, '../../uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const DPI = Number(process.env.PDF_DPI) || 200;
const MAX_EDGE = Number(process.env.PDF_MAX_EDGE) || 4096;

const assertBuffer = (buf, label) => {
  if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) {
    throw new Error(`${label} is empty or invalid`);
  }
  return buf;
};

const fileToBuffer = (file) => {
  if (file?.buffer?.length) return file.buffer;
  if (file?.path && fs.existsSync(file.path)) {
    return fs.readFileSync(file.path);
  }
  throw new Error('Uploaded file could not be read. Please try again.');
};

/** Convert PDF → PNG (first page) — tuned for DTCP scanned Tamil layouts */
const pdfBufferToPng = async (pdfBuffer) => {
  assertBuffer(pdfBuffer, 'PDF data');

  const tmpDir = path.join(os.tmpdir(), 'landlink-pdf');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPdf = path.join(tmpDir, `layout-${Date.now()}.pdf`);
  fs.writeFileSync(tmpPdf, pdfBuffer);

  try {
    // 1) pdf-to-img v6 (reliable for large scanned DTCP PDFs on Windows)
    const { pdf } = await import('pdf-to-img');
    const scale = Math.max(2, Math.min(4, Math.round(DPI / 72)));
    const doc = await pdf(tmpPdf, { scale });
    const page = await doc.getPage(1);
    await doc.destroy();
    if (page?.length) {
      console.log('pdf-to-img OK:', page.length, 'bytes');
      return Buffer.from(page);
    }
  } catch (err) {
    console.warn('pdf-to-img failed:', err.message);
  }

  try {
    // 2) PDF.js + @napi-rs/canvas
    const { buffer } = await renderPdfPageToPng(pdfBuffer, DPI);
    if (buffer?.length) {
      console.log('PDF.js render OK:', buffer.length, 'bytes');
      return buffer;
    }
  } catch (err) {
    console.warn('PDF.js render failed:', err.message);
  }

  try {
    // 3) pdf2pic (needs GraphicsMagick installed)
    const { fromPath } = require('pdf2pic');
    const convert = fromPath(tmpPdf, {
      density: DPI,
      format: 'png',
      width: MAX_EDGE,
      height: MAX_EDGE,
      savePath: tmpDir,
      saveFilename: `page-${Date.now()}`,
    });
    const result = await convert(1, { responseType: 'image' });
    if (result?.path && fs.existsSync(result.path)) {
      console.log('pdf2pic OK');
      return fs.readFileSync(result.path);
    }
    if (result?.buffer?.length) return result.buffer;
  } catch (err) {
    console.error('PDF Conversion Strategy 3 (pdf2pic) failed:', err.message);
  } finally {
    try {
      if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
    } catch {
      /* ignore */
    }
  }

  const finalError = new Error('PDF conversion failed on server. Please try converting your PDF to a high-quality JPG/PNG image and uploading that instead.');
  finalError.details = 'All conversion strategies (pdf-to-img, PDF.js, pdf2pic) failed.';
  throw finalError;
};

const optimizePng = async (inputBuffer) => {
  assertBuffer(inputBuffer, 'Image data');

  const meta = await sharp(inputBuffer, { limitInputPixels: false }).metadata();
  let w = meta.width || 1;
  let h = meta.height || 1;

  if (w > MAX_EDGE || h > MAX_EDGE) {
    const ratio = Math.min(MAX_EDGE / w, MAX_EDGE / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const out = await sharp(inputBuffer, { limitInputPixels: false })
    .resize(w, h, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 8 })
    .toBuffer();

  const finalMeta = await sharp(out).metadata();
  return {
    buffer: out,
    width: finalMeta.width || w,
    height: finalMeta.height || h,
  };
};

const saveLocal = async (buffer, ext) => {
  assertBuffer(buffer, 'File');
  const uploadsDir = getUploadsDir();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return { filename, url: `/uploads/${filename}` };
};

// const uploadToCloudinary = (buffer, folder, resourceType = 'image') =>
//   new Promise((resolve, reject) => {
//     assertBuffer(buffer, 'Upload');
//     const options = { folder: `landlink/${folder}`, resource_type: resourceType };
//     if (process.env.CLOUDINARY_UPLOAD_PRESET) {
//       options.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
//     }
//     const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
//       if (err) {
//         console.error('Cloudinary upload error:', err.http_code, err.message, err);
//         reject(err);
//         return;
//       }
//       resolve(result);
//     });
//     stream.end(buffer);
//   });
const uploadToCloudinary = async (buffer, folder, resourceType = 'image') => {
  assertBuffer(buffer, 'Upload');

  const tmpPath = path.join(os.tmpdir(), `upload-${Date.now()}.png`);
  fs.writeFileSync(tmpPath, buffer);

  try {
    const result = await cloudinary.uploader.upload(tmpPath, {
      folder: `landlink/${folder}`,
      resource_type: resourceType,
    });

    return result;
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    throw err;
  } finally {
    try {
      fs.unlinkSync(tmpPath); // cleanup temp file
    } catch {}
  }
};
const processLayoutFile = async (file) => {
  const rawBuffer = fileToBuffer(file);
  const mime = file.mimetype || '';
  const name = (file.originalname || '').toLowerCase();
  const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');

  let imageBuffer;
  let pdfUrl = null;

  if (isPdf) {
    console.log('Converting PDF, size:', rawBuffer.length);
    imageBuffer = await pdfBufferToPng(rawBuffer);
    const pdfSave = await saveLocal(rawBuffer, '.pdf');
    pdfUrl = pdfSave.url;
  } else {
    imageBuffer = rawBuffer;
  }

  const { buffer: optimized, width, height } = await optimizePng(imageBuffer);
  console.log('Layout image ready:', width, 'x', height);

  if (useCloudinary()) {
    try {
      const imgUp = await uploadToCloudinary(optimized, 'layouts', 'image');
      return { pdfUrl, imageUrl: imgUp.secure_url, publicId: imgUp.public_id, width, height };
    } catch (err) {
      console.error('CLOUDINARY FULL ERROR:', err);
    }
  }

  const imgSave = await saveLocal(optimized, '.png');
  return { pdfUrl, imageUrl: imgSave.url, publicId: null, width, height };
};

const uploadBufferToCloudOrLocal = async (buffer, originalname, _mimetype, folder) => {
  assertBuffer(buffer, 'File');
  if (useCloudinary()) {
    try {
      const result = await uploadToCloudinary(buffer, folder, 'auto');
      return { secure_url: result.secure_url };
    } catch (err) {
      console.error('Cloudinary document upload failed, saving locally:', err.message);
    }
  }
  const ext = path.extname(originalname) || '';
  const save = await saveLocal(buffer, ext);
  return { secure_url: save.url };
};

module.exports = {
  processLayoutFile,
  uploadBuffer: uploadBufferToCloudOrLocal,
  useCloudinary,
  getUploadsDir,
  fileToBuffer,
};
