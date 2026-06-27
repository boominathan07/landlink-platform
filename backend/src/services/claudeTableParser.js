const { extractTableData } = require('./tableExtractor');

/**
 * Layout table extraction — image content only (OpenCV + EasyOCR, Tesseract fallback).
 * No fixed reference rows or vision template tables.
 */
async function parseTableWithClaude(imagePath) {
  return extractTableData(imagePath);
}

module.exports = { parseTableWithClaude };
