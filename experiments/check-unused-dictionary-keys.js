/**
 * Check if there are dictionary keys not referenced in mission file
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const LuaParser = require('../src/lua-parser.js');

async function checkUnusedKeys() {
    console.log('Checking for unused dictionary keys...\n');

    const mizPath = path.join(__dirname, '..', 'samples', 'sample_mission.miz');
    const mizBuffer = fs.readFileSync(mizPath);
    const zip = await JSZip.loadAsync(mizBuffer);

    // Parse dictionary
    const dictFile = zip.file('l10n/DEFAULT/dictionary');
    const dictContent = await dictFile.async('string');
    const dictionary = LuaParser.parse(dictContent);

    const allDictKeys = Object.keys(dictionary);
    console.log('All dictionary keys:', allDictKeys);
    console.log('Total dictionary entries:', allDictKeys.length);
    console.log('\n');

    // Parse mission file
    const missionFile = zip.file('mission');
    const missionContent = await missionFile.async('string');

    // Find all dictionary key references in mission file
    const dictKeyPattern = /DictKey_\w+/g;
    const referencedKeys = [...new Set(missionContent.match(dictKeyPattern) || [])];

    console.log('Dictionary keys referenced in mission:', referencedKeys);
    console.log('Total referenced keys:', referencedKeys.length);
    console.log('\n');

    // Find unreferenced keys
    const unreferencedKeys = allDictKeys.filter(key => !referencedKeys.includes(key));

    if (unreferencedKeys.length > 0) {
        console.log('UNREFERENCED dictionary keys (in dictionary but not in mission):');
        for (const key of unreferencedKeys) {
            console.log(`  ${key}: "${dictionary[key]}"`);
        }
    } else {
        console.log('All dictionary keys are referenced in the mission file.');
    }
    console.log('\n');

    // Find referenced but missing keys
    const missingKeys = referencedKeys.filter(key => !allDictKeys.includes(key));

    if (missingKeys.length > 0) {
        console.log('MISSING dictionary keys (referenced in mission but not in dictionary):');
        for (const key of missingKeys) {
            console.log(`  ${key}`);
        }
    } else {
        console.log('All referenced keys exist in the dictionary.');
    }
}

checkUnusedKeys().catch(console.error);
