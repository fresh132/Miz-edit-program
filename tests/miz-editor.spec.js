// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Miz Editor UI Tests
 */

test.describe('Miz Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Miz Editor/);
  });

  test('should display main UI elements', async ({ page }) => {
    // Check header
    await expect(page.locator('h1')).toContainText('Miz Editor');

    // Check file upload section
    await expect(page.locator('#drop-zone')).toBeVisible();
    await expect(page.locator('#browse-btn')).toBeVisible();

    // Check mode selection
    await expect(page.locator('#mode-auto')).toBeVisible();
    await expect(page.locator('#mode-manual')).toBeVisible();

    // Check locale selection
    await expect(page.locator('#locale-select')).toBeVisible();

    // Check output format options
    await expect(page.locator('#format-txt')).toBeVisible();
    await expect(page.locator('#format-json')).toBeVisible();

    // Check process button
    await expect(page.locator('#process-btn')).toBeVisible();
    await expect(page.locator('#process-btn')).toBeDisabled();
  });

  test('should have auto mode selected by default', async ({ page }) => {
    await expect(page.locator('#mode-auto')).toBeChecked();
    await expect(page.locator('#mode-manual')).not.toBeChecked();
  });

  test('should show manual categories when manual mode is selected', async ({ page }) => {
    // Manual categories should be hidden initially
    await expect(page.locator('#manual-categories')).toHaveClass(/d-none/);

    // Click manual mode
    await page.locator('#mode-manual').click();

    // Manual categories should now be visible
    await expect(page.locator('#manual-categories')).not.toHaveClass(/d-none/);

    // Check all category checkboxes are present
    await expect(page.locator('#cat-briefings')).toBeVisible();
    await expect(page.locator('#cat-tasks')).toBeVisible();
    await expect(page.locator('#cat-triggers')).toBeVisible();
    await expect(page.locator('#cat-units')).toBeVisible();
    await expect(page.locator('#cat-waypoints')).toBeVisible();
    await expect(page.locator('#cat-radio')).toBeVisible();
  });

  test('should hide manual categories when switching back to auto mode', async ({ page }) => {
    // Switch to manual mode
    await page.locator('#mode-manual').click();
    await expect(page.locator('#manual-categories')).not.toHaveClass(/d-none/);

    // Switch back to auto mode
    await page.locator('#mode-auto').click();
    await expect(page.locator('#manual-categories')).toHaveClass(/d-none/);
  });

  test('should have text format selected by default', async ({ page }) => {
    await expect(page.locator('#format-txt')).toBeChecked();
    await expect(page.locator('#format-json')).not.toBeChecked();
  });

  test('should have DEFAULT locale selected by default', async ({ page }) => {
    const localeSelect = page.locator('#locale-select');
    await expect(localeSelect).toHaveValue('DEFAULT');
  });

  test('should show error section when hidden initially', async ({ page }) => {
    await expect(page.locator('#error-section')).toHaveClass(/d-none/);
  });

  test('should show results section when hidden initially', async ({ page }) => {
    await expect(page.locator('#results-section')).toHaveClass(/d-none/);
  });

  test('should show progress section when hidden initially', async ({ page }) => {
    await expect(page.locator('#progress-section')).toHaveClass(/d-none/);
  });
});

test.describe('Miz Editor - File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should enable process button after file upload', async ({ page }) => {
    // Create a sample miz file (ZIP with minimal content)
    const sampleMizPath = path.join(__dirname, '..', 'samples', 'sample_mission.miz');

    // Check if sample file exists, if not skip test
    if (!fs.existsSync(sampleMizPath)) {
      test.skip();
      return;
    }

    // Upload file
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(sampleMizPath);

    // Process button should be enabled
    await expect(page.locator('#process-btn')).toBeEnabled();

    // File info should be visible
    await expect(page.locator('#file-info')).not.toHaveClass(/d-none/);
    await expect(page.locator('#file-name')).toContainText('sample_mission.miz');
  });

  test('should clear file when clear button is clicked', async ({ page }) => {
    const sampleMizPath = path.join(__dirname, '..', 'samples', 'sample_mission.miz');

    if (!fs.existsSync(sampleMizPath)) {
      test.skip();
      return;
    }

    // Upload file
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(sampleMizPath);

    // Clear file
    await page.locator('#clear-file-btn').click();

    // File info should be hidden
    await expect(page.locator('#file-info')).toHaveClass(/d-none/);

    // Process button should be disabled
    await expect(page.locator('#process-btn')).toBeDisabled();
  });
});

test.describe('Miz Editor - Processing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should process sample miz file and show results', async ({ page }) => {
    const sampleMizPath = path.join(__dirname, '..', 'samples', 'sample_mission.miz');

    if (!fs.existsSync(sampleMizPath)) {
      test.skip();
      return;
    }

    // Upload file
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(sampleMizPath);

    // Click process
    await page.locator('#process-btn').click();

    // Wait for results to appear (with timeout)
    await expect(page.locator('#results-section')).not.toHaveClass(/d-none/, { timeout: 10000 });

    // Output preview should have content
    const outputPreview = page.locator('#output-preview');
    await expect(outputPreview).not.toBeEmpty();

    // Download button should be visible
    await expect(page.locator('#download-btn')).toBeVisible();

    // Stats should be displayed
    await expect(page.locator('#extraction-stats')).not.toBeEmpty();
  });

  test('should format output as JSON when JSON format is selected', async ({ page }) => {
    const sampleMizPath = path.join(__dirname, '..', 'samples', 'sample_mission.miz');

    if (!fs.existsSync(sampleMizPath)) {
      test.skip();
      return;
    }

    // Select JSON format
    await page.locator('#format-json').click();

    // Upload and process file
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(sampleMizPath);
    await page.locator('#process-btn').click();

    // Wait for results
    await expect(page.locator('#results-section')).not.toHaveClass(/d-none/, { timeout: 10000 });

    // Output should be valid JSON
    const outputText = await page.locator('#output-preview').inputValue();
    expect(() => JSON.parse(outputText)).not.toThrow();
  });

  test('should extract all 3 text types: briefings, triggers, and radio messages', async ({ page }) => {
    const sampleMizPath = path.join(__dirname, '..', 'samples', 'sample_mission.miz');

    if (!fs.existsSync(sampleMizPath)) {
      test.skip();
      return;
    }

    // Upload and process file
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(sampleMizPath);
    await page.locator('#process-btn').click();

    // Wait for results
    await expect(page.locator('#results-section')).not.toHaveClass(/d-none/, { timeout: 10000 });

    // Get the output text
    const outputText = await page.locator('#output-preview').inputValue();

    // Verify all three required sections are present
    expect(outputText).toContain('БРИФИНГ:');
    expect(outputText).toContain('BRIEFING:');
    expect(outputText).toContain('ТРИГГЕРЫ:');
    expect(outputText).toContain('TRIGGERS:');
    expect(outputText).toContain('РАДИОСООБЩЕНИЯ:');
    expect(outputText).toContain('RADIO MESSAGES:');

    // Verify specific content from each category
    // Briefings
    expect(outputText).toContain('Sample Training Mission');
    expect(outputText).toContain('Blue coalition objective');

    // Triggers
    expect(outputText).toContain('Welcome to the training mission');
    expect(outputText).toContain('All objectives have been completed');

    // Radio messages
    expect(outputText).toContain('Overlord, Eagle Flight checking in');
    expect(outputText).toContain('Maintain CAP pattern');

    // Verify extraction stats show all categories have items
    const statsText = await page.locator('#extraction-stats').textContent();
    expect(statsText).toContain('briefings');
    expect(statsText).toContain('triggers');
    expect(statsText).toContain('radio');
  });
});

test.describe('Miz Editor - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    // Check progress bar has role
    await expect(page.locator('#progress-bar')).toHaveAttribute('role', 'progressbar');
  });

  test('should have proper labels for form elements', async ({ page }) => {
    // Check mode radio buttons have labels
    await expect(page.locator('label[for="mode-auto"]')).toBeVisible();
    await expect(page.locator('label[for="mode-manual"]')).toBeVisible();

    // Check format radio buttons have labels
    await expect(page.locator('label[for="format-txt"]')).toBeVisible();
    await expect(page.locator('label[for="format-json"]')).toBeVisible();
  });
});
