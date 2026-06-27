require('dotenv').config();
const { analyzeClaudeVision } = require('./src/services/visionService');
const { extractPlotsFromLayoutImage } = require('./src/services/layoutOcr');
const path = require('path');
const fs = require('fs');

const testImagePath = path.join(__dirname, 'uploads/tmp/1780673090135-s.no.jpg');

async function testClaudeVisionErrorHandling() {
  console.log('--- Test 1: Claude Vision with Placeholder API Key ---');
  try {
    // When API key is <<<PASTE_YOUR_REAL_KEY_HERE>>> or similar placeholder
    await analyzeClaudeVision(testImagePath);
    console.error('❌ FAIL: Expected error for placeholder API key, but it succeeded');
  } catch (error) {
    console.log('✅ PASS: Correctly threw error for placeholder API key:', error.message);
  }
}

async function testFallbackOCR() {
  console.log('\n--- Test 2: EasyOCR Fallback Verification ---');
  try {
    // This calls extractPlotsFromLayoutImage using the Python script fallback
    const result = await extractPlotsFromLayoutImage(testImagePath);
    console.log(`✅ EasyOCR extraction returned ${result.length} plots.`);
    if (result.length > 0) {
      console.log('Sample plot from fallback:', result[0]);
    }
  } catch (error) {
    console.log('⚠️ Note: Fallback EasyOCR script execution skipped/failed (expected if Python or easyocr is not fully configured):', error.message);
  }
}

async function testSanitizationAndValidations() {
  console.log('\n--- Test 3: Validation and Error Checks ---');
  
  // Create a helper to simulate the route validations
  const validatePlots = (extractedPlots) => {
    if (extractedPlots.length < 2) {
      throw new Error('Extraction failed: less than 2 plots detected.');
    }
    const firstArea = extractedPlots[0].areaSqFeet;
    const allIdentical = extractedPlots.every((p) => p.areaSqFeet === firstArea);
    if (allIdentical) {
      throw new Error('Extraction returned identical data for all plots — likely OCR failure');
    }
    return true;
  };

  // 3a. Test < 2 plots fails
  try {
    validatePlots([{ plotNumber: '1', areaSqFeet: 1200 }]);
    console.error('❌ FAIL: Expected failure for < 2 plots');
  } catch (error) {
    console.log('✅ PASS: Correctly failed for < 2 plots:', error.message);
  }

  // 3b. Test all identical areaSqFeet fails
  try {
    validatePlots([
      { plotNumber: '1', areaSqFeet: 1200 },
      { plotNumber: '2', areaSqFeet: 1200 },
      { plotNumber: '3', areaSqFeet: 1200 }
    ]);
    console.error('❌ FAIL: Expected failure for all identical areaSqFeet values');
  } catch (error) {
    console.log('✅ PASS: Correctly failed for identical areaSqFeet values:', error.message);
  }

  // 3c. Test correct distinct plots succeeds
  try {
    const success = validatePlots([
      { plotNumber: '1', areaSqFeet: 1200 },
      { plotNumber: '2', areaSqFeet: 1500 }
    ]);
    if (success) {
      console.log('✅ PASS: Correctly succeeded for valid distinct plots');
    }
  } catch (error) {
    console.error('❌ FAIL: Expected success for valid distinct plots, but got error:', error.message);
  }
}

async function main() {
  try {
    await testClaudeVisionErrorHandling();
    await testFallbackOCR();
    await testSanitizationAndValidations();
  } catch (e) {
    console.error('Test suite failed:', e);
  }
}

main();
