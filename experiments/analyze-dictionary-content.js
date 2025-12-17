/**
 * Analyze dictionary content to understand what should be extracted
 * This helps us understand the structure and prepare for the new parser
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function analyzeDictionaryContent() {
    console.log('Analyzing dictionary content from test mission...\n');

    const mizPath = path.join(__dirname, 'test_mission_with_radio.miz');

    if (!fs.existsSync(mizPath)) {
        console.error('Test mission file not found:', mizPath);
        return;
    }

    const mizBuffer = fs.readFileSync(mizPath);
    const zip = await JSZip.loadAsync(mizBuffer);

    // Extract and show DEFAULT dictionary
    console.log('=== DEFAULT Dictionary ===');
    const defaultDict = zip.file('l10n/DEFAULT/dictionary');
    if (defaultDict) {
        const content = await defaultDict.async('string');
        console.log(content);
        console.log('\n');

        // Parse it to understand structure
        const LuaParser = require('../src/lua-parser.js');
        const parsed = LuaParser.parse(content);
        console.log('Parsed dictionary keys:');
        console.log(Object.keys(parsed));
        console.log('\n');
        console.log('Full parsed dictionary:');
        console.log(JSON.stringify(parsed, null, 2));
    } else {
        console.log('No DEFAULT dictionary found');
    }

    console.log('\n=== Mission File Snippet ===');
    const missionFile = zip.file('mission');
    if (missionFile) {
        const content = await missionFile.async('string');

        // Show relevant parts
        console.log('Mission file contains these top-level keys (first 1000 chars):');
        console.log(content.substring(0, 1000));
    }
}

analyzeDictionaryContent().catch(console.error);
