const { exec } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '../../../scripts/extract_plot_table.py');

const pythonPaths = [
  'C:\\Users\\USER\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
  process.env.PYTHON_PATH,
  'python',
  'python3',
].filter(Boolean);

function mapPaddleRow(row) {
  const plotNumber = String(row.plotNumber || row.plot_number || '').trim();
  const cents = parseFloat(row.cents ?? row.cent);
  const needsReview = row.needsReview === true;
  const areaSqFeet = Number.isFinite(cents) ? Number((cents * 435.6).toFixed(2)) : null;
  const areaSqMeters = areaSqFeet ? Number((areaSqFeet / 10.7639).toFixed(2)) : null;

  return {
    plot_number: plotNumber,
    plotNumber,
    widthMeters: null,
    lengthMeters: null,
    width_m: null,
    length_m: null,
    width: null,
    length: null,
    areaSqMeters,
    area_sqm: areaSqMeters,
    areaSqFeet,
    area_sqft: areaSqFeet,
    area: areaSqFeet,
    cents: Number.isFinite(cents) ? cents : null,
    cent: Number.isFinite(cents) ? cents : null,
    needsReview,
  };
}

function parseScriptOutput(output) {
  const trimmed = output.trim();
  if (!trimmed) throw new Error('Empty OCR output');

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (!arrayMatch) throw new Error('No JSON array found in OCR output');
    parsed = JSON.parse(arrayMatch[0]);
  }

  const rows = Array.isArray(parsed) ? parsed : parsed.plots || [];
  if (!rows.length) throw new Error('No plots extracted from image');

  return rows.map(mapPaddleRow).filter((p) => p.plotNumber);
}

async function extractPlotsFromImage(imagePath) {
  let lastError = null;

  for (const pythonPath of pythonPaths) {
    try {
      const plots = await new Promise((resolve, reject) => {
        const child = exec(`"${pythonPath}" "${SCRIPT}" "${imagePath}"`, {
          maxBuffer: 50 * 1024 * 1024,
          timeout: 180000,
          env: {
            ...process.env,
            FLAGS_use_mkldnn: '0',
            PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True',
          },
        });

        let output = '';
        let errorOutput = '';

        child.stdout.on('data', (data) => {
          output += data;
        });

        child.stderr.on('data', (data) => {
          errorOutput += data;
        });

        child.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(errorOutput || `PaddleOCR script exited with code ${code}`));
            return;
          }

          try {
            resolve(parseScriptOutput(output));
          } catch (err) {
            reject(err);
          }
        });

        child.on('error', reject);
      });

      if (plots.length > 0) return plots;
      throw new Error('No plots extracted');
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('PaddleOCR extraction failed');
}

module.exports = { extractPlotsFromImage };
