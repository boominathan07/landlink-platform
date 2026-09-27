const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PADDLE_CACHE_DIR = path.join(__dirname, '../../.paddleocr');
const WARMUP_SCRIPT = path.join(__dirname, '../../scripts/warmup_paddleocr.py');

function resolveOcrScriptPath() {
  const candidates = [
    path.join(__dirname, '../../scripts/extract_plot_table.py'),
    path.join(__dirname, '../../../scripts/extract_plot_table.py'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return path.resolve(candidate);
    }
  }
  return path.resolve(candidates[0]);
}

function getPythonPaths() {
  const paths = [];

  if (process.env.PYTHON_PATH) {
    paths.push(process.env.PYTHON_PATH);
  }

  if (process.platform === 'win32') {
    paths.push(
      'C:\\Users\\USER\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python312/python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python311/python.exe'),
      'py',
      'python',
      'python3',
    );
  } else {
    paths.push('python3', 'python');
  }

  return [...new Set(paths.filter(Boolean))];
}

function getOcrChildEnv() {
  fs.mkdirSync(PADDLE_CACHE_DIR, { recursive: true });
  return {
    ...process.env,
    FLAGS_use_mkldnn: '0',
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True',
    OMP_NUM_THREADS: '1',
    MKL_NUM_THREADS: '1',
    PADDLEOCR_HOME: PADDLE_CACHE_DIR,
  };
}

function formatScriptFailure(code, stdout, stderr) {
  const errText = (stderr || '').trim();
  if (errText) {
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error) {
        const detail = parsed.detail ? `\n${parsed.detail}` : '';
        return new Error(`${parsed.error}${detail}`);
      }
    } catch {
      // not JSON — use raw stderr
    }
    return new Error(errText);
  }

  const outText = (stdout || '').trim();
  if (outText) {
    return new Error(
      `PaddleOCR script exited with code ${code}. Output: ${outText.slice(0, 800)}`,
    );
  }

  return new Error(`PaddleOCR script exited with code ${code}`);
}

function runPythonScript(pythonPath, scriptPath, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, [scriptPath, ...args], {
      env: getOcrChildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let output = '';
    let errorOutput = '';
    let settled = false;

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(
        new Error(
          `OCR timed out after ${timeoutMs}ms. On Render, ensure build runs npm run install-ocr so models are pre-downloaded.`,
        ),
      );
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('error', (err) => {
      finish(new Error(`Failed to run Python (${pythonPath}): ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        finish(formatScriptFailure(code, output, errorOutput));
        return;
      }
      finish(null, output);
    });
  });
}

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
  const scriptPath = resolveOcrScriptPath();
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `OCR script missing (${scriptPath}). Ensure backend/scripts/extract_plot_table.py is deployed.`,
    );
  }

  const resolvedImage = path.resolve(imagePath);
  if (!fs.existsSync(resolvedImage)) {
    throw new Error(`Image not found for OCR: ${resolvedImage}`);
  }

  const timeoutMs = Number(process.env.OCR_TIMEOUT_MS) || 120000;
  let lastError = null;
  const pythonPaths = getPythonPaths();

  for (const pythonPath of pythonPaths) {
    try {
      const stdout = await runPythonScript(
        pythonPath,
        scriptPath,
        [resolvedImage],
        timeoutMs,
      );
      const plots = parseScriptOutput(stdout);
      if (plots.length > 0) return plots;
      throw new Error('No plots extracted');
    } catch (err) {
      lastError = err;
      const retryable =
        err.message.includes('Failed to run Python') ||
        err.message.includes('Python was not found') ||
        err.message.includes('ENOENT');
      if (!retryable) break;
    }
  }

  throw lastError || new Error('PaddleOCR extraction failed');
}

async function warmupPaddleOcrCache() {
  if (!fs.existsSync(WARMUP_SCRIPT)) return;
  const pythonPaths = getPythonPaths();
  const timeoutMs = Number(process.env.OCR_WARMUP_TIMEOUT_MS) || 300000;

  for (const pythonPath of pythonPaths) {
    try {
      await runPythonScript(pythonPath, WARMUP_SCRIPT, [], timeoutMs);
      console.log('[ocr] PaddleOCR warmup finished');
      return;
    } catch (err) {
      console.warn(`[ocr] Warmup failed with ${pythonPath}:`, err.message);
    }
  }
}

module.exports = { extractPlotsFromImage, warmupPaddleOcrCache };
