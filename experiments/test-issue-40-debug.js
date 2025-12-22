/**
 * Debug script to trace issue #40 - dictionary generation
 */

const fs = require('fs');
const MizParser = require('../src/miz-parser.js');
const LuaParser = require('../src/lua-parser.js');

async function debugDictionaryGeneration() {
    console.log('=== Debugging Dictionary Generation ===\n');

    // Read the DEFAULT dictionary raw content
    const defaultDictRaw = `dictionary =
{
    ["DictKey_MissionStart"] = "Welcome to the training mission. All pilots report to your assigned aircraft.",
    ["DictKey_ObjectiveComplete"] = "Excellent work! All objectives have been completed. Return to base.",
    ["DictKey_Warning"] = "Warning: Enemy aircraft detected. All fighters scramble immediately.",
    ["DictKey_RadioCall1"] = "Overlord, Eagle Flight checking in, on station at Angels 25.",
    ["DictKey_RadioCall2"] = "Eagle Flight, Overlord, copy. Maintain CAP pattern and await further instructions.",
}`;

    console.log('=== Default Dictionary Raw ===');
    console.log(defaultDictRaw);
    console.log();

    // Simulate imported text with translations
    const importedText = `БРИФИНГ: / BRIEFING:

Briefing_Mission: ИЗМЕНЁННАЯ МИССИЯ

ТРИГГЕРЫ: / TRIGGERS:

DictKey_MissionStart: ПЕРЕВЕДЕНО - Добро пожаловать!
DictKey_ObjectiveComplete: ПЕРЕВЕДЕНО - Отлично!
DictKey_Warning: ПЕРЕВЕДЕНО - Внимание!

РАДИОСООБЩЕНИЯ: / RADIO MESSAGES:

DictKey_RadioCall1: ПЕРЕВЕДЕНО - Оверлорд!
DictKey_RadioCall2: ПЕРЕВЕДЕНО - Игл!`;

    console.log('=== Imported Text ===');
    console.log(importedText);
    console.log();

    // Parse imported text
    console.log('=== Parsing Imported Text ===');
    const mappings = MizParser.parseImportedText(importedText);
    console.log('Parsed mappings:', JSON.stringify(mappings, null, 2));
    console.log();

    // Check keyMappings
    console.log('=== Key Mappings Check ===');
    console.log('keyMappings:', mappings.keyMappings);
    console.log('Number of keyMappings:', Object.keys(mappings.keyMappings).length);
    console.log();

    // Generate dictionary with translation
    console.log('=== Generating Dictionary ===');
    const result = MizParser.generateDictionaryPreservingFormat(defaultDictRaw, mappings, 'RU');
    console.log('Generated RU dictionary:');
    console.log(result);
    console.log();

    // Verify translations were applied
    console.log('=== Verification ===');
    if (result.includes('ПЕРЕВЕДЕНО')) {
        console.log('✓ Translations were applied');
    } else {
        console.log('✗ Translations were NOT applied');

        // Debug the regex pattern
        console.log('\n=== Regex Debug ===');
        const entryPattern = /(\[["']([^"']+)["']\]\s*=\s*)["']((?:[^"'\\]|\\.)*)["']/g;

        let match;
        while ((match = entryPattern.exec(defaultDictRaw)) !== null) {
            console.log('Match:', {
                full: match[0].substring(0, 60) + '...',
                prefix: match[1],
                key: match[2],
                value: match[3].substring(0, 30) + '...'
            });

            // Check if this key is in translations
            if (mappings.keyMappings[match[2]]) {
                console.log('  -> Should be replaced with:', mappings.keyMappings[match[2]].substring(0, 30));
            }
        }
    }

    console.log('\n=== Debug Complete ===');
}

debugDictionaryGeneration().catch(console.error);
