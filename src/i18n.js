const translations = {};
let currentLanguage = 'en';

// Runtime diagnostics for tracking i18n key usage
const keyUsageTracker = new Map();
let diagnosticsEnabled = false;

// Storage key for persistent diagnostics
const DIAGNOSTICS_STORAGE_KEY = 'i18n_key_usage_diagnostics';

/**
 * Loads diagnostic data from localStorage.
 * @returns {boolean} True if data was loaded successfully, false otherwise.
 */
function loadDiagnosticsFromStorage() {
  try {
    const storedData = localStorage.getItem(DIAGNOSTICS_STORAGE_KEY);
    if (!storedData) {
      console.log('[i18n] No diagnostic data found in localStorage.');
      return false;
    }

    const parsedData = JSON.parse(storedData);
    if (!parsedData || !Array.isArray(parsedData)) {
      console.warn('[i18n] Invalid diagnostic data format in localStorage.');
      return false;
    }

    // Clear current tracker and populate from storage
    keyUsageTracker.clear();
    parsedData.forEach(item => {
      // Ensure keys are stored as Map entries
      keyUsageTracker.set(item.key, {
        used: item.used,
        usageCount: item.usageCount,
        firstUsed: item.firstUsed ? new Date(item.firstUsed) : null,
        lastUsed: item.lastUsed ? new Date(item.lastUsed) : null
      });
    });

    console.log(`[i18n] Loaded ${keyUsageTracker.size} diagnostic entries from localStorage.`);
    return true;
  } catch (error) {
    console.error('[i18n] Error loading diagnostic data from localStorage:', error);
    return false;
  }
}

/**
 * Saves the current keyUsageTracker data to localStorage.
 */
function saveDiagnosticsToStorage() {
  try {
    // Convert Map to an array of objects for JSON stringification
    const dataToStore = Array.from(keyUsageTracker.entries()).map(([key, usage]) => ({
      key,
      used: usage.used,
      usageCount: usage.usageCount,
      firstUsed: usage.firstUsed,
      lastUsed: usage.lastUsed
    }));
    localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, JSON.stringify(dataToStore));
  } catch (error) {
    console.error('[i18n] Error saving diagnostic data to localStorage:', error);
  }
}

/**
 * Enables or disables runtime diagnostics for i18n key usage tracking.
 * @param {boolean} enabled - Whether to enable diagnostics.
 */
export function enableDiagnostics(enabled = true) {
  diagnosticsEnabled = enabled;
  if (enabled) {
    // Load existing diagnostics from storage if enabling
    loadDiagnosticsFromStorage();
    console.log('[i18n] Runtime diagnostics enabled. Tracking key usage...');
  } else {
    console.log('[i18n] Runtime diagnostics disabled.');
  }
}

/**
 * Records usage of an i18n key for diagnostic purposes.
 * @param {string} key - The translation key that was used.
 */
function recordKeyUsage(key) {
  if (!diagnosticsEnabled) return;
  
  if (!keyUsageTracker.has(key)) {
    keyUsageTracker.set(key, {
      used: false,
      usageCount: 0,
      firstUsed: null,
      lastUsed: null
    });
  }
  
  const usage = keyUsageTracker.get(key);
  usage.used = true;
  usage.usageCount++;
  usage.lastUsed = new Date();
  
  if (usage.firstUsed === null) {
    usage.firstUsed = new Date();
  }

  // Save changes to localStorage
  saveDiagnosticsToStorage();
}

/**
 * Gets diagnostic information about i18n key usage.
 * @returns {Object} Diagnostic information including key usage statistics.
 */
export function getDiagnostics() {
  const diagnostics = {
    enabled: diagnosticsEnabled,
    totalKeys: keyUsageTracker.size,
    usedKeys: 0,
    unusedKeys: 0,
    keyUsage: {}
  };
  
  keyUsageTracker.forEach((usage, key) => {
    diagnostics.keyUsage[key] = {
      used: usage.used,
      usageCount: usage.usageCount,
      firstUsed: usage.firstUsed,
      lastUsed: usage.lastUsed
    };
    
    if (usage.used) {
      diagnostics.usedKeys++;
    } else {
      diagnostics.unusedKeys++;
    }
  });
  
  return diagnostics;
}

/**
 * Resets the diagnostic tracking data.
 */
export function resetDiagnostics() {
  keyUsageTracker.clear();
  // Also clear the data from localStorage
  saveDiagnosticsToStorage();
  console.log('[i18n] Diagnostic tracking data reset.');
}

/**
 * Loads the language pack for the given language.
 * @param {string} lang - The language to load (e.g., 'en', 'ru').
 */
export async function loadLanguage(lang) {
  try {
    const response = await fetch(`src/locales/${lang}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load language pack for ${lang}`);
    }
    const data = await response.json();
    translations[lang] = data;
    currentLanguage = lang;

    // Ensure all keys from the loaded language pack are tracked, even if not yet used.
    // Merge with existing data from storage if the key is already tracked.
    for (const key in data) {
      if (!keyUsageTracker.has(key)) {
        keyUsageTracker.set(key, {
          used: false,
          usageCount: 0,
          firstUsed: null,
          lastUsed: null
        });
      }
    }
    // After merging, save the potentially updated tracker state to storage
    saveDiagnosticsToStorage();

    console.log(`[i18n] Language '${lang}' loaded successfully. Tracked ${keyUsageTracker.size} keys.`);
  } catch (error) {
    console.error(`[i18n] Error loading language '${lang}':`, error);
  }
}

/**
 * Returns the translated string for a given key.
 * @param {string} key - The translation key.
 * @param {object} [replacements] - Optional object with values to replace placeholders in the string.
 * @returns {string} The translated string, or the key itself if not found.
 */
export function t(key, replacements = {}) {
  // Record key usage for diagnostics
  recordKeyUsage(key);
  
  const langPack = translations[currentLanguage];
  if (!langPack) {
    console.warn(`[i18n] No language pack loaded for '${currentLanguage}'. Returning key: ${key}`);
    return key;
  }

  let translated = langPack[key];
  if (translated === undefined) {
    console.warn(`[i18n] Translation key '${key}' not found for language '${currentLanguage}'.`);
    return key;
  }

  // Replace placeholders like {value}
  for (const placeholder in replacements) {
    translated = translated.replace(new RegExp(`{${placeholder}}`, 'g'), replacements[placeholder]);
  }

  return translated;
}

/**
 * Returns the currently active language.
 * @returns {string} The current language code.
 */
export function getCurrentLanguage() {
  return currentLanguage;
}

// Load default language on module load
loadLanguage(currentLanguage);