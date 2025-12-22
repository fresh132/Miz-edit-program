/**
 * Unit tests for Issue #40 fix
 * Tests: updateMissionBriefings function and full import flow
 */

const fs = require('fs');
const MizParser = require('../src/miz-parser.js');
const JSZip = require('jszip');

// Test 1: updateMissionBriefings function
function testUpdateMissionBriefings() {
    console.log('Test 1: updateMissionBriefings function');

    const missionContent = `mission =
{
    ["sortie"] = "Original Mission Name",
    ["descriptionText"] = "Original description text.",
    ["descriptionBlueTask"] = "Blue task original.",
    ["descriptionRedTask"] = "Red task original.",
    ["descriptionNeutralsTask"] = "Neutral task original.",
    ["coalition"] =
    {
        ["blue"] = {},
    },
}`;

    const briefings = {
        sortie: 'Translated Mission Name',
        descriptionText: 'Translated description text.',
        descriptionBlueTask: 'Blue task translated.',
        descriptionRedTask: 'Red task translated.',
        descriptionNeutralsTask: 'Neutral task translated.'
    };

    const result = MizParser.updateMissionBriefings(missionContent, briefings);

    const tests = [
        ['sortie', 'Translated Mission Name'],
        ['descriptionText', 'Translated description text.'],
        ['descriptionBlueTask', 'Blue task translated.'],
        ['descriptionRedTask', 'Red task translated.'],
        ['descriptionNeutralsTask', 'Neutral task translated.']
    ];

    let allPassed = true;
    for (const [key, expected] of tests) {
        if (result.includes(expected)) {
            console.log(`  ✓ ${key} updated correctly`);
        } else {
            console.log(`  ✗ ${key} NOT updated`);
            console.log(`    Expected: ${expected}`);
            allPassed = false;
        }
    }

    // Check that structure is preserved
    if (result.includes('["coalition"]')) {
        console.log('  ✓ Other mission content preserved');
    } else {
        console.log('  ✗ Other mission content NOT preserved');
        allPassed = false;
    }

    console.log();
    return allPassed;
}

// Test 2: Full import flow with briefings
async function testFullImportFlow() {
    console.log('Test 2: Full import flow with briefings');

    const mizPath = './experiments/test_mission_with_radio.miz';
    if (!fs.existsSync(mizPath)) {
        console.log('  ⚠ Skipped: test file not found');
        return true;
    }

    const mizBuffer = fs.readFileSync(mizPath);

    // Parse original miz
    const originalParsed = await MizParser.parse(mizBuffer);
    const originalSortie = originalParsed.mission.sortie;
    console.log(`  Original sortie: "${originalSortie}"`);

    // Create translated export text
    const translatedText = `БРИФИНГ: / BRIEFING:

Briefing_Mission: ТЕСТ МИССИЯ ПЕРЕВЕДЕНА
Briefing_Description: Тестовое описание
Briefing_Blue: Синяя задача
Briefing_Red: Красная задача
Briefing_Neutral: Нейтральная задача

ТРИГГЕРЫ: / TRIGGERS:

DictKey_MissionStart: Перевод триггера 1
DictKey_ObjectiveComplete: Перевод триггера 2
DictKey_Warning: Перевод триггера 3

РАДИОСООБЩЕНИЯ: / RADIO MESSAGES:

DictKey_RadioCall1: Перевод радио 1
DictKey_RadioCall2: Перевод радио 2`;

    // Import
    const importedMizBlob = await MizParser.importToMiz(
        mizBuffer,
        translatedText,
        'RU',
        () => {}
    );

    const importedBuffer = Buffer.from(await importedMizBlob.arrayBuffer());

    // Verify mission file was updated
    const importedZip = await JSZip.loadAsync(importedBuffer);
    const missionFile = importedZip.file('mission');
    const missionContent = await missionFile.async('string');

    let allPassed = true;

    // Check mission file briefings
    if (missionContent.includes('ТЕСТ МИССИЯ ПЕРЕВЕДЕНА')) {
        console.log('  ✓ Mission sortie was updated');
    } else {
        console.log('  ✗ Mission sortie NOT updated');
        allPassed = false;
    }

    if (missionContent.includes('Тестовое описание')) {
        console.log('  ✓ Mission description was updated');
    } else {
        console.log('  ✗ Mission description NOT updated');
        allPassed = false;
    }

    // Check dictionary was updated
    const ruDictFile = importedZip.file('l10n/RU/dictionary');
    const ruDictContent = await ruDictFile.async('string');

    if (ruDictContent.includes('Перевод триггера 1')) {
        console.log('  ✓ RU dictionary trigger was updated');
    } else {
        console.log('  ✗ RU dictionary trigger NOT updated');
        allPassed = false;
    }

    if (ruDictContent.includes('Перевод радио 1')) {
        console.log('  ✓ RU dictionary radio was updated');
    } else {
        console.log('  ✗ RU dictionary radio NOT updated');
        allPassed = false;
    }

    // Re-parse and verify extraction works
    const reimportParsed = await MizParser.parse(importedBuffer);
    const extraction = MizParser.extractText(reimportParsed, {
        mode: 'auto',
        preferredLocale: 'RU'
    });
    const extractedText = MizParser.formatAsText(extraction);

    if (extractedText.includes('ТЕСТ МИССИЯ ПЕРЕВЕДЕНА')) {
        console.log('  ✓ Re-extracted text contains updated sortie');
    } else {
        console.log('  ✗ Re-extracted text does NOT contain updated sortie');
        allPassed = false;
    }

    console.log();
    return allPassed;
}

// Test 3: Edge cases - escaping special characters
function testEscapingSpecialChars() {
    console.log('Test 3: Escaping special characters');

    const missionContent = `mission =
{
    ["sortie"] = "Original",
}`;

    // Test with newlines and quotes
    const briefings = {
        sortie: 'Line1\nLine2 with "quotes"'
    };

    const result = MizParser.updateMissionBriefings(missionContent, briefings);

    let allPassed = true;

    // Should have escaped newline
    if (result.includes('\\n')) {
        console.log('  ✓ Newlines escaped correctly');
    } else {
        console.log('  ✗ Newlines NOT escaped');
        allPassed = false;
    }

    // Should have escaped quotes
    if (result.includes('\\"')) {
        console.log('  ✓ Quotes escaped correctly');
    } else {
        console.log('  ✗ Quotes NOT escaped');
        allPassed = false;
    }

    console.log();
    return allPassed;
}

// Run all tests
async function runAllTests() {
    console.log('=== Running Issue #40 Unit Tests ===\n');

    let allPassed = true;

    allPassed = testUpdateMissionBriefings() && allPassed;
    allPassed = testEscapingSpecialChars() && allPassed;
    allPassed = await testFullImportFlow() && allPassed;

    console.log('=== Summary ===');
    if (allPassed) {
        console.log('✓ All tests passed!');
        process.exit(0);
    } else {
        console.log('✗ Some tests failed');
        process.exit(1);
    }
}

runAllTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
