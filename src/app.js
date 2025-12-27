/**
 * Miz Editor - Main Application
 * Web interface for extracting localizable text from DCS World .miz files
 */

(function() {
    'use strict';

    // State
    let currentFile = null;
    let parsedData = null;
    let extractionResult = null;

    // Import state
    let importMizFile = null;
    let importTxtFile = null;
    let importedMizBlob = null;

    // DOM Elements
    const elements = {
        dropZone: document.getElementById('drop-zone'),
        fileInput: document.getElementById('file-input'),
        browseBtn: document.getElementById('browse-btn'),
        clearFileBtn: document.getElementById('clear-file-btn'),
        fileInfo: document.getElementById('file-info'),
        fileName: document.getElementById('file-name'),
        modeAuto: document.getElementById('mode-auto'),
        modeManual: document.getElementById('mode-manual'),
        manualCategories: document.getElementById('manual-categories'),
        localeSelect: document.getElementById('locale-select'),
        formatTxt: document.getElementById('format-txt'),
        formatJson: document.getElementById('format-json'),
        processBtn: document.getElementById('process-btn'),
        processText: document.getElementById('process-text'),
        processSpinner: document.getElementById('process-spinner'),
        progressSection: document.getElementById('progress-section'),
        progressBar: document.getElementById('progress-bar'),
        progressText: document.getElementById('progress-text'),
        resultsSection: document.getElementById('results-section'),
        outputPreview: document.getElementById('output-preview'),
        extractionStats: document.getElementById('extraction-stats'),
        downloadBtn: document.getElementById('download-btn'),
        errorSection: document.getElementById('error-section'),
        errorMessage: document.getElementById('error-message'),
        // Import elements
        importMizInput: document.getElementById('import-miz-input'),
        importMizInfo: document.getElementById('import-miz-info'),
        importMizName: document.getElementById('import-miz-name'),
        importTxtInput: document.getElementById('import-txt-input'),
        importTxtInfo: document.getElementById('import-txt-info'),
        importTxtName: document.getElementById('import-txt-name'),
        importLocaleSelect: document.getElementById('import-locale-select'),
        importBtn: document.getElementById('import-btn'),
        importText: document.getElementById('import-text'),
        importSpinner: document.getElementById('import-spinner'),
        importProgressSection: document.getElementById('import-progress-section'),
        importProgressBar: document.getElementById('import-progress-bar'),
        importProgressText: document.getElementById('import-progress-text'),
        importSuccessSection: document.getElementById('import-success-section'),
        downloadImportedBtn: document.getElementById('download-imported-btn'),
        importErrorSection: document.getElementById('import-error-section'),
        importErrorMessage: document.getElementById('import-error-message'),
        // Language selector
        languageSelector: document.getElementById('language-selector')
    };

    // Initialize the application
    async function init() {
        // Initialize i18n first
        if (window.i18n) {
            await window.i18n.init();
        }
        setupEventListeners();
        checkElectronEnvironment();
    }

    // Setup all event listeners
    function setupEventListeners() {
        // File input handling
        elements.browseBtn.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', handleFileSelect);
        elements.clearFileBtn.addEventListener('click', clearFile);

        // Drag and drop
        elements.dropZone.addEventListener('dragover', handleDragOver);
        elements.dropZone.addEventListener('dragleave', handleDragLeave);
        elements.dropZone.addEventListener('drop', handleDrop);
        elements.dropZone.addEventListener('click', () => elements.fileInput.click());

        // Mode selection
        elements.modeAuto.addEventListener('change', handleModeChange);
        elements.modeManual.addEventListener('change', handleModeChange);

        // Process button
        elements.processBtn.addEventListener('click', processFile);

        // Download button
        elements.downloadBtn.addEventListener('click', downloadOutput);

        // Import handlers
        elements.importMizInput.addEventListener('change', handleImportMizSelect);
        elements.importTxtInput.addEventListener('change', handleImportTxtSelect);
        elements.importBtn.addEventListener('click', performImport);
        elements.downloadImportedBtn.addEventListener('click', downloadImportedMiz);

        // Language selector handler
        if (elements.languageSelector) {
            elements.languageSelector.addEventListener('change', handleLanguageChange);
        }
    }

    // Handle language change
    function handleLanguageChange(event) {
        const newLanguage = event.target.value;
        if (window.i18n) {
            window.i18n.setLanguage(newLanguage, true);
        }
    }

    // Check if running in Electron
    function checkElectronEnvironment() {
        if (typeof window !== 'undefined' && window.electronAPI) {
            console.log('Running in Electron environment');
            // Electron-specific setup can be added here
        }
    }

    // Handle file selection from input
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            loadFile(file);
        }
    }

    // Handle drag over
    function handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        elements.dropZone.classList.add('drag-over');
    }

    // Handle drag leave
    function handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        elements.dropZone.classList.remove('drag-over');
    }

    // Handle file drop
    function handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        elements.dropZone.classList.remove('drag-over');

        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.toLowerCase().endsWith('.miz')) {
                loadFile(file);
            } else {
                showError('Please select a valid .miz file');
            }
        }
    }

    // Load a file
    function loadFile(file) {
        if (!file.name.toLowerCase().endsWith('.miz')) {
            showError('Please select a valid .miz file');
            return;
        }

        currentFile = file;
        parsedData = null;
        extractionResult = null;

        // Update UI
        elements.fileName.textContent = file.name;
        elements.fileInfo.classList.remove('d-none');
        elements.processBtn.disabled = false;
        hideError();
        hideResults();
    }

    // Clear the current file
    function clearFile() {
        currentFile = null;
        parsedData = null;
        extractionResult = null;

        elements.fileInput.value = '';
        elements.fileInfo.classList.add('d-none');
        elements.processBtn.disabled = true;
        hideResults();
        hideError();
    }

    // Handle mode change
    function handleModeChange() {
        if (elements.modeManual.checked) {
            elements.manualCategories.classList.remove('d-none');
        } else {
            elements.manualCategories.classList.add('d-none');
        }
    }

    // Process the file
    async function processFile() {
        if (!currentFile) {
            showError('Please select a .miz file first');
            return;
        }

        // Show progress
        showProgress();
        setProcessing(true);
        hideError();
        hideResults();

        try {
            // Parse the .miz file
            parsedData = await MizParser.parse(currentFile, updateProgress);

            updateProgress(80, 'Extracting text...');

            // Get extraction options
            const options = getExtractionOptions();

            // Update locale dropdown with available locales
            updateLocaleDropdown(parsedData.availableLocales);

            // Extract text
            extractionResult = MizParser.extractText(parsedData, options);

            updateProgress(90, 'Formatting output...');

            // Display results
            displayResults();

            updateProgress(100, 'Complete!');

            // Hide progress after a short delay
            setTimeout(() => {
                hideProgress();
            }, 500);

        } catch (error) {
            console.error('Processing error:', error);
            showError(error.message || 'An error occurred while processing the file');
            hideProgress();
        } finally {
            setProcessing(false);
        }
    }

    // Get extraction options from UI
    function getExtractionOptions() {
        const mode = elements.modeManual.checked ? 'manual' : 'auto';
        const categories = [];

        if (mode === 'manual') {
            const checkboxes = document.querySelectorAll('.category-checkbox:checked');
            checkboxes.forEach(cb => categories.push(cb.value));
        }

        return {
            mode: mode,
            categories: categories,
            preferredLocale: elements.localeSelect.value
        };
    }

    // Update locale dropdown with available locales
    function updateLocaleDropdown(availableLocales) {
        const currentValue = elements.localeSelect.value;

        // Keep DEFAULT and RU as base options
        elements.localeSelect.innerHTML = `
            <option value="DEFAULT">DEFAULT (Primary)</option>
            <option value="RU">Russian (RU)</option>
        `;

        // Add any additional locales found
        for (const locale of availableLocales) {
            if (locale !== 'DEFAULT' && locale !== 'RU') {
                const option = document.createElement('option');
                option.value = locale;
                option.textContent = locale;
                elements.localeSelect.appendChild(option);
            }
        }

        // Restore selection if available
        if (availableLocales.includes(currentValue)) {
            elements.localeSelect.value = currentValue;
        }
    }

    // Display extraction results
    function displayResults() {
        if (!extractionResult) return;

        // Format output based on selected format
        const format = elements.formatJson.checked ? 'json' : 'txt';
        let output;

        if (format === 'json') {
            output = MizParser.formatAsJson(extractionResult);
        } else {
            output = MizParser.formatAsText(extractionResult);
        }

        // Update preview
        elements.outputPreview.value = output;

        // Update stats with validation info
        let statsText = `${extractionResult.stats.totalStrings} strings (${extractionResult.stats.uniqueStrings} unique)`;

        // Show validation warnings/errors per issue #7
        if (extractionResult.validation) {
            if (!extractionResult.validation.isComplete) {
                if (extractionResult.validation.errors.length > 0) {
                    statsText += `\n⚠️ Errors: ${extractionResult.validation.errors.join(', ')}`;
                }
                if (extractionResult.validation.warnings.length > 0) {
                    statsText += `\n⚠️ Warnings: ${extractionResult.validation.warnings.join(', ')}`;
                }
            } else {
                statsText += '\n✅ Complete extraction (briefings, triggers, and radio messages)';
            }
        }

        elements.extractionStats.textContent = statsText;

        // Show results section
        elements.resultsSection.classList.remove('d-none');
    }

    // Download the output
    function downloadOutput() {
        if (!extractionResult || !currentFile) return;

        const format = elements.formatJson.checked ? 'json' : 'txt';
        let content, mimeType, extension;

        if (format === 'json') {
            content = MizParser.formatAsJson(extractionResult);
            mimeType = 'application/json';
            extension = 'json';
        } else {
            content = MizParser.formatAsText(extractionResult);
            mimeType = 'text/plain';
            extension = 'txt';
        }

        // Generate filename from original file
        const baseName = currentFile.name.replace(/\.miz$/i, '');
        const fileName = `${baseName}_extracted.${extension}`;

        // Create download
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }

    // Progress updates
    function updateProgress(percent, message) {
        elements.progressBar.style.width = `${percent}%`;
        elements.progressText.textContent = message;
    }

    function showProgress() {
        elements.progressSection.classList.remove('d-none');
        updateProgress(0, 'Starting...');
    }

    function hideProgress() {
        elements.progressSection.classList.add('d-none');
    }

    // Processing state
    function setProcessing(isProcessing) {
        elements.processBtn.disabled = isProcessing || !currentFile;
        const t = window.i18n ? window.i18n.t : (key) => key;
        if (isProcessing) {
            elements.processText.textContent = t('export.process.processing');
            elements.processSpinner.classList.remove('d-none');
        } else {
            elements.processText.textContent = t('export.process.button');
            elements.processSpinner.classList.add('d-none');
        }
    }

    // Error handling
    function showError(message) {
        elements.errorMessage.textContent = message;
        elements.errorSection.classList.remove('d-none');
    }

    function hideError() {
        elements.errorSection.classList.add('d-none');
    }

    // Results display
    function hideResults() {
        elements.resultsSection.classList.add('d-none');
    }

    // ========== IMPORT FUNCTIONALITY ==========

    // Handle import .miz file selection
    function handleImportMizSelect(event) {
        const file = event.target.files[0];
        if (file && file.name.toLowerCase().endsWith('.miz')) {
            importMizFile = file;
            elements.importMizName.textContent = file.name;
            elements.importMizInfo.classList.remove('d-none');
            checkImportReady();
            hideImportError();
        } else {
            showImportError('Please select a valid .miz file');
        }
    }

    // Handle import .txt file selection
    function handleImportTxtSelect(event) {
        const file = event.target.files[0];
        if (file && file.name.toLowerCase().endsWith('.txt')) {
            importTxtFile = file;
            elements.importTxtName.textContent = file.name;
            elements.importTxtInfo.classList.remove('d-none');
            checkImportReady();
            hideImportError();
        } else {
            showImportError('Please select a valid .txt file');
        }
    }

    // Check if import is ready
    function checkImportReady() {
        elements.importBtn.disabled = !(importMizFile && importTxtFile);
    }

    // Perform import
    async function performImport() {
        if (!importMizFile || !importTxtFile) {
            showImportError('Please select both .miz and .txt files');
            return;
        }

        // Show progress
        showImportProgress();
        setImportProcessing(true);
        hideImportError();
        hideImportSuccess();

        try {
            // Read the translated text file
            const txtContent = await readTextFile(importTxtFile);

            updateImportProgress(20, 'Text file loaded...');

            // Get target locale
            const targetLocale = elements.importLocaleSelect.value;

            // Validate original .miz file
            updateImportProgress(30, 'Validating .miz file...');
            const validation = await MizParser.validateMiz(importMizFile);

            if (!validation.valid) {
                throw new Error(`Invalid .miz file: ${validation.errors.join(', ')}`);
            }

            // Perform import
            importedMizBlob = await MizParser.importToMiz(
                importMizFile,
                txtContent,
                targetLocale,
                (percent, message) => {
                    updateImportProgress(30 + (percent * 0.7), message);
                }
            );

            updateImportProgress(100, 'Import complete!');

            // Show success
            setTimeout(() => {
                hideImportProgress();
                showImportSuccess();
            }, 500);

        } catch (error) {
            console.error('Import error:', error);
            showImportError(error.message || 'An error occurred during import');
            hideImportProgress();
        } finally {
            setImportProcessing(false);
        }
    }

    // Download imported .miz file
    function downloadImportedMiz() {
        if (!importedMizBlob || !importMizFile) return;

        const baseName = importMizFile.name.replace(/\.miz$/i, '');
        const locale = elements.importLocaleSelect.value;
        const fileName = `${baseName}_${locale}.miz`;

        const url = URL.createObjectURL(importedMizBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Read text file
    function readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    // Import progress updates
    function updateImportProgress(percent, message) {
        elements.importProgressBar.style.width = `${percent}%`;
        elements.importProgressText.textContent = message;
    }

    function showImportProgress() {
        elements.importProgressSection.classList.remove('d-none');
        updateImportProgress(0, 'Starting...');
    }

    function hideImportProgress() {
        elements.importProgressSection.classList.add('d-none');
    }

    // Import processing state
    function setImportProcessing(isProcessing) {
        elements.importBtn.disabled = isProcessing || !(importMizFile && importTxtFile);
        const t = window.i18n ? window.i18n.t : (key) => key;
        if (isProcessing) {
            elements.importText.textContent = t('import.process.importing');
            elements.importSpinner.classList.remove('d-none');
        } else {
            elements.importText.textContent = t('import.process.button');
            elements.importSpinner.classList.add('d-none');
        }
    }

    // Import error handling
    function showImportError(message) {
        elements.importErrorMessage.textContent = message;
        elements.importErrorSection.classList.remove('d-none');
    }

    function hideImportError() {
        elements.importErrorSection.classList.add('d-none');
    }

    // Import success display
    function showImportSuccess() {
        elements.importSuccessSection.classList.remove('d-none');
    }

    function hideImportSuccess() {
        elements.importSuccessSection.classList.add('d-none');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for testing
    window.MizEditorApp = {
        loadFile,
        processFile,
        clearFile,
        getExtractionOptions,
        performImport,
        downloadImportedMiz
    };
})();
