/**
 * Experiment to reproduce Issue #30: Wrong key mapping during import
 *
 * The problem: During export, we generate Trigger_1, Trigger_2, etc.
 * During import, we match by index to sorted dictionary keys.
 * If extraction order != sorted key order, translations go to wrong keys.
 */

// Simulate a dictionary with keys in non-sequential order
const mockDictionary = {
    "DictKey_ActionRadioText_6709": "F-16 SEAD - WEST DAMASCUS - 2 POINTS",
    "DictKey_ActionRadioText_5466": "",  // Empty in original
    "DictKey_subtitle_6335": "ROTOR: Lot more of them than us though.",
    "DictKey_ActionText_1234": "Some trigger text",
    "DictKey_ActionText_5678": "Another trigger text"
};

// Step 1: Extract (simulate _extractFromDictionary)
console.log('=== STEP 1: EXTRACTION ===');
const extracted = [];
for (const [key, value] of Object.entries(mockDictionary)) {
    if (key.includes('ActionText') || key.includes('ActionRadioText') || key.includes('subtitle')) {
        const text = value || '[EMPTY]';
        extracted.push({
            category: key.includes('Radio') || key.includes('subtitle') ? 'Radio' : 'Trigger',
            context: key,  // Original key saved here
            text: text
        });
    }
}

console.log('Extracted items:');
extracted.forEach((item, idx) => {
    console.log(`  [${idx}] ${item.context} -> "${item.text}"`);
});

// Step 2: Export to TXT (current buggy implementation)
console.log('\n=== STEP 2: EXPORT TO TXT (CURRENT - BUGGY) ===');
const txtLines = [];
let triggerIndex = 1;
let radioIndex = 1;

for (const item of extracted) {
    if (item.category === 'Trigger') {
        // BUG: We lose the original key (item.context) here!
        txtLines.push(`Trigger_${triggerIndex}: ${item.text}`);
        triggerIndex++;
    } else if (item.category === 'Radio') {
        // BUG: We lose the original key (item.context) here!
        txtLines.push(`Radio_${radioIndex}: ${item.text}`);
        radioIndex++;
    }
}

console.log('Exported TXT:');
txtLines.forEach(line => console.log(`  ${line}`));

// Step 3: User translates the TXT file
console.log('\n=== STEP 3: USER TRANSLATION ===');
const translatedTxt = [
    'Trigger_1: Translated trigger 1',
    'Radio_1: Translated radio 1',
    'Radio_2: Translated empty radio',
    'Radio_3: Translated radio 3'
];
console.log('User provides translated TXT:');
translatedTxt.forEach(line => console.log(`  ${line}`));

// Step 4: Import (current buggy implementation)
console.log('\n=== STEP 4: IMPORT (CURRENT - BUGGY) ===');
const mappings = { triggers: [], radio: [] };

for (const line of translatedTxt) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
        const [, prefix, text] = match;
        if (prefix.startsWith('Trigger_')) {
            mappings.triggers.push(text);
        } else if (prefix.startsWith('Radio_')) {
            mappings.radio.push(text);
        }
    }
}

console.log('Parsed mappings:');
console.log('  Triggers:', mappings.triggers);
console.log('  Radio:', mappings.radio);

// Step 5: Generate dictionary (current buggy implementation)
console.log('\n=== STEP 5: GENERATE DICTIONARY (CURRENT - BUGGY) ===');
const existingTriggerKeys = Object.keys(mockDictionary)
    .filter(k => k.includes('ActionText'))
    .sort();
const existingRadioKeys = Object.keys(mockDictionary)
    .filter(k => k.includes('Radio') || k.includes('subtitle'))
    .sort();

console.log('Sorted trigger keys:', existingTriggerKeys);
console.log('Sorted radio keys:', existingRadioKeys);

const translations = {};

mappings.triggers.forEach((text, index) => {
    const dictKey = existingTriggerKeys[index];
    translations[dictKey] = text;
    console.log(`  [${index}] ${dictKey} <- "${text}"`);
});

mappings.radio.forEach((text, index) => {
    const dictKey = existingRadioKeys[index];
    translations[dictKey] = text;
    console.log(`  [${index}] ${dictKey} <- "${text}"`);
});

// Step 6: Show the problem
console.log('\n=== STEP 6: THE PROBLEM ===');
console.log('Original dictionary:');
for (const [key, value] of Object.entries(mockDictionary)) {
    console.log(`  ${key} = "${value}"`);
}

console.log('\nAfter import (WRONG):');
for (const [key, value] of Object.entries(mockDictionary)) {
    const newValue = translations[key] || value;
    const changed = translations[key] ? ' [CHANGED]' : '';
    console.log(`  ${key} = "${newValue}"${changed}`);
}

console.log('\n=== PROPOSED FIX ===');
console.log('1. During export, include the DictKey in the prefix:');
console.log('   DictKey_ActionText_1234: Some trigger text');
console.log('   DictKey_ActionRadioText_6709: F-16 SEAD - WEST DAMASCUS...');
console.log('');
console.log('2. During import, parse the DictKey from the prefix:');
console.log('   DictKey_ActionText_1234: Translated trigger 1');
console.log('   -> translations["DictKey_ActionText_1234"] = "Translated trigger 1"');
console.log('');
console.log('3. This preserves exact key-to-text mapping!');
