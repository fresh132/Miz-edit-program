/**
 * Test to verify Issue #36 fix handles missions WITH briefings in dictionary correctly
 *
 * This test ensures that when briefings ARE in the DEFAULT dictionary,
 * they get correctly translated (not removed).
 */

const MizParser = require('../src/miz-parser.js');
const LuaParser = require('../src/lua-parser.js');

console.log('=== TEST: Missions WITH briefings in dictionary ===\n');

// Create mock DEFAULT dictionary WITH briefings
const defaultDictWithBriefings = `dictionary = {
    ["DictKey_MissionStart"] = "Welcome to the training mission.",
    ["DictKey_sortie"] = "Test Mission Name",
    ["DictKey_descriptionText"] = "This is the mission description.",
    ["DictKey_ActionText_123"] = "Trigger message 1",
    ["DictKey_ActionText_456"] = "Trigger message 2",
}
`;

// Create mock extraction result with briefings
const mockExtractionResult = {
    locale: 'DEFAULT',
    extracted: {
        briefings: [
            {
                category: 'Briefing',
                context: 'Mission Name',
                text: 'Test Mission Name'
            },
            {
                category: 'Briefing',
                context: 'Description',
                text: 'This is the mission description.'
            }
        ],
        triggers: [
            {
                category: 'Trigger',
                context: 'DictKey_ActionText_123',
                text: 'Trigger message 1'
            },
            {
                category: 'Trigger',
                context: 'DictKey_ActionText_456',
                text: 'Trigger message 2'
            }
        ],
        radio: []
    },
    stats: {
        totalStrings: 4,
        uniqueStrings: 4
    }
};

// Step 1: Export to TXT
console.log('Step 1: Export to TXT');
const exportedTxt = MizParser.formatAsText(mockExtractionResult);
console.log(exportedTxt);
console.log('\n');

// Step 2: Simulate translation
console.log('Step 2: Simulate translation');
const translatedTxt = exportedTxt
    .replace('Test Mission Name', 'Тестовое название миссии')
    .replace('This is the mission description.', 'Это описание миссии.')
    .replace('Trigger message 1', 'Сообщение триггера 1')
    .replace('Trigger message 2', 'Сообщение триггера 2');

console.log('Translated text:');
console.log(translatedTxt);
console.log('\n');

// Step 3: Parse imported text
console.log('Step 3: Parse imported text');
const mappings = MizParser.parseImportedText(translatedTxt);
console.log('Parsed mappings:');
console.log('  briefings:', mappings.briefings);
console.log('  triggers:', mappings.triggers);
console.log('\n');

// Step 4: Generate new dictionary
console.log('Step 4: Generate RU dictionary');
const ruDict = MizParser.generateDictionaryPreservingFormat(
    defaultDictWithBriefings,
    mappings,
    'RU'
);

console.log('Generated RU dictionary:');
console.log(ruDict);
console.log('\n');

// Step 5: Verify
console.log('Step 5: Verify correctness');
const parsedDefault = LuaParser.parse(defaultDictWithBriefings);
const parsedRu = LuaParser.parse(ruDict);

console.log('DEFAULT keys:', Object.keys(parsedDefault));
console.log('RU keys:', Object.keys(parsedRu));
console.log('\n');

// Check that RU has same number of keys as DEFAULT
if (Object.keys(parsedRu).length !== Object.keys(parsedDefault).length) {
    console.error('❌ FAIL: RU has different number of keys than DEFAULT');
    console.error(`  DEFAULT: ${Object.keys(parsedDefault).length}, RU: ${Object.keys(parsedRu).length}`);
    process.exit(1);
}

// Check that briefings are translated (not removed)
const checks = [
    {
        key: 'DictKey_sortie',
        expected: 'Тестовое название миссии',
        description: 'Briefing sortie should be translated'
    },
    {
        key: 'DictKey_descriptionText',
        expected: 'Это описание миссии.',
        description: 'Briefing description should be translated'
    },
    {
        key: 'DictKey_ActionText_123',
        expected: 'Сообщение триггера 1',
        description: 'Trigger 1 should be translated'
    },
    {
        key: 'DictKey_MissionStart',
        expected: 'Welcome to the training mission.',
        description: 'Non-translatable string should be preserved'
    }
];

let allPass = true;
for (const check of checks) {
    const actual = parsedRu[check.key];
    if (actual === check.expected) {
        console.log(`✓ ${check.description}`);
        console.log(`  ${check.key} = "${actual}"`);
    } else {
        console.error(`❌ ${check.description}`);
        console.error(`  Expected: "${check.expected}"`);
        console.error(`  Got: "${actual}"`);
        allPass = false;
    }
}

console.log('\n=== RESULT ===');
if (allPass) {
    console.log('✅ ALL CHECKS PASSED');
    console.log('Missions WITH briefings in dictionary are handled correctly!');
} else {
    console.error('❌ SOME CHECKS FAILED');
    process.exit(1);
}
