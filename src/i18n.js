const translations = {};
let currentLanguage = 'en';

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
    console.log(`[i18n] Language '${lang}' loaded successfully.`);
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