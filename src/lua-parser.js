/**
 * Lua Table Parser for DCS World mission files
 * Parses Lua table syntax into JavaScript objects
 */

var LuaParser = {
    /**
     * Parse a Lua table string into a JavaScript object
     * @param {string} luaString - The Lua code containing a table
     * @returns {object} Parsed JavaScript object
     */
    parse: function(luaString) {
        if (!luaString || typeof luaString !== 'string') {
            return {};
        }

        try {
            // Remove BOM if present
            luaString = luaString.replace(/^\uFEFF/, '');

            // Remove Lua comments (-- comment and --[[ multiline ]])
            luaString = this.removeComments(luaString);

            // Handle dictionary files that start with "dictionary = {" or just "return {"
            let match = luaString.match(/(?:dictionary\s*=\s*|return\s*)(\{[\s\S]*\})\s*;?\s*$/);
            if (match) {
                luaString = match[1];
            }

            // Parse the main table
            return this.parseTable(luaString.trim());
        } catch (e) {
            console.error('Lua parse error:', e);
            return {};
        }
    },

    /**
     * Remove Lua comments from string
     */
    removeComments: function(str) {
        // Remove multi-line comments --[[ ... ]]
        str = str.replace(/--\[\[[\s\S]*?\]\]/g, '');
        // Remove single-line comments -- ...
        str = str.replace(/--[^\n]*/g, '');
        return str;
    },

    /**
     * Parse a Lua table structure
     */
    parseTable: function(str) {
        str = str.trim();

        if (!str.startsWith('{') || !str.endsWith('}')) {
            // Try to find a table within the string
            const tableMatch = str.match(/\{[\s\S]*\}/);
            if (tableMatch) {
                str = tableMatch[0];
            } else {
                return {};
            }
        }

        // Remove outer braces
        str = str.slice(1, -1).trim();

        const result = {};
        const arrayItems = [];
        let isArray = true;
        let index = 0;

        while (index < str.length) {
            // Skip whitespace and commas
            while (index < str.length && /[\s,]/.test(str[index])) {
                index++;
            }

            if (index >= str.length) break;

            // Check if this is a key-value pair
            const keyValueResult = this.parseKeyValue(str, index);
            if (keyValueResult) {
                isArray = false;
                result[keyValueResult.key] = keyValueResult.value;
                index = keyValueResult.nextIndex;
            } else {
                // Try to parse as array value
                const valueResult = this.parseValue(str, index);
                if (valueResult) {
                    arrayItems.push(valueResult.value);
                    index = valueResult.nextIndex;
                } else {
                    index++;
                }
            }
        }

        // Return array if all items are array-style, otherwise return object
        if (isArray && arrayItems.length > 0 && Object.keys(result).length === 0) {
            return arrayItems;
        }

        // Merge array items into result with numeric keys
        arrayItems.forEach((item, i) => {
            result[i + 1] = item;
        });

        return result;
    },

    /**
     * Parse a key-value pair
     */
    parseKeyValue: function(str, startIndex) {
        let index = startIndex;
        let key = null;

        // Skip whitespace
        while (index < str.length && /\s/.test(str[index])) {
            index++;
        }

        // Check for ["key"] = syntax
        if (str[index] === '[') {
            index++; // skip [

            // Check for string key ["..."]
            if (str[index] === '"' || str[index] === "'") {
                const quote = str[index];
                index++;
                const keyStart = index;
                while (index < str.length && str[index] !== quote) {
                    if (str[index] === '\\') index++; // skip escaped char
                    index++;
                }
                key = str.slice(keyStart, index);
                key = this.unescapeString(key);
                index++; // skip closing quote
            } else {
                // Numeric key [123]
                const keyStart = index;
                while (index < str.length && /[\d]/.test(str[index])) {
                    index++;
                }
                key = parseInt(str.slice(keyStart, index));
            }

            // Skip to ]
            while (index < str.length && str[index] !== ']') {
                index++;
            }
            index++; // skip ]
        }
        // Check for identifier = syntax (like sortie = or trig = )
        else if (/[a-zA-Z_]/.test(str[index])) {
            const keyStart = index;
            while (index < str.length && /[a-zA-Z0-9_]/.test(str[index])) {
                index++;
            }
            const potentialKey = str.slice(keyStart, index);

            // Skip whitespace
            while (index < str.length && /\s/.test(str[index])) {
                index++;
            }

            // Check if followed by =
            if (str[index] === '=') {
                key = potentialKey;
            } else {
                // Not a key-value pair, return null
                return null;
            }
        } else {
            return null;
        }

        // Skip whitespace and =
        while (index < str.length && /[\s=]/.test(str[index])) {
            index++;
        }

        // Parse the value
        const valueResult = this.parseValue(str, index);
        if (!valueResult) {
            return null;
        }

        return {
            key: key,
            value: valueResult.value,
            nextIndex: valueResult.nextIndex
        };
    },

    /**
     * Parse a value (string, number, boolean, table, or nil)
     */
    parseValue: function(str, startIndex) {
        let index = startIndex;

        // Skip whitespace
        while (index < str.length && /\s/.test(str[index])) {
            index++;
        }

        if (index >= str.length) return null;

        const char = str[index];

        // String value
        if (char === '"' || char === "'") {
            return this.parseString(str, index);
        }

        // Multi-line string [[...]]
        if (char === '[' && str[index + 1] === '[') {
            return this.parseMultilineString(str, index);
        }

        // Table value
        if (char === '{') {
            return this.parseNestedTable(str, index);
        }

        // Boolean or nil
        if (str.slice(index, index + 4) === 'true') {
            return { value: true, nextIndex: index + 4 };
        }
        if (str.slice(index, index + 5) === 'false') {
            return { value: false, nextIndex: index + 5 };
        }
        if (str.slice(index, index + 3) === 'nil') {
            return { value: null, nextIndex: index + 3 };
        }

        // Number (including negative and decimal)
        if (/[-\d.]/.test(char)) {
            const numStart = index;
            if (char === '-') index++;
            while (index < str.length && /[\d.eE+-]/.test(str[index])) {
                index++;
            }
            const numStr = str.slice(numStart, index);
            const num = parseFloat(numStr);
            if (!isNaN(num)) {
                return { value: num, nextIndex: index };
            }
        }

        // Try to read as identifier (for enum values like "country.id.USA")
        if (/[a-zA-Z_]/.test(char)) {
            const identStart = index;
            while (index < str.length && /[a-zA-Z0-9_.]/.test(str[index])) {
                index++;
            }
            return { value: str.slice(identStart, index), nextIndex: index };
        }

        return null;
    },

    /**
     * Parse a quoted string
     */
    parseString: function(str, startIndex) {
        const quote = str[startIndex];
        let index = startIndex + 1;
        let result = '';

        while (index < str.length) {
            if (str[index] === '\\') {
                // Handle escape sequences
                index++;
                if (index < str.length) {
                    result += this.handleEscape(str[index]);
                    index++;
                }
            } else if (str[index] === quote) {
                // End of string
                return { value: result, nextIndex: index + 1 };
            } else {
                result += str[index];
                index++;
            }
        }

        return { value: result, nextIndex: index };
    },

    /**
     * Parse a multi-line string [[...]]
     */
    parseMultilineString: function(str, startIndex) {
        let index = startIndex + 2; // skip [[
        let result = '';

        // Check for [=[ style
        let equalSigns = 0;
        if (str[startIndex + 1] === '=') {
            index = startIndex + 1;
            while (str[index] === '=') {
                equalSigns++;
                index++;
            }
            index++; // skip the final [
        }

        const endPattern = ']' + '='.repeat(equalSigns) + ']';

        while (index < str.length) {
            if (str.slice(index, index + endPattern.length) === endPattern) {
                return { value: result, nextIndex: index + endPattern.length };
            }
            result += str[index];
            index++;
        }

        return { value: result, nextIndex: index };
    },

    /**
     * Parse a nested table
     */
    parseNestedTable: function(str, startIndex) {
        let depth = 0;
        let index = startIndex;

        // Find matching closing brace
        while (index < str.length) {
            if (str[index] === '{') {
                depth++;
            } else if (str[index] === '}') {
                depth--;
                if (depth === 0) {
                    const tableStr = str.slice(startIndex, index + 1);
                    return { value: this.parseTable(tableStr), nextIndex: index + 1 };
                }
            } else if (str[index] === '"' || str[index] === "'") {
                // Skip strings to avoid counting braces inside strings
                const quote = str[index];
                index++;
                while (index < str.length && str[index] !== quote) {
                    if (str[index] === '\\') index++;
                    index++;
                }
            } else if (str[index] === '[' && str[index + 1] === '[') {
                // Skip multi-line strings
                index += 2;
                while (index < str.length && !(str[index] === ']' && str[index + 1] === ']')) {
                    index++;
                }
                index++; // will be incremented again at end of loop
            }
            index++;
        }

        return null;
    },

    /**
     * Handle escape sequences
     */
    handleEscape: function(char) {
        switch (char) {
            case 'n': return '\n';
            case 't': return '\t';
            case 'r': return '\r';
            case '\\': return '\\';
            case '"': return '"';
            case "'": return "'";
            case '0': return '\0';
            default: return char;
        }
    },

    /**
     * Unescape a string
     */
    unescapeString: function(str) {
        return str.replace(/\\(.)/g, (match, char) => this.handleEscape(char));
    }
};

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LuaParser;
} else if (typeof window !== 'undefined') {
    window.LuaParser = LuaParser;
}
