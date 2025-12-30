/**
 * Test script for Issue #50: Verify the fix for import bug with locale switching
 * Verifies that:
 * 1. When RU locale is selected, RU translations are used for keys that exist in RU
 * 2. For keys that only exist in DEFAULT, DEFAULT values are used as fallback
 * 3. Total count of extracted items is the same for all locales
 */

const fs = require('fs');
const path = require('path');

// Load dependencies
const JSZip = require('jszip');
const MizParser = require('../src/miz-parser.js');

async function runTests() {
    console.log('=== Issue #50: Verify Fix for Locale Switching ===\n');

    // Create test .miz file with both DEFAULT and RU locales
    const zip = new JSZip();

    const missionContent = `
mission = {
    ["sortie"] = "Test Mission",
    ["descriptionText"] = "DictKey_descriptionText_1",
    ["coalition"] = {},
    ["trig"] = {},
    ["trigrules"] = {}
}
`;
    zip.file('mission', missionContent);

    // DEFAULT dictionary with entries for ActionText_1 through ActionText_10
    const defaultDictEntries = [
        `    ["DictKey_descriptionText_1"] = "English description"`,
        // Entries 1-5 will be in both DEFAULT and RU
        `    ["DictKey_ActionText_1"] = "English trigger 1"`,
        `    ["DictKey_ActionText_2"] = "English trigger 2"`,
        `    ["DictKey_ActionText_3"] = "English trigger 3"`,
        `    ["DictKey_ActionText_4"] = "English trigger 4"`,
        `    ["DictKey_ActionText_5"] = "English trigger 5"`,
        // Entries 6-10 will only be in DEFAULT (fallback test)
        `    ["DictKey_ActionText_6"] = "English trigger 6"`,
        `    ["DictKey_ActionText_7"] = "English trigger 7"`,
        `    ["DictKey_ActionText_8"] = "English trigger 8"`,
        `    ["DictKey_ActionText_9"] = "English trigger 9"`,
        `    ["DictKey_ActionText_10"] = "English trigger 10"`
    ];
    const defaultDictContent = `dictionary = {\n${defaultDictEntries.join(',\n')}\n}`;
    zip.file('l10n/DEFAULT/dictionary', defaultDictContent);

    // RU dictionary with only entries 1-5 (with Russian translations)
    const ruDictEntries = [
        `    ["DictKey_descriptionText_1"] = "Описание на русском"`,
        `    ["DictKey_ActionText_1"] = "Русский триггер 1"`,
        `    ["DictKey_ActionText_2"] = "Русский триггер 2"`,
        `    ["DictKey_ActionText_3"] = "Русский триггер 3"`,
        `    ["DictKey_ActionText_4"] = "Русский триггер 4"`,
        `    ["DictKey_ActionText_5"] = "Русский триггер 5"`
    ];
    const ruDictContent = `dictionary = {\n${ruDictEntries.join(',\n')}\n}`;
    zip.file('l10n/RU/dictionary', ruDictContent);

    const mizBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const parsedData = await MizParser.parse(mizBuffer);

    console.log('Test 1: Verify total counts are equal for all locales');
    const extractedDefault = MizParser.extractText(parsedData, { preferredLocale: 'DEFAULT' });
    const extractedRU = MizParser.extractText(parsedData, { preferredLocale: 'RU' });

    console.log(`  DEFAULT: ${extractedDefault.stats.totalStrings} entries`);
    console.log(`  RU: ${extractedRU.stats.totalStrings} entries`);

    if (extractedDefault.stats.totalStrings === extractedRU.stats.totalStrings) {
        console.log('  ✓ PASS - Same number of entries for both locales\n');
    } else {
        console.log('  ✗ FAIL - Different number of entries!\n');
        process.exit(1);
    }

    console.log('Test 2: Verify RU translations are used when available');
    const ruTriggers = extractedRU.extracted.triggers || [];
    const ruTrigger1 = ruTriggers.find(t => t.context === 'DictKey_ActionText_1');

    if (ruTrigger1 && ruTrigger1.text === 'Русский триггер 1') {
        console.log(`  RU trigger 1: "${ruTrigger1.text}"`);
        console.log('  ✓ PASS - RU translation is used\n');
    } else {
        console.log(`  RU trigger 1: "${ruTrigger1?.text || 'NOT FOUND'}"`);
        console.log('  ✗ FAIL - RU translation not used!\n');
        process.exit(1);
    }

    console.log('Test 3: Verify DEFAULT fallback for missing RU entries');
    const ruTrigger6 = ruTriggers.find(t => t.context === 'DictKey_ActionText_6');

    if (ruTrigger6 && ruTrigger6.text === 'English trigger 6') {
        console.log(`  RU trigger 6 (fallback): "${ruTrigger6.text}"`);
        console.log('  ✓ PASS - DEFAULT fallback is used for missing entries\n');
    } else {
        console.log(`  RU trigger 6: "${ruTrigger6?.text || 'NOT FOUND'}"`);
        console.log('  ✗ FAIL - DEFAULT fallback not working!\n');
        process.exit(1);
    }

    console.log('Test 4: Verify all 10 triggers are extracted for RU locale');
    if (ruTriggers.length === 10) {
        console.log(`  Total triggers for RU: ${ruTriggers.length}`);
        console.log('  ✓ PASS - All 10 triggers extracted\n');
    } else {
        console.log(`  Total triggers for RU: ${ruTriggers.length}`);
        console.log('  ✗ FAIL - Expected 10 triggers!\n');
        process.exit(1);
    }

    console.log('Test 5: Verify locale is correctly reported');
    console.log(`  DEFAULT extraction locale: ${extractedDefault.locale}`);
    console.log(`  RU extraction locale: ${extractedRU.locale}`);

    if (extractedDefault.locale === 'DEFAULT' && extractedRU.locale === 'RU') {
        console.log('  ✓ PASS - Locales correctly reported\n');
    } else {
        console.log('  ✗ FAIL - Locales not correctly reported!\n');
        process.exit(1);
    }

    console.log('=== All Tests Passed! ===');
    console.log('The fix for Issue #50 is working correctly:');
    console.log('- RU translations are used when available');
    console.log('- DEFAULT values are used as fallback for missing entries');
    console.log('- Total counts are equal for all locales');
}

runTests().catch(e => {
    console.error('Test failed:', e.message);
    process.exit(1);
});
