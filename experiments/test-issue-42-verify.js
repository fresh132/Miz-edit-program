/**
 * Verify fix for issue #42:
 * 1. Filter out unnecessary data like "JAMMER COOLING 9 MINUTE"
 * 2. Display data as [RADIO] or [TRIGGER] instead of DictKey format
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// Load modules
const LuaParser = require('../src/lua-parser.js');
const MizParser = require('../src/miz-parser.js');

async function testIssue42() {
    console.log('=== Testing issue #42 fixes ===\n');

    // Create a test mission with problematic data
    console.log('1. Creating test mission with ActionRadioText system messages...\n');

    const missionContent = `mission =
{
    ["sortie"] = "Test Mission for Issue 42",
    ["descriptionText"] = "Testing extraction and filtering",
    ["descriptionBlueTask"] = "Test blue task",
    ["triggers"] =
    {
        ["triggers"] =
        {
            [1] =
            {
                ["comment"] = "Test trigger with good text",
                ["actions"] =
                {
                    [1] = "a_out_text_delay(getValueDictByKey(\\"DictKey_ActionText_5731\\"), 10, false)",
                },
            },
        },
    },
}
`;

    // Dictionary with:
    // - Good translatable content (ActionText)
    // - System messages (ActionRadioText with JAMMER, etc.)
    // - Subtitles (should be kept)
    const dictionaryContent = `dictionary =
{
    ["DictKey_ActionText_5731"] = "Proceed to waypoint 1, 20,000 feet.",
    ["DictKey_ActionText_5732"] = "Warning: Enemy aircraft approaching from the north!",
    ["DictKey_ActionRadioText_1234"] = "JAMMER COOLING 9 MINUTE",
    ["DictKey_ActionRadioText_1235"] = "SYSTEMS CHECK",
    ["DictKey_ActionRadioText_1236"] = "LOCK",
    ["DictKey_ActionRadioText_1237"] = "This is a proper radio message that should be translated",
    ["DictKey_subtitle_101"] = "Roger that, maintaining position.",
    ["DictKey_subtitle_102"] = "Copy, proceeding to waypoint.",
}
`;

    const zip = new JSZip();
    zip.file('mission', missionContent);
    zip.folder('l10n').folder('DEFAULT').file('dictionary', dictionaryContent);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Parse and extract
    const parsedData = await MizParser.parse(zipBuffer);

    console.log('2. Dictionary keys in mission:');
    Object.entries(parsedData.dictionaries['DEFAULT'] || {}).forEach(([key, value]) => {
        console.log(`   ${key}: "${value}"`);
    });

    const result = MizParser.extractText(parsedData, { mode: 'auto' });

    console.log('\n3. Testing system message filtering...');
    console.log('\n   Expected behavior:');
    console.log('   - KEEP: ActionText_5731 (translatable text)');
    console.log('   - KEEP: ActionText_5732 (translatable text)');
    console.log('   - FILTER: ActionRadioText_1234 "JAMMER COOLING 9 MINUTE" (system message)');
    console.log('   - FILTER: ActionRadioText_1235 "SYSTEMS CHECK" (system message)');
    console.log('   - FILTER: ActionRadioText_1236 "LOCK" (system message)');
    console.log('   - KEEP: ActionRadioText_1237 (actual translatable radio)');
    console.log('   - KEEP: subtitle_101, subtitle_102 (translatable subtitles)');

    console.log('\n   Extracted triggers:');
    result.extracted.triggers?.forEach(item => {
        console.log(`   ✓ [${item.context}]: ${item.text}`);
    });

    console.log('\n   Extracted radio:');
    result.extracted.radio?.forEach(item => {
        console.log(`   ✓ [${item.context}]: ${item.text}`);
    });

    console.log('\n4. Testing text output format...\n');
    const textOutput = MizParser.formatAsText(result);
    console.log('--- OUTPUT ---');
    console.log(textOutput);
    console.log('--- END ---');

    // Verify filtering works
    console.log('\n5. Verification results:');

    const hasJammerMessage = textOutput.includes('JAMMER COOLING');
    const hasSystemsCheck = textOutput.includes('SYSTEMS CHECK');
    const hasLockMessage = textOutput.toLowerCase().includes(': lock');
    const hasGoodRadioMessage = textOutput.includes('This is a proper radio message');
    const hasSubtitle = textOutput.includes('Roger that');

    console.log(`   - System message "JAMMER COOLING" filtered: ${!hasJammerMessage ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`   - System message "SYSTEMS CHECK" filtered: ${!hasSystemsCheck ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`   - System message "LOCK" filtered: ${!hasLockMessage ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`   - Good radio message kept: ${hasGoodRadioMessage ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`   - Subtitle message kept: ${hasSubtitle ? '✓ PASS' : '✗ FAIL'}`);

    // Test import parsing with new format
    console.log('\n6. Testing import parsing with new [LABEL] format...');
    const testImport = `ТРИГГЕРЫ: / TRIGGERS:

[TRIGGER_1]: This is trigger text
DictKey_ActionText_5731: This has a DictKey

РАДИОСООБЩЕНИЯ: / RADIO MESSAGES:

[RADIO_1]: Radio message text
`;

    const mappings = MizParser.parseImportedText(testImport);
    console.log(`   Parsed triggers: ${mappings.triggers.length}`);
    console.log(`   Parsed radio: ${mappings.radio.length}`);
    console.log(`   Key mappings: ${Object.keys(mappings.keyMappings).length}`);

    if (mappings.triggers.length >= 2 && mappings.radio.length >= 1) {
        console.log('   ✓ PASS: Import parsing works with new format');
    } else {
        console.log('   ✗ FAIL: Import parsing issue');
    }

    console.log('\n=== Issue #42 test complete ===');
}

testIssue42().catch(console.error);
