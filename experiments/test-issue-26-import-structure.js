/**
 * Experiment for Issue #26: Test import structure
 * Goal: Understand what files exist in l10n/DEFAULT besides dictionary
 * and test the new import mechanism
 */

const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');

async function analyzeMizStructure(mizPath) {
    console.log(`\n=== Analyzing ${mizPath} ===\n`);

    const data = await fs.readFile(mizPath);
    const zip = await JSZip.loadAsync(data);

    // List all files in the archive
    const allFiles = Object.keys(zip.files);
    console.log('All files in archive:');
    allFiles.forEach(f => console.log(`  ${f}`));

    // Find all l10n files
    console.log('\n=== l10n Files ===');
    const l10nFiles = allFiles.filter(f => f.startsWith('l10n/'));

    // Group by locale
    const locales = {};
    for (const file of l10nFiles) {
        const match = file.match(/^l10n\/([^/]+)\/(.+)$/);
        if (match) {
            const [, locale, filename] = match;
            if (!locales[locale]) {
                locales[locale] = [];
            }
            locales[locale].push(filename);
        }
    }

    // Display locales and their files
    for (const [locale, files] of Object.entries(locales)) {
        console.log(`\n${locale}:`);
        files.forEach(f => console.log(`  - ${f}`));
    }

    return { zip, locales, allFiles };
}

async function testCurrentImportBehavior(mizPath, translatedText, targetLocale = 'RU') {
    console.log(`\n=== Testing Current Import Behavior ===\n`);
    console.log(`Target locale: ${targetLocale}\n`);

    const data = await fs.readFile(mizPath);
    const zip = await JSZip.loadAsync(data);

    // Simulate current behavior: only creates dictionary file
    console.log('Current behavior:');
    console.log('  - Only creates l10n/${targetLocale}/dictionary');
    console.log('  - Does NOT copy other files from DEFAULT\n');

    // Check what files exist in DEFAULT
    const defaultFiles = Object.keys(zip.files).filter(f => f.startsWith('l10n/DEFAULT/'));
    console.log('Files in l10n/DEFAULT:');
    defaultFiles.forEach(f => console.log(`  - ${f}`));

    // Check if there are other files besides dictionary
    const nonDictFiles = defaultFiles.filter(f => !f.includes('dictionary'));
    console.log(`\nNon-dictionary files in DEFAULT: ${nonDictFiles.length}`);
    if (nonDictFiles.length > 0) {
        console.log('These files should be copied to new locale:');
        nonDictFiles.forEach(f => console.log(`  - ${f}`));
    }

    return { zip, defaultFiles, nonDictFiles };
}

async function testNewImportBehavior(mizPath, translatedText, targetLocale = 'RU') {
    console.log(`\n=== Testing NEW Import Behavior (Issue #26) ===\n`);

    const data = await fs.readFile(mizPath);
    const zip = await JSZip.loadAsync(data);

    // Get all DEFAULT files
    const defaultFiles = Object.keys(zip.files).filter(f => f.startsWith('l10n/DEFAULT/'));

    console.log('Step 1: Copy all files from DEFAULT except dictionary');
    const filesToCopy = defaultFiles.filter(f => !f.includes('dictionary'));

    for (const defaultPath of filesToCopy) {
        const file = zip.file(defaultPath);
        if (file && !file.dir) {
            const content = await file.async('string');
            const newPath = defaultPath.replace('l10n/DEFAULT/', `l10n/${targetLocale}/`);
            console.log(`  Copying: ${defaultPath} -> ${newPath}`);
            // In real implementation: zip.file(newPath, content);
        }
    }

    console.log('\nStep 2: Handle dictionary specially');
    console.log('  - Read DEFAULT/dictionary');
    console.log('  - Preserve non-translatable strings (non-trigger, non-radio, non-briefing)');
    console.log('  - Merge with translated strings');
    console.log('  - Create new locale/dictionary');

    // Get DEFAULT dictionary
    const defaultDictFile = zip.file('l10n/DEFAULT/dictionary');
    if (defaultDictFile) {
        const defaultDictContent = await defaultDictFile.async('string');
        console.log(`\nDEFAULT dictionary size: ${defaultDictContent.length} bytes`);

        // Parse to see what keys exist
        const dictKeys = [...defaultDictContent.matchAll(/\["([^"]+)"\]/g)].map(m => m[1]);
        console.log(`Total keys in DEFAULT: ${dictKeys.length}`);

        // Categorize keys
        const categories = {
            triggers: dictKeys.filter(k => k.includes('ActionText') || k.includes('Trigger')),
            radio: dictKeys.filter(k => k.includes('subtitle') || k.includes('Radio') || k.includes('ActionRadioText')),
            briefings: dictKeys.filter(k => k.includes('sortie') || k.includes('description')),
            other: []
        };

        categories.other = dictKeys.filter(k =>
            !categories.triggers.includes(k) &&
            !categories.radio.includes(k) &&
            !categories.briefings.includes(k)
        );

        console.log('\nKey categories:');
        console.log(`  Triggers: ${categories.triggers.length}`);
        console.log(`  Radio: ${categories.radio.length}`);
        console.log(`  Briefings: ${categories.briefings.length}`);
        console.log(`  Other (should be preserved): ${categories.other.length}`);

        if (categories.other.length > 0) {
            console.log('\nExample "other" keys (first 10):');
            categories.other.slice(0, 10).forEach(k => console.log(`    - ${k}`));
        }
    }

    console.log('\nExpected outcome:');
    console.log('  ✓ All non-dictionary files copied to new locale');
    console.log('  ✓ Dictionary contains translated strings for triggers/radio/briefings');
    console.log('  ✓ Dictionary preserves all other strings from DEFAULT');
}

// Main test execution
async function main() {
    const testFiles = [
        'experiments/test_mission_with_radio.miz',
        'experiments/outputs/test_issue_18.miz'
    ];

    for (const file of testFiles) {
        try {
            await analyzeMizStructure(file);
            await testCurrentImportBehavior(file, '');
            await testNewImportBehavior(file, '');
        } catch (err) {
            console.error(`Error processing ${file}:`, err.message);
        }
    }

    console.log('\n=== Test Complete ===\n');
}

main().catch(console.error);
