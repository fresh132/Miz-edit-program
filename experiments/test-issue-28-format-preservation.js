/**
 * Test Issue #28: Format preservation in imported dictionary
 * Verifies that:
 * 1. Original format is preserved (quotes, spacing, line breaks)
 * 2. Key order is maintained (no sorting)
 * 3. Non-translatable strings remain unchanged
 */

const JSZip = require('jszip');
const fs = require('fs').promises;

// Load the parser modules
const LuaParser = require('../src/lua-parser.js');

// Make JSZip and LuaParser globally available
global.JSZip = JSZip;
global.LuaParser = LuaParser;

const MizParser = require('../src/miz-parser.js');

async function testFormatPreservation() {
    console.log('=== Testing Issue #28: Format Preservation ===\n');

    const translatedText = `
БРИФИНГ: / BRIEFING:

Briefing_Mission: Тестовая миссия с радио
Briefing_Description: Это тестовое описание миссии

ТРИГГЕРЫ: / TRIGGERS:

Trigger_1: Внимание! Обнаружены вражеские самолёты
Trigger_2: Отлично! Все цели уничтожены
Trigger_3: Добро пожаловать на учебную миссию

РАДИОСООБЩЕНИЯ: / RADIO MESSAGES:

Radio_1: Оверлорд, звено Орёл на связи, высота 7500 метров
Radio_2: Звено Орёл, Оверлорд, понял. Продолжайте патрулирование
`.trim();

    const mizPath = 'experiments/test_mission_with_radio.miz';
    console.log(`Using test file: ${mizPath}\n`);

    // Read original file
    const originalData = await fs.readFile(mizPath);
    const originalBuffer = originalData.buffer.slice(
        originalData.byteOffset,
        originalData.byteOffset + originalData.byteLength
    );
    const originalZip = await JSZip.loadAsync(originalBuffer);

    // Get DEFAULT dictionary before import
    const defaultDictFile = originalZip.file('l10n/DEFAULT/dictionary');
    const defaultDictContent = await defaultDictFile.async('string');

    console.log('Original DEFAULT dictionary:');
    console.log('='.repeat(80));
    console.log(defaultDictContent);
    console.log('='.repeat(80));
    console.log();

    // Perform import
    console.log('Performing import with new format-preserving function...\n');

    const newMizBlob = await MizParser.importToMiz(
        originalBuffer,
        translatedText,
        'RU',
        (percent, message) => {
            console.log(`  [${Math.round(percent)}%] ${message}`);
        }
    );

    console.log('\n=== Verifying Results ===\n');

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
    console.log();

    // Analyze format preservation
    console.log('=== Format Analysis ===\n');

    // Check 1: Opening brace position
    const defaultHasNewlineBeforeBrace = /dictionary\s*=\s*\n\s*\{/.test(defaultDictContent);
    const ruHasNewlineBeforeBrace = /dictionary\s*=\s*\n\s*\{/.test(ruDictContent);
    console.log(`1. Opening brace on new line:`);
    console.log(`   DEFAULT: ${defaultHasNewlineBeforeBrace ? '✓' : '✗'}`);
    console.log(`   RU:      ${ruHasNewlineBeforeBrace ? '✓' : '✗'}`);
    console.log(`   Match:   ${defaultHasNewlineBeforeBrace === ruHasNewlineBeforeBrace ? '✓' : '✗'}`);
    console.log();

    // Check 2: Indentation
    const defaultIndent = defaultDictContent.match(/\n(\s+)\[/)?.[1] || '';
    const ruIndent = ruDictContent.match(/\n(\s+)\[/)?.[1] || '';
    console.log(`2. Indentation:`);
    console.log(`   DEFAULT: "${defaultIndent}" (${defaultIndent.length} spaces)`);
    console.log(`   RU:      "${ruIndent}" (${ruIndent.length} spaces)`);
    console.log(`   Match:   ${defaultIndent === ruIndent ? '✓' : '✗'}`);
    console.log();

    // Check 3: Key order (compare first 3 keys)
    const extractKeys = (content) => {
        const matches = [...content.matchAll(/\["([^"]+)"\]/g)];
        return matches.map(m => m[1]);
    };

    const defaultKeys = extractKeys(defaultDictContent);
    const ruKeys = extractKeys(ruDictContent);

    console.log(`3. Key order preservation:`);
    console.log(`   DEFAULT keys: ${defaultKeys.slice(0, 3).join(', ')}...`);
    console.log(`   RU keys:      ${ruKeys.slice(0, 3).join(', ')}...`);

    // Check if non-translatable keys appear in same order
    const nonTranslatableKeys = ['DictKey_MissionStart', 'DictKey_ObjectiveComplete', 'DictKey_Warning'];
    const defaultOrder = nonTranslatableKeys.map(k => defaultKeys.indexOf(k));
    const ruOrder = nonTranslatableKeys.map(k => ruKeys.indexOf(k));

    console.log(`   Non-translatable key positions in DEFAULT: ${defaultOrder}`);
    console.log(`   Non-translatable key positions in RU: ${ruOrder}`);

    const orderPreserved = JSON.stringify(defaultOrder) === JSON.stringify(ruOrder);
    console.log(`   Order preserved: ${orderPreserved ? '✓' : '✗'}`);
    console.log();

    // Check 4: Trailing commas
    const defaultLines = defaultDictContent.split('\n');
    const ruLines = ruDictContent.split('\n');

    const defaultHasTrailingCommas = defaultLines.some(l => l.trim().endsWith('",'));
    const ruHasTrailingCommas = ruLines.some(l => l.trim().endsWith('",'));

    console.log(`4. Trailing commas:`);
    console.log(`   DEFAULT has trailing commas: ${defaultHasTrailingCommas ? '✓' : '✗'}`);
    console.log(`   RU has trailing commas:      ${ruHasTrailingCommas ? '✓' : '✗'}`);
    console.log();

    // Check 5: Non-translatable strings preserved
    const defaultDict = LuaParser.parse(defaultDictContent);
    const ruDict = LuaParser.parse(ruDictContent);

    console.log(`5. Non-translatable strings preservation:`);
    for (const key of ['DictKey_MissionStart', 'DictKey_ObjectiveComplete', 'DictKey_Warning']) {
        const preserved = defaultDict[key] === ruDict[key];
        console.log(`   ${key}: ${preserved ? '✓ preserved' : '✗ changed'}`);
        if (!preserved) {
            console.log(`      DEFAULT: ${defaultDict[key]}`);
            console.log(`      RU:      ${ruDict[key]}`);
        }
    }
    console.log();

    // Check 6: Translated strings added
    console.log(`6. Translated strings:`);
    const translatedKeys = Object.keys(ruDict).filter(k =>
        k.includes('DictKey_sortie') ||
        k.includes('DictKey_description') ||
        k.includes('Trigger') ||
        k.includes('Radio')
    );

    for (const key of translatedKeys.slice(0, 5)) {
        console.log(`   ${key}: ${ruDict[key].substring(0, 50)}${ruDict[key].length > 50 ? '...' : ''}`);
    }
    console.log();

    // Summary
    console.log('=== Summary ===');
    const allPassed =
        defaultHasNewlineBeforeBrace === ruHasNewlineBeforeBrace &&
        defaultIndent === ruIndent &&
        orderPreserved &&
        ruHasTrailingCommas;

    console.log(`Overall: ${allPassed ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED'}`);

    if (allPassed) {
        console.log('✓ Format preservation working correctly!');
    } else {
        console.log('✗ Format preservation needs adjustment');
    }

    // Save output
    const outputPath = 'experiments/outputs/test_issue_28_format_preserved.miz';
    await fs.writeFile(outputPath, Buffer.from(newMizData));
    console.log(`\n✓ Saved imported .miz to ${outputPath}`);
}

testFormatPreservation()
    .then(() => {
        console.log('\n=== Test Complete ===\n');
    })
    .catch(err => {
        console.error('\n✗ Test failed:', err);
        console.error(err.stack);
        process.exit(1);
    });
