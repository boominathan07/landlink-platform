const path = require('path');

/**
 * Render first page of PDF to PNG using Mozilla PDF.js + @napi-rs/canvas.
 * Works on Windows without ImageMagick — handles large scanned DTCP layouts.
 */
async function renderPdfPageToPng(pdfBuffer, dpi = 200) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = require('@napi-rs/canvas');

  const workerPath = path.join(
    path.dirname(require.resolve('pdfjs-dist/package.json')),
    'legacy',
    'build',
    'pdf.worker.mjs'
  );
  pdfjs.GlobalWorkerOptions.workerSrc = `file://${workerPath.replace(/\\/g, '/')}`;

  const scale = Math.max(1.5, Math.min(4, dpi / 72));
  const data = new Uint8Array(pdfBuffer);

  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: false,
    isEvalSupported: false,
  }).promise;

  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  await doc.destroy();

  return {
    buffer: canvas.toBuffer('image/png'),
    width,
    height,
  };
}

module.exports = { renderPdfPageToPng };
