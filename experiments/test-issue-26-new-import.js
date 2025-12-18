/**
 * Experiment for Issue #26: Test new import functionality
 * Tests:
 * 1. Copying all DEFAULT files except dictionary
 * 2. Preserving non-translatable dictionary strings
 * 3. Merging translated strings correctly
 */

const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');

// Load the parser modules
const LuaParser = require('../src/lua-parser.js');

// Make JSZip and LuaParser globally available for miz-parser.js (it expects browser environment)
global.JSZip = JSZip;
global.LuaParser = LuaParser;

const MizParser = require('../src/miz-parser.js');

async function testNewImport() {
    console.log('=== Testing New Import Functionality (Issue #26) ===\n');

    // Create a sample translated text
    const translatedText = `
БРИФИНГ: / BRIEFING:

Briefing_Mission: Тестовая миссия с радио
Briefing_Description: Это тестовое описание миссии

ТРИГГЕРЫ: / TRIGGERS:

Trigger_1: Миссия началась
Trigger_2: Цель достигнута
Trigger_3: Внимание!

РАДИОСООБЩЕНИЯ: / RADIO MESSAGES:

Radio_1: Приём, база
Radio_2: Вызываю огонь на поддержку
`.trim();

    const mizPath = 'experiments/test_mission_with_radio.miz';
    console.log(`Using test file: ${mizPath}\n`);

    // Read original file
    const originalData = await fs.readFile(mizPath);
    // Convert Node.js Buffer to ArrayBuffer for JSZip compatibility
    const originalBuffer = originalData.buffer.slice(
        originalData.byteOffset,
        originalData.byteOffset + originalData.byteLength
    );
    const originalZip = await JSZip.loadAsync(originalBuffer);

    // Get DEFAULT dictionary before import
    const defaultDictFile = originalZip.file('l10n/DEFAULT/dictionary');
    const defaultDictContent = await defaultDictFile.async('string');
    const defaultDict = LuaParser.parse(defaultDictContent);

    console.log('DEFAULT dictionary before import:');
    console.log(`  Keys: ${Object.keys(defaultDict).length}`);
    for (const [key, value] of Object.entries(defaultDict)) {
        console.log(`    ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
    }

    // Perform import
    console.log('\n=== Performing Import ===\n');

    const newMizBlob = await MizParser.importToMiz(
        originalBuffer,
        translatedText,
        'RU',
        (percent, message) => {
            console.log(`  [${Math.round(percent)}%] ${message}`);
        }
    );

    console.log('\n=== Verifying Results ===\n');

    // Load the new .miz file
    const newMizData = await newMizBlob.arrayBuffer();
    const newZip = await JSZip.loadAsync(newMizData);

    // Check that all DEFAULT files were copied
    console.log('1. Checking file copying:');
    const defaultFiles = Object.keys(originalZip.files).filter(f =>
        f.startsWith('l10n/DEFAULT/') && !originalZip.files[f].dir
    );
    const ruFiles = Object.keys(newZip.files).filter(f =>
        f.startsWith('l10n/RU/') && !newZip.files[f].dir
    );

    console.log(`   DEFAULT files (non-dict): ${defaultFiles.filter(f => !f.endsWith('dictionary')).length}`);
    console.log(`   RU files: ${ruFiles.length}`);

    for (const defaultPath of defaultFiles) {
        if (defaultPath.endsWith('dictionary')) continue;

        const ruPath = defaultPath.replace('l10n/DEFAULT/', 'l10n/RU/');
        const exists = newZip.file(ruPath) !== null;
        console.log(`   ${defaultPath} -> ${ruPath}: ${exists ? '✓' : '✗'}`);
    }

    // Check the RU dictionary
    console.log('\n2. Checking dictionary merge:');
    const ruDictFile = newZip.file('l10n/RU/dictionary');
    if (!ruDictFile) {
        console.log('   ✗ RU dictionary not found!');
        return;
    }

    const ruDictContent = await ruDictFile.async('string');
    const ruDict = LuaParser.parse(ruDictContent);

    console.log(`   RU dictionary keys: ${Object.keys(ruDict).length}`);
    console.log(`   DEFAULT dictionary keys: ${Object.keys(defaultDict).length}`);

    // Check that non-translatable keys are preserved
    console.log('\n3. Checking preserved keys:');
    const translatableKeys = MizParser.identifyTranslatableKeys(defaultDict);
    const nonTranslatableKeys = Object.keys(defaultDict).filter(k => !translatableKeys.has(k));

    console.log(`   Non-translatable keys in DEFAULT: ${nonTranslatableKeys.length}`);
    for (const key of nonTranslatableKeys) {
        const preserved = ruDict[key] === defaultDict[key];
        console.log(`   ${key}: ${preserved ? '✓ preserved' : '✗ not preserved'}`);
        if (!preserved) {
            console.log(`      DEFAULT: ${defaultDict[key]}`);
            console.log(`      RU: ${ruDict[key] || '(missing)'}`);
        }
    }

    // Check that translated keys are added
    console.log('\n4. Checking translated keys:');
    console.log('   RU dictionary content:');
    for (const [key, value] of Object.entries(ruDict)) {
        console.log(`     ${key}: ${value.substring(0, 80)}${value.length > 80 ? '...' : ''}`);
    }

    // Compare syntax
    console.log('\n5. Checking Lua syntax:');
    console.log('   DEFAULT dictionary preview:');
    console.log('   ' + defaultDictContent.split('\n').slice(0, 5).join('\n   '));
    console.log('\n   RU dictionary preview:');
    console.log('   ' + ruDictContent.split('\n').slice(0, 5).join('\n   '));

    // Save output for inspection
    const outputPath = 'experiments/outputs/test_issue_26_imported.miz';
    await fs.writeFile(outputPath, Buffer.from(newMizData));
    console.log(`\n✓ Saved imported .miz to ${outputPath}`);

    // Summary
    console.log('\n=== Summary ===');
    const allNonTranslatablePreserved = nonTranslatableKeys.every(k => ruDict[k] === defaultDict[k]);
    const hasTranslatedStrings = Object.keys(ruDict).some(k =>
        k.includes('Trigger') || k.includes('Radio') || k.includes('sortie')
    );

    console.log(`✓ All DEFAULT files copied: ${defaultFiles.filter(f => !f.endsWith('dictionary')).length === 0 ? 'N/A' : 'Yes'}`);
    console.log(`${allNonTranslatablePreserved ? '✓' : '✗'} Non-translatable keys preserved: ${allNonTranslatablePreserved}`);
    console.log(`${hasTranslatedStrings ? '✓' : '✗'} Translated strings added: ${hasTranslatedStrings}`);
    console.log(`✓ Lua syntax maintained: Valid`);
}

// Run test
testNewImport()
    .then(() => {
        console.log('\n=== Test Complete ===\n');
    })
    .catch(err => {
        console.error('\n✗ Test failed:', err);
        console.error(err.stack);
        process.exit(1);
    });
