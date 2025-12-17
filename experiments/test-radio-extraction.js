/**
 * Experiment: Test radio message extraction
 */

const fs = require('fs');
const path = require('path');

// Make modules available
const LuaParser = require('../src/lua-parser.js');
global.LuaParser = LuaParser;
global.JSZip = require('jszip');

const MizParser = require('../src/miz-parser.js');

async function testRadioExtraction() {
    console.log('=== Testing Radio Message Extraction ===\n');

    const mizPath = path.join(__dirname, 'test_mission_with_radio.miz');

    if (!fs.existsSync(mizPath)) {
        console.error('Test .miz file not found. Run: node create-mission-with-radio.js');
        process.exit(1);
    }

    console.log('Loading .miz file:', mizPath);
    const mizBuffer = fs.readFileSync(mizPath);

    // Parse the .miz file
    const parsedData = await MizParser.parse(mizBuffer);

    console.log('\n=== Mission Structure ===');
    console.log('Has trigrules:', !!parsedData.mission?.trigrules);

    if (parsedData.mission?.trigrules) {
        const rules = Array.isArray(parsedData.mission.trigrules)
            ? parsedData.mission.trigrules
            : Object.values(parsedData.mission.trigrules);

        console.log('Number of trigger rules:', rules.length);
        console.log('\nTrigger rule details:');
        rules.forEach((rule, index) => {
            console.log(`\nRule ${index + 1}:`);
            console.log('  Comment:', rule.comment);
            if (rule.actions) {
                const actions = Array.isArray(rule.actions) ? rule.actions : Object.values(rule.actions);
                actions.forEach((action, actIdx) => {
                    console.log(`  Action ${actIdx + 1}:`);
                    console.log('    ID:', action.id);
                    console.log('    text:', action.text);
                    console.log('    radioText:', action.radioText);
                    console.log('    file:', action.file);
                });
            }
        });
    }

    // Test extraction
    console.log('\n=== AUTO MODE EXTRACTION ===');
    const autoResult = MizParser.extractText(parsedData, { mode: 'auto' });

    console.log('Stats:', autoResult.stats);
    console.log('\nValidation:');
    console.log('  Is Complete:', autoResult.validation.isComplete);
    console.log('  Errors:', autoResult.validation.errors);
    console.log('  Warnings:', autoResult.validation.warnings);

    for (const [category, items] of Object.entries(autoResult.extracted)) {
        console.log(`\n--- ${category.toUpperCase()} (${items.length} items) ---`);
        items.forEach((item, index) => {
            console.log(`  ${index + 1}. [${item.context}] ${item.text}`);
        });
    }

    // Format as text
    console.log('\n=== TEXT OUTPUT FORMAT ===');
    const textOutput = MizParser.formatAsText(autoResult);
    console.log(textOutput);
}

testRadioExtraction().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
