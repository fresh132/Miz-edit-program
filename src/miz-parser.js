/**
 * MIZ File Parser for DCS World mission files
 * Handles .miz file extraction and parsing
 */

const MizParser = {
    /**
     * Categories of extractable text
     */
    CATEGORIES: {
        briefings: {
            name: 'Mission Briefings',
            keys: ['descriptionText', 'descriptionBlueTask', 'descriptionRedTask', 'descriptionNeutralsTask', 'sortie']
        },
        tasks: {
            name: 'Task Descriptions',
            keys: ['task', 'taskDescription']
        },
        triggers: {
            name: 'Trigger Messages',
            patterns: ['message', 'text', 'comment']
        },
        units: {
            name: 'Unit Names',
            keys: ['name']
        },
        waypoints: {
            name: 'Waypoints',
            keys: ['name', 'comment']
        },
        radio: {
            name: 'Radio Messages',
            keys: ['radioText', 'message']
        }
    },

    /**
     * Parse a .miz file and extract its contents
     * @param {File|ArrayBuffer} file - The .miz file to parse
     * @param {Function} progressCallback - Callback for progress updates
     * @returns {Promise<object>} Parsed mission data
     */
    parse: async function(file, progressCallback = () => {}) {
        progressCallback(5, 'Loading .miz file...');

        let zip;
        try {
            zip = await JSZip.loadAsync(file);
        } catch (e) {
            throw new Error('Invalid .miz file: Unable to read as ZIP archive');
        }

        progressCallback(20, 'Extracting mission data...');

        const result = {
            mission: null,
            dictionaries: {},
            mapResources: {},
            availableLocales: [],
            rawStrings: []
        };

        // List all files in the archive
        const fileNames = Object.keys(zip.files);

        // Find and parse the mission file
        const missionFile = zip.file('mission');
        if (missionFile) {
            progressCallback(30, 'Parsing mission file...');
            const missionContent = await missionFile.async('string');
            result.mission = LuaParser.parse(missionContent);
        } else {
            throw new Error('Invalid .miz file: No mission file found');
        }

        // Find and parse dictionary files
        progressCallback(50, 'Extracting localization data...');

        // Check for l10n folder
        const l10nPattern = /^l10n\/([^/]+)\/dictionary$/;
        const mapResourcePattern = /^l10n\/([^/]+)\/mapResource$/;
        const mapResourceLuaPattern = /^l10n\/([^/]+)\/mapResource\.lua$/;

        for (const fileName of fileNames) {
            // Parse dictionary files
            const match = fileName.match(l10nPattern);
            if (match) {
                const locale = match[1];
                result.availableLocales.push(locale);

                const dictFile = zip.file(fileName);
                if (dictFile) {
                    const dictContent = await dictFile.async('string');
                    result.dictionaries[locale] = LuaParser.parse(dictContent);
                }
            }

            // Also check for .lua extension
            const luaMatch = fileName.match(/^l10n\/([^/]+)\/dictionary\.lua$/);
            if (luaMatch) {
                const locale = luaMatch[1];
                if (!result.availableLocales.includes(locale)) {
                    result.availableLocales.push(locale);
                }

                const dictFile = zip.file(fileName);
                if (dictFile) {
                    const dictContent = await dictFile.async('string');
                    result.dictionaries[locale] = LuaParser.parse(dictContent);
                }
            }

            // Parse mapResource files (for radio sound resources)
            const mapResMatch = fileName.match(mapResourcePattern);
            if (mapResMatch) {
                const locale = mapResMatch[1];
                const mapResFile = zip.file(fileName);
                if (mapResFile) {
                    const mapResContent = await mapResFile.async('string');
                    result.mapResources[locale] = LuaParser.parse(mapResContent);
                }
            }

            // Also check for mapResource.lua extension
            const mapResLuaMatch = fileName.match(mapResourceLuaPattern);
            if (mapResLuaMatch) {
                const locale = mapResLuaMatch[1];
                const mapResFile = zip.file(fileName);
                if (mapResFile) {
                    const mapResContent = await mapResFile.async('string');
                    result.mapResources[locale] = LuaParser.parse(mapResContent);
                }
            }
        }

        progressCallback(70, 'Processing extracted data...');

        return result;
    },

    /**
     * Extract localizable text from parsed mission data
     * @param {object} parsedData - Data from parse()
     * @param {object} options - Extraction options
     * @returns {object} Extracted text organized by category
     */
    extractText: function(parsedData, options = {}) {
        const {
            mode = 'auto',
            categories = [],
            preferredLocale = 'DEFAULT'
        } = options;

        const result = {
            locale: preferredLocale,
            extracted: {},
            stats: {
                totalStrings: 0,
                uniqueStrings: 0,
                byCategory: {}
            },
            validation: {
                isComplete: false,
                errors: [],
                warnings: []
            }
        };

        // Select the dictionary to use
        let dictionary = parsedData.dictionaries[preferredLocale];
        if (!dictionary && preferredLocale !== 'DEFAULT') {
            dictionary = parsedData.dictionaries['DEFAULT'];
            result.locale = 'DEFAULT';
        }
        if (!dictionary) {
            // Use first available dictionary
            const firstLocale = parsedData.availableLocales[0];
            if (firstLocale) {
                dictionary = parsedData.dictionaries[firstLocale];
                result.locale = firstLocale;
            }
        }

        // In auto mode, only extract focused categories (briefings, triggers, radio)
        // Ignore units, waypoints, tasks per issue requirements
        const focusedCategories = ['briefings', 'triggers', 'radio'];
        const categoriesToExtract = mode === 'auto' ? focusedCategories : categories;

        // Extract text by category
        if (categoriesToExtract.includes('briefings')) {
            result.extracted.briefings = this.extractBriefings(parsedData.mission, dictionary);
            result.stats.byCategory.briefings = result.extracted.briefings.length;
        }

        if (categoriesToExtract.includes('triggers')) {
            result.extracted.triggers = this.extractTriggers(parsedData.mission, dictionary);
            result.stats.byCategory.triggers = result.extracted.triggers.length;
        }

        if (categoriesToExtract.includes('radio')) {
            const mapResource = parsedData.mapResources?.[result.locale] || parsedData.mapResources?.['DEFAULT'];
            result.extracted.radio = this.extractRadioMessages(parsedData.mission, dictionary, mapResource);
            result.stats.byCategory.radio = result.extracted.radio.length;
        }

        // Optional categories for manual mode only
        if (categoriesToExtract.includes('tasks')) {
            result.extracted.tasks = this.extractTasks(parsedData.mission, dictionary);
            result.stats.byCategory.tasks = result.extracted.tasks.length;
        }

        if (categoriesToExtract.includes('units')) {
            result.extracted.units = this.extractUnits(parsedData.mission, dictionary);
            result.stats.byCategory.units = result.extracted.units.length;
        }

        if (categoriesToExtract.includes('waypoints')) {
            result.extracted.waypoints = this.extractWaypoints(parsedData.mission, dictionary);
            result.stats.byCategory.waypoints = result.extracted.waypoints.length;
        }

        // Критически важный fallback для современных миссий (2020-2025)
        if (result.extracted.triggers && result.extracted.triggers.length === 0) {
            result.extracted.triggers = this.extractTriggers(parsedData.mission, dictionary);
            result.stats.byCategory.triggers = result.extracted.triggers.length;
        }
        if (result.extracted.radio && result.extracted.radio.length === 0) {
            const mapResource = parsedData.mapResources?.[result.locale] || parsedData.mapResources?.['DEFAULT'];
            result.extracted.radio = this.extractRadioMessages(parsedData.mission, dictionary, mapResource);
            result.stats.byCategory.radio = result.extracted.radio.length;
        }

        // Calculate totals
        const allStrings = [];
        for (const category of Object.keys(result.extracted)) {
            allStrings.push(...result.extracted[category]);
        }
        result.stats.totalStrings = allStrings.length;
        result.stats.uniqueStrings = new Set(allStrings.map(s => s.text)).size;

        // Validation per issue #7: Check for required categories
        const requiredCategories = ['briefings', 'triggers', 'radio'];
        const missingCategories = [];
        const emptyCategories = [];

        for (const category of requiredCategories) {
            if (!result.extracted[category]) {
                missingCategories.push(category);
            } else if (result.extracted[category].length === 0) {
                emptyCategories.push(category);
            }
        }

        if (missingCategories.length > 0) {
            result.validation.errors.push(
                `Missing required categories: ${missingCategories.join(', ')}`
            );
        }

        if (emptyCategories.length > 0) {
            result.validation.warnings.push(
                `Empty required categories: ${emptyCategories.join(', ')}`
            );
        }

        // Mark as complete if all required categories have content
        result.validation.isComplete =
            result.extracted.briefings?.length > 0 &&
            result.extracted.triggers?.length > 0 &&
            result.extracted.radio?.length > 0;

        return result;
    },

    /**
     * Resolve a DictKey reference to actual text
     */
    resolveText: function(value, dictionary) {
        if (!value) return null;

        // Check if it's a DictKey reference
        if (typeof value === 'string') {
            if (value.startsWith('DictKey_')) {
                if (dictionary && dictionary[value]) {
                    return this.cleanText(dictionary[value]);
                }
                return null;
            }
            return this.cleanText(value);
        }

        return null;
    },

    /**
     * Clean and trim text with strict cleaning per issue requirements
     * Removes all Lua artifacts: quotes, escapes, tabs, multiple spaces
     */
    cleanText: function(text) {
        if (!text || typeof text !== 'string') return null;

        // Initial trim
        text = text.trim();

        // Remove empty strings
        if (!text) return null;

        // Remove Lua artifacts (quotes at start/end that might have been escaped)
        text = text.replace(/^["']|["']$/g, '');

        // Unescape common Lua escape sequences
        text = text.replace(/\\n/g, '\n');
        text = text.replace(/\\t/g, ' '); // Convert tabs to spaces first
        text = text.replace(/\\"/g, '"');
        text = text.replace(/\\'/g, "'");
        text = text.replace(/\\\\/g, '\\');

        // STRICT CLEANING per issue requirements:
        // 1. Remove all tabs (replace with space)
        text = text.replace(/\t/g, ' ');

        // 2. Normalize multiple spaces to single space
        text = text.replace(/\s+/g, ' ');

        // 3. Remove any remaining escape characters
        text = text.replace(/\\(?!n)/g, '');

        // 4. Final trim to remove leading/trailing whitespace
        text = text.trim();

        // 5. Remove empty lines but preserve intentional line breaks
        text = text.replace(/\n\s*\n/g, '\n');

        return text || null;
    },

    /**
     * Extract text from dictionary by key prefixes
     * Helper function for modern DCS missions (2020-2025)
     * @param {object} dictionary - The dictionary object
     * @param {string[]} prefixes - Array of key prefixes to match (e.g., ['DictKey_ActionText_'])
     * @param {string} category - Category name for the extracted items
     * @returns {Array} Array of extracted items with category, context, and text
     */
    _extractFromDictionary: function(dictionary, prefixes, category) {
        const results = [];
        if (!dictionary) return results;

        for (const [key, value] of Object.entries(dictionary)) {
            if (prefixes.some(p => key.startsWith(p))) {
                const text = this.cleanText(value);
                if (text) {
                    results.push({
                        category: category,
                        context: key,                // сохраняем оригинальный ключ
                        text: text
                    });
                }
            }
        }
        return results;
    },

    /**
     * Extract briefing texts
     */
    extractBriefings: function(mission, dictionary) {
        const results = [];

        if (!mission) return results;

        const briefingKeys = ['sortie', 'descriptionText', 'descriptionBlueTask', 'descriptionRedTask', 'descriptionNeutralsTask'];

        for (const key of briefingKeys) {
            if (mission[key]) {
                const text = this.resolveText(mission[key], dictionary);
                if (text) {
                    results.push({
                        category: 'Briefing',
                        context: this.formatContextName(key),
                        text: text
                    });
                }
            }
        }

        return results;
    },

    /**
     * Extract task descriptions
     */
    extractTasks: function(mission, dictionary) {
        const results = [];

        if (!mission) return results;

        // Search for tasks in coalition data
        const coalitions = ['blue', 'red', 'neutrals'];

        for (const coalition of coalitions) {
            const coalitionData = mission.coalition?.[coalition];
            if (!coalitionData) continue;

            // Look through countries and groups
            this.traverseGroups(coalitionData, (group, path) => {
                if (group.task) {
                    const text = this.resolveText(group.task, dictionary);
                    if (text) {
                        results.push({
                            category: 'Task',
                            context: `${coalition}/${path}`,
                            text: text
                        });
                    }
                }
            });
        }

        return results;
    },

    /**
     * Extract trigger messages
     * Per issue #13: Support modern DCS mission format (2020-2025)
     * Modern missions use mission.triggers.triggers or mission.trig with Lua code strings
     * Extracts text from outText(), outTextForGroup(), outTextForCoalition(), outTextForUnit()
     */
    extractTriggers: function(mission, dictionary) {
        const results = [];
        const seen = new Set();

        const addUnique = (text, context) => {
            const clean = this.cleanText(text);
            if (clean && !seen.has(clean)) {
                seen.add(clean);
                results.push({
                    category: 'Trigger',
                    context: context || 'Trigger Message',
                    text: clean
                });
            }
        };

        // 1. New format: mission.triggers.triggers (modern DCS missions 2020-2025)
        if (mission?.triggers?.triggers) {
            const triggers = Array.isArray(mission.triggers.triggers)
                ? mission.triggers.triggers
                : Object.values(mission.triggers.triggers);

            for (const trig of triggers) {
                if (!trig?.actions) continue;
                const actions = Array.isArray(trig.actions) ? trig.actions : Object.values(trig.actions);
                for (const action of actions) {
                    if (typeof action === 'string') {
                        // Ищем outText, outTextForGroup, outTextForCoalition, outTextForUnit
                        // Pattern matches: outText(..., "text", ...) or outTextFor*(..., "text", ...)
                        const matches = action.matchAll(/outText(?:For\w+)?\s*\([^)]*?["']([^"']+)["']/g);
                        for (const match of matches) {
                            const text = match[1];
                            if (text) addUnique(text, trig.comment || 'Trigger Action');
                        }
                    }
                }
            }
        }

        // 2. Alternative new format: mission.trig.actions (if exists)
        if (mission?.trig?.actions) {
            const actions = Array.isArray(mission.trig.actions) ? mission.trig.actions : Object.values(mission.trig.actions);
            for (const action of actions) {
                if (typeof action === 'string') {
                    const matches = action.matchAll(/outText(?:For\w+)?\s*\([^)]*?["']([^"']+)["']/g);
                    for (const match of matches) {
                        const text = match[1];
                        if (text) addUnique(text, 'Legacy Trigger');
                    }
                }
            }
        }

        // 3. Old format: mission.trigrules (backward compatibility)
        if (mission?.trigrules) {
            const trigrules = mission.trigrules;
            const rules = Array.isArray(trigrules) ? trigrules : Object.values(trigrules);

            for (const rule of rules) {
                if (!rule || typeof rule !== 'object') continue;

                if (rule.actions) {
                    const actions = Array.isArray(rule.actions) ? rule.actions : Object.values(rule.actions);
                    for (const action of actions) {
                        if (!action) continue;

                        // Skip radio-specific actions (they're handled by extractRadioMessages)
                        const isRadioAction =
                            action.radioText ||
                            (action.id && typeof action.id === 'string' &&
                             (action.id.toLowerCase().includes('radio') ||
                              action.id.toLowerCase().includes('transmit')));

                        if (isRadioAction) continue;

                        // Look for text/message properties
                        for (const key of ['text', 'message']) {
                            if (action[key]) {
                                const text = this.resolveText(action[key], dictionary);
                                if (text) {
                                    addUnique(text, rule.comment || 'Trigger Message');
                                }
                            }
                        }
                    }
                }
            }
        }

        // Если ничего не нашли — берём из dictionary (modern DCS missions 2020-2025)
        if (results.length === 0 && dictionary) {
            const fromDict = this._extractFromDictionary(
                dictionary,
                ['DictKey_ActionText_'],
                'Trigger'
            );
            results.push(...fromDict);
        }

        return results;
    },

    /**
     * Extract unit names
     */
    extractUnits: function(mission, dictionary) {
        const results = [];
        const seenNames = new Set();

        if (!mission) return results;

        const coalitions = ['blue', 'red', 'neutrals'];

        for (const coalition of coalitions) {
            const coalitionData = mission.coalition?.[coalition];
            if (!coalitionData) continue;

            this.traverseUnits(coalitionData, (unit, path) => {
                if (unit.name) {
                    const text = this.resolveText(unit.name, dictionary);
                    if (text && !seenNames.has(text)) {
                        seenNames.add(text);
                        results.push({
                            category: 'Unit',
                            context: `${coalition}/${path}`,
                            text: text
                        });
                    }
                }
            });
        }

        return results;
    },

    /**
     * Extract waypoint information
     */
    extractWaypoints: function(mission, dictionary) {
        const results = [];

        if (!mission) return results;

        const coalitions = ['blue', 'red', 'neutrals'];

        for (const coalition of coalitions) {
            const coalitionData = mission.coalition?.[coalition];
            if (!coalitionData) continue;

            this.traverseGroups(coalitionData, (group, path) => {
                if (group.route?.points) {
                    const points = Array.isArray(group.route.points)
                        ? group.route.points
                        : Object.values(group.route.points);

                    points.forEach((point, index) => {
                        if (!point) return;

                        if (point.name) {
                            const text = this.resolveText(point.name, dictionary);
                            if (text) {
                                results.push({
                                    category: 'Waypoint',
                                    context: `${path}/WP${index + 1}`,
                                    text: text
                                });
                            }
                        }

                        if (point.comment) {
                            const text = this.resolveText(point.comment, dictionary);
                            if (text) {
                                results.push({
                                    category: 'Waypoint',
                                    context: `${path}/WP${index + 1} Comment`,
                                    text: text
                                });
                            }
                        }
                    });
                }
            });
        }

        return results;
    },

    /**
     * Extract radio messages
     * Per issue #13: Support modern DCS mission format (2020-2025)
     * Extracts subtitles from radioTransmission() calls and related outText() calls
     * @param {object} mission - Mission data
     * @param {object} dictionary - Dictionary for DictKey resolution
     * @param {object} mapResource - mapResource.lua content for ResKey resolution
     */
    extractRadioMessages: function(mission, dictionary, mapResource) {
        const results = [];
        const seen = new Set();

        const addUnique = (text, context) => {
            const clean = this.cleanText(text);
            if (clean && !seen.has(clean)) {
                seen.add(clean);
                results.push({
                    category: 'Radio',
                    context: context || 'Radio Transmission',
                    text: clean
                });
            }
        };

        // Search in actions for radioTransmission + outText (subtitles)
        const searchInActions = (actions, contextPrefix) => {
            if (!actions) return;
            const arr = Array.isArray(actions) ? actions : Object.values(actions);
            for (const action of arr) {
                if (typeof action !== 'string') continue;

                // Subtitles from radio (outText with radio context)
                const subtitleMatches = action.matchAll(/outText(?:For\w+)?\s*\([^)]*?["']([^"']+)["']/g);
                for (const match of subtitleMatches) {
                    if (match[1]) addUnique(match[1], contextPrefix || 'Radio Subtitle');
                }

                // Radio transmission audio files (informational)
                if (action.includes('radioTransmission')) {
                    const audioMatches = action.matchAll(/["']([^"']*\.ogg)["']/g);
                    for (const match of audioMatches) {
                        if (match[1]) {
                            addUnique(`[Radio Sound] ${match[1]}`, contextPrefix || 'Radio Audio');
                        }
                    }
                }

                // Check for ResKey references in mapResource
                if (mapResource && action.includes('ResKey_')) {
                    const resKeyMatches = action.matchAll(/ResKey_(\w+)/g);
                    for (const match of resKeyMatches) {
                        const resKey = `ResKey_${match[1]}`;
                        const path = mapResource[resKey];
                        if (path && typeof path === 'string') {
                            addUnique(`[Resource] ${path}`, contextPrefix || 'Radio Resource');
                        }
                    }
                }
            }
        };

        // 1. New format: mission.triggers.triggers
        if (mission?.triggers?.triggers) {
            const triggers = Array.isArray(mission.triggers.triggers)
                ? mission.triggers.triggers
                : Object.values(mission.triggers.triggers);
            for (const t of triggers) {
                if (t?.actions) {
                    // Check if this trigger contains radio-related actions
                    const actionsStr = JSON.stringify(t.actions);
                    if (actionsStr.includes('radioTransmission') || actionsStr.includes('Radio')) {
                        searchInActions(t.actions, t.comment || 'Radio Trigger');
                    }
                }
            }
        }

        // 2. Alternative new format: mission.trig
        if (mission?.trig?.actions) {
            const actionsStr = JSON.stringify(mission.trig.actions);
            if (actionsStr.includes('radioTransmission') || actionsStr.includes('Radio')) {
                searchInActions(mission.trig.actions, 'Legacy Radio');
            }
        }

        // 3. Old format: mission.trigrules (backward compatibility)
        if (mission?.trigrules) {
            const rules = Array.isArray(mission.trigrules) ? mission.trigrules : Object.values(mission.trigrules);

            for (const rule of rules) {
                if (!rule?.actions) continue;

                const actions = Array.isArray(rule.actions) ? rule.actions : Object.values(rule.actions);

                for (const action of actions) {
                    if (!action) continue;

                    // DCS radio actions typically have specific action IDs
                    if (action.radioText || action.file ||
                        (action.id && typeof action.id === 'string' && action.id.toLowerCase().includes('radio'))) {

                        const textKey = action.radioText || action.file || action.text;
                        if (textKey) {
                            const text = this.resolveText(textKey, dictionary);
                            if (text) {
                                addUnique(text, rule.comment || 'Radio Message');
                            }
                        }
                    }
                }
            }
        }

        // 4. Search for radio messages in coalition groups (unit radio settings)
        if (mission?.coalition) {
            const coalitions = ['blue', 'red', 'neutrals'];

            for (const coalition of coalitions) {
                const coalitionData = mission.coalition[coalition];
                if (!coalitionData) continue;

                this.traverseGroups(coalitionData, (group, path) => {
                    if (group.radio || group.frequency) {
                        ['radioText', 'message', 'radioMessage'].forEach(key => {
                            if (group[key]) {
                                const text = this.resolveText(group[key], dictionary);
                                if (text) {
                                    addUnique(text, path);
                                }
                            }
                        });
                    }
                });
            }
        }

        // Если ничего не нашли — берём из dictionary (modern DCS missions 2020-2025)
        if (results.length === 0 && dictionary) {
            const fromDict = this._extractFromDictionary(
                dictionary,
                ['DictKey_subtitle_', 'DictKey_ActionRadioText_'],
                'Radio'
            );
            results.push(...fromDict);
        }

        return results;
    },

    /**
     * Traverse groups in coalition data
     */
    traverseGroups: function(coalitionData, callback) {
        if (!coalitionData?.country) return;

        const countries = Array.isArray(coalitionData.country)
            ? coalitionData.country
            : Object.values(coalitionData.country);

        for (const country of countries) {
            if (!country) continue;

            const countryName = country.name || 'Unknown';
            const groupTypes = ['plane', 'helicopter', 'vehicle', 'ship', 'static'];

            for (const groupType of groupTypes) {
                const typeData = country[groupType];
                if (!typeData?.group) continue;

                const groups = Array.isArray(typeData.group)
                    ? typeData.group
                    : Object.values(typeData.group);

                for (const group of groups) {
                    if (group) {
                        callback(group, `${countryName}/${groupType}/${group.name || 'Unknown'}`);
                    }
                }
            }
        }
    },

    /**
     * Traverse units in coalition data
     */
    traverseUnits: function(coalitionData, callback) {
        this.traverseGroups(coalitionData, (group, path) => {
            if (group.units) {
                const units = Array.isArray(group.units)
                    ? group.units
                    : Object.values(group.units);

                for (const unit of units) {
                    if (unit) {
                        callback(unit, path);
                    }
                }
            }
        });
    },

    /**
     * Format context name for display
     */
    formatContextName: function(key) {
        const names = {
            sortie: 'Mission Name',
            descriptionText: 'Description',
            descriptionBlueTask: 'Blue Task',
            descriptionRedTask: 'Red Task',
            descriptionNeutralsTask: 'Neutral Task'
        };
        return names[key] || key;
    },

    /**
     * Format extracted data as plain text with clear sections per issue #7 requirements
     * Format with sections:
     *   БРИФИНГ: / BRIEFING:
     *   ...
     *
     *   ТРИГГЕРЫ: / TRIGGERS:
     *   ...
     *
     *   РАДИОСООБЩЕНИЯ: / RADIO MESSAGES:
     *   ...
     */
    formatAsText: function(extractionResult) {
        const sections = [];

        // BRIEFING SECTION
        if (extractionResult.extracted.briefings && extractionResult.extracted.briefings.length > 0) {
            const briefingLines = ['БРИФИНГ: / BRIEFING:', ''];
            for (const item of extractionResult.extracted.briefings) {
                const prefix = this.getCleanPrefix(item.context, 'Briefing');
                briefingLines.push(`${prefix}: ${item.text}`);
            }
            sections.push(briefingLines.join('\n'));
        }

        // TRIGGERS SECTION
        if (extractionResult.extracted.triggers && extractionResult.extracted.triggers.length > 0) {
            const triggerLines = ['ТРИГГЕРЫ: / TRIGGERS:', ''];
            let triggerIndex = 1;
            for (const item of extractionResult.extracted.triggers) {
                triggerLines.push(`Trigger_${triggerIndex}: ${item.text}`);
                triggerIndex++;
            }
            sections.push(triggerLines.join('\n'));
        }

        // RADIO MESSAGES SECTION
        if (extractionResult.extracted.radio && extractionResult.extracted.radio.length > 0) {
            const radioLines = ['РАДИОСООБЩЕНИЯ: / RADIO MESSAGES:', ''];
            let radioIndex = 1;
            for (const item of extractionResult.extracted.radio) {
                radioLines.push(`Radio_${radioIndex}: ${item.text}`);
                radioIndex++;
            }
            sections.push(radioLines.join('\n'));
        }

        // OPTIONAL CATEGORIES (for manual mode)
        if (extractionResult.extracted.tasks && extractionResult.extracted.tasks.length > 0) {
            const taskLines = ['ЗАДАЧИ: / TASKS:', ''];
            let taskIndex = 1;
            for (const item of extractionResult.extracted.tasks) {
                taskLines.push(`Task_${taskIndex}: ${item.text}`);
                taskIndex++;
            }
            sections.push(taskLines.join('\n'));
        }

        if (extractionResult.extracted.units && extractionResult.extracted.units.length > 0) {
            const unitLines = ['ПОДРАЗДЕЛЕНИЯ: / UNITS:', ''];
            let unitIndex = 1;
            for (const item of extractionResult.extracted.units) {
                unitLines.push(`Unit_${unitIndex}: ${item.text}`);
                unitIndex++;
            }
            sections.push(unitLines.join('\n'));
        }

        if (extractionResult.extracted.waypoints && extractionResult.extracted.waypoints.length > 0) {
            const waypointLines = ['ПУТЕВЫЕ ТОЧКИ: / WAYPOINTS:', ''];
            let waypointIndex = 1;
            for (const item of extractionResult.extracted.waypoints) {
                waypointLines.push(`Waypoint_${waypointIndex}: ${item.text}`);
                waypointIndex++;
            }
            sections.push(waypointLines.join('\n'));
        }

        return sections.join('\n\n');
    },

    /**
     * Get clean prefix for briefing contexts
     */
    getCleanPrefix: function(context, category) {
        const contextMap = {
            'Mission Name': 'Briefing_Mission',
            'Description': 'Briefing_Description',
            'Blue Task': 'Briefing_Blue',
            'Red Task': 'Briefing_Red',
            'Neutral Task': 'Briefing_Neutral'
        };
        return contextMap[context] || `${category}_${context.replace(/[^a-zA-Z0-9]/g, '_')}`;
    },

    /**
     * Format extracted data as JSON
     */
    formatAsJson: function(extractionResult) {
        const jsonOutput = {
            metadata: {
                locale: extractionResult.locale,
                totalStrings: extractionResult.stats.totalStrings,
                uniqueStrings: extractionResult.stats.uniqueStrings
            },
            strings: {}
        };

        let keyIndex = 1;
        for (const [category, items] of Object.entries(extractionResult.extracted)) {
            for (const item of items) {
                const key = `${category}_${keyIndex++}`;
                jsonOutput.strings[key] = {
                    category: item.category,
                    context: item.context,
                    text: item.text
                };
            }
        }

        return JSON.stringify(jsonOutput, null, 2);
    },

    /**
     * Parse imported text file back to structured data
     * Handles both old format and new sectioned format (issue #7)
     * @param {string} importedText - The modified .txt file content
     * @returns {object} Parsed import data with mappings
     */
    parseImportedText: function(importedText) {
        const lines = importedText.split('\n');
        const mappings = {
            briefings: {},
            triggers: [],
            radio: [],
            tasks: [],
            units: [],
            waypoints: []
        };

        const linePattern = /^([^:]+):\s*(.*)$/;

        // Track current section for sectioned format
        let currentSection = null;
        const sectionMap = {
            'БРИФИНГ': 'briefings',
            'BRIEFING': 'briefings',
            'ТРИГГЕРЫ': 'triggers',
            'TRIGGERS': 'triggers',
            'РАДИОСООБЩЕНИЯ': 'radio',
            'RADIO MESSAGES': 'radio',
            'ЗАДАЧИ': 'tasks',
            'TASKS': 'tasks',
            'ПОДРАЗДЕЛЕНИЯ': 'units',
            'UNITS': 'units',
            'ПУТЕВЫЕ ТОЧКИ': 'waypoints',
            'WAYPOINTS': 'waypoints'
        };

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            // Check if this is a section header
            const sectionMatch = trimmedLine.match(/^([А-ЯЁA-Z\s]+):\s*(?:\/\s*([A-Z\s]+):)?$/);
            if (sectionMatch) {
                const sectionName = sectionMatch[1].trim();
                const sectionNameEn = sectionMatch[2]?.trim();
                currentSection = sectionMap[sectionName] || sectionMap[sectionNameEn] || null;
                continue;
            }

            const match = trimmedLine.match(linePattern);
            if (!match) continue;

            const [, prefix, text] = match;
            const cleanText = text.trim();

            if (!cleanText) continue;

            // Map briefings
            if (prefix.startsWith('Briefing_Mission')) {
                mappings.briefings.sortie = cleanText;
            } else if (prefix.startsWith('Briefing_Description')) {
                mappings.briefings.descriptionText = cleanText;
            } else if (prefix.startsWith('Briefing_Blue')) {
                mappings.briefings.descriptionBlueTask = cleanText;
            } else if (prefix.startsWith('Briefing_Red')) {
                mappings.briefings.descriptionRedTask = cleanText;
            } else if (prefix.startsWith('Briefing_Neutral')) {
                mappings.briefings.descriptionNeutralsTask = cleanText;
            }
            // Map triggers (both old and new format)
            else if (prefix.startsWith('Trigger_Message_') || prefix.startsWith('Trigger_')) {
                mappings.triggers.push(cleanText);
            }
            // Map radio (both old and new format)
            else if (prefix.startsWith('Radio_Message_') || prefix.startsWith('Radio_')) {
                mappings.radio.push(cleanText);
            }
            // Map optional categories
            else if (prefix.startsWith('Task_')) {
                mappings.tasks.push(cleanText);
            } else if (prefix.startsWith('Unit_')) {
                mappings.units.push(cleanText);
            } else if (prefix.startsWith('Waypoint_')) {
                mappings.waypoints.push(cleanText);
            }
        }

        return mappings;
    },

    /**
     * Generate Lua dictionary content from mappings
     * @param {object} mappings - The import mappings
     * @returns {string} Lua dictionary content
     */
    generateLuaDictionary: function(mappings) {
        const entries = [];
        let keyIndex = 1;

        // Helper to escape Lua strings
        const escapeLua = (str) => {
            return str
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\t/g, '\\t');
        };

        // Add briefings
        for (const [key, value] of Object.entries(mappings.briefings)) {
            if (value) {
                const dictKey = `DictKey_${key}`;
                entries.push(`    ["${dictKey}"] = "${escapeLua(value)}"`);
            }
        }

        // Add triggers
        for (const text of mappings.triggers) {
            const dictKey = `DictKey_Trigger_${keyIndex++}`;
            entries.push(`    ["${dictKey}"] = "${escapeLua(text)}"`);
        }

        // Add radio messages
        for (const text of mappings.radio) {
            const dictKey = `DictKey_Radio_${keyIndex++}`;
            entries.push(`    ["${dictKey}"] = "${escapeLua(text)}"`);
        }

        // Build Lua dictionary
        const luaContent = `dictionary = {\n${entries.join(',\n')}\n}`;
        return luaContent;
    },

    /**
     * Import translated text back into .miz file
     * @param {File|ArrayBuffer} originalMizFile - The original .miz file
     * @param {string} importedText - The translated text content
     * @param {string} targetLocale - Target locale (e.g., 'RU')
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Blob>} New .miz file with imported locale
     */
    importToMiz: async function(originalMizFile, importedText, targetLocale = 'RU', progressCallback = () => {}) {
        progressCallback(5, 'Loading original .miz file...');

        // Load original .miz
        let zip;
        try {
            zip = await JSZip.loadAsync(originalMizFile);
        } catch (e) {
            throw new Error('Invalid .miz file: Unable to read as ZIP archive');
        }

        progressCallback(20, 'Parsing imported text...');

        // Parse imported text
        const mappings = this.parseImportedText(importedText);

        progressCallback(40, 'Generating new locale dictionary...');

        // Generate Lua dictionary
        const dictionaryContent = this.generateLuaDictionary(mappings);

        progressCallback(60, 'Updating .miz archive...');

        // Add/update locale dictionary in zip
        const localePath = `l10n/${targetLocale}/dictionary`;
        zip.file(localePath, dictionaryContent);

        progressCallback(80, 'Finalizing .miz file...');

        // Generate new .miz file
        const newMizBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        progressCallback(100, 'Import complete!');

        return newMizBlob;
    },

    /**
     * Validate .miz file structure
     * @param {File|ArrayBuffer} mizFile - The .miz file to validate
     * @returns {Promise<object>} Validation result
     */
    validateMiz: async function(mizFile) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        try {
            const zip = await JSZip.loadAsync(mizFile);

            // Check for mission file
            const missionFile = zip.file('mission');
            if (!missionFile) {
                result.valid = false;
                result.errors.push('Missing mission file');
                return result;
            }

            // Try to parse mission file
            const missionContent = await missionFile.async('string');
            const mission = LuaParser.parse(missionContent);

            if (!mission || typeof mission !== 'object') {
                result.valid = false;
                result.errors.push('Invalid mission file format');
            }

            // Check for at least DEFAULT locale
            const defaultDict = zip.file('l10n/DEFAULT/dictionary');
            if (!defaultDict) {
                result.warnings.push('No DEFAULT locale dictionary found');
            }

        } catch (e) {
            result.valid = false;
            result.errors.push(`Validation error: ${e.message}`);
        }

        return result;
    }
};

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MizParser;
}
