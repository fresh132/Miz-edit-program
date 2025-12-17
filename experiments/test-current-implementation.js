/**
 * Test the current parser implementation
 */

const fs = require('fs');
const path = require('path');

// Load JSZip globally (as it would be in browser)
global.JSZip = require('jszip');

// Load LuaParser globally
global.LuaParser = require('../src/lua-parser.js');

const MizParser = require('../src/miz-parser.js');

async function testCurrentImplementation() {
    console.log('Testing current parser implementation...\n');

    const mizPath = path.join(__dirname, '..', 'samples', 'sample_mission.miz');

    if (!fs.existsSync(mizPath)) {
        console.error('Sample mission file not found:', mizPath);
        return;
    }

    const mizBuffer = fs.readFileSync(mizPath);

    // Parse the .miz file
    console.log('Parsing .miz file...');
    const parsedData = await MizParser.parse(mizBuffer);

    console.log('Available locales:', parsedData.availableLocales);
    console.log('\n');

    // Extract text in auto mode (default)
    console.log('Extracting text in auto mode...');
    const extracted = MizParser.extractText(parsedData, {
        mode: 'auto',
        preferredLocale: 'DEFAULT'
    });

    console.log('\n=== EXTRACTION RESULTS ===\n');
    console.log('Locale:', extracted.locale);
    console.log('Total strings:', extracted.stats.totalStrings);
    console.log('Unique strings:', extracted.stats.uniqueStrings);
    console.log('\n');

    console.log('Stats by category:');
    console.log(JSON.stringify(extracted.stats.byCategory, null, 2));
    console.log('\n');

    // Show briefings
    if (extracted.extracted.briefings && extracted.extracted.briefings.length > 0) {
        console.log('=== BRIEFINGS ===');
        for (const item of extracted.extracted.briefings) {
            console.log(`${item.context}: ${item.text}`);
        }
        console.log('\n');
    }

    // Show triggers
    if (extracted.extracted.triggers && extracted.extracted.triggers.length > 0) {
        console.log('=== TRIGGERS ===');
        for (const item of extracted.extracted.triggers) {
            console.log(`${item.context}: ${item.text}`);
        }
        console.log('\n');
    }

    // Show radio
    if (extracted.extracted.radio && extracted.extracted.radio.length > 0) {
        console.log('=== RADIO MESSAGES ===');
        for (const item of extracted.extracted.radio) {
            console.log(`${item.context}: ${item.text}`);
        }
        console.log('\n');
    }

    // Show formatted text output
    console.log('=== FORMATTED TEXT OUTPUT ===\n');
    const formattedText = MizParser.formatAsText(extracted);
    console.log(formattedText);

    // Validation
    console.log('\n\n=== VALIDATION ===');
    console.log('Is complete:', extracted.validation.isComplete);
    console.log('Errors:', extracted.validation.errors);
    console.log('Warnings:', extracted.validation.warnings);
}

testCurrentImplementation().catch(console.error);
