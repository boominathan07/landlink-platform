const path = require('path');
const fs = require('fs');
const { extractTableData } = require('./tableExtractor');
const { dedupePlots, filterSpurious } = require('./plotOcrParser');

function resolveImagePath(imageUrlOrPath) {
  if (!imageUrlOrPath) return null;
  if (imageUrlOrPath.startsWith('http')) return imageUrlOrPath;

  const normalized = imageUrlOrPath.replace(/^\//, '');
  const candidates = [
    path.join(__dirname, '../../', normalized),
    path.join(__dirname, '../../../', normalized),
    path.join(__dirname, '../../uploads', path.basename(normalized)),
    path.join(__dirname, '../../uploads/tmp', path.basename(normalized)),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function normalizeExtractedPlots(plots) {
  return filterSpurious(dedupePlots(plots)).map((p) => {
    const cents = parseFloat(p.cents ?? p.cent) || null;
    const areaSqFeet =
      parseFloat(p.areaSqFeet ?? p.area_sqft ?? p.area) ||
      (cents ? Number((cents * 435.6).toFixed(2)) : null);
    const areaSqMeters =
      parseFloat(p.areaSqMeters ?? p.area_sqm) ||
      (areaSqFeet ? Number((areaSqFeet / 10.7639).toFixed(2)) : null);

    return {
      plot_number: String(p.plot_number || p.plotNumber),
      plotNumber: String(p.plot_number || p.plotNumber),
      width: parseFloat(p.width ?? p.widthMeters ?? p.width_m) || null,
      length: parseFloat(p.length ?? p.lengthMeters ?? p.length_m) || null,
      area: areaSqFeet,
      cent: cents,
      widthMeters: parseFloat(p.widthMeters ?? p.width_m ?? p.width) || null,
      lengthMeters: parseFloat(p.lengthMeters ?? p.length_m ?? p.length) || null,
      areaSqMeters: areaSqMeters,
      areaSqFeet: areaSqFeet,
      cents,
      needsReview: p.needsReview === true,
    };
  });
}

async function extractPlotsFromLayoutImage(imagePath) {
  const raw = await extractTableData(imagePath);
  return normalizeExtractedPlots(raw);
}

module.exports = {
  extractPlotsFromLayoutImage,
  normalizeExtractedPlots,
  resolveImagePath,
};
