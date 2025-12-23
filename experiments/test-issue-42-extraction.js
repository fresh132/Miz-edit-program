/**
 * Test script to understand current extraction behavior for issue #42
 * Issue: Need to filter out unnecessary data like DictKey_ActionRadioText_ and
 * change display format from "key: value" to "[RADIO]" or "[TRIGGER]" labels
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// Load modules
const LuaParser = require('../src/lua-parser.js');
const MizParser = require('../src/miz-parser.js');

async function testExtraction() {
    console.log('=== Testing current extraction behavior for issue #42 ===\n');

    const mizPath = path.join(__dirname, 'test_mission_with_radio.miz');

    if (!fs.existsSync(mizPath)) {
        console.error('Test mission file not found:', mizPath);
        console.log('Creating a test mission with more realistic data...\n');
        await createTestMission();
        return;
    }

    const mizBuffer = fs.readFileSync(mizPath);

    // Parse the miz file
    const parsedData = await MizParser.parse(mizBuffer);

    console.log('Available locales:', parsedData.availableLocales);
    console.log('\nDictionary keys in DEFAULT:');
    if (parsedData.dictionaries['DEFAULT']) {
        const keys = Object.keys(parsedData.dictionaries['DEFAULT']);
        keys.forEach(k => {
            console.log(`  ${k}: "${parsedData.dictionaries['DEFAULT'][k]}"`);
        });
    }

    // Extract text
    console.log('\n=== Extracted Text ===\n');
    const result = MizParser.extractText(parsedData, { mode: 'auto' });

    console.log('Briefings:');
    result.extracted.briefings?.forEach(item => {
        console.log(`  [${item.category}] ${item.context}: ${item.text}`);
    });

    console.log('\nTriggers:');
    result.extracted.triggers?.forEach(item => {
        console.log(`  [${item.category}] ${item.context}: ${item.text}`);
    });

    console.log('\nRadio:');
    result.extracted.radio?.forEach(item => {
        console.log(`  [${item.category}] ${item.context}: ${item.text}`);
    });

    // Format as text to see current output format
    console.log('\n=== Current Text Format Output ===\n');
    const textOutput = MizParser.formatAsText(result);
    console.log(textOutput);

    console.log('\n=== Stats ===');
    console.log(`Total strings: ${result.stats.totalStrings}`);
    console.log(`Unique strings: ${result.stats.uniqueStrings}`);
    console.log('By category:', result.stats.byCategory);
}

async function createTestMission() {
    console.log('Creating test mission with realistic DCS data patterns...\n');

    // This is a more realistic mission structure with the problematic keys mentioned in issue
    const missionContent = `mission =
{
    ["sortie"] = "DictKey_sortie_8",
    ["descriptionText"] = "DictKey_descriptionText_1",
    ["descriptionBlueTask"] = "DictKey_descriptionBlueTask_2",
    ["descriptionRedTask"] = "DictKey_descriptionRedTask_3",
    ["triggers"] =
    {
        ["triggers"] =
        {
            [1] =
            {
                ["comment"] = "Initial radio call",
                ["actions"] =
                {
                    [1] = "a_out_text_delay(getValueDictByKey(\\"DictKey_ActionText_5731\\"), 10, false)",
                    [2] = "a_radio_transmission(getValueDictByKey(\\"DictKey_ActionRadioText_1234\\"), \\"ResKey_Sound_1\\", 121.5, false)",
                },
            },
            [2] =
            {
                ["comment"] = "Warning trigger",
                ["actions"] =
                {
                    [1] = "a_out_text_delay(getValueDictByKey(\\"DictKey_ActionText_5732\\"), 10, false)",
                },
            },
        },
    },
}
`;

    // Dictionary with the problematic keys from issue #42
    const dictionaryContent = `dictionary =
{
    ["DictKey_sortie_8"] = "Training Mission Alpha",
    ["DictKey_descriptionText_1"] = "This is a comprehensive training mission.",
    ["DictKey_descriptionBlueTask_2"] = "Complete all objectives and return safely.",
    ["DictKey_descriptionRedTask_3"] = "Defend the airspace.",
    ["DictKey_ActionText_5731"] = "Proceed to waypoint 1, 20,000 feet.",
    ["DictKey_ActionText_5732"] = "Warning: Enemy aircraft approaching!",
    ["DictKey_ActionRadioText_1234"] = "JAMMER COOLING 9 MINUTE",
    ["DictKey_ActionRadioText_1235"] = "SYSTEMS CHECK COMPLETE",
    ["DictKey_subtitle_101"] = "Roger that, maintaining position.",
    ["DictKey_subtitle_102"] = "Copy, proceeding to waypoint.",
}
`;

    const zip = new JSZip();
    zip.file('mission', missionContent);
    zip.folder('l10n').folder('DEFAULT').file('dictionary', dictionaryContent);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const outputPath = path.join(__dirname, 'test_mission_issue42.miz');
    fs.writeFileSync(outputPath, zipBuffer);

    console.log('Created test mission at:', outputPath);
    console.log('\nNow testing extraction on it...\n');

    // Now test extraction on this mission
    const parsedData = await MizParser.parse(zipBuffer);

    console.log('Dictionary keys:');
    Object.entries(parsedData.dictionaries['DEFAULT'] || {}).forEach(([key, value]) => {
        console.log(`  ${key}: "${value}"`);
    });

    const result = MizParser.extractText(parsedData, { mode: 'auto' });

    console.log('\n=== Current Text Format Output ===\n');
    const textOutput = MizParser.formatAsText(result);
    console.log(textOutput);

    console.log('\n=== The Problem ===');
    console.log('As you can see, the current output shows:');
    console.log('  DictKey_ActionText_5731: Proceed to waypoint 1, 20,000 feet.');
    console.log('  DictKey_ActionRadioText_1234: JAMMER COOLING 9 MINUTE');
    console.log('');
    console.log('But the issue requests:');
    console.log('  1. Filter out unnecessary data like "JAMMER COOLING 9 MINUTE" (system messages)');
    console.log('  2. Display as [RADIO] or [TRIGGER] instead of key-value format');
}

testExtraction().catch(console.error);
