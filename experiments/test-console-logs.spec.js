const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test('check console logs during processing', async ({ page }) => {
    const messages = [];

    // Listen to console messages
    page.on('console', msg => {
        messages.push({ type: msg.type(), text: msg.text() });
        console.log(`[${msg.type()}] ${msg.text()}`);
    });

    // Listen to page errors
    page.on('pageerror', error => {
        console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Navigate to the app
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check if parsers are defined via console
    const parserCheck = await page.evaluate(() => {
        const checks = {
            moduleType: typeof module,
            windowType: typeof window,
            luaParserType: typeof LuaParser,
            mizParserType: typeof MizParser,
            windowLuaParser: typeof window.LuaParser,
            windowMizParser: typeof window.MizParser
        };
        console.log('Parser check:', JSON.stringify(checks, null, 2));
        return checks;
    });

    console.log('\nParser check results:');
    console.log(JSON.stringify(parserCheck, null, 2));

    // Check if sample file exists
    const sampleMizPath = path.join(__dirname, '..', 'samples', 'sample_mission.miz');
    if (!fs.existsSync(sampleMizPath)) {
        console.log('Sample file not found, skipping');
        test.skip();
        return;
    }

    // Upload file
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(sampleMizPath);

    // Click process
    await page.locator('#process-btn').click();

    // Wait a bit to see what happens
    await page.waitForTimeout(2000);

    // Check if there's an error
    const errorVisible = await page.locator('#error-section').isVisible();
    if (errorVisible) {
        const errorText = await page.locator('#error-message').textContent();
        console.log('\nError message:', errorText);
    }

    // Check if results are visible
    const resultsVisible = await page.locator('#results-section').isVisible();
    console.log('\nResults visible:', resultsVisible);

    // Save console messages
    fs.writeFileSync(
        path.join(__dirname, '..', 'ci-logs', 'browser-console.json'),
        JSON.stringify(messages, null, 2)
    );
});
