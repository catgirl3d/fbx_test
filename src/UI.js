/**
 * Lightweight UI initializer for the refactor.
 * Exposes initUI({ onLoadFile, onApplyHDRI, onResetAll, onFrame, onClearScene, getSettings, setSettings })
 *
 * This module expects the DOM structure in the original index.html (elements by id).
 * It handles language switching (i18n), theme toggle, basic bindings and settings persistence.
 */

import { t, loadLanguage, enableDiagnostics, getDiagnostics, resetDiagnostics } from './i18n.js';
import Logger from './core/Logger.js';
import dom from './DOMManager.js'; // Import DOMManager

const LS_KEY = 'viewerSettings.v1';

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}
function saveSettings(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s || {})); } catch {}
}

/**
 * initUI
 * @param {Object} opts
 * @param {(file:File)=>void} opts.onLoadFile
 * @param {(url:string)=>Promise<void>} opts.onApplyHDRI
 * @param {()=>void} opts.onResetAll
 * @param {()=>void} opts.onFrame
 * @param {()=>void} opts.onClearScene
 * @param {()=>Object} [opts.getSettings]
 * @param {(s:Object)=>void} [opts.setSettings]
 */
export function initUI({
  onLoadFile, onApplyHDRI, onApplyTextures, onResetAll, onFrame, onClearScene, getSettings, setSettings
} = {}) {
  // Enable runtime diagnostics for i18n key usage tracking
  enableDiagnostics(true);
  
  // Log initial diagnostic state
  Logger.log('[UI] Runtime diagnostics initialized for i18n key tracking.');
  const d = document;
  const fileInput = d.getElementById('file-input');
  const resetCameraBtn = d.getElementById('reset-camera');
  const clearSceneBtn = d.getElementById('clear-scene');
  const resetAllBtn = d.getElementById('reset-all');
  const applyHdriBtn = d.getElementById('apply-hdri');
  const hdriUrlInput = d.getElementById('hdri-url');
  const applyTexturesBtn = d.getElementById('apply-textures');
  const textureInput = d.getElementById('texture-input');
  const langSelect = d.getElementById('lang');
  const themeToggle = d.getElementById('theme-toggle');
  const themeIcon = d.getElementById('theme-icon');
  const dropZone = d.getElementById('drop-zone'); // Get the drop zone element
  
  // Movement sensitivity control
  const movementSensitivityInput = d.getElementById('movement-sensitivity');
  const movementSensitivityValue = d.getElementById('movement-sensitivity-val');

  // helper: apply language strings to elements using [data-i]
  function applyLang() {
    document.querySelectorAll('[data-i]').forEach(el => {
      const key = el.getAttribute('data-i');
      el.textContent = t(key);
    });
    const openInspectorBtn = d.getElementById('open-inspector');
    if (openInspectorBtn) openInspectorBtn.title = t('btnShowInspector');
    
    // Update inspector title specifically (in case inspector panel is not visible when applyLang is called)
    const inspectorTitle = d.querySelector('#scene-inspector header strong[data-i="inspector"]');
    if (inspectorTitle) inspectorTitle.textContent = t('inspector');
  }

  function isDark() { return d.body.classList.contains('theme-dark'); }
  function setTheme(theme) {
    d.body.classList.toggle('theme-dark', theme === 'dark');
    if (themeIcon) { themeIcon.classList.remove('fa-sun', 'fa-moon'); themeIcon.classList.add(theme === 'dark' ? 'fa-moon' : 'fa-sun'); }
    persist();
  }

  function persist() {
    const s = getSettings ? getSettings() : loadSettings();
    // try to store some UI fields (lang, theme)
    s.lang = langSelect?.value || s.lang;
    s.theme = isDark() ? 'dark' : 'light';
    saveSettings(s);
    if (setSettings) setSettings(s);
  }

  // restore saved settings
  (async function restore() {
    const s = getSettings ? getSettings() : loadSettings();
    if (s.theme) setTheme(s.theme); else setTheme('light');
    // Restore language, load it, then apply translations
    const lang = s.lang || (navigator.language.startsWith('ru') ? 'ru' : 'en');
    langSelect.value = lang;
    await loadLanguage(lang);
    applyLang();
  })();

  // Bind file input
  fileInput?.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0 && onLoadFile) {
      onLoadFile(files);
    }
    fileInput.value = '';
  });

  // Reset / clear buttons
  resetCameraBtn?.addEventListener('click', () => {
    onFrame && onFrame();
    // Also trigger the same logic as the R hotkey - reset camera to initial transform
    if (typeof window !== 'undefined' && window.camera && window.controls) {
      window.camera.position.set(2, 1.2, 3);
      window.controls.target.set(0, 0.8, 0);
      window.controls.update();
    }
  });
  clearSceneBtn?.addEventListener('click', () => {
    onClearScene && onClearScene();
    persistedToast(t('sceneCleared'));
    persist();
    // Also trigger the same logic as the Delete hotkey - clear selection
    if (typeof window !== 'undefined' && window.clearSelection) {
      window.clearSelection();
    }
  });

  resetAllBtn?.addEventListener('click', () => {
    if (onResetAll) onResetAll();
    persistedToast(t('settingsReset'));
  });

  // HDRI apply
  applyHdriBtn?.addEventListener('click', () => {
    if (onApplyHDRI) onApplyHDRI(hdriUrlInput.value.trim());
  });

  // Apply textures button
  applyTexturesBtn?.addEventListener('click', () => {
    if (onApplyTextures) {
      const file = textureInput.files?.[0];
      if (file) {
        onApplyTextures(file);
      } else {
        toast(t('selectZipFile'));
      }
    }
  });

  // Texture input change
  textureInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.zip')) {
      toast(t('fileSelected', { filename: file.name }));
    } else if (file) {
      toast(t('selectZipFile'));
      textureInput.value = '';
    }
  });

  // Theme toggle
  themeToggle?.addEventListener('click', () => setTheme(isDark() ? 'light' : 'dark'));

  // Language select
  langSelect?.addEventListener('change', async () => {
    await loadLanguage(langSelect.value);
    applyLang();
    persist();
  });

  // Small toast helper (non-blocking)
  const toastEl = d.getElementById('toast');
  function persistedToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  // Expose toast for app use
  const toast = persistedToast;

  // Initialize movement sensitivity control
  // Fixed: Guard against undefined getSettings and missing movementSensitivity property
  function initMovementSensitivityControl() {
    if (movementSensitivityInput) {
      // Set initial value from settings with fallback
      const settings = getSettings ? getSettings() : {};
      const currentSensitivity = settings.movementSensitivity || 5.0;
      movementSensitivityInput.value = currentSensitivity;
      if (movementSensitivityValue) {
        movementSensitivityValue.textContent = currentSensitivity.toFixed(1);
      }
      
      // Add event listener for live updates
      movementSensitivityInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (!isNaN(value) && value >= 0.1 && value <= 50) {
          const newSettings = getSettings ? getSettings() : {};
          newSettings.movementSensitivity = value;
          if (setSettings) setSettings(newSettings);
          if (movementSensitivityValue) {
            movementSensitivityValue.textContent = value.toFixed(1);
          }
        }
      });
    }
  }
  
  // Initialize the control after settings are restored
  setTimeout(initMovementSensitivityControl, 100);

  // Drag and Drop functionality
  if (dropZone) {
    dom.on(dropZone, 'dragover', (e) => {
      e.preventDefault(); // Prevent default to allow drop
      dom.addClass(dropZone, 'drag-over');
    });

    dom.on(dropZone, 'dragleave', () => {
      dom.removeClass(dropZone, 'drag-over');
    });

    dom.on(dropZone, 'drop', (e) => {
      e.preventDefault(); // Prevent default file opening
      dom.removeClass(dropZone, 'drag-over');

      const files = e.dataTransfer.files;
      if (files.length > 0 && onLoadFile) {
        // Pass all dropped files to the handler
        onLoadFile(files);
      }
    });
  }

  // Diagnostic helper functions
  function logDiagnostics() {
    const diagnostics = getDiagnostics();
    Logger.group('[UI] i18n Key Usage Diagnostics');
    Logger.log('Diagnostics enabled:', diagnostics.enabled);
    Logger.log('Total keys tracked:', diagnostics.totalKeys);
    Logger.log('Used keys:', diagnostics.usedKeys);
    Logger.log('Unused keys:', diagnostics.unusedKeys);
    Logger.log('Usage rate:', ((diagnostics.usedKeys / diagnostics.totalKeys) * 100).toFixed(1) + '%');
    
    // Log keys with usage details
    if (Object.keys(diagnostics.keyUsage).length > 0) {
      Logger.group('Key Usage Details');
      Object.entries(diagnostics.keyUsage).forEach(([key, usage]) => {
        Logger.log(`${key}: ${usage.usageCount} uses, last used: ${usage.lastUsed ? usage.lastUsed.toISOString() : 'never'}`);
      });
      Logger.groupEnd();
    }
    Logger.groupEnd();
  }

  function exportDiagnostics() {
    const diagnostics = getDiagnostics();
    const exportData = {
      timestamp: new Date().toISOString(),
      diagnostics: diagnostics,
      usedKeys: Object.entries(diagnostics.keyUsage)
        .filter(([_, usage]) => usage.used)
        .map(([key, usage]) => ({
          key,
          usageCount: usage.usageCount,
          firstUsed: usage.firstUsed,
          lastUsed: usage.lastUsed
        })),
      unusedKeys: Object.entries(diagnostics.keyUsage)
        .filter(([_, usage]) => !usage.used)
        .map(([key]) => key)
    };
    
    Logger.log('[UI] Exported diagnostics data:', exportData);
    return exportData;
  }

  function resetUIDiagnostics() {
    resetDiagnostics();
    Logger.log('[UI] i18n diagnostic tracking data reset.');
  }

  // Log initial diagnostics after a short delay to allow some keys to be used
  setTimeout(() => {
    logDiagnostics();
  }, 2000);

  return {
    applyLang,
    setTheme,
    persist,
    toast: persistedToast,
    // Diagnostic functions
    logDiagnostics,
    exportDiagnostics,
    resetDiagnostics: resetUIDiagnostics
  };
}