/**
 * Experiment: Create mission file with radio messages
 * This creates a test mission that includes all 3 text types
 */

const fs = require('fs');
const path = require('path');

// Check if JSZip is available
let JSZip;
try {
    JSZip = require('jszip');
} catch (e) {
    console.log('JSZip not found. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install jszip', { cwd: path.join(__dirname, '..') });
    JSZip = require('jszip');
}

// Mission content with all three types of messages
const missionContent = `mission =
{
    ["sortie"] = "Sample Training Mission",
    ["descriptionText"] = "This is a sample DCS World mission created for testing the Miz Editor application. The mission demonstrates text extraction capabilities.",
    ["descriptionBlueTask"] = "Blue coalition objective: Complete all training exercises and return to base safely.",
    ["descriptionRedTask"] = "Red coalition objective: Defend assigned airspace from enemy incursions.",
    ["descriptionNeutralsTask"] = "Neutral forces: Observe and report only.",
    ["coalition"] =
    {
        ["blue"] =
        {
            ["name"] = "blue",
            ["country"] =
            {
                [1] =
                {
                    ["name"] = "USA",
                    ["id"] = 2,
                    ["plane"] =
                    {
                        ["group"] =
                        {
                            [1] =
                            {
                                ["name"] = "Eagle Flight",
                                ["task"] = "CAP",
                                ["units"] =
                                {
                                    [1] =
                                    {
                                        ["name"] = "Eagle 1-1",
                                        ["type"] = "F-15C",
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    ["trigrules"] =
    {
        [1] =
        {
            ["comment"] = "Mission Start Message",
            ["actions"] =
            {
                [1] =
                {
                    ["id"] = "MessageToAll",
                    ["text"] = "DictKey_MissionStart",
                },
            },
        },
        [2] =
        {
            ["comment"] = "Objective Complete",
            ["actions"] =
            {
                [1] =
                {
                    ["id"] = "MessageToAll",
                    ["text"] = "DictKey_ObjectiveComplete",
                },
            },
        },
        [3] =
        {
            ["comment"] = "Warning Message",
            ["actions"] =
            {
                [1] =
                {
                    ["id"] = "MessageToAll",
                    ["text"] = "DictKey_Warning",
                },
            },
        },
        [4] =
        {
            ["comment"] = "Radio Call 1",
            ["actions"] =
            {
                [1] =
                {
                    ["id"] = "radioTransmission",
                    ["radioText"] = "DictKey_RadioCall1",
                },
            },
        },
        [5] =
        {
            ["comment"] = "Radio Call 2",
            ["actions"] =
            {
                [1] =
                {
                    ["id"] = "transmitMessage",
                    ["file"] = "DictKey_RadioCall2",
                },
            },
        },
    },
}
`;

const dictionaryDefaultContent = `dictionary =
{
    ["DictKey_MissionStart"] = "Welcome to the training mission. All pilots report to your assigned aircraft.",
    ["DictKey_ObjectiveComplete"] = "Excellent work! All objectives have been completed. Return to base.",
    ["DictKey_Warning"] = "Warning: Enemy aircraft detected. All fighters scramble immediately.",
    ["DictKey_RadioCall1"] = "Overlord, Eagle Flight checking in, on station at Angels 25.",
    ["DictKey_RadioCall2"] = "Eagle Flight, Overlord, copy. Maintain CAP pattern and await further instructions.",
}
`;

const dictionaryRuContent = `dictionary =
{
    ["DictKey_MissionStart"] = "Добро пожаловать на тренировочную миссию. Все пилоты, доложите о готовности.",
    ["DictKey_ObjectiveComplete"] = "Отличная работа! Все цели выполнены. Возвращайтесь на базу.",
    ["DictKey_Warning"] = "Внимание: Обнаружены вражеские самолёты. Всем истребителям - немедленный взлёт.",
    ["DictKey_RadioCall1"] = "Оверлорд, Игл Флайт на связи, на позиции на высоте 25.",
    ["DictKey_RadioCall2"] = "Игл Флайт, Оверлорд, принял. Продолжайте патрулирование и ожидайте дальнейших указаний.",
}
`;

const optionsContent = `options =
{
    ["difficulty"] =
    {
        ["fuel"] = false,
        ["labels"] = 0,
    },
}
`;

async function createMizFile() {
    const zip = new JSZip();

    zip.file('mission', missionContent);
    zip.file('options', optionsContent);
    zip.file('l10n/DEFAULT/dictionary', dictionaryDefaultContent);
    zip.file('l10n/RU/dictionary', dictionaryRuContent);

    const content = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    });

    const outputPath = path.join(__dirname, 'test_mission_with_radio.miz');
    fs.writeFileSync(outputPath, content);

    console.log(`Test .miz file created: ${outputPath}`);
    console.log(`File size: ${content.length} bytes`);
}

createMizFile().catch(err => {
    console.error('Error creating .miz file:', err);
    process.exit(1);
});
