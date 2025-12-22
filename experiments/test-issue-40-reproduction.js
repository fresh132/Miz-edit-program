/**
 * Test script to reproduce issue #40
 * Problem: When changing .txt file and building miz, changes don't appear in RU locale
 * The RU dictionary should contain translated text, not DEFAULT text
 */

const fs = require('fs');
const path = require('path');
const MizParser = require('../src/miz-parser.js');
const JSZip = require('jszip');

async function testIssue40() {
    console.log('=== Testing Issue #40: Import Changes Not Showing ===\n');

    const mizPath = './experiments/test_mission_with_radio.miz';
    console.log(`Using file: ${mizPath}\n`);

    // Step 1: Parse original .miz file
    console.log('Step 1: Parsing original .miz file...');
    const mizBuffer = fs.readFileSync(mizPath);
    const parsedData = await MizParser.parse(mizBuffer);

    console.log('Available locales:', parsedData.availableLocales);

    // Show original RU dictionary
    console.log('\n=== Original RU Dictionary ===');
    const originalRuDict = parsedData.dictionaries['RU'];
    for (const [key, value] of Object.entries(originalRuDict || {})) {
        console.log(`${key}: ${value.substring(0, 60)}...`);
    }

    // Step 2: Extract DEFAULT text
    console.log('\n=== Step 2: Extracting DEFAULT text ===');
    const extractionDefault = MizParser.extractText(parsedData, {
        mode: 'auto',
        preferredLocale: 'DEFAULT'
    });
    const defaultText = MizParser.formatAsText(extractionDefault);
    console.log('DEFAULT export:\n', defaultText.substring(0, 300), '\n...');

    // Step 3: Simulate user editing the text (translate to Russian)
    console.log('\n=== Step 3: Simulating user translation ===');

    // Create translated text - replacing English with Russian
    const translatedText = `БРИФИНГ: / BRIEFING:

Briefing_Mission: Тренировочная миссия (ИЗМЕНЕНО)
Briefing_Description: Это тестовая миссия DCS World для проверки редактора Miz.
Briefing_Blue: Задача синей коалиции: Выполнить все тренировочные упражнения.
Briefing_Red: Задача красной коалиции: Защитить воздушное пространство.
Briefing_Neutral: Нейтральные силы: Наблюдать и докладывать.

ТРИГГЕРЫ: / TRIGGERS:

DictKey_MissionStart: ПЕРЕВЕДЕНО - Добро пожаловать на миссию!
DictKey_ObjectiveComplete: ПЕРЕВЕДЕНО - Отличная работа! Все цели выполнены.
DictKey_Warning: ПЕРЕВЕДЕНО - Внимание: Обнаружен противник!

РАДИОСООБЩЕНИЯ: / RADIO MESSAGES:

DictKey_RadioCall1: ПЕРЕВЕДЕНО - Оверлорд, Игл на связи!
DictKey_RadioCall2: ПЕРЕВЕДЕНО - Игл, Оверлорд, принято!`;

    console.log('Translated text (sample):\n', translatedText.substring(0, 300), '\n...');

    // Step 4: Import to RU locale
    console.log('\n=== Step 4: Importing to RU locale ===');
    const importedMizBlob = await MizParser.importToMiz(
        mizBuffer,
        translatedText,
        'RU',
        (percent, msg) => console.log(`  ${percent.toFixed(0)}% - ${msg}`)
    );

    // Save imported .miz
    const importedMizPath = './experiments/outputs/issue-40-imported.miz';
    const importedBuffer = Buffer.from(await importedMizBlob.arrayBuffer());
    fs.writeFileSync(importedMizPath, importedBuffer);
    console.log(`\nSaved imported .miz to: ${importedMizPath}`);

    // Step 5: Extract and verify RU dictionary from imported .miz
    console.log('\n=== Step 5: Verifying RU dictionary in imported .miz ===');

    // Extract the zip to check raw dictionary content
    const importedZip = await JSZip.loadAsync(importedBuffer);
    const ruDictFile = importedZip.file('l10n/RU/dictionary');
    if (ruDictFile) {
        const ruDictContent = await ruDictFile.async('string');
        console.log('\nRaw RU dictionary after import:');
        console.log(ruDictContent);
    }

    // Also parse and show extracted text
    const importedParsed = await MizParser.parse(importedBuffer);
    const ruDict = importedParsed.dictionaries['RU'];

    console.log('\n=== Parsed RU Dictionary ===');
    for (const [key, value] of Object.entries(ruDict || {})) {
        console.log(`${key}: ${value.substring(0, 60)}...`);
    }

    // Step 6: Verify the fix
    console.log('\n=== Step 6: Verification Results ===');

    // Check if translations were applied
    let success = true;
    const expectedTranslations = {
        'DictKey_MissionStart': 'ПЕРЕВЕДЕНО',
        'DictKey_ObjectiveComplete': 'ПЕРЕВЕДЕНО',
        'DictKey_Warning': 'ПЕРЕВЕДЕНО',
        'DictKey_RadioCall1': 'ПЕРЕВЕДЕНО',
        'DictKey_RadioCall2': 'ПЕРЕВЕДЕНО'
    };

    for (const [key, expectedSubstring] of Object.entries(expectedTranslations)) {
        const actualValue = ruDict?.[key] || '';
        if (actualValue.includes(expectedSubstring)) {
            console.log(`✓ ${key} contains translated text`);
        } else {
            console.log(`✗ ${key} NOT translated correctly`);
            console.log(`  Expected to contain: "${expectedSubstring}"`);
            console.log(`  Actual value: "${actualValue}"`);
            success = false;
        }
    }

    if (success) {
        console.log('\n✓ SUCCESS: All translations were applied correctly!');
    } else {
        console.log('\n✗ FAILURE: Some translations were NOT applied correctly');
        console.log('This is the bug described in issue #40');
    }

    console.log('\n=== Test Complete ===');
    return success;
}

testIssue40().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
}).then(success => {
    process.exit(success ? 0 : 1);
});
