/**
 * Test Issue #50 fix with the sample_mission.miz file
 * This file has both DEFAULT and RU dictionaries with different contents
 */

const fs = require('fs');
const path = require('path');

const MizParser = require('../src/miz-parser.js');

async function runTest() {
    console.log('=== Issue #50: Test with sample_mission.miz ===\n');

    const sampleMizPath = path.join(__dirname, '..', 'samples', 'sample_mission.miz');
    if (!fs.existsSync(sampleMizPath)) {
        console.error('Sample .miz file not found. Run: node samples/create-miz-archive.js');
        process.exit(1);
    }

    const mizBuffer = fs.readFileSync(sampleMizPath);
    const parsedData = await MizParser.parse(mizBuffer);

    console.log('Available locales:', parsedData.availableLocales);
    console.log('DEFAULT dictionary keys:', Object.keys(parsedData.dictionaries['DEFAULT'] || {}).length);
    console.log('RU dictionary keys:', Object.keys(parsedData.dictionaries['RU'] || {}).length);
    console.log('');

    // Extract with DEFAULT
    const extractedDefault = MizParser.extractText(parsedData, { preferredLocale: 'DEFAULT' });
    console.log('Extraction with DEFAULT locale:');
    console.log('  Locale used:', extractedDefault.locale);
    console.log('  Briefings:', extractedDefault.extracted.briefings?.length || 0);
    console.log('  Triggers:', extractedDefault.extracted.triggers?.length || 0);
    console.log('  Radio:', extractedDefault.extracted.radio?.length || 0);
    console.log('  Total:', extractedDefault.stats.totalStrings);
    console.log('');

    // Extract with RU
    const extractedRU = MizParser.extractText(parsedData, { preferredLocale: 'RU' });
    console.log('Extraction with RU locale:');
    console.log('  Locale used:', extractedRU.locale);
    console.log('  Briefings:', extractedRU.extracted.briefings?.length || 0);
    console.log('  Triggers:', extractedRU.extracted.triggers?.length || 0);
    console.log('  Radio:', extractedRU.extracted.radio?.length || 0);
    console.log('  Total:', extractedRU.stats.totalStrings);
    console.log('');

    // Verify counts match
    if (extractedDefault.stats.totalStrings === extractedRU.stats.totalStrings) {
        console.log('✓ PASS - Both locales extract the same number of strings');
    } else {
        console.log('✗ FAIL - Different number of strings extracted!');
        console.log(`  DEFAULT: ${extractedDefault.stats.totalStrings}`);
        console.log(`  RU: ${extractedRU.stats.totalStrings}`);
        process.exit(1);
    }

    // Show sample texts to verify translations are being used
    if (extractedRU.extracted.triggers?.length > 0) {
        console.log('');
        console.log('Sample RU trigger text:', extractedRU.extracted.triggers[0].text.substring(0, 80) + '...');
    }

    console.log('\n=== Test Complete ===');
}

runTest().catch(console.error);
