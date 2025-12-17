/**
 * Analyze how dictionary keys are referenced in the mission file
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const LuaParser = require('../src/lua-parser.js');

async function analyzeMissionReferences() {
    console.log('Analyzing mission references to dictionary keys...\n');

    const mizPath = path.join(__dirname, 'test_mission_with_radio.miz');

    if (!fs.existsSync(mizPath)) {
        console.error('Test mission file not found:', mizPath);
        return;
    }

    const mizBuffer = fs.readFileSync(mizPath);
    const zip = await JSZip.loadAsync(mizBuffer);

    // Parse mission file
    const missionFile = zip.file('mission');
    if (!missionFile) {
        console.error('No mission file found');
        return;
    }

    const missionContent = await missionFile.async('string');
    const mission = LuaParser.parse(missionContent);

    console.log('=== Mission Structure ===\n');
    console.log('Top-level keys:', Object.keys(mission));
    console.log('\n');

    // Check trigrules
    if (mission.trigrules) {
        console.log('=== Trigger Rules ===\n');
        const rules = Array.isArray(mission.trigrules) ? mission.trigrules : Object.values(mission.trigrules);

        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            console.log(`Rule ${i + 1}:`);
            console.log(`  Comment: ${rule.comment || 'N/A'}`);

            if (rule.actions) {
                const actions = Array.isArray(rule.actions) ? rule.actions : Object.values(rule.actions);
                console.log(`  Actions count: ${actions.length}`);

                for (let j = 0; j < actions.length; j++) {
                    const action = actions[j];
                    console.log(`  Action ${j + 1}:`);
                    console.log(`    ID: ${action.id || 'N/A'}`);
                    console.log(`    text: ${action.text || 'N/A'}`);
                    console.log(`    message: ${action.message || 'N/A'}`);
                    console.log(`    radioText: ${action.radioText || 'N/A'}`);
                    console.log(`    file: ${action.file || 'N/A'}`);
                }
            }
            console.log('\n');
        }
    } else {
        console.log('No trigrules found in mission\n');
    }
}

analyzeMissionReferences().catch(console.error);
