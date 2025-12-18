/**
 * Test what the current implementation generates
 */

const JSZip = require('jszip');
const fs = require('fs').promises;

// Load the parser modules
const LuaParser = require('../src/lua-parser.js');

// Make JSZip and LuaParser globally available
global.JSZip = JSZip;
global.LuaParser = LuaParser;

const MizParser = require('../src/miz-parser.js');

async function testCurrentGeneration() {
    console.log('=== Testing Current Generated Format ===\n');

    const translatedText = `
БРИФИНГ: / BRIEFING:

Briefing_Mission: Тестовая миссия
Briefing_Description: Это тестовое описание

ТРИГГЕРЫ: / TRIGGERS:

Trigger_1: Миссия началась
Trigger_2: Цель достигнута

РАДИОСООБЩЕНИЯ: / RADIO MESSAGES:

Radio_1: Приём, база
Radio_2: Вызываю огонь
`.trim();

    const mizPath = 'experiments/test_mission_with_radio.miz';
    const originalData = await fs.readFile(mizPath);
    const originalBuffer = originalData.buffer.slice(
        originalData.byteOffset,
        originalData.byteOffset + originalData.byteLength
    );

    // Perform import
    console.log('Performing import...\n');
    const newMizBlob = await MizParser.importToMiz(originalBuffer, translatedText, 'RU', () => {});

    // Load the new .miz file
    const newMizData = await newMizBlob.arrayBuffer();
    const newZip = await JSZip.loadAsync(newMizData);

    // Get the generated RU dictionary
    const ruDictFile = newZip.file('l10n/RU/dictionary');
    const ruDictContent = await ruDictFile.async('string');

    console.log('Generated RU dictionary:');
    console.log('='.repeat(80));
    console.log(ruDictContent);
    console.log('='.repeat(80));

    // Also show the original for comparison
    const originalZip = await JSZip.loadAsync(originalBuffer);
    const defaultDictFile = originalZip.file('l10n/DEFAULT/dictionary');
    const defaultDictContent = await defaultDictFile.async('string');

    console.log('\nOriginal DEFAULT dictionary:');
    console.log('='.repeat(80));
    console.log(defaultDictContent);
    console.log('='.repeat(80));
}

testCurrentGeneration()
    .then(() => console.log('\n=== Done ==='))
    .catch(err => {
        console.error('Error:', err);
        console.error(err.stack);
        process.exit(1);
    });
