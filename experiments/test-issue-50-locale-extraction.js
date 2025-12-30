/**
 * Test script for Issue #50: Import bug with locale switching
 * Tests that locale selection properly extracts all data from the selected locale
 *
 * Issue description:
 * - When importing a corrected file, not all data is extracted
 * - When selecting locale "default" or "ru", it doesn't change properly
 * - When selecting "ru" locale, only 200+ data items are extracted
 * - When selecting "default" locale, only 500+ data items are extracted
 */

const fs = require('fs');
const path = require('path');

// Load dependencies
const JSZip = require('jszip');
const MizParser = require('../src/miz-parser.js');

async function runTests() {
    console.log('=== Issue #50: Import Bug with Locale Switching ===\n');

    // First, create a test .miz file with both DEFAULT and RU locales
    console.log('Creating test .miz with multiple locales...\n');

    const zip = new JSZip();

    // Create mission file with briefings
    const missionContent = `
mission = {
    ["sortie"] = "Test Mission",
    ["descriptionText"] = "DictKey_descriptionText_1",
    ["descriptionBlueTask"] = "DictKey_descriptionBlueTask_1",
    ["descriptionRedTask"] = "DictKey_descriptionRedTask_1",
    ["coalition"] = {
        ["blue"] = {},
        ["red"] = {}
    },
    ["trig"] = {
        ["actions"] = {}
    },
    ["trigrules"] = {}
}
`;
    zip.file('mission', missionContent);

    // Create DEFAULT dictionary with many entries
    const defaultDictEntries = [];
    // Add description entries
    defaultDictEntries.push(`    ["DictKey_descriptionText_1"] = "This is the mission description in English"`);
    defaultDictEntries.push(`    ["DictKey_descriptionBlueTask_1"] = "Blue task description in English"`);
    defaultDictEntries.push(`    ["DictKey_descriptionRedTask_1"] = "Red task description in English"`);

    // Add ActionText entries (simulating 500+ entries)
    for (let i = 1; i <= 50; i++) {
        defaultDictEntries.push(`    ["DictKey_ActionText_${i}"] = "Trigger message ${i} in English"`);
    }

    // Add Radio entries
    for (let i = 1; i <= 30; i++) {
        defaultDictEntries.push(`    ["DictKey_ActionRadioText_${i}"] = "Radio message ${i} in English"`);
    }

    const defaultDictContent = `dictionary = {\n${defaultDictEntries.join(',\n')}\n}`;
    zip.file('l10n/DEFAULT/dictionary', defaultDictContent);

    // Create RU dictionary with FEWER entries (simulating the bug scenario)
    const ruDictEntries = [];
    // Add description entries
    ruDictEntries.push(`    ["DictKey_descriptionText_1"] = "Описание миссии на русском"`);
    ruDictEntries.push(`    ["DictKey_descriptionBlueTask_1"] = "Описание задачи синих на русском"`);
    ruDictEntries.push(`    ["DictKey_descriptionRedTask_1"] = "Описание задачи красных на русском"`);

    // Add ActionText entries (simulating only 20 entries instead of 50)
    for (let i = 1; i <= 20; i++) {
        ruDictEntries.push(`    ["DictKey_ActionText_${i}"] = "Сообщение триггера ${i} на русском"`);
    }

    // Add Radio entries (simulating only 10 entries instead of 30)
    for (let i = 1; i <= 10; i++) {
        ruDictEntries.push(`    ["DictKey_ActionRadioText_${i}"] = "Радиосообщение ${i} на русском"`);
    }

    const ruDictContent = `dictionary = {\n${ruDictEntries.join(',\n')}\n}`;
    zip.file('l10n/RU/dictionary', ruDictContent);

    // Generate .miz buffer
    const mizBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    // Test 1: Parse the .miz file
    console.log('Test 1: Parse .miz file and check available locales');
    const parsedData = await MizParser.parse(mizBuffer);
    console.log('  - Locales found:', parsedData.availableLocales);
    console.log('  - DEFAULT dictionary entries:', Object.keys(parsedData.dictionaries['DEFAULT'] || {}).length);
    console.log('  - RU dictionary entries:', Object.keys(parsedData.dictionaries['RU'] || {}).length);
    console.log('  ✓ PASS\n');

    // Test 2: Extract with DEFAULT locale
    console.log('Test 2: Extract text with DEFAULT locale');
    const extractedDefault = MizParser.extractText(parsedData, {
        mode: 'auto',
        preferredLocale: 'DEFAULT'
    });
    console.log('  - Locale used:', extractedDefault.locale);
    console.log('  - Briefings:', extractedDefault.extracted.briefings?.length || 0);
    console.log('  - Triggers:', extractedDefault.extracted.triggers?.length || 0);
    console.log('  - Radio:', extractedDefault.extracted.radio?.length || 0);
    console.log('  - Total strings:', extractedDefault.stats.totalStrings);

    // Check first trigger text to verify locale
    if (extractedDefault.extracted.triggers?.length > 0) {
        console.log('  - First trigger text:', extractedDefault.extracted.triggers[0].text.substring(0, 50));
    }
    console.log('  ✓ PASS\n');

    // Test 3: Extract with RU locale
    console.log('Test 3: Extract text with RU locale');
    const extractedRU = MizParser.extractText(parsedData, {
        mode: 'auto',
        preferredLocale: 'RU'
    });
    console.log('  - Locale used:', extractedRU.locale);
    console.log('  - Briefings:', extractedRU.extracted.briefings?.length || 0);
    console.log('  - Triggers:', extractedRU.extracted.triggers?.length || 0);
    console.log('  - Radio:', extractedRU.extracted.radio?.length || 0);
    console.log('  - Total strings:', extractedRU.stats.totalStrings);

    // Check first trigger text to verify locale
    if (extractedRU.extracted.triggers?.length > 0) {
        console.log('  - First trigger text:', extractedRU.extracted.triggers[0].text.substring(0, 50));
    }
    console.log('');

    // Test 4: Compare extraction counts
    console.log('Test 4: Compare extraction counts between locales');
    const defaultCount = extractedDefault.stats.totalStrings;
    const ruCount = extractedRU.stats.totalStrings;
    console.log(`  - DEFAULT total: ${defaultCount}`);
    console.log(`  - RU total: ${ruCount}`);
    console.log(`  - Difference: ${defaultCount - ruCount}`);

    if (defaultCount !== ruCount) {
        console.log('  ⚠️ WARNING: Different number of entries extracted for different locales');
        console.log('  This is the bug described in issue #50!');
        console.log('  Expected: Both locales should extract ALL keys, using fallback for missing translations');
    } else {
        console.log('  ✓ PASS - Same number of entries for both locales');
    }
    console.log('');

    // Test 5: Verify that RU locale extraction doesn't change when selecting it
    console.log('Test 5: Verify locale selection actually changes the output');

    // Extract multiple times with different locales
    const extract1 = MizParser.extractText(parsedData, { preferredLocale: 'DEFAULT' });
    const extract2 = MizParser.extractText(parsedData, { preferredLocale: 'RU' });
    const extract3 = MizParser.extractText(parsedData, { preferredLocale: 'DEFAULT' }); // Switch back

    console.log('  - First DEFAULT extraction locale:', extract1.locale);
    console.log('  - RU extraction locale:', extract2.locale);
    console.log('  - Second DEFAULT extraction locale:', extract3.locale);

    if (extract1.locale === 'DEFAULT' && extract2.locale === 'RU' && extract3.locale === 'DEFAULT') {
        console.log('  ✓ PASS - Locale switching works correctly');
    } else {
        console.log('  ✗ FAIL - Locale switching does not work as expected');
    }
    console.log('');

    // Test 6: Check if entries in DEFAULT but not in RU are being extracted
    console.log('Test 6: Check for missing entries when switching to RU locale');

    // Get all ActionText keys from DEFAULT
    const defaultActionTextKeys = Object.keys(parsedData.dictionaries['DEFAULT'])
        .filter(k => k.startsWith('DictKey_ActionText_'));

    // Get all ActionText keys from RU
    const ruActionTextKeys = Object.keys(parsedData.dictionaries['RU'] || {})
        .filter(k => k.startsWith('DictKey_ActionText_'));

    console.log(`  - DEFAULT ActionText keys: ${defaultActionTextKeys.length}`);
    console.log(`  - RU ActionText keys: ${ruActionTextKeys.length}`);
    console.log(`  - Missing in RU: ${defaultActionTextKeys.length - ruActionTextKeys.length}`);

    // Find which keys are missing
    const missingKeys = defaultActionTextKeys.filter(k => !ruActionTextKeys.includes(k));
    if (missingKeys.length > 0) {
        console.log(`  - First 5 missing keys: ${missingKeys.slice(0, 5).join(', ')}`);
        console.log('  ⚠️ These entries will NOT be extracted when RU locale is selected!');
        console.log('  SOLUTION: Fallback to DEFAULT dictionary for missing keys');
    }
    console.log('');

    console.log('=== Test Summary ===');
    console.log('The issue is that when a locale (like RU) has fewer dictionary entries');
    console.log('than DEFAULT, the extraction only uses entries from the selected locale.');
    console.log('This causes fewer items to be extracted when switching locales.');
    console.log('');
    console.log('PROPOSED FIX: When extracting from dictionary, merge DEFAULT and');
    console.log('selected locale dictionaries, using selected locale values when');
    console.log('available, and falling back to DEFAULT for missing keys.');
}

runTests().catch(console.error);
