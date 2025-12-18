/**
 * Inspect DEFAULT dictionary format to understand the structure
 */

const JSZip = require('jszip');
const fs = require('fs').promises;

async function inspectDictionaryFormat() {
    console.log('=== Inspecting DEFAULT Dictionary Format ===\n');

    const mizPath = 'experiments/test_mission_with_radio.miz';
    const originalData = await fs.readFile(mizPath);
    const originalBuffer = originalData.buffer.slice(
        originalData.byteOffset,
        originalData.byteOffset + originalData.byteLength
    );
    const originalZip = await JSZip.loadAsync(originalBuffer);

    // Get DEFAULT dictionary
    const defaultDictFile = originalZip.file('l10n/DEFAULT/dictionary');
    if (!defaultDictFile) {
        console.log('No DEFAULT dictionary found');
        return;
    }

    const defaultDictContent = await defaultDictFile.async('string');

    console.log('Raw DEFAULT dictionary content:');
    console.log('='.repeat(80));
    console.log(defaultDictContent);
    console.log('='.repeat(80));
    console.log(`\nFile length: ${defaultDictContent.length} bytes`);
    console.log(`Lines: ${defaultDictContent.split('\n').length}`);
}

inspectDictionaryFormat()
    .then(() => console.log('\n=== Done ==='))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
