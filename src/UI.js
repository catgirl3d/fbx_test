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
    toggleShadows:'Тени', toggleLight:'Только освещение', toggleGrid:'Сетка', bgLabel:'Фон', btnApply:'Применить',
    matOverride:'Материал', wireframe:'Каркас',
    animTitle:'Анимации', animPlay:'Пуск', animPause:'Пауза', animStop:'Стоп', animLoop:'Зациклить', animSpeed:'Скорость',
    animHint:'По умолчанию анимация не проигрывается.', hotkeys:'Горячие клавиши',
    hkSelect:'выбор', hkFocus:'к объекту', hkReset:'сброс камеры', hkClearSel:'снять выделение',
    movementSensitivity:'Чувствительность движения', movementSensitivityHint:'Работает со всеми раскладками клавиатуры',
    inspector:'Сцена', btnHideInspector:'Скрыть', btnShowInspector:'Инспектор', objects:'Объекты:',
    btnResetAll:'Сбросить всё', btnReset:'Сбросить'
  },
  en: {
    title: '3D Viewer', btnLoad:'Load model', btnFrame:'Frame', btnClear:'Clear',
    toggleShadows:'Shadows', toggleLight:'Light only', toggleGrid:'Grid', bgLabel:'Background', btnApply:'Apply',
    matOverride:'Material', wireframe:'Wireframe',
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
  const langSelect = d.getElementById('lang');
  const themeToggle = d.getElementById('theme-toggle');
  const themeIcon = d.getElementById('theme-icon');
  const themeLabel = d.getElementById('theme-label');
  const movementSensitivityInput = d.getElementById('movement-sensitivity');
  const movementSensitivityValue = d.getElementById('movement-sensitivity-val');

  function applyLang(lang) {
    d.querySelectorAll('[data-i]').forEach(el => {
      const key = el.getAttribute('data-i');
      if (i18n[lang]?.[key]) el.textContent = i18n[lang][key];
    });
    d.getElementById('open-inspector').title = i18n[lang]?.btnShowInspector || '';
    if (themeLabel) themeLabel.textContent = (lang === 'ru' ? (isDark() ? 'Ночная' : 'Светлая') : (isDark() ? 'Dark' : 'Light'));
  }

  function isDark() { return d.body.classList.contains('theme-dark'); }

  function setTheme(theme) {
    d.body.classList.toggle('theme-dark', theme === 'dark');
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? '🌙' : '🌞';
    if (themeLabel) themeLabel.textContent = (langSelect.value === 'ru' ? (theme === 'dark' ? 'Ночная' : 'Светлая') : (theme === 'dark' ? 'Dark' : 'Light'));
    persist();
  }

  function persist() {
    const s = getSettings ? getSettings() : loadSettings();
    s.lang = langSelect?.value || s.lang;
    s.theme = isDark() ? 'dark' : 'light';
    s.movementSensitivity = parseFloat(movementSensitivityInput?.value) || 5.0;
    saveSettings(s);
    if (setSettings) setSettings(s);
  }

  (function restore() {
    const s = getSettings ? getSettings() : loadSettings();
    setTheme(s.theme || 'light');
    if (s.lang) langSelect.value = s.lang;
    if (s.movementSensitivity) {
      movementSensitivityInput.value = s.movementSensitivity;
      if (movementSensitivityValue) movementSensitivityValue.textContent = s.movementSensitivity.toFixed(1);
    }
    applyLang(langSelect.value);
  })();

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file && onLoadFile) onLoadFile(file);
    e.target.value = '';
  });

  themeToggle?.addEventListener('click', () => setTheme(isDark() ? 'light' : 'dark'));
  langSelect?.addEventListener('change', () => {
    applyLang(langSelect.value);
    persist();
  });

  movementSensitivityInput?.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      if (movementSensitivityValue) movementSensitivityValue.textContent = value.toFixed(1);
      persist();
    }
  });

  const toastEl = d.getElementById('toast');
  function persistedToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  return {
    applyLang,
    setTheme,
    persist,
    toast: persistedToast
  };
}