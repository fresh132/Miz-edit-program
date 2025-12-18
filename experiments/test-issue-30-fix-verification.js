/**
 * Test to verify Issue #30 fix: Exact key preservation during export/import
 *
 * This test simulates the full export-import cycle with the fixed code
 */

const fs = require('fs');
const path = require('path');

// Load the parser modules
const LuaParser = require('../src/lua-parser.js');
const MizParser = require('../src/miz-parser.js');

console.log('=== TEST: Issue #30 Fix Verification ===\n');

// Create mock extraction result with dictionary keys
const mockExtractionResult = {
    locale: 'DEFAULT',
    extracted: {
        briefings: [
            {
                category: 'Briefing',
                context: 'Mission Name',
                text: 'Test Mission'
            }
        ],
        triggers: [
            {
                category: 'Trigger',
                context: 'DictKey_ActionText_5678',  // Note: Not in numerical order
                text: 'Second trigger text'
            },
            {
                category: 'Trigger',
                context: 'DictKey_ActionText_1234',
                text: 'First trigger text'
            }
        ],
        radio: [
            {
                category: 'Radio',
                context: 'DictKey_ActionRadioText_6709',  // Note: Not in numerical order
                text: 'F-16 SEAD - WEST DAMASCUS - 2 POINTS'
            },
            {
                category: 'Radio',
                context: 'DictKey_ActionRadioText_5466',  // This was empty in original
                text: ''
            },
            {
                category: 'Radio',
                context: 'DictKey_subtitle_6335',
                text: 'ROTOR: Lot more of them than us though.'
            }
        ]
    },
    stats: {
        totalStrings: 6,
        uniqueStrings: 6
    }
};

// Step 1: Export to TXT (with fix)
console.log('Step 1: Export to TXT with DictKey preservation');
const exportedTxt = MizParser.formatAsText(mockExtractionResult);
console.log(exportedTxt);
console.log('\n');

// Verify that DictKeys are present in the exported text
const hasDictKeys = exportedTxt.includes('DictKey_ActionText_') &&
                    exportedTxt.includes('DictKey_ActionRadioText_');
console.log(`✓ Exported text contains DictKeys: ${hasDictKeys}`);

if (!hasDictKeys) {
    console.error('❌ FAIL: Exported text does not contain DictKeys');
    process.exit(1);
}

// Step 2: Simulate user translation
console.log('\nStep 2: Simulate user translation');
const translatedTxt = exportedTxt
    .replace('Second trigger text', 'Второй текст триггера')
    .replace('First trigger text', 'Первый текст триггера')
    .replace('F-16 SEAD - WEST DAMASCUS - 2 POINTS', 'INCIRLIK ARRIVAL: Devil 1-2, descend to 3000 feet')
    .replace('ROTOR: Lot more of them than us though.', 'ROTOR: Их гораздо больше чем нас');

console.log('User translates the file...');
console.log(translatedTxt);
console.log('\n');

// Step 3: Parse imported text (with fix)
console.log('Step 3: Parse imported text with exact key mapping');
const mappings = MizParser.parseImportedText(translatedTxt);

console.log('Parsed mappings:');
console.log('  keyMappings:', mappings.keyMappings);
console.log('  triggers (legacy array):', mappings.triggers);
console.log('  radio (legacy array):', mappings.radio);
console.log('\n');

// Verify that keyMappings contains the exact DictKey mappings
const expectedKeys = [
    'DictKey_ActionText_5678',
    'DictKey_ActionText_1234',
    'DictKey_ActionRadioText_6709',
    'DictKey_subtitle_6335'
];

let allKeysPresent = true;
for (const key of expectedKeys) {
    if (!mappings.keyMappings[key]) {
        console.error(`❌ Missing key in keyMappings: ${key}`);
        allKeysPresent = false;
    } else {
        console.log(`✓ Found key: ${key} = "${mappings.keyMappings[key]}"`);
    }
}

if (!allKeysPresent) {
    console.error('❌ FAIL: Not all expected keys found in keyMappings');
    process.exit(1);
}

// Step 4: Create mock DEFAULT dictionary
console.log('\nStep 4: Create mock DEFAULT dictionary');
const defaultDictRaw = `dictionary = {
    ["DictKey_ActionRadioText_6709"] = "F-16 SEAD - WEST DAMASCUS - 2 POINTS",
    ["DictKey_UnitName_3471"] = "Static SA342L-1",
    ["DictKey_GroupName_1988"] = "Static FARP Tent-96",
    ["DictKey_UnitName_4202"] = "Static F/A-18C Lot 20-5",
    ["DictKey_ActionRadioText_5466"] = "",
    ["DictKey_subtitle_6335"] = "ROTOR:  Lot more of them than us though.",
    ["DictKey_UnitName_3444"] = "",
    ["DictKey_ActionText_6249"] = "",
    ["DictKey_WptName_1531"] = "",
    ["DictKey_ActionText_1234"] = "First trigger text",
    ["DictKey_ActionText_5678"] = "Second trigger text",
    ["DictKey_UnitName_17"] = "Aerial-2-1",
} -- end of dictionary
`;

console.log('DEFAULT dictionary:');
console.log(defaultDictRaw);
console.log('\n');

// Step 5: Generate new dictionary with translations (with fix)
console.log('Step 5: Generate new dictionary with exact key mapping');
const newDictionary = MizParser.generateDictionaryPreservingFormat(defaultDictRaw, mappings, 'RU');

console.log('Generated RU dictionary:');
console.log(newDictionary);
console.log('\n');

// Step 6: Verify the fix
console.log('Step 6: Verify correctness of key mappings');

// Parse both dictionaries to compare
const defaultDict = LuaParser.parse(defaultDictRaw);
const newDict = LuaParser.parse(newDictionary);

// Check that translations went to the correct keys
const verifications = [
    {
        key: 'DictKey_ActionText_1234',
        expected: 'Первый текст триггера',
        description: 'First trigger should map to DictKey_ActionText_1234'
    },
    {
        key: 'DictKey_ActionText_5678',
        expected: 'Второй текст триггера',
        description: 'Second trigger should map to DictKey_ActionText_5678'
    },
    {
        key: 'DictKey_ActionRadioText_6709',
        expected: 'INCIRLIK ARRIVAL: Devil 1-2, descend to 3000 feet',
        description: 'First radio should map to DictKey_ActionRadioText_6709'
    },
    {
        key: 'DictKey_ActionRadioText_5466',
        expected: '',
        description: 'Empty radio should stay in DictKey_ActionRadioText_5466 (not filled with wrong text)'
    },
    {
        key: 'DictKey_subtitle_6335',
        expected: 'ROTOR: Их гораздо больше чем нас',
        description: 'Third radio should map to DictKey_subtitle_6335'
    },
    {
        key: 'DictKey_UnitName_3471',
        expected: 'Static SA342L-1',
        description: 'Non-translatable unit name should be preserved'
    }
];

let allCorrect = true;
for (const verification of verifications) {
    const actual = newDict[verification.key];
    const matches = actual === verification.expected;

    if (matches) {
        console.log(`✓ ${verification.description}`);
        console.log(`  ${verification.key} = "${actual}"`);
    } else {
        console.error(`❌ ${verification.description}`);
        console.error(`  Expected: "${verification.expected}"`);
        console.error(`  Got: "${actual}"`);
        allCorrect = false;
    }
}

console.log('\n=== TEST RESULT ===');
if (allCorrect) {
    console.log('✅ ALL TESTS PASSED');
    console.log('Issue #30 fix verified: Translations are now mapped to correct DictKeys!');
} else {
    console.log('❌ SOME TESTS FAILED');
    console.log('The fix may need additional work.');
    process.exit(1);
}
