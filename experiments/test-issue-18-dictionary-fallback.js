/**
 * Experiment: Test dictionary fallback for modern DCS missions (issue #18)
 * Tests extraction from dictionary when mission trig fields are empty
 */

const fs = require('fs');
const path = require('path');

// Make modules available
const LuaParser = require('../src/lua-parser.js');
global.LuaParser = LuaParser;
global.JSZip = require('jszip');

const MizParser = require('../src/miz-parser.js');

// Create a modern mission with EMPTY trig but data in dictionary
const modernMissionContent = `mission =
{
    ["sortie"] = "DictKey_sortie_1",
    ["descriptionText"] = "DictKey_descriptionText_1",
    ["descriptionBlueTask"] = "DictKey_descriptionBlueTask_1",
    ["triggers"] =
    {
        ["zones"] = {},
        ["triggers"] = {},  -- EMPTY triggers (typical for 2020-2025 missions)
    },
    ["trigrules"] = {},  -- EMPTY trigrules
    ["trig"] =
    {
        ["actions"] = {},  -- EMPTY actions
    },
}
`;

// Create a dictionary with the actual text
const dictionaryContent = `dictionary =
{
    -- Briefings
    ["DictKey_sortie_1"] = "Operation Desert Storm 2025",
    ["DictKey_descriptionText_1"] = "This is a modern DCS mission (2020-2025) where all text is stored in dictionary",
    ["DictKey_descriptionBlueTask_1"] = "Destroy enemy SAM sites and provide CAS for ground forces",

    -- Triggers (DictKey_ActionText_*)
    ["DictKey_ActionText_001"] = "Mission started. All pilots check in.",
    ["DictKey_ActionText_002"] = "Enemy SAM site detected at grid 1234-5678",
    ["DictKey_ActionText_003"] = "Warning: Enemy fighters inbound from north",
    ["DictKey_ActionText_004"] = "Excellent work! Primary objective complete.",
    ["DictKey_ActionText_005"] = "All aircraft RTB for debriefing",

    -- Radio subtitles (DictKey_subtitle_*)
    ["DictKey_subtitle_001"] = "Tower: Flight 123, you are cleared for takeoff runway 24.",
    ["DictKey_subtitle_002"] = "AWACS: Magic to all aircraft, picture clean, no threats.",
    ["DictKey_subtitle_003"] = "Ground Control: Viper 1-1, target destroyed. Good shooting!",
    ["DictKey_subtitle_004"] = "Lead: All callsigns, form up on me, heading 270.",

    -- Additional radio (DictKey_ActionRadioText_*)
    ["DictKey_ActionRadioText_001"] = "Tower: Wind is 240 at 15 knots, cleared to land.",
    ["DictKey_ActionRadioText_002"] = "FAC: Target marked with smoke, cleared hot.",
}
`;

async function createTestMiz(missionContent, dictionaryContent, filename) {
    const JSZip = require('jszip');
    const zip = new JSZip();

    zip.file('mission', missionContent);
    zip.file('options', 'options = {}');
    zip.file('l10n/DEFAULT/dictionary', dictionaryContent);

    const content = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    const outputPath = path.join(__dirname, 'outputs', filename);

    // Ensure outputs directory exists
    const outputDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, content);
    return outputPath;
}

async function testDictionaryFallback() {
    console.log('=== Testing Dictionary Fallback for Modern DCS Missions (Issue #18) ===\n');

    console.log('Creating test mission with:');
    console.log('  - EMPTY mission.triggers.triggers');
    console.log('  - EMPTY mission.trigrules');
    console.log('  - EMPTY mission.trig.actions');
    console.log('  - Text stored in l10n/DEFAULT/dictionary\n');

    const mizPath = await createTestMiz(modernMissionContent, dictionaryContent, 'test_issue_18.miz');
    console.log('Test .miz file created:', mizPath);

    const buffer = fs.readFileSync(mizPath);
    const parsed = await MizParser.parse(buffer);

    console.log('\n--- Mission Structure Check ---');
    console.log('Has mission.triggers:', !!parsed.mission?.triggers);
    console.log('Has mission.triggers.triggers:', !!parsed.mission?.triggers?.triggers);
    console.log('Triggers count:', Object.keys(parsed.mission?.triggers?.triggers || {}).length);
    console.log('Has mission.trigrules:', !!parsed.mission?.trigrules);
    console.log('Trigrules count:', Object.keys(parsed.mission?.trigrules || {}).length);
    console.log('Has dictionary:', !!parsed.dictionaries?.DEFAULT);

    if (parsed.dictionaries?.DEFAULT) {
        const dictKeys = Object.keys(parsed.dictionaries.DEFAULT);
        console.log('Dictionary keys count:', dictKeys.length);
        console.log('Dictionary has DictKey_ActionText_*:', dictKeys.some(k => k.startsWith('DictKey_ActionText_')));
        console.log('Dictionary has DictKey_subtitle_*:', dictKeys.some(k => k.startsWith('DictKey_subtitle_')));
        console.log('Dictionary has DictKey_ActionRadioText_*:', dictKeys.some(k => k.startsWith('DictKey_ActionRadioText_')));
    }

    const result = MizParser.extractText(parsed, { mode: 'auto' });

    console.log('\n--- Extraction Results ---');
    console.log('Briefings:', result.stats.byCategory.briefings || 0);
    console.log('Triggers:', result.stats.byCategory.triggers || 0);
    console.log('Radio:', result.stats.byCategory.radio || 0);
    console.log('Total strings:', result.stats.totalStrings);
    console.log('Unique strings:', result.stats.uniqueStrings);

    console.log('\n--- Validation ---');
    console.log('Is complete:', result.validation.isComplete);
    console.log('Errors:', result.validation.errors);
    console.log('Warnings:', result.validation.warnings);

    if (result.extracted.briefings) {
        console.log('\n--- Extracted Briefings ---');
        result.extracted.briefings.forEach((item, idx) => {
            console.log(`${idx + 1}. [${item.context}] ${item.text}`);
        });
    }

    if (result.extracted.triggers) {
        console.log('\n--- Extracted Triggers (from dictionary) ---');
        result.extracted.triggers.forEach((item, idx) => {
            console.log(`${idx + 1}. [${item.context}] ${item.text}`);
        });
    } else {
        console.log('\n--- Extracted Triggers ---');
        console.log('⚠️  NO TRIGGERS EXTRACTED - FALLBACK FAILED!');
    }

    if (result.extracted.radio) {
        console.log('\n--- Extracted Radio Messages (from dictionary) ---');
        result.extracted.radio.forEach((item, idx) => {
            console.log(`${idx + 1}. [${item.context}] ${item.text}`);
        });
    } else {
        console.log('\n--- Extracted Radio Messages ---');
        console.log('⚠️  NO RADIO MESSAGES EXTRACTED - FALLBACK FAILED!');
    }

    // Success criteria
    console.log('\n=== Test Results ===');
    const success =
        result.stats.byCategory.briefings >= 3 &&
        result.stats.byCategory.triggers >= 5 &&
        result.stats.byCategory.radio >= 6 &&
        result.validation.isComplete;

    if (success) {
        console.log('✅ SUCCESS: Dictionary fallback is working correctly!');
        console.log('   - Briefings extracted:', result.stats.byCategory.briefings);
        console.log('   - Triggers extracted from dictionary:', result.stats.byCategory.triggers);
        console.log('   - Radio messages extracted from dictionary:', result.stats.byCategory.radio);
        console.log('   - Validation shows complete:', result.validation.isComplete);
    } else {
        console.log('❌ FAILURE: Dictionary fallback is not working as expected');
        if (result.stats.byCategory.triggers === 0) {
            console.log('   - Triggers NOT extracted from dictionary (expected 5+)');
        }
        if (result.stats.byCategory.radio === 0) {
            console.log('   - Radio messages NOT extracted from dictionary (expected 6+)');
        }
        if (!result.validation.isComplete) {
            console.log('   - Validation incomplete');
        }
        process.exit(1);
    }
}

testDictionaryFallback().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
