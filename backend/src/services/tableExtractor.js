const fs = require('fs');
const path = require('path');
const os = require('os');
const { extractPlotsFromImage } = require('./ocrService');
const { dedupePlots } = require('./plotOcrParser');

async function extractTableData(imagePath) {
  const plots = await extractPlotsFromImage(imagePath);

  if (!plots || plots.length === 0) {
    throw new Error('No plots extracted from image');
  }

  const uniquePlots = dedupePlots(plots);
  uniquePlots.sort((a, b) => {
    const numA = parseInt(String(a.plot_number || a.plotNumber).replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(String(b.plot_number || b.plotNumber).replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  return uniquePlots;
}

module.exports = { extractTableData };
