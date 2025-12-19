/**
 * Test to reproduce Issue #36: Dictionary build problems
 *
 * Issue states:
 * 1. Dictionary file doesn't build with original line arrangement
 * 2. There are small artifacts present
 * 3. Briefing and mission name are being added to the end of file (shouldn't be there)
 * 4. If text was taken from a file, it should be returned to the same file
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// Load the parser modules
const LuaParser = require('../src/lua-parser.js');
const MizParser = require('../src/miz-parser.js');

async function testIssue36() {
    console.log('=== TEST: Issue #36 Reproduction ===\n');

    const mizPath = path.join(__dirname, 'test_mission_with_radio.miz');

    if (!fs.existsSync(mizPath)) {
        console.error('Test mission file not found:', mizPath);
        return;
    }

    const mizBuffer = fs.readFileSync(mizPath);

    // Step 1: Parse the original MIZ
    console.log('Step 1: Parse original MIZ file');
    const parsedData = await MizParser.parse(mizBuffer);
    console.log(`  Found ${parsedData.availableLocales.length} locales:`, parsedData.availableLocales);

    // Step 2: Extract text
    console.log('\nStep 2: Extract text from mission');
    const extracted = MizParser.extractText(parsedData, {
        mode: 'auto',
        preferredLocale: 'DEFAULT'
    });
    console.log(`  Extracted strings:`);
    console.log(`    Briefings: ${extracted.extracted.briefings?.length || 0}`);
    console.log(`    Triggers: ${extracted.extracted.triggers?.length || 0}`);
    console.log(`    Radio: ${extracted.extracted.radio?.length || 0}`);

    // Step 3: Format as text (export)
    console.log('\nStep 3: Format as text for export');
    const exportedText = MizParser.formatAsText(extracted);
    console.log('Exported text preview (first 500 chars):');
    console.log(exportedText.substring(0, 500));

    // Step 4: Save original DEFAULT dictionary for comparison
    console.log('\nStep 4: Read original DEFAULT dictionary');
    const zip = await JSZip.loadAsync(mizBuffer);
    const defaultDictFile = zip.file('l10n/DEFAULT/dictionary');
    const originalDefaultDict = await defaultDictFile.async('string');

    console.log('Original DEFAULT dictionary:');
    console.log(originalDefaultDict);
    console.log('\n');

    // Parse to get structure
    const parsedDefaultDict = LuaParser.parse(originalDefaultDict);
    console.log('Original DEFAULT dictionary keys:', Object.keys(parsedDefaultDict));
    console.log('Total keys in DEFAULT:', Object.keys(parsedDefaultDict).length);

    // Step 5: Simulate user translation
    console.log('\nStep 5: Simulate user translation');
    const translatedText = exportedText
        .replace(/Test Mission/g, 'Тестовая миссия')
        .replace(/This is a test/g, 'Это тест');

    console.log('User provides translated text...');

    // Step 6: Import back to MIZ
    console.log('\nStep 6: Import translated text back to MIZ');
    const newMizBlob = await MizParser.importToMiz(
        mizBuffer,
        translatedText,
        'RU',
        (progress, message) => {
            if (progress % 20 === 0) {
                console.log(`  [${progress}%] ${message}`);
            }
        }
    );

    // Step 7: Extract and analyze the RU dictionary
    console.log('\nStep 7: Analyze generated RU dictionary');

    // Convert Blob to ArrayBuffer in Node.js
    const newMizBuffer = await newMizBlob.arrayBuffer();
    const newZip = await JSZip.loadAsync(newMizBuffer);
    const ruDictFile = newZip.file('l10n/RU/dictionary');

    if (!ruDictFile) {
        console.error('❌ ERROR: No RU dictionary found in generated MIZ!');
        return;
    }

    const ruDictContent = await ruDictFile.async('string');
    console.log('Generated RU dictionary:');
    console.log(ruDictContent);
    console.log('\n');

    // Parse to get structure
    const parsedRuDict = LuaParser.parse(ruDictContent);
    console.log('Generated RU dictionary keys:', Object.keys(parsedRuDict));
    console.log('Total keys in RU:', Object.keys(parsedRuDict).length);

    // Step 8: Verify issues from #36
    console.log('\n=== VERIFICATION: Issue #36 Checks ===');

    // Check 1: Line arrangement (key order should match DEFAULT)
    console.log('\n1. Check line arrangement (key order):');
    const defaultKeys = Object.keys(parsedDefaultDict);
    const ruKeys = Object.keys(parsedRuDict);

    // Find non-translatable keys that should be in same positions
    const nonTranslatableKeys = defaultKeys.filter(k =>
        !k.includes('sortie') &&
        !k.includes('description') &&
        !k.includes('ActionText') &&
        !k.includes('Radio') &&
        !k.includes('subtitle')
    );

    console.log(`  Non-translatable keys in DEFAULT: ${nonTranslatableKeys.length}`);
    console.log(`  Sample non-translatable keys:`, nonTranslatableKeys.slice(0, 5));

    let orderPreserved = true;
    for (let i = 0; i < Math.min(5, nonTranslatableKeys.length); i++) {
        const key = nonTranslatableKeys[i];
        const defaultIndex = defaultKeys.indexOf(key);
        const ruIndex = ruKeys.indexOf(key);

        if (defaultIndex !== ruIndex) {
            console.log(`  ❌ Key ${key} moved: DEFAULT index ${defaultIndex} -> RU index ${ruIndex}`);
            orderPreserved = false;
        } else {
            console.log(`  ✓ Key ${key} at index ${defaultIndex}`);
        }
    }

    if (orderPreserved) {
        console.log('  ✓ Order preserved for non-translatable keys');
    }

    // Check 2: Artifacts (look for unexpected characters or formatting)
    console.log('\n2. Check for artifacts:');
    const artifacts = [];

    // Check for double escaping
    if (ruDictContent.includes('\\\\n') && !originalDefaultDict.includes('\\\\n')) {
        artifacts.push('Double-escaped newlines found');
    }

    // Check for unexpected quotes
    if (ruDictContent.includes('\\"\\')) {
        artifacts.push('Double-escaped quotes found');
    }

    if (artifacts.length > 0) {
        console.log('  ❌ Artifacts found:', artifacts);
    } else {
        console.log('  ✓ No obvious artifacts detected');
    }

    // Check 3: Briefing and mission name at end of file
    console.log('\n3. Check briefing/mission at end of file:');
    const ruDictLines = ruDictContent.split('\n');
    const lastEntries = ruDictLines.slice(-15).join('\n');

    console.log('  Last 15 lines of RU dictionary:');
    console.log(lastEntries);

    // Check if briefing keys appear after the last key from DEFAULT
    const hasTrailingBriefings = lastEntries.includes('DictKey_sortie') ||
                                  lastEntries.includes('DictKey_description');

    // Get the position of briefing keys in DEFAULT
    const briefingKeysInDefault = defaultKeys.filter(k =>
        k.includes('sortie') || k.includes('description')
    );

    console.log('\n  Briefing keys in DEFAULT:', briefingKeysInDefault);

    if (briefingKeysInDefault.length === 0) {
        console.log('  ℹ No briefing keys in original DEFAULT (briefings from mission file)');

        // If briefings were added at the end, check if they should be there
        if (hasTrailingBriefings) {
            console.log('  ⚠ WARNING: Briefing keys added at end of RU dictionary');
            console.log('  This might be the issue - briefings should be in mission file, not dictionary!');
        }
    } else {
        console.log('  ✓ Briefing keys exist in DEFAULT dictionary');
    }

    // Check 4: Values preservation
    console.log('\n4. Check non-translatable string preservation:');
    let preservationOk = true;
    for (const key of nonTranslatableKeys.slice(0, 5)) {
        const defaultValue = parsedDefaultDict[key];
        const ruValue = parsedRuDict[key];

        if (defaultValue !== ruValue) {
            console.log(`  ❌ Key ${key} changed: "${defaultValue}" -> "${ruValue}"`);
            preservationOk = false;
        } else {
            console.log(`  ✓ Key ${key} preserved: "${defaultValue}"`);
        }
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    const issues = [];

    if (!orderPreserved) issues.push('Line arrangement not preserved');
    if (artifacts.length > 0) issues.push('Artifacts detected');
    if (hasTrailingBriefings && briefingKeysInDefault.length === 0) {
        issues.push('Briefings incorrectly added to dictionary end');
    }
    if (!preservationOk) issues.push('Non-translatable strings not preserved');

    if (issues.length === 0) {
        console.log('✅ All checks passed! No issues detected.');
    } else {
        console.log('❌ Issues found:');
        issues.forEach(issue => console.log(`  - ${issue}`));
    }
}

testIssue36().catch(console.error);
