const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPT = path.join(__dirname, '../../scripts/detect_plots.py');
const LEGACY_SCRIPT = path.join(__dirname, 'plotLayoutExtractor.py');
const TIMEOUT_MS = 90000;

const pythonCmd = () => (process.platform === 'win32' ? 'python' : 'python3');

const runPythonScript = (scriptPath, args) =>
  new Promise((resolve, reject) => {
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Detection script not found: ${scriptPath}`));
    }

    const chunks = [];
    const errChunks = [];
    const py = spawn(pythonCmd(), [scriptPath, ...args], { windowsHide: true });

    const timeout = setTimeout(() => {
      py.kill();
      reject(new Error('Plot detection timed out. Try a smaller or clearer layout image.'));
    }, TIMEOUT_MS);

    py.stdout.on('data', (d) => chunks.push(d));
    py.stderr.on('data', (d) => {
      errChunks.push(d);
      console.log('Python:', d.toString());
    });
    py.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Python not available: ${err.message}`));
    });
    py.on('close', (code) => {
      clearTimeout(timeout);
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      const stderr = Buffer.concat(errChunks).toString('utf8').trim();
      if (stderr) console.warn('detect_plots stderr:', stderr);

      try {
        const parsed = JSON.parse(raw || '{}');
        if (!parsed.success) {
          return reject(new Error(parsed.error || 'Plot detection failed'));
        }
        resolve(parsed);
      } catch {
        reject(new Error(raw || stderr || `Plot detection exited with code ${code}`));
      }
    });
  });

const runPlotDetection = async (imageSource) => {
  const result = await runPythonScript(SCRIPT, [imageSource]);
  return {
    plots: result.plots || [],
    width: result.width,
    height: result.height,
    count: result.count || (result.plots || []).length,
  };
};

const runPlotExtraction = async (filePath) => {
  const result = await runPythonScript(LEGACY_SCRIPT, [filePath]);
  return result.plots || [];
};

module.exports = { runPlotDetection, runPlotExtraction };
