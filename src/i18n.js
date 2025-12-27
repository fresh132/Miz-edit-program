/**
 * Miz Editor - Internationalization (i18n) Module
 * Handles language switching and text lookups
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'miz-editor-language';
    const DEFAULT_LANGUAGE = 'en';
    const SUPPORTED_LANGUAGES = ['en', 'ru'];

    // Translations cache
    let translations = {};
    let currentLanguage = DEFAULT_LANGUAGE;
    let isInitialized = false;

    /**
     * Get the saved language preference or detect from browser
     */
    function getPreferredLanguage() {
        // Check localStorage first
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
            return saved;
        }

        // Detect from browser language
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang) {
            const langCode = browserLang.split('-')[0].toLowerCase();
            if (SUPPORTED_LANGUAGES.includes(langCode)) {
                return langCode;
            }
        }

        return DEFAULT_LANGUAGE;
    }

    /**
     * Load translations for a language
     */
    async function loadTranslations(lang) {
        try {
            const response = await fetch(`locales/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${lang}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error loading translations for ${lang}:`, error);
            // Fallback to English if loading fails
            if (lang !== DEFAULT_LANGUAGE) {
                return loadTranslations(DEFAULT_LANGUAGE);
            }
            return {};
        }
    }

    /**
     * Initialize the i18n module
     */
    async function init() {
        if (isInitialized) return;

        currentLanguage = getPreferredLanguage();
        translations = await loadTranslations(currentLanguage);
        isInitialized = true;

        // Apply translations to the page
        applyTranslations();

        return currentLanguage;
    }

    /**
     * Get a nested property from an object using dot notation
     * @param {Object} obj - The object to search
     * @param {string} path - The dot-notated path (e.g., 'app.title')
     * @returns {string} The value or the path if not found
     */
    function getNestedValue(obj, path) {
        const keys = path.split('.');
        let value = obj;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return path; // Return the path as fallback
            }
        }

        return value;
    }

    /**
     * Get a translated string by key
     * @param {string} key - The translation key (dot notation, e.g., 'app.title')
     * @param {Object} params - Optional parameters for string interpolation
     * @returns {string} The translated string
     */
    function t(key, params = {}) {
        let text = getNestedValue(translations, key);

        if (typeof text !== 'string') {
            console.warn(`Translation key not found: ${key}`);
            return key;
        }

        // Simple parameter interpolation: {{paramName}}
        Object.keys(params).forEach(param => {
            text = text.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
        });

        return text;
    }

    /**
     * Get the current language code
     */
    function getCurrentLanguage() {
        return currentLanguage;
    }

    /**
     * Get all supported languages
     */
    function getSupportedLanguages() {
        return [...SUPPORTED_LANGUAGES];
    }

    /**
     * Change the application language
     * @param {string} lang - The language code
     * @param {boolean} reload - Whether to reload the page
     */
    async function setLanguage(lang, reload = true) {
        if (!SUPPORTED_LANGUAGES.includes(lang)) {
            console.error(`Unsupported language: ${lang}`);
            return false;
        }

        if (lang === currentLanguage) {
            return true;
        }

        // Save preference
        localStorage.setItem(STORAGE_KEY, lang);

        if (reload) {
            // Show confirmation dialog
            showReloadDialog(lang);
        } else {
            // Load new translations without reload
            currentLanguage = lang;
            translations = await loadTranslations(lang);
            applyTranslations();
        }

        return true;
    }

    /**
     * Show a reload confirmation dialog
     */
    function showReloadDialog(newLang) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'i18n-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;

        // Create modal dialog
        const modal = document.createElement('div');
        modal.className = 'i18n-modal';
        modal.style.cssText = `
            background-color: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            text-align: center;
        `;

        const title = t('language.reloadTitle');
        const message = t('language.reloadMessage');
        const reloadNow = t('language.reloadNow');
        const reloadLater = t('language.reloadLater');

        modal.innerHTML = `
            <h4 style="margin-bottom: 16px; color: #343a40;">${title}</h4>
            <p style="margin-bottom: 24px; color: #6c757d;">${message}</p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="i18n-reload-later" class="btn btn-outline-secondary">${reloadLater}</button>
                <button id="i18n-reload-now" class="btn btn-primary">${reloadNow}</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Event handlers
        document.getElementById('i18n-reload-now').addEventListener('click', () => {
            window.location.reload();
        });

        document.getElementById('i18n-reload-later').addEventListener('click', () => {
            overlay.remove();
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    /**
     * Apply translations to all elements with data-i18n attribute
     */
    function applyTranslations() {
        // Update page title
        document.title = t('app.title') + ' - DCS World Mission Text Extractor';

        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translated = t(key);

            // Check if it's an attribute translation (format: attr:key)
            if (key.includes(':')) {
                const [attr, actualKey] = key.split(':');
                element.setAttribute(attr, t(actualKey));
            } else {
                element.textContent = translated;
            }
        });

        // Update all elements with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = t(key);
        });

        // Update HTML lang attribute
        document.documentElement.lang = currentLanguage;

        // Update language selector if exists
        const langSelector = document.getElementById('language-selector');
        if (langSelector) {
            langSelector.value = currentLanguage;
        }
    }

    // Expose the i18n API globally
    window.i18n = {
        init,
        t,
        getCurrentLanguage,
        getSupportedLanguages,
        setLanguage,
        applyTranslations
    };
})();
