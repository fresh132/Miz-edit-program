/**
 * Test script to reproduce issue #40 - briefing update flow
 * The user says:
 * - When changing .txt file (e.g. briefing) and building miz
 * - The next time you import the built miz file, changes don't show
 * - Also when manually opening dictionary file, the structure is very broken
 */

const fs = require('fs');
const path = require('path');
const MizParser = require('../src/miz-parser.js');
const JSZip = require('jszip');

async function testBriefingUpdate() {
    console.log('=== Testing Issue #40: Briefing Update Flow ===\n');

    const mizPath = './experiments/test_mission_with_radio.miz';
    console.log(`Using file: ${mizPath}\n`);

    // Step 1: Parse original .miz file
    console.log('Step 1: Parsing original .miz file...');
    const mizBuffer = fs.readFileSync(mizPath);
    const parsedData = await MizParser.parse(mizBuffer);

    console.log('Available locales:', parsedData.availableLocales);

    // Show mission file briefing content
    console.log('\n=== Mission file briefing content ===');
    const mission = parsedData.mission;
    console.log('sortie:', mission.sortie);
    console.log('descriptionText:', mission.descriptionText?.substring(0, 80), '...');
    console.log('descriptionBlueTask:', mission.descriptionBlueTask?.substring(0, 80), '...');

    // Step 2: Extract DEFAULT text
    console.log('\n=== Step 2: Extracting DEFAULT text ===');
    const extractionDefault = MizParser.extractText(parsedData, {
        mode: 'auto',
        preferredLocale: 'DEFAULT'
    });
    const defaultText = MizParser.formatAsText(extractionDefault);
    console.log('DEFAULT export:\n', defaultText);

    // Step 3: Simulate user changing briefing text
    console.log('\n=== Step 3: Simulating user changing briefing text ===');

    // User changes the briefing mission name
    const modifiedText = defaultText.replace('Sample Training Mission', 'ИЗМЕНЕННАЯ МИССИЯ');
    console.log('Modified text:\n', modifiedText);

    // Step 4: Import to RU locale
    console.log('\n=== Step 4: Importing modified text to RU locale ===');
    const importedMizBlob = await MizParser.importToMiz(
        mizBuffer,
        modifiedText,
        'RU',
        (percent, msg) => console.log(`  ${percent.toFixed(0)}% - ${msg}`)
    );

    const importedBuffer = Buffer.from(await importedMizBlob.arrayBuffer());

    // Save imported .miz for inspection
    fs.writeFileSync('./experiments/outputs/issue-40-briefing-updated.miz', importedBuffer);
    console.log('\nSaved to: ./experiments/outputs/issue-40-briefing-updated.miz');

    // Step 5: Check dictionary structure
    console.log('\n=== Step 5: Checking dictionary structure ===');
    const importedZip = await JSZip.loadAsync(importedBuffer);

    const ruDictFile = importedZip.file('l10n/RU/dictionary');
    if (ruDictFile) {
        const ruDictContent = await ruDictFile.async('string');
        console.log('RU dictionary after import:');
        console.log(ruDictContent);

        // Check for structure issues
        console.log('\n=== Structure Analysis ===');

        // Check if it starts properly
        if (!ruDictContent.trim().startsWith('dictionary =')) {
            console.log('✗ STRUCTURE ERROR: Does not start with "dictionary ="');
        } else {
            console.log('✓ Starts with "dictionary ="');
        }

        // Check for balanced braces
        const openBraces = (ruDictContent.match(/{/g) || []).length;
        const closeBraces = (ruDictContent.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
            console.log(`✗ STRUCTURE ERROR: Unbalanced braces - { = ${openBraces}, } = ${closeBraces}`);
        } else {
            console.log(`✓ Balanced braces: ${openBraces} pairs`);
        }

        // Check for duplicate keys
        const keyMatches = ruDictContent.matchAll(/\["([^"]+)"\]/g);
        const keys = [...keyMatches].map(m => m[1]);
        const uniqueKeys = new Set(keys);
        if (keys.length !== uniqueKeys.size) {
            console.log(`✗ STRUCTURE ERROR: Duplicate keys found`);
            const seen = {};
            keys.forEach(k => {
                seen[k] = (seen[k] || 0) + 1;
            });
            Object.entries(seen).filter(([k, v]) => v > 1).forEach(([k, v]) => {
                console.log(`  Duplicate: ${k} appears ${v} times`);
            });
        } else {
            console.log(`✓ No duplicate keys (${keys.length} unique keys)`);
        }
    }

    // Step 6: Re-import the modified miz and check if changes show
    console.log('\n=== Step 6: Re-importing modified miz ===');
    const reimportParsed = await MizParser.parse(importedBuffer);

    console.log('Available locales in re-imported miz:', reimportParsed.availableLocales);

    const reExtractionRu = MizParser.extractText(reimportParsed, {
        mode: 'auto',
        preferredLocale: 'RU'
    });
    const reExtractedText = MizParser.formatAsText(reExtractionRu);

    console.log('\nRe-extracted RU text:');
    console.log(reExtractedText);

    // Check if our change appears
    console.log('\n=== Verification ===');
    if (reExtractedText.includes('ИЗМЕНЕННАЯ МИССИЯ')) {
        console.log('✓ SUCCESS: The change "ИЗМЕНЕННАЯ МИССИЯ" appears in re-extracted text');
    } else {
        console.log('✗ FAILURE: The change "ИЗМЕНЕННАЯ МИССИЯ" does NOT appear in re-extracted text');
        console.log('This is the bug described in issue #40');

        // Let's check where the sortie value comes from
        console.log('\nDebugging:');
        console.log('  Mission sortie:', reimportParsed.mission?.sortie);
        console.log('  RU dictionary has DictKey_sortie:', reimportParsed.dictionaries?.RU?.DictKey_sortie);
        console.log('  DEFAULT dictionary has DictKey_sortie:', reimportParsed.dictionaries?.DEFAULT?.DictKey_sortie);
    }

    console.log('\n=== Test Complete ===');
}

testBriefingUpdate().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
