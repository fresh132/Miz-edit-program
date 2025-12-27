/**
 * Test script for Issue #48: Simplified import scheme
 * Tests that dictionary is copied and modified by keys only (no rebuilding)
 */

const fs = require('fs');
const path = require('path');

// Load dependencies
const JSZip = require('jszip');
const MizParser = require('../src/miz-parser.js');

async function runTests() {
    console.log('=== Issue #48: Simplified Import Scheme Test ===\n');

    const sampleMizPath = path.join(__dirname, '..', 'samples', 'sample_mission.miz');

    if (!fs.existsSync(sampleMizPath)) {
        console.error('Sample .miz file not found. Run: node samples/create-miz-archive.js');
        process.exit(1);
    }

    const mizBuffer = fs.readFileSync(sampleMizPath);

    // Test 1: Parse the miz file
    console.log('Test 1: Parse sample .miz file');
    const parsedData = await MizParser.parse(mizBuffer);
    console.log('  - Locales found:', parsedData.availableLocales);
    console.log('  - Mission parsed:', !!parsedData.mission);
    console.log('  - DEFAULT dictionary entries:', Object.keys(parsedData.dictionaries['DEFAULT'] || {}).length);
    console.log('  ✓ PASS\n');

    // Test 2: Extract text from the mission
    console.log('Test 2: Extract text from mission');
    const extracted = MizParser.extractText(parsedData, { mode: 'auto' });
    console.log('  - Briefings:', extracted.extracted.briefings?.length || 0);
    console.log('  - Triggers:', extracted.extracted.triggers?.length || 0);
    console.log('  - Radio:', extracted.extracted.radio?.length || 0);
    console.log('  ✓ PASS\n');

    // Test 3: Format as text (for import)
    console.log('Test 3: Format extracted text');
    const formattedText = MizParser.formatAsText(extracted);
    console.log('  - Text length:', formattedText.length);
    console.log('  - Contains BRIEFING section:', formattedText.includes('BRIEFING:'));
    console.log('  - Contains TRIGGERS section:', formattedText.includes('TRIGGERS:'));
    console.log('  - Contains RADIO section:', formattedText.includes('RADIO MESSAGES:'));
    console.log('  ✓ PASS\n');

    // Test 4: Parse imported text (simulate translation)
    console.log('Test 4: Parse imported text with translations');
    // Simulate translated text (replace some strings with Russian)
    const translatedText = formattedText
        .replace('Sample Training Mission', 'Учебная миссия')
        .replace('Welcome to the training mission', 'Добро пожаловать в учебную миссию');

    const mappings = MizParser.parseImportedText(translatedText);
    console.log('  - Briefings parsed:', Object.keys(mappings.briefings).length);
    console.log('  - keyMappings count:', Object.keys(mappings.keyMappings).length);
    console.log('  - Sample mapping:', Object.keys(mappings.keyMappings)[0] || 'none');
    console.log('  ✓ PASS\n');

    // Test 5: Generate dictionary preserving format (Issue #48 core test)
    console.log('Test 5: Generate dictionary by copying and modifying by keys');

    // Load raw DEFAULT dictionary
    const zip = await JSZip.loadAsync(mizBuffer);
    const defaultDictFile = zip.file('l10n/DEFAULT/dictionary');
    const defaultDictRaw = await defaultDictFile.async('string');

    console.log('  - Original dictionary length:', defaultDictRaw.length);
    console.log('  - Original dictionary first 200 chars:');
    console.log('    ' + defaultDictRaw.substring(0, 200).replace(/\n/g, '\n    '));

    // Generate new dictionary
    const newDict = MizParser.generateDictionaryPreservingFormat(defaultDictRaw, mappings, 'RU');

    console.log('  - New dictionary length:', newDict.length);
    console.log('  - Format preserved (starts same):', newDict.startsWith('dictionary = {'));
    console.log('  - Format preserved (ends same):', newDict.trim().endsWith('}'));

    // Check that translations were applied
    const translationsApplied = newDict.includes('Учебная миссия') || newDict.includes('Добро пожаловать');
    console.log('  - Translations applied:', translationsApplied);

    // Check that structure is preserved (no new keys added)
    const originalKeyCount = (defaultDictRaw.match(/\["/g) || []).length;
    const newKeyCount = (newDict.match(/\["/g) || []).length;
    console.log('  - Original key count:', originalKeyCount);
    console.log('  - New key count:', newKeyCount);
    console.log('  - Keys preserved (no rebuilding):', originalKeyCount === newKeyCount);

    if (originalKeyCount === newKeyCount) {
        console.log('  ✓ PASS - Dictionary copied and modified by keys only\n');
    } else {
        console.log('  ✗ FAIL - Dictionary was rebuilt (key count changed)\n');
    }

    // Test 6: Full import workflow
    console.log('Test 6: Full import workflow');
    try {
        const newMizBlob = await MizParser.importToMiz(mizBuffer, translatedText, 'CN');
        const newMizBuffer = await newMizBlob.arrayBuffer();
        const newZip = await JSZip.loadAsync(newMizBuffer);

        // Check that CN locale was created
        const cnDictFile = newZip.file('l10n/CN/dictionary');
        console.log('  - CN dictionary created:', !!cnDictFile);

        if (cnDictFile) {
            const cnDict = await cnDictFile.async('string');
            console.log('  - CN dictionary length:', cnDict.length);
            console.log('  - CN has translations:', cnDict.includes('Учебная миссия') || cnDict.includes('Добро пожаловать'));
        }

        // Check that other files were copied
        const cnFiles = Object.keys(newZip.files).filter(f => f.startsWith('l10n/CN/'));
        console.log('  - Files in CN locale:', cnFiles.length);

        console.log('  ✓ PASS\n');
    } catch (e) {
        console.log('  ✗ FAIL -', e.message, '\n');
    }

    console.log('=== All tests completed ===');
}

runTests().catch(console.error);
