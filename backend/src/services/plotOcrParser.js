/**
 * Shared plot table parsing and validation for OCR pipelines.
 */

const HEADER_RE = /plot|width|length|area|cent|survey|taluk|village|extent|s\.?\s*no|sq\.?\s*m|sq\.?\s*ft|total|taluka/i;

function parseNumericCell(text) {
  if (!text) return null;
  let raw = String(text).trim();
  if (raw.includes('=')) raw = raw.split('=').pop();
  raw = raw.replace(/,/g, '.').replace(/[^\d.\-+]/g, '');
  if (!raw || raw === '.' || raw === '-' || raw === '+') return null;
  const val = parseFloat(raw);
  return Number.isFinite(val) ? val : null;
}

function parseLengthCell(text) {
  if (!text) return null;
  const raw = String(text).trim();
  if (raw.includes('=')) {
    const val = parseNumericCell(raw.split('=').pop());
    if (val != null && val >= 10 && val <= 25) return val;
  }
  const nums = raw.match(/\d+\.?\d*/g) || [];
  const candidates = nums.map(Number).filter((v) => v >= 10 && v <= 25);
  if (candidates.length) return candidates[candidates.length - 1];
  return parseNumericCell(raw);
}

function normalizePlotNumber(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/\D/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  if (num < 1 || num > 200) return null;
  return num;
}

function buildPlotFromParts(plotNum, numbers, lengthRaw) {
  if (numbers.length < 3) return null;

  const widthM = numbers[0];
  const lengthM = lengthRaw ? parseLengthCell(lengthRaw) : numbers[1];
  if (lengthM == null) return null;

  let areaSqM = null;
  let areaSqFt = null;
  let cent = null;
  const rest = lengthRaw ? numbers.slice(1) : numbers.slice(2);

  if (rest.length >= 3) {
    areaSqM = rest[0] < 500 ? rest[0] : null;
    areaSqFt = rest.find((n) => n >= 500) ?? rest[1];
    cent = rest[rest.length - 1] < 10 ? rest[rest.length - 1] : rest[2];
  } else if (rest.length === 2) {
    if (rest[0] >= 500) {
      areaSqFt = rest[0];
      cent = rest[1];
    } else {
      areaSqM = rest[0];
      areaSqFt = rest[1];
    }
  } else if (rest.length === 1) {
    areaSqFt = rest[0] >= 500 ? rest[0] : rest[0] * 10.7639;
  }

  if (areaSqFt == null && areaSqM != null) areaSqFt = roundTo(areaSqM * 10.7639, 2);
  if (areaSqM == null && areaSqFt != null) areaSqM = roundTo(areaSqFt / 10.7639, 2);
  if (cent == null && areaSqFt != null) cent = roundTo(areaSqFt / 435.6, 2);

  return {
    plotNumber: String(plotNum),
    plot_number: String(plotNum),
    widthMeters: widthM,
    width_m: widthM,
    width: widthM,
    lengthMeters: lengthM,
    length_m: lengthM,
    length: lengthM,
    areaSqMeters: areaSqM,
    area_sqm: areaSqM,
    areaSqFeet: areaSqFt,
    area_sqft: areaSqFt,
    area: areaSqFt,
    cents: cent,
    cent,
  };
}

function validatePlotMinimal(plot) {
  const plotNum = parseInt(plot.plotNumber ?? plot.plot_number, 10);
  const cent = parseFloat(plot.cents ?? plot.cent);
  if (!Number.isFinite(plotNum) || plotNum < 1) return false;
  if (!Number.isFinite(cent) || cent < 1 || cent > 50) return false;
  return true;
}

function validatePlot(plot, strictRatio = true) {
  const w = parseFloat(plot.widthMeters ?? plot.width_m ?? plot.width);
  const l = parseFloat(plot.lengthMeters ?? plot.length_m ?? plot.length);
  const areaSqFt = parseFloat(plot.areaSqFeet ?? plot.area_sqft ?? plot.area);
  const cent = parseFloat(plot.cents ?? plot.cent);
  const plotNum = parseInt(plot.plotNumber ?? plot.plot_number, 10);
  const areaSqM = parseFloat(plot.areaSqMeters ?? plot.area_sqm) || areaSqFt / 10.7639;

  if (!Number.isFinite(w) || !Number.isFinite(l) || !Number.isFinite(areaSqFt) || !Number.isFinite(cent)) {
    return false;
  }
  if (w < 4 || w > 20 || l < 8 || l > 30) return false;
  if (areaSqFt < 1000 || areaSqFt > 4000) return false;
  if (cent < 1 || cent > 8) return false;

  if (strictRatio) {
    const expectedSqM = w * l;
    if (expectedSqM > 0) {
      const ratio = areaSqM / expectedSqM;
      if (ratio < 0.45 || ratio > 1.55) return false;
    }
  }

  if (plotNum > 35 && areaSqFt < 1600 && w < 10) return false;
  if (plotNum > 60) return false;

  return true;
}

function parseLineRegex(line) {
  const clean = line.trim();
  if (!clean || HEADER_RE.test(clean)) return null;

  const m = clean.match(
    /^(\d{1,3})\s+(\d+\.?\d*)\s+(.+?)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s*$/
  );
  if (!m) return null;

  const plotNum = normalizePlotNumber(m[1]);
  if (plotNum == null) return null;

  const numbers = [
    parseNumericCell(m[2]),
    parseNumericCell(m[4]),
    parseNumericCell(m[5]),
    parseNumericCell(m[6]),
  ].filter((v) => v != null);

  return buildPlotFromParts(plotNum, [parseNumericCell(m[2]), ...numbers], m[3]);
}

function parsePlotsFromText(text) {
  const plots = [];
  for (const line of text.split('\n')) {
    const plot = parseLineRegex(line);
    if (plot && (validatePlot(plot, false) || validatePlot(plot, true))) {
      plots.push(plot);
    }
  }
  return filterSpurious(dedupePlots(plots));
}

function dedupePlots(plots) {
  const byNum = new Map();
  for (const plot of plots) {
    const key = String(plot.plotNumber || plot.plot_number);
    if (!byNum.has(key)) byNum.set(key, plot);
  }
  return [...byNum.values()].sort(
    (a, b) => parseInt(a.plotNumber || a.plot_number, 10) - parseInt(b.plotNumber || b.plot_number, 10)
  );
}

function filterSpurious(plots) {
  if (!plots.length) return plots;
  const nums = plots.map((p) => parseInt(p.plotNumber || p.plot_number, 10)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return plots;

  const byNum = new Map();
  for (const p of plots) {
    const n = parseInt(p.plotNumber || p.plot_number, 10);
    if (Number.isFinite(n)) byNum.set(n, p);
  }

  let best = [];
  for (const start of [1, nums[0]]) {
    const chain = [];
    let expected = start;
    while (byNum.has(expected)) {
      chain.push(byNum.get(expected));
      expected += 1;
    }
    if (chain.length > best.length) best = chain;
  }
  if (best.length >= Math.max(3, Math.floor(plots.length * 0.5))) {
    return best;
  }

  const maxNum = nums[nums.length - 1];
  const cap = plots.length + 3;
  return plots.filter((p) => {
    const n = parseInt(p.plotNumber || p.plot_number, 10);
    if (n > 60) return false;
    if (maxNum > plots.length + 5 && n > cap) return false;
    if (n > maxNum * 0.6 + 25 && plots.length < 15) return false;
    return true;
  });
}

function roundTo(value, decimals) {
  return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
}

module.exports = {
  parsePlotsFromText,
  parseLineRegex,
  validatePlot,
  validatePlotMinimal,
  dedupePlots,
  filterSpurious,
  parseNumericCell,
  parseLengthCell,
  normalizePlotNumber,
  buildPlotFromParts,
};
