const { test, expect } = require('@playwright/test');
const path = require('path');

test('check browser exports', async ({ page }) => {
    // Navigate to the test HTML file
    await page.goto('file://' + path.join(__dirname, 'test-browser-exports.html'));

    // Wait for the results to be displayed
    await page.waitForSelector('#results p');

    // Get all result paragraphs
    const results = await page.locator('#results p').allTextContents();

    console.log('Test results:');
    results.forEach(result => console.log('  ' + result));

    // Check if parsers are defined
    const luaParserDefined = await page.evaluate(() => typeof window.LuaParser !== 'undefined');
    const mizParserDefined = await page.evaluate(() => typeof window.MizParser !== 'undefined');

    console.log('\nDirect evaluation:');
    console.log('  window.LuaParser defined:', luaParserDefined);
    console.log('  window.MizParser defined:', mizParserDefined);

    // Assertions
    expect(luaParserDefined).toBe(true);
    expect(mizParserDefined).toBe(true);
});
