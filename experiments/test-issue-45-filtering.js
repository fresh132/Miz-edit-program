/**
 * Test script for issue #45 - Enhanced system message filtering
 *
 * Verifies that:
 * 1. System messages in ActionText entries are correctly filtered
 * 2. System messages in ActionRadioText entries are correctly filtered
 * 3. Translatable content is preserved
 */

const MizParser = require('../src/miz-parser.js');

console.log('=== Testing Issue #45: Enhanced System Message Filtering ===\n');

// Test cases from the actual issue
const testCases = {
    shouldFilter: {
        ActionText: [
            // JAMMER messages
            { key: 'DictKey_ActionText_5304', text: 'JAMMER COOLING 11 MINUTE' },
            { key: 'DictKey_ActionText_5296', text: 'JAMMER COOLING 3 MINUTE' },
            { key: 'DictKey_ActionText_5317', text: 'JAMMER OUTPUT - SA-2' },
            { key: 'DictKey_ActionText_5322', text: 'NO JAMMER OUTPUT - SA-15' },
            { key: 'DictKey_ActionText_5292', text: 'JAMMER HEAT 14 MINUTE' },
            { key: 'DictKey_ActionText_5278', text: 'JAMMER STOP EMITTING' },
            { key: 'DictKey_ActionText_5311', text: 'JAMMER COOLED - AVAILABLE AGAIN' },
            { key: 'DictKey_ActionText_5309', text: 'JUAMMER OVERHEATED' },

            // Single numbers
            { key: 'DictKey_ActionText_5313', text: '100' },
            { key: 'DictKey_ActionText_5335', text: '180' },
            { key: 'DictKey_ActionText_5340', text: '250' },
            { key: 'DictKey_ActionText_5312', text: '30' },
            { key: 'DictKey_ActionText_5332', text: '90' },
            { key: 'DictKey_ActionText_5338', text: '240+' },
            { key: 'DictKey_ActionText_5334', text: '150' },

            // Button status
            { key: 'DictKey_ActionText_5264', text: 'BUTTON 5 ON' },
            { key: 'DictKey_ActionText_5261', text: 'BUTTON 3 OFF' },
            { key: 'DictKey_ActionText_5257', text: 'BUTTON 1 OFF' },
            { key: 'DictKey_ActionText_5256', text: 'BUTTON 1 ON' },
            { key: 'DictKey_ActionText_5266', text: 'BUTTON 6 ON' },
            { key: 'DictKey_ActionText_5265', text: 'BUTTON 5 OFF' },

            // ECM/CMS messages
            { key: 'DictKey_ActionText_5632', text: 'ECM Power OFF' },
            { key: 'DictKey_ActionText_5644', text: 'ECM MASTER OFF' },
            { key: 'DictKey_ActionText_5646', text: 'ECM MASTER OFF' },
            { key: 'DictKey_ActionText_5634', text: 'ECM XMIT POS 3' },
            { key: 'DictKey_ActionText_5645', text: 'CMS AUTO ON' },
            { key: 'DictKey_ActionText_5276', text: 'CMS RIGHT PRESSED' },
            { key: 'DictKey_ActionText_5273', text: 'WAIT CMS AFT' },
            { key: 'DictKey_ActionText_5271', text: 'XMIT POS 1 OR 2' },

            // Script placeholder messages
            { key: 'DictKey_ActionText_1207', text: 'INSERT ON COURSE AUDIO' },
            { key: 'DictKey_ActionText_1212', text: 'INSERT OFF COURSE AUDIO' },
            { key: 'DictKey_ActionText_1206', text: 'INSERT ATC HANDOFF MESSAGE' },
            { key: 'DictKey_ActionText_38', text: 'SET STARTING MESSAGE' },
            { key: 'DictKey_ActionText_4118', text: 'INSERT TASKING COMPLETE AUDIO' },
            { key: 'DictKey_ActionText_4107', text: 'INSERT ATTACK COMPLETE AUDIO' },
            { key: 'DictKey_ActionText_1219', text: 'ADD TOWER - ENTER PATTERN MESSGAE' },
            { key: 'DictKey_ActionText_1213', text: 'HOLD UNTIL CLEAR' },
            { key: 'DictKey_ActionText_1214', text: 'HOLD UNTIL CLEAR' },

            // Short technical labels
            { key: 'DictKey_ActionText_4112', text: 'WEPS' },
            { key: 'DictKey_ActionText_4111', text: 'TRIGGER' },
            { key: 'DictKey_ActionText_5393', text: 'POWER ON' },
            { key: 'DictKey_ActionText_5630', text: 'LASER OFF' },
            { key: 'DictKey_ActionText_4113', text: 'MASTER ARM' },
            { key: 'DictKey_ActionText_62', text: 'RESP 2' },
            { key: 'DictKey_ActionText_58', text: 'ASK 1' },
            { key: 'DictKey_ActionText_59', text: 'ASK 3' },
            { key: 'DictKey_ActionText_9', text: 'COMM 1' },

            // Heat/cooling status
            { key: 'DictKey_ActionText_5330', text: 'HEAT PENALTY REMOVED' },

            // Target/status labels
            { key: 'DictKey_ActionText_6609', text: 'TARGET DETAILS:' },
        ],
        ActionRadioText: [
            // Menu items
            { key: 'DictKey_ActionRadioText_187', text: 'Contact RAPCON Arrival' },
            { key: 'DictKey_ActionRadioText_88', text: 'Request Takeoff' },
            { key: 'DictKey_ActionRadioText_5392', text: 'Request taxi' },
            { key: 'DictKey_ActionRadioText_5437', text: 'Contact Departure' },
            { key: 'DictKey_ActionRadioText_5709', text: 'Request Takeoff' },
            { key: 'DictKey_ActionRadioText_5596', text: 'Request Landing' },
            { key: 'DictKey_ActionRadioText_5400', text: 'Request Engine Start' },
            { key: 'DictKey_ActionRadioText_4136', text: 'Contact Tower' },

            // Action menu items
            { key: 'DictKey_ActionRadioText_1185', text: 'Declare emergency' },
            { key: 'DictKey_ActionRadioText_5127', text: 'Abort Mission' },
            { key: 'DictKey_ActionRadioText_5122', text: 'Abort Mission' },
            { key: 'DictKey_ActionRadioText_6637', text: 'View Briefing Image' },

            // Points/purchase menu items
            { key: 'DictKey_ActionRadioText_6713', text: 'F-16 SEAD - NORTH DAMASCUS - 2 POINTS' },
            { key: 'DictKey_ActionRadioText_6673', text: 'F-16 SEAD - SOUTH DAMASCUS - 2 POINTS' },
            { key: 'DictKey_ActionRadioText_6777', text: 'E/A-18G GROWLER - 5 POINTS' },
            { key: 'DictKey_ActionRadioText_6715', text: 'F-16 SEAD - EAST DAMASCUS - 2 POINTS' },
            { key: 'DictKey_ActionRadioText_6779', text: 'KC-135 - 4 POINTS' },
            { key: 'DictKey_ActionRadioText_6751', text: 'AWACS - 3 POINTS' },
            { key: 'DictKey_ActionRadioText_6712', text: 'F-15 FIGHTER SWEEP - 3 POINTS' },
        ],
    },
    shouldKeep: {
        ActionText: [
            // Player instructions (should be translated)
            { key: 'DictKey_ActionText_6065', text: 'Contact Popeye. Make sure the VHF radio is set to Sword flight then press spacebar when ready. (Keep UHF set for Gamesmaster).' },
            { key: 'DictKey_ActionText_5702', text: 'Switch the VHF radio to H4 Tower (COMM 2 channel 2) and contact using the F10 radio menu.' },
            { key: 'DictKey_ActionText_6233', text: 'Proceed to the rally point at waypoint 5.' },
            { key: 'DictKey_ActionText_5911', text: 'Go line abreast with Sword 1, take up position 1 mile to their left.' },
            { key: 'DictKey_ActionText_5735', text: 'Set the VHF radio for Sword flight (COMM 2 channel 7). Press spacebar when set.' },
            { key: 'DictKey_ActionText_5731', text: 'Proceed to waypoint 1, 20,000 feet.' },
            { key: 'DictKey_ActionText_6247', text: 'Contact Popeye to report your arrival at the rally point. Press spacebar when ready.' },
            { key: 'DictKey_ActionText_6159', text: 'Push in towards the SA-3 site. It is advised you set a mark point on the missile launch site if you have tally.' },
            { key: 'DictKey_ActionText_6771', text: 'Mission complete. Please exit when ready.' },
            { key: 'DictKey_ActionText_6707', text: 'F-16 SEAD West selected. A flight of Wild Weasels will now provide SEAD against SAMs west of Damascus.' },
            { key: 'DictKey_ActionText_5594', text: 'Next time make sure you gain clearance from H4 Tower before landing!' },
            { key: 'DictKey_ActionText_5718', text: 'Hold until the rest of your flight has taken off.' },
            { key: 'DictKey_ActionText_5342', text: "Welcome to the 'First In - Weasels over Syria' campaign. Begin by setting the battery to MAIN POWER and then contact H4 Ground to request startup using the F10 radio menu. The radio is already set to the correct frequency." },
            { key: 'DictKey_ActionText_5919', text: 'Fence in, set Firepower (setup weapons), check and set up Emitters as required (lights, radar, RWR), check Navigation is set as desired (recommend setting a course line of 145 to WP4), check Countermeasures set, check ECM is ready.' },
            { key: 'DictKey_ActionText_5120', text: 'You have taken damage, you can abort the mission via the F10 menu if you wish. If you make it back to Incirlik the mission will still complete.' },
            { key: 'DictKey_ActionText_6605', text: 'Welcome to Gauntlet Ops! You will shortly be provided with a target to hit within the Damascus area, how you hit this target is up to you but be aware the might of the full Syrian IADS will be waiting for you. This is not an easy task but help is on hand, you have 10 points available to purchase support elements for this mission, do this from the F10 menu before you take off. Each support element will act independently to help you, you will not be able to give them orders. You are free to select your own weapons loadout from the ground crew radio menu, do this before you taxi. Once you have destroyed the target, escape and land at H4 to complete the mission. Details on threats can be found within the Intel Assessment document in the campaign docs folder. Good luck pilot and press spacebar when ready to receive tasking…' },
        ],
        subtitle: [
            // Radio subtitles (dialogue - should be translated)
            { key: 'DictKey_subtitle_5535', text: 'PLAYER: FL070, Sword 2-1.' },
            { key: 'DictKey_subtitle_6370', text: "POPEYE: Ok Sword 2-1 we're cleared in on approach Bravo at angels 16. Bravo is the oil facility that's smoking in the distance, you'll also find it listed as waypoint 8 in your flight plan. Bravo is our safe approach to pattern airspace so make sure you don't deviate, we have traffic ahead." },
            { key: 'DictKey_subtitle_5693', text: 'POPEYE: Sword 1-1 airborne.' },
            { key: 'DictKey_subtitle_6221', text: 'POPEYE: SA-3 radar is down, good work Sword flight.' },
        ],
    },
};

// Run tests
let passed = 0;
let failed = 0;

console.log('--- Testing messages that SHOULD be filtered ---\n');

for (const [keyType, cases] of Object.entries(testCases.shouldFilter)) {
    console.log(`Testing ${keyType} entries that should be filtered:`);
    for (const { key, text } of cases) {
        const result = MizParser.isSystemMessage(text, key);
        if (result === true) {
            console.log(`  ✓ FILTERED: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
            passed++;
        } else {
            console.log(`  ✗ MISSED: "${text}" (key: ${key})`);
            failed++;
        }
    }
    console.log('');
}

console.log('--- Testing messages that SHOULD be kept ---\n');

for (const [keyType, cases] of Object.entries(testCases.shouldKeep)) {
    console.log(`Testing ${keyType} entries that should be kept:`);
    for (const { key, text } of cases) {
        const result = MizParser.isSystemMessage(text, key);
        if (result === false) {
            console.log(`  ✓ KEPT: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
            passed++;
        } else {
            console.log(`  ✗ WRONGLY FILTERED: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}" (key: ${key})`);
            failed++;
        }
    }
    console.log('');
}

// Summary
console.log('=== Test Summary ===');
console.log(`Total: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
    console.log('\n✓ ALL TESTS PASSED!');
    process.exit(0);
} else {
    console.log(`\n✗ ${failed} TESTS FAILED!`);
    process.exit(1);
}
