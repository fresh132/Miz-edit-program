/**
 * Verify the imported .miz file structure
 */

const JSZip = require('jszip');
const fs = require('fs').promises;

// Load the parser modules
const LuaParser = require('../src/lua-parser.js');
global.JSZip = JSZip;
global.LuaParser = LuaParser;

async function verifyImportedMiz() {
    console.log('=== Verifying Imported .miz File ===\n');

    const mizPath = 'experiments/outputs/test_issue_26_imported.miz';
    const data = await fs.readFile(mizPath);
    const zip = await JSZip.loadAsync(data);

    // List all files
    console.log('Files in imported .miz:');
    const allFiles = Object.keys(zip.files);
    allFiles.forEach(f => {
        if (!zip.files[f].dir) {
            console.log(`  ${f}`);
        }
    });

    // Check RU locale files
    console.log('\n=== RU Locale Files ===');
    const ruFiles = allFiles.filter(f => f.startsWith('l10n/RU/'));
    console.log(`Total RU files: ${ruFiles.length}`);
    ruFiles.forEach(f => console.log(`  ${f}`));

    // Read and display RU dictionary
    console.log('\n=== RU Dictionary Content ===');
    const ruDictFile = zip.file('l10n/RU/dictionary');
    if (ruDictFile) {
        const content = await ruDictFile.async('string');
        console.log(content);
    } else {
        console.log('ERROR: RU dictionary not found!');
    }

    // Compare with DEFAULT
    console.log('\n=== DEFAULT Dictionary Content ===');
    const defaultDictFile = zip.file('l10n/DEFAULT/dictionary');
    if (defaultDictFile) {
        const content = await defaultDictFile.async('string');
        console.log(content);
    }
}

verifyImportedMiz().catch(console.error);
