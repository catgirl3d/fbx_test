/**
 * Lightweight UI initializer for the refactor.
 * Exposes initUI({ onLoadFile, onApplyHDRI, onResetAll, onFrame, onClearScene, getSettings, setSettings })
 *
 * This module expects the DOM structure in the original index.html (elements by id).
 * It handles language switching (i18n), theme toggle, basic bindings and settings persistence.
 */

const i18n = {
  ru: {
    title: '3D Viewer', btnLoad:'Загрузить модель', btnFrame:'К камере', btnClear:'Очистить',
    toggleShadows:'Тени', toggleLight:'Только освещение', toggleGrid:'Сетка', bgLabel:'Фон', btnApply:'Применить', toggleFlipUV:'Перевернуть UV',
    bgWhite:'Белый', bgLightGray:'Светло-серый', bgMidGray:'Средне-серый', bgDarkGray:'Тёмный', bgTransparent:'Прозрачный', bgCustom:'Произвольный',
    hdriLabel:'HDRI', texturesLabel:'Текстуры',
    matOverride:'Материал', wireframe:'Каркас', matOriginal:'Оригинал',
    animTitle:'Анимации', animPlay:'Пуск', animPause:'Пауза', animStop:'Стоп', animLoop:'Зациклить', animSpeed:'Скорость',
    animHint:'По умолчанию анимация не проигрывается.', hotkeys:'Горячие клавиши',
    hkSelect:'выбор', hkFocus:'к объекту', hkReset:'сброс камеры', hkClearSel:'снять выделение',
    movementSensitivity:'Чувствительность движения', movementSensitivityHint:'Работает со всеми раскладками клавиатуры',
    inspector:'Сцена', btnHideInspector:'Скрыть', btnShowInspector:'Инспектор', objects:'Объекты:',
    btnResetAll:'Сбросить всё', btnReset:'Сбросить'
  },
  en: {
    title: '3D Viewer', btnLoad:'Load model', btnFrame:'Frame', btnClear:'Clear',
    toggleShadows:'Shadows', toggleLight:'Light only', toggleGrid:'Grid', bgLabel:'Background', btnApply:'Apply', toggleFlipUV:'Flip UV',
    bgWhite:'White', bgLightGray:'Light Gray', bgMidGray:'Mid Gray', bgDarkGray:'Dark', bgTransparent:'Transparent', bgCustom:'Custom',
    hdriLabel:'HDRI', texturesLabel:'Textures',
    matOverride:'Material', wireframe:'Wireframe', matOriginal:'Original',
    animTitle:'Animations', animPlay:'Play', animPause:'Pause', animStop:'Stop', animLoop:'Loop', animSpeed:'Speed',
    animHint:'By default animations do not play.', hotkeys:'Hotkeys',
    hkSelect:'select', hkFocus:'focus', hkReset:'reset camera', hkClearSel:'clear selection',
    movementSensitivity:'Movement sensitivity', movementSensitivityHint:'Works with all keyboard layouts',
    inspector:'Scene', btnHideInspector:'Hide', btnShowInspector:'Inspector', objects:'Objects:',
    btnResetAll:'Reset all', btnReset:'Reset'
  }
};

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
  
  // Movement sensitivity control
  const movementSensitivityInput = d.getElementById('movement-sensitivity');
  const movementSensitivityValue = d.getElementById('movement-sensitivity-val');

  // helper: apply language strings to elements using [data-i]
  function applyLang(lang) {
    document.querySelectorAll('[data-i]').forEach(el => {
      const key = el.getAttribute('data-i');
      if (i18n[lang] && i18n[lang][key] !== undefined) el.textContent = i18n[lang][key];
    });
    const openInspectorBtn = d.getElementById('open-inspector');
    if (openInspectorBtn) openInspectorBtn.title = (i18n[lang] && i18n[lang].btnShowInspector) || '';
  }

  function isDark() { return d.body.classList.contains('theme-dark'); }
  function setTheme(theme) {
    d.body.classList.toggle('theme-dark', theme === 'dark');
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? '🌙' : '🌞';
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
  (function restore() {
    const s = getSettings ? getSettings() : loadSettings();
    if (s.theme) setTheme(s.theme); else setTheme('light');
    if (s.lang) langSelect.value = s.lang;
    applyLang(langSelect.value);
  })();

  // Bind file input
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file && onLoadFile) onLoadFile(file);
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
    persistedToast('Сцена очищена');
    persist();
    // Also trigger the same logic as the Delete hotkey - clear selection
    if (typeof window !== 'undefined' && window.clearSelection) {
      window.clearSelection();
    }
  });

  resetAllBtn?.addEventListener('click', () => {
    if (onResetAll) onResetAll();
    persistedToast((langSelect.value === 'ru') ? 'Настройки сброшены по умолчанию' : 'Settings reset to defaults');
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
        toast('Выберите ZIP файл с текстурами');
      }
    }
  });

  // Texture input change
  textureInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.zip')) {
      toast(`Выбран файл: ${file.name}`);
    } else if (file) {
      toast('Выберите ZIP файл');
      textureInput.value = '';
    }
  });

  // Theme toggle
  themeToggle?.addEventListener('click', () => setTheme(isDark() ? 'light' : 'dark'));

  // Language select
  langSelect?.addEventListener('change', () => {
    applyLang(langSelect.value);
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

  return {
    applyLang,
    setTheme,
    persist,
    toast: persistedToast
  };
}