const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { extractPlotsFromImage } = require('./ocrService');
const { extractTableData } = require('./tableExtractor');

/**
 * Runs the Python table extraction script on the specified PDF file.
 * Returns a promise that resolves with the extracted plots data.
 */
const extractPlotMarkers = (pdfPath) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'pdfExtractor.py');

    console.log(`Spawning Python process to extract tables from: ${pdfPath}`);

    const pythonPaths = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python312/python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python313/python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python311/python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python310/python.exe'),
      'python',
      'python3',
      'py',
    ];

    let currentIdx = 0;

    const trySpawn = () => {
      if (currentIdx >= pythonPaths.length) {
        return reject(new Error('Python execution environment not found. Please ensure Python is installed and added to PATH.'));
      }

      const pyCmd = pythonPaths[currentIdx];
      console.log(`Attempting Python execution path (${currentIdx + 1}/${pythonPaths.length}): ${pyCmd}`);

      let pyProcess;
      try {
        pyProcess = spawn(pyCmd, [scriptPath, pdfPath]);
      } catch (err) {
        currentIdx++;
        return trySpawn();
      }

      let stdoutData = '';
      let stderrData = '';
      let hasError = false;

      pyProcess.stdout.on('data', (data) => { stdoutData += data.toString(); });
      pyProcess.stderr.on('data', (data) => { stderrData += data.toString(); });

      pyProcess.on('error', () => {
        hasError = true;
        currentIdx++;
        trySpawn();
      });

      pyProcess.on('close', (code) => {
        if (hasError) return;

        const isWindowsDummyAlias =
          stderrData.includes('Python was not found') ||
          stderrData.includes('App execution aliases');

        if (code !== 0 || isWindowsDummyAlias) {
          currentIdx++;
          trySpawn();
        } else {
          try {
            const result = JSON.parse(stdoutData.trim());
            if (result.success === false) {
              return reject(new Error(result.error || 'Failed to parse PDF table data'));
            }
            resolve(result);
          } catch (err) {
            reject(new Error('Invalid output format from extraction script'));
          }
        }
      });
    };

    trySpawn();
  });
};

/**
 * Runs OpenCV + EasyOCR on layout images (with Tesseract fallback).
 */
const extractTableFromImage = async (imagePathOrUrl) => {
  console.log(`Running OCR pipeline on image: ${imagePathOrUrl}`);

  let tempFilePath = imagePathOrUrl;
  let shouldCleanup = false;

  if (imagePathOrUrl.startsWith('http')) {
    const axios = require('axios');
    const tmpDir = path.join(os.tmpdir(), 'landlink-ocr');
    fs.mkdirSync(tmpDir, { recursive: true });
    tempFilePath = path.join(tmpDir, `ocr-${Date.now()}.png`);
    shouldCleanup = true;
    const response = await axios({
      method: 'GET',
      url: imagePathOrUrl,
      responseType: 'stream',
    });
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tempFilePath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  try {
    let plots = [];

    try {
      const result = await extractPlotsFromImage(tempFilePath);
      plots = result.plots || [];
    } catch (pyErr) {
      console.warn('Python OCR failed, using tableExtractor fallback:', pyErr.message);
      plots = await extractTableData(tempFilePath);
    }

    if (plots.length === 0) {
      plots = await extractTableData(tempFilePath);
    }

    const normalized = plots.map((p) => ({
      plot_number: String(p.plot_number || p.plotNumber),
      plotNumber: String(p.plot_number || p.plotNumber),
      width: parseFloat(p.width ?? p.widthMeters ?? p.width_m) || null,
      length: parseFloat(p.length ?? p.lengthMeters ?? p.length_m) || null,
      area: parseFloat(p.area ?? p.areaSqFeet ?? p.area_sqft) || null,
      cent: parseFloat(p.cent ?? p.cents) || null,
      widthMeters: parseFloat(p.widthMeters ?? p.width_m ?? p.width) || null,
      lengthMeters: parseFloat(p.lengthMeters ?? p.length_m ?? p.length) || null,
      areaSqMeters: parseFloat(p.areaSqMeters ?? p.area_sqm) || null,
      areaSqFeet: parseFloat(p.areaSqFeet ?? p.area_sqft ?? p.area) || null,
      cents: parseFloat(p.cents ?? p.cent) || null,
    }));

    return {
      success: true,
      total_plots: normalized.length,
      plots: normalized,
      processing_time: 0,
      engine: 'opencv+easyocr',
    };
  } finally {
    if (shouldCleanup && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch { /* ignore */ }
    }
  }
};

module.exports = { extractPlotMarkers, extractTableFromImage };
