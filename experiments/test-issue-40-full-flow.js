/**
 * Test the FULL flow of issue #40
 * Problem: After export/import, RU locale shows DEFAULT values instead of translated
 */

const fs = require('fs');
const MizParser = require('../src/miz-parser.js');
const JSZip = require('jszip');

async function testFullFlow() {
    console.log('=== Testing Full Issue #40 Flow ===\n');

    const mizPath = './experiments/test_mission_with_radio.miz';
    const mizBuffer = fs.readFileSync(mizPath);

    // Step 1: Parse and extract DEFAULT text
    console.log('Step 1: Parse and extract DEFAULT text...');
    const parsedData = await MizParser.parse(mizBuffer);

    const extractionDefault = MizParser.extractText(parsedData, {
        mode: 'auto',
        preferredLocale: 'DEFAULT'
    });
    const defaultText = MizParser.formatAsText(extractionDefault);
    console.log('Exported DEFAULT text:\n', defaultText);

    // Step 2: Parse the exported text
    console.log('\n\nStep 2: Parsing the exported text...');
    const mappings = MizParser.parseImportedText(defaultText);
    console.log('keyMappings:', mappings.keyMappings);
    console.log('briefings:', mappings.briefings);
    console.log('triggers:', mappings.triggers);
    console.log('radio:', mappings.radio);

    // Step 3: Read the raw DEFAULT dictionary
    console.log('\n\nStep 3: Reading raw DEFAULT dictionary...');
    const zip = await JSZip.loadAsync(mizBuffer);
    const defaultDictFile = zip.file('l10n/DEFAULT/dictionary');
    const defaultDictRaw = await defaultDictFile.async('string');
    console.log('Raw DEFAULT dictionary:\n', defaultDictRaw);

    // Step 4: Generate dictionary with the SAME text (no changes)
    console.log('\n\nStep 4: Generating RU dictionary...');
    const result = MizParser.generateDictionaryPreservingFormat(defaultDictRaw, mappings, 'RU');
    console.log('Generated RU dictionary:\n', result);

    // Step 5: Verify translations
    console.log('\n\nStep 5: Verification...');

    // Check if the same values were preserved
    const originalDict = parsedData.dictionaries['DEFAULT'];
    const generatedDict = require('../src/lua-parser.js').parse(result);

    console.log('\nOriginal DEFAULT dictionary keys:', Object.keys(originalDict));
    console.log('Generated RU dictionary keys:', Object.keys(generatedDict));

    for (const key of Object.keys(originalDict)) {
        const original = originalDict[key];
        const generated = generatedDict[key];
        const keyMapping = mappings.keyMappings[key];

        console.log(`\nKey: ${key}`);
        console.log(`  Original DEFAULT: "${original?.substring(0, 50)}..."`);
        console.log(`  keyMapping value: "${keyMapping?.substring(0, 50)}..."`);
        console.log(`  Generated RU: "${generated?.substring(0, 50)}..."`);

        if (keyMapping && generated === keyMapping) {
            console.log('  ✓ Match!');
        } else if (original === generated) {
            console.log('  ≈ Same as original (no keyMapping or not changed)');
        } else {
            console.log('  ✗ Mismatch!');
        }
    }

    console.log('\n=== Test Complete ===');
}

testFullFlow().catch(console.error);
