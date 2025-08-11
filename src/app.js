import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js';
import { SceneManager } from './Scene.js';
import { RendererManager } from './Renderer.js';
import { initUI } from './UI.js';
import { GLTFLoaderWrapper } from './loaders/GLTF.js';
import { FBXLoaderWrapper } from './loaders/FBX.js';
import { AnimationManager } from './Animation.js';
import Materials, { applyMaterialOverride, setLightOnly } from './Materials.js';
import TransformControlsWrapper from './TransformControls.js';
import { initInspector } from './Inspector.js';
import { LightingManager } from './Lighting.js';
import Settings from './Settings.js';
import { RenderSettings } from './RenderSettings.js';

// Bootstrap: wire modules together and re-implement core behaviors from the original inline script.
// This file replaces the monolithic inline script and uses modular building blocks.

const canvas = document.getElementById('viewport');
if (!canvas) throw new Error('Canvas #viewport not found');

// Mark module loaded for diagnostics
window.__app_module_loaded = true;
console.info('[app] src/app.js loaded');

// Runtime logger: surface runtime errors to console and UI toast for quick debugging
function _reportRuntimeError(msg, detail){
  console.error('[RuntimeError]', msg, detail);
  try {
    const toastEl = document.getElementById('toast');
    if (toastEl){
      const text = msg && msg.message ? msg.message : (typeof msg === 'string' ? msg : JSON.stringify(msg));
      toastEl.textContent = 'Error: ' + text;
      toastEl.classList.add('show');
      setTimeout(()=> toastEl.classList.remove('show'), 6000);
    }
  } catch(e){}
}

window.addEventListener('error', (e) => {
  _reportRuntimeError(e.error || e.message || 'Runtime error', e);
});
window.addEventListener('unhandledrejection', (e) => {
  _reportRuntimeError(e.reason || 'Unhandled promise rejection', e);
});

const rendererMgr = new RendererManager({ canvas, antialias: false, alpha: true });
const sceneMgr = new SceneManager();
let inspectorApi = null;

// Diagnostic: print renderer/composer initial state
try {
  console.info('[diag] rendererMgr.renderer exists:', !!rendererMgr.renderer);
  console.info('[diag] renderer toneMapping:', rendererMgr.renderer?.toneMapping, 'toneMappingExposure:', rendererMgr.renderer?.toneMappingExposure);
  console.info('[diag] composer exists:', !!rendererMgr.composer, 'outlinePass:', !!rendererMgr.outlinePass);
} catch (e) { console.warn('[diag] failed to inspect rendererMgr', e); }

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 50000);
camera.position.set(2, 1.2, 3);

const controls = new OrbitControls(camera, rendererMgr.renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.8, 0);
controls.update();

let clock = new THREE.Clock();
let currentModel = null;

// Loaders
const gltfLoaderWrapper = new GLTFLoaderWrapper();
gltfLoaderWrapper.init(rendererMgr.renderer);

const fbxLoaderWrapper = new FBXLoaderWrapper();
fbxLoaderWrapper.init(rendererMgr.renderer);

// Animation manager
const animMgr = new AnimationManager();

// Transform controls
const tControls = new TransformControlsWrapper(camera, rendererMgr.renderer.domElement);
sceneMgr.getScene().add(tControls.controls);

// Settings & RenderSettings
const settings = new Settings();
const renderSettings = new RenderSettings(rendererMgr, settings);

// Lighting manager (replaces direct scene lights)
const lighting = new LightingManager(sceneMgr.getScene());

// Wire transform dragging to OrbitControls enable/disable
tControls.on('dragging-changed', (isDragging) => {
  controls.enabled = !isDragging;
});

// Renderer initial size
rendererMgr.setSize(window.innerWidth, window.innerHeight);

// Helpers: Stats UI
function updateStatsUI() {
  const polyCountEl = document.getElementById('poly-count');
  const objCountEl = document.getElementById('obj-count');
  let tris = 0, objs = 0;
  sceneMgr.getScene().traverse(o => {
    objs++;
    if (o.isMesh && o.geometry) {
      const index = o.geometry.index;
      const pos = o.geometry.attributes.position;
      if (index) tris += index.count / 3;
      else if (pos) tris += pos.count / 3;
    }
  });
  if (polyCountEl) polyCountEl.textContent = new Intl.NumberFormat('ru-RU').format(tris) + ' трис.';
  if (objCountEl) objCountEl.textContent = objs;
}

// Animation UI helper
function updateAnimTimeUI(time, dur) {
  const t = Math.max(0, Math.min(time, dur || 0));
  const d = dur || 0;
  const animTime = document.getElementById('anim-time');
  const animProgress = document.getElementById('anim-progress');
  if (animTime) animTime.textContent = `${t.toFixed(2)} / ${d.toFixed(2)}s`;
  if (animProgress) animProgress.value = d ? (t / d) : 0;
}

<<<<<<< HEAD
// Show or hide the Animations section in the left panel.
// When visible is true -> show; false -> hide (display:none).
function setAnimSectionVisible(visible) {
  const animSection = document.querySelector('details[data-sec="anim"]');
  if (!animSection) return;
  animSection.style.display = visible ? '' : 'none';
}

=======
>>>>>>> d4f436b6ce7bed0f1284659aa88a051c6b23e3ad
// Camera framing
function frameObject(root) {
  if (!root) return;
  const box = new THREE.Box3().setFromObject(root);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  if (!isFinite(sphere.radius)) return;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const dist = sphere.radius / Math.sin(Math.min(Math.PI / 4, fov / 2));
  const dirTo = new THREE.Vector3(0, 0.2, 1).normalize();
  camera.position.copy(sphere.center.clone().addScaledVector(dirTo, dist * 1.2));
  controls.target.copy(sphere.center);
  controls.update();
}

// Clear model
function clearCurrentModel() {
  if (currentModel) {
    sceneMgr.remove(currentModel);
    currentModel = null;
    sceneMgr.clearMeasure();
    sceneMgr.updateBBox(null);
  }
  updateStatsUI();
  animMgr.dispose();
  if (inspectorApi && typeof inspectorApi.refresh === 'function') {
    try { inspectorApi.refresh(); } catch(e) { /* ignore */ }
  } else {
    const tree = document.getElementById('tree'); if (tree) tree.innerHTML = '';
  }
  const animSelect = document.getElementById('anim-select'); if (animSelect) animSelect.innerHTML = '';
<<<<<<< HEAD
  // Hide animations section when model is cleared / no animations present
  try { if (typeof setAnimSectionVisible === 'function') setAnimSectionVisible(false); } catch(e) {}
=======
>>>>>>> d4f436b6ce7bed0f1284659aa88a051c6b23e3ad
  tControls.detach();
}

// Scene tree is handled by Inspector module (src/Inspector.js). Use inspectorApi.refresh() to update the tree when available.

// Post-load common operations
async function postLoad(gltf, sourceType = 'gltf') {
  clearCurrentModel();
  const root = gltf.scene || gltf;
  sceneMgr.add(root);
  currentModel = root;

<<<<<<< HEAD
  // If shadows are enabled, set cast/receive flags for new meshes
  const shadowsEnabled = document.getElementById('toggle-shadows')?.checked;
  if (shadowsEnabled) {
    root.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }

=======
>>>>>>> d4f436b6ce7bed0f1284659aa88a051c6b23e3ad
  // Apply material override default behavior if any UI toggles are set
  const matOverrideEl = document.getElementById('mat-override');
  const wireframeEl = document.getElementById('toggle-wireframe');
  const envIntensityEl = document.getElementById('env-intensity');
  const lightOnlyEl = document.getElementById('toggle-lightonly');

  const overrideType = matOverrideEl?.value || 'none';
  const wire = !!(wireframeEl && wireframeEl.checked);
  const envI = envIntensityEl ? Number(envIntensityEl.value) : 1;

  applyMaterialOverride(currentModel, { overrideType, wire, envIntensity: envI });

  if (lightOnlyEl && lightOnlyEl.checked) setLightOnly(currentModel, true);

  frameObject(currentModel);
  updateStatsUI();
  sceneMgr.updateBBox(currentModel);
  // Setup animations
  const clips = gltf.animations || root.animations || [];
  animMgr.dispose();
  animMgr.init(root);
  animMgr.setClips(clips);
<<<<<<< HEAD
  // Show or hide Animations UI depending on whether clips were found
  try { if (typeof setAnimSectionVisible === 'function') setAnimSectionVisible(!!(clips && clips.length)); } catch(e) {}
=======
>>>>>>> d4f436b6ce7bed0f1284659aa88a051c6b23e3ad
  // populate animation UI
  const animSelect = document.getElementById('anim-select');
  const animPlayPause = document.getElementById('anim-playpause');
  const animStop = document.getElementById('anim-stop');
  const animLoop = document.getElementById('anim-loop');
  const animSpeed = document.getElementById('anim-speed');
  const animProgress = document.getElementById('anim-progress');
  const animTime = document.getElementById('anim-time');

  if (animSelect) {
    animSelect.innerHTML = '';
    clips.forEach((clip, i) => {
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = clip.name || ('Clip ' + (i + 1));
      animSelect.appendChild(opt);
    });
    if (clips.length) {
      animSelect.selectedIndex = 0;
      animMgr.select(0);
    }
  }

  if (animPlayPause) {
    animPlayPause.dataset.state = 'stopped';
    animPlayPause.textContent = (document.getElementById('lang')?.value === 'ru') ? 'Пуск' : 'Play';
  }
  if (animStop) animStop.textContent = (document.getElementById('lang')?.value === 'ru') ? 'Стоп' : 'Stop';
  if (animTime) animTime.textContent = `0.00 / ${ (animMgr.getCurrentDuration()||0).toFixed(2) }s`;

  if (inspectorApi && typeof inspectorApi.refresh === 'function') inspectorApi.refresh();
}

// UI bindings via initUI
/* ===== Reset helpers for UI sections =====
   These mimic the original inline behaviors and call into
   the modular managers (renderSettings, lighting, sceneMgr, tControls).
*/
function _showToast(msg){
  try {
    if (typeof ui !== 'undefined' && ui && ui.toast) { ui.toast(msg); return; }
  } catch(e){}
  const t = document.getElementById('toast');
  if (t){ t.textContent = msg; t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), 2600); }
}

function resetRender(){
  const exposureEl = document.getElementById('exposure');
  if (exposureEl) {
    exposureEl.value = 1;
    try { renderSettings.applyExposure(1); } catch(e){}
    const exposureValEl = document.getElementById('exposure-val');
    if (exposureValEl) exposureValEl.textContent = (1).toFixed(2);
  }
  const toneMappingEl = document.getElementById('tone-mapping');
  if (toneMappingEl) {
    toneMappingEl.value = 'ACES';
    try { renderSettings.applyToneMapping('ACES'); } catch(e){}
  }
  _showToast('Reset: Render');
}

function resetDir(){
  const dirIntensityEl = document.getElementById('dir-intensity');
  const dirAngleEl = document.getElementById('dir-angle');
  const dirSoftnessEl = document.getElementById('dir-softness');
  const dirIntensityVal = document.getElementById('dir-intensity-val');
  const dirAngleVal = document.getElementById('dir-angle-val');
  const dirSoftnessVal = document.getElementById('dir-softness-val');

  if (dirIntensityEl) { dirIntensityEl.value = 0.9; try { lighting.setDirIntensity(0.9); } catch(e){} if (dirIntensityVal) dirIntensityVal.textContent = (0.9).toFixed(2); }
  if (dirAngleEl) { dirAngleEl.value = 34; try { lighting.setDirFromAngle(34); } catch(e){} if (dirAngleVal) dirAngleVal.textContent = `${Math.round(34)}°`; }
  if (dirSoftnessEl) { dirSoftnessEl.value = 1; try { lighting.setDirSoftness(1); } catch(e){} if (dirSoftnessVal) dirSoftnessVal.textContent = (1).toFixed(1); }

  _showToast('Reset: Directional light');
}

function resetEnv(){
  const envIntensityEl = document.getElementById('env-intensity');
  const envIntensityVal = document.getElementById('env-intensity-val');
  const hdriUrlInput = document.getElementById('hdri-url');

  if (envIntensityEl) { envIntensityEl.value = 1; try { sceneMgr.applyEnvIntensity(1, currentModel || sceneMgr.getScene()); } catch(e){} if (envIntensityVal) envIntensityVal.textContent = (1).toFixed(2); }
  if (hdriUrlInput) { hdriUrlInput.value = ''; }
  try { sceneMgr.setEnvironment(null); } catch(e){}
  _showToast('Reset: Environment');
}

function resetGizmos(){
  const toggleTransformEl = document.getElementById('toggle-transform');
  const transformModeEl = document.getElementById('transform-mode');
  const toggleSnapEl = document.getElementById('toggle-snap');
  const snapPosEl = document.getElementById('snap-pos');
  const snapRotEl = document.getElementById('snap-rot');
  const snapScaleEl = document.getElementById('snap-scale');
  const measureToggleEl = document.getElementById('measure-toggle');
  const measureOutEl = document.getElementById('measure-out');

  if (toggleTransformEl) { toggleTransformEl.checked = false; }
  try { tControls.enable(false); tControls.detach(); } catch(e){}
  if (transformModeEl) transformModeEl.value = 'translate';
  if (toggleSnapEl) toggleSnapEl.checked = false;
  try { tControls.setTranslationSnap(null); tControls.setRotationSnap(null); tControls.setScaleSnap(null); } catch(e){}

  if (snapPosEl) snapPosEl.value = 0.1;
  if (snapRotEl) snapRotEl.value = 15;
  if (snapScaleEl) snapScaleEl.value = 0.1;

  try { sceneMgr.clearMeasure(); } catch(e){}
  if (measureToggleEl) measureToggleEl.classList.remove('ok');
  if (measureOutEl) measureOutEl.textContent = '—';

  _showToast('Reset: Gizmos');
}

function resetAll(){
  // toggles
  const toggleShadowsEl = document.getElementById('toggle-shadows');
  const toggleFXAAEl = document.getElementById('toggle-fxaa');
  const toggleLightOnlyEl = document.getElementById('toggle-lightonly');
  const toggleGridEl = document.getElementById('toggle-grid');

  if (toggleShadowsEl) { toggleShadowsEl.checked = false; toggleShadowsEl.dispatchEvent(new Event('change')); }
  if (toggleFXAAEl) { toggleFXAAEl.checked = true; toggleFXAAEl.dispatchEvent(new Event('change')); }
  if (toggleLightOnlyEl) { toggleLightOnlyEl.checked = false; toggleLightOnlyEl.dispatchEvent(new Event('change')); }
  if (toggleGridEl) { toggleGridEl.checked = true; toggleGridEl.dispatchEvent(new Event('change')); }

  // background & hdri
  const bgSelectEl = document.getElementById('bg-select');
  const bgColorEl = document.getElementById('bg-color');
  const hdriUrlInput = document.getElementById('hdri-url');
  if (bgSelectEl) { bgSelectEl.value = 'white'; }
  if (bgColorEl) { bgColorEl.value = '#ffffff'; }
  try { sceneMgr.setBackground('#ffffff'); } catch(e){}
  if (hdriUrlInput) hdriUrlInput.value = '';
  try { sceneMgr.setEnvironment(null); } catch(e){}

  // materials
  const matOverrideEl = document.getElementById('mat-override');
  const toggleWireframeEl = document.getElementById('toggle-wireframe');
  if (matOverrideEl) matOverrideEl.value = 'none';
  if (toggleWireframeEl) toggleWireframeEl.checked = false;
  try { applyMaterialOverride(currentModel, { overrideType: (matOverrideEl?.value || 'none'), wire: !!toggleWireframeEl?.checked, envIntensity: Number(document.getElementById('env-intensity')?.value || 1) }); } catch(e){}

  // sections / helpers
  resetRender();
  resetDir();
  resetEnv();
  resetGizmos();

  // camera & selection (clear outlines, detach gizmos)
  try { rendererMgr.setOutlineObjects([]); } catch(e){}
  try { frameObject(currentModel || sceneMgr.getScene()); } catch(e){}

  // persist defaults by clearing settings store
  try { settings.clear(); } catch(e){}
  _showToast('Settings reset to defaults');
}

/* initialize UI */
const ui = initUI({
  onLoadFile: (file) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.gltf') || name.endsWith('.glb')) {
      showOverlay('Загрузка glTF/GLB', file.name);
      gltfLoaderWrapper.loadFromFile(file, (evt) => {
        if (evt && evt.lengthComputable) setProgress(evt.loaded / evt.total);
        else setIndeterminate();
      }).then(gltf => {
        hideOverlay();
        postLoad(gltf, 'gltf');
      }).catch(err => {
        hideOverlay();
        ui.toast('Ошибка загрузки: ' + (err.message || err));
      });
    } else if (name.endsWith('.fbx')) {
      showOverlay('Загрузка FBX', file.name);
      fbxLoaderWrapper.loadFromFile(file, (evt) => {
        if (evt && evt.lengthComputable) setProgress(evt.loaded / evt.total);
        else setIndeterminate();
      }).then(obj => {
        hideOverlay();
        // FBX returns Object3D — wrap in a simple shape consistent with GLTF handling
        postLoad(obj, 'fbx');
      }).catch(err => {
        hideOverlay();
        ui.toast('Ошибка FBX: ' + (err.message || err));
      });
    } else {
      ui.toast('Поддерживаются: glTF/GLB/FBX');
    }
  },

  onApplyHDRI: async (url) => {
    if (!url) {
      sceneMgr.setEnvironment(null);
      ui.toast('HDRI cleared');
      return;
    }
    showOverlay('HDRI', 'Загружаем окружение…');
    const loaderModule = await import('https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/RGBELoader.js');
    const loader = new loaderModule.RGBELoader();
    loader.load(url, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      sceneMgr.setEnvironment(tex);
      sceneMgr.applyEnvIntensity && sceneMgr.applyEnvIntensity( Number(document.getElementById('env-intensity')?.value || 1), currentModel || sceneMgr.getScene());
      hideOverlay();
      ui.toast('HDRI applied');
    }, undefined, (err) => {
      hideOverlay();
      ui.toast('Не удалось загрузить HDRI');
    });
  },

  onResetAll: resetAll,

  onFrame: () => { frameObject(currentModel || sceneMgr.getScene()); },

  onClearScene: () => { clearCurrentModel(); ui.toast('Scene cleared'); },
  
  getSettings: () => settings.get(),
  setSettings: (s) => {
    // Update the settings store with new values
    Object.keys(s).forEach(key => {
      settings.set(key, s[key]);
    });
  }
});

// Reveal UI that was hidden by the original preload guard
document.body.classList.remove('preload');
// Apply language strings from the lang select (if UI exposes applyLang)
const langEl = document.getElementById('lang');
if (ui && ui.applyLang && langEl) ui.applyLang(langEl.value || 'en');
<<<<<<< HEAD
// Hide animations section on startup if there are no clips
try { if (typeof setAnimSectionVisible === 'function') setAnimSectionVisible(!!animMgr.hasClips && animMgr.hasClips()); } catch(e) {}
=======
>>>>>>> d4f436b6ce7bed0f1284659aa88a051c6b23e3ad

// Section reset buttons bindings (were present in the original monolithic script
// but got omitted during refactor). Wire them to the helper functions above.
const resetRenderBtn = document.getElementById('reset-render');
const resetDirBtn = document.getElementById('reset-dir');
const resetEnvBtn = document.getElementById('reset-env');
const resetGizmosBtn = document.getElementById('reset-gizmos');

resetRenderBtn?.addEventListener('click', resetRender);
resetDirBtn?.addEventListener('click', resetDir);
resetEnvBtn?.addEventListener('click', resetEnv);
resetGizmosBtn?.addEventListener('click', resetGizmos);

// initialize render settings UI state
const tmEl = document.getElementById('tone-mapping');
if (tmEl) tmEl.value = renderSettings.getState().tonemapping || tmEl.value;
const exposureEl = document.getElementById('exposure');
if (exposureEl) exposureEl.value = renderSettings.getState().exposure || exposureEl.value;
const exposureValEl = document.getElementById('exposure-val');
if (exposureValEl) exposureValEl.textContent = (renderSettings.getState().exposure || Number(exposureEl?.value || 1)).toFixed(2);
const fxaaToggle = document.getElementById('toggle-fxaa');
if (fxaaToggle) fxaaToggle.checked = renderSettings.getState().fxaa;

// initialize lighting UI labels
const dirIntensityValEl = document.getElementById('dir-intensity-val');
const dirAngleValEl = document.getElementById('dir-angle-val');
const dirSoftnessValEl = document.getElementById('dir-softness-val');
const envIntensityValEl = document.getElementById('env-intensity-val');
if (dirIntensityValEl) dirIntensityValEl.textContent = (lighting.getDirIntensity?.() || Number(document.getElementById('dir-intensity')?.value || 0.9)).toFixed(2);
if (dirAngleValEl) dirAngleValEl.textContent = `${Math.round(Number(document.getElementById('dir-angle')?.value || 34))}°`;
if (dirSoftnessValEl) dirSoftnessValEl.textContent = (lighting.getDirSoftness?.() || Number(document.getElementById('dir-softness')?.value || 1)).toFixed(1);
if (envIntensityValEl) envIntensityValEl.textContent = (Number(document.getElementById('env-intensity')?.value || 1)).toFixed(2);
// Initialize inspector (optional)
inspectorApi = null;
try {
  if (typeof initInspector === 'function') {
    inspectorApi = initInspector({
      sceneManager: sceneMgr,
      onSelect: (obj) => {
        rendererMgr.setOutlineObjects(obj);
        sceneMgr.updateBBox(obj);
        // Open inspector panel on selection
        try { setInspectorOpen(true); } catch(e) {}
      }
    });
  }
} catch (e) {
  console.warn('Inspector init error', e);
  inspectorApi = null;
}

// Inspector open/close bindings (UI buttons)
const openInspectorBtn = document.getElementById('open-inspector');
const inspectorEl = document.getElementById('scene-inspector');
const inspectorCloseBtn = document.getElementById('inspector-close');
const leftColEl = document.querySelector('.left-col');

function setInspectorOpen(open){
  if (!inspectorEl) return;
  inspectorEl.classList.toggle('right-0', !!open);
  inspectorEl.classList.toggle('right-[-360px]', !open);
}
openInspectorBtn?.addEventListener('click', ()=> setInspectorOpen(true));
inspectorCloseBtn?.addEventListener('click', ()=> setInspectorOpen(false));
leftColEl?.addEventListener('dblclick', ()=> setInspectorOpen(true));

// Small overlay helpers (same as original)
const overlay = document.getElementById('overlay');
const meter = document.getElementById('meter');
const progressTitle = document.getElementById('progress-title');
const progressSub = document.getElementById('progress-sub');

function showOverlay(title, sub) {
  if (overlay) overlay.classList.add('show');
  if (progressTitle) progressTitle.textContent = title || 'Загрузка…';
  if (progressSub) progressSub.textContent = sub || '';
  setIndeterminate();
}
function hideOverlay() { if (overlay) overlay.classList.remove('show'); }
function setProgress(p) {
  if (meter) {
    meter.classList.remove('indeterminate');
    meter.firstElementChild.style.width = Math.round(p*100) + '%';
  }
  if (progressSub) progressSub.textContent = Math.round(p*100) + '%';
}
function setIndeterminate() {
  if (meter) {
    meter.classList.add('indeterminate');
    meter.firstElementChild.style.width = '40%';
  }
  if (progressSub) progressSub.textContent = 'Ожидаем данные…';
}

// Wire UI controls that were previously in index.html (transform controls, materials, toggles, animations)
(function bindExtraUI() {
  const toggleTransform = document.getElementById('toggle-transform');
  const transformMode = document.getElementById('transform-mode');
  const toggleSnap = document.getElementById('toggle-snap');
  const snapPos = document.getElementById('snap-pos');
  const snapRot = document.getElementById('snap-rot');
  const snapScale = document.getElementById('snap-scale');

  const toggleShadows = document.getElementById('toggle-shadows');
  const toggleFXAA = document.getElementById('toggle-fxaa');
  const toggleLightOnly = document.getElementById('toggle-lightonly');
  const toggleGrid = document.getElementById('toggle-grid');

  const bgSelect = document.getElementById('bg-select');
  const bgColor = document.getElementById('bg-color');

  const matOverride = document.getElementById('mat-override');
  const toggleWireframe = document.getElementById('toggle-wireframe');

  const animSelect = document.getElementById('anim-select');
  const animPlayPause = document.getElementById('anim-playpause');
  const animStop = document.getElementById('anim-stop');
  const animLoop = document.getElementById('anim-loop');
  const animSpeed = document.getElementById('anim-speed');
  const animProgress = document.getElementById('anim-progress');
  const animTime = document.getElementById('anim-time');

  // Transform controls
  function applySnap() {
    if (!toggleSnap) return;
    if (toggleSnap.checked) {
      tControls.setTranslationSnap(Number(snapPos.value) || 0);
      tControls.setRotationSnap(THREE.MathUtils.degToRad(Number(snapRot.value) || 0));
      tControls.setScaleSnap(Number(snapScale.value) || 0);
    } else {
      tControls.setTranslationSnap(null);
      tControls.setRotationSnap(null);
      tControls.setScaleSnap(null);
    }
  }
  toggleTransform?.addEventListener('change', () => {
    const on = toggleTransform.checked;
    tControls.enable(on);
    if (on && currentModel) tControls.attach(currentModel);
    else tControls.detach();
  });
  transformMode?.addEventListener('change', () => tControls.setMode(transformMode.value));
  toggleSnap?.addEventListener('change', applySnap);
  [snapPos, snapRot, snapScale].forEach(el => el?.addEventListener('change', applySnap));

  // Toggles
  toggleShadows?.addEventListener('change', () => {
    const on = toggleShadows.checked;
    rendererMgr.renderer.shadowMap.enabled = on;
    lighting.enableShadows(on);
<<<<<<< HEAD
    // Apply castShadow/receiveShadow to all meshes in scene or current model
    const root = currentModel || sceneMgr.getScene();
    if (root) {
      root.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = on;
          obj.receiveShadow = on;
        }
      });
    }
    // Also ensure the scene's own directional light (if exists) has shadows enabled
    // This addresses the duplicate light in SceneManager
    const sceneDirLight = sceneMgr.getScene()?.children?.find?.(child => child.isDirectionalLight);
    if (sceneDirLight) {
      sceneDirLight.castShadow = on;
    }
=======
>>>>>>> d4f436b6ce7bed0f1284659aa88a051c6b23e3ad
  });
  toggleFXAA?.addEventListener('change', () => { rendererMgr.enableFXAA(toggleFXAA.checked); });
  toggleLightOnly?.addEventListener('change', () => { setLightOnly(currentModel, toggleLightOnly.checked); });
  toggleGrid?.addEventListener('change', () => { sceneMgr.setGridVisible(!!toggleGrid.checked); });

  // Background selection
  function updateBackground() {
    const bgSelectValue = bgSelect?.value;
    if (bgSelectValue === 'custom') {
      sceneMgr.setBackground(bgColor?.value || '#ffffff');
    } else {
      // Map select values to colors
      const colorMap = {
        'white': '#ffffff',
        'lightgray': '#d3d3d3',
        'midgray': '#808080',
        'darkgray': '#404040',
        'transparent': null
      };
      sceneMgr.setBackground(colorMap[bgSelectValue] || '#ffffff');
    }
  }
  
  bgSelect?.addEventListener('change', updateBackground);
  bgColor?.addEventListener('input', updateBackground);

  // Material override
  matOverride?.addEventListener('change', () => {
    applyMaterialOverride(currentModel, { overrideType: matOverride.value, wire: !!toggleWireframe?.checked, envIntensity: Number(document.getElementById('env-intensity')?.value || 1) });
  });
  toggleWireframe?.addEventListener('change', () => {
    applyMaterialOverride(currentModel, { overrideType: matOverride?.value || 'none', wire: !!toggleWireframe?.checked, envIntensity: Number(document.getElementById('env-intensity')?.value || 1) });
  });

  // Animations UI

  animSelect?.addEventListener('change', () => {
    if (!animMgr.hasClips()) return;
    animMgr.select(Number(animSelect.value));
    updateAnimTimeUI(0, animMgr.getCurrentDuration());
  });

  animPlayPause?.addEventListener('click', () => {
    if (!animMgr.hasClips()) return;
    if (animPlayPause.dataset.state !== 'playing') {
      // Check if animation has finished (for non-looped animations)
      const currentTime = animMgr.getCurrentTime();
      const duration = animMgr.getCurrentDuration();
      // If animation has finished or is very close to the end, restart it
      if (currentTime >= duration - 0.001) {
        // Restart animation from the beginning
        animMgr.play(animMgr.activeIndex);
      } else {
        // Continue playing from current position
        animMgr.play();
      }
      animPlayPause.dataset.state = 'playing';
      animPlayPause.textContent = (document.getElementById('lang')?.value === 'ru') ? 'Пауза' : 'Pause';
    } else {
      animMgr.pause();
      animPlayPause.dataset.state = 'paused';
      animPlayPause.textContent = (document.getElementById('lang')?.value === 'ru') ? 'Пуск' : 'Play';
    }
  });

  animStop?.addEventListener('click', () => {
    animMgr.stop();
    animPlayPause.dataset.state = 'stopped';
    animPlayPause.textContent = (document.getElementById('lang')?.value === 'ru') ? 'Пуск' : 'Play';
    updateAnimTimeUI(0, animMgr.getCurrentDuration());
  });

  animLoop?.addEventListener('change', () => { animMgr.setLoop(animLoop.checked); });
  animSpeed?.addEventListener('change', () => { animMgr.setSpeed(Number(animSpeed.value || 1)); });

  animProgress?.addEventListener('input', () => {
    if (!animMgr.hasClips()) return;
    const dur = animMgr.getCurrentDuration();
    const t = parseFloat(animProgress.value) * dur;
    // set active action time directly if available
    if (animMgr.activeAction) {
      animMgr.activeAction.time = t;
      animMgr.update(0);
      updateAnimTimeUI(t, dur);
    }
  });
})();

// Picking
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2 - 1, -((e.clientY-rect.top)/rect.height)*2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const meshes = [];
  if (currentModel) currentModel.traverse(o => { if (o.isMesh) meshes.push(o); });
  else sceneMgr.getScene().traverse(o => { if (o.isMesh) meshes.push(o); });
  const hit = ray.intersectObjects(meshes, true)[0];
  if (hit) {
    rendererMgr.setOutlineObjects(hit.object);
    sceneMgr.updateBBox(hit.object);
    if (inspectorApi && typeof inspectorApi.refresh === 'function') {
      try { inspectorApi.refresh(); } catch(e) {}
    }
    setInspectorOpen(true);
  }
});

// Resize
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  rendererMgr.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

// wire UI inputs for lighting (if present)
const dirIntensityEl = document.getElementById('dir-intensity');
const dirAngleEl = document.getElementById('dir-angle');
const dirSoftnessEl = document.getElementById('dir-softness');
const envIntensityEl = document.getElementById('env-intensity');
if (dirIntensityEl) dirIntensityEl.addEventListener('input', () => {
  const v = Number(dirIntensityEl.value || 0);
  lighting.setDirIntensity(v);
  const el = document.getElementById('dir-intensity-val');
  if (el) el.textContent = v.toFixed(2);
});
if (dirAngleEl) dirAngleEl.addEventListener('input', () => {
  const v = Number(dirAngleEl.value || 0);
  lighting.setDirFromAngle(v);
  const el = document.getElementById('dir-angle-val');
  if (el) el.textContent = `${Math.round(v)}°`;
});
if (dirSoftnessEl) dirSoftnessEl.addEventListener('input', () => {
  const v = Number(dirSoftnessEl.value || 0);
  lighting.setDirSoftness(v);
  const el = document.getElementById('dir-softness-val');
  if (el) el.textContent = v.toFixed(1);
});
if (envIntensityEl) envIntensityEl.addEventListener('input', () => {
  const v = Number(envIntensityEl.value || 1);
  sceneMgr.applyEnvIntensity(v, currentModel || sceneMgr.getScene());
  const el = document.getElementById('env-intensity-val');
  if (el) el.textContent = v.toFixed(2);
});

// Bind render settings UI to manager
const toneMappingEl = document.getElementById('tone-mapping');
const fxaaEl = document.getElementById('toggle-fxaa');
if (exposureEl) {
  exposureEl.addEventListener('input', ()=> {
    const v = Number(exposureEl.value || 1);
    renderSettings.applyExposure(v);
    const exposureValEl = document.getElementById('exposure-val');
    if (exposureValEl) exposureValEl.textContent = v.toFixed(2);
  });
  // also update the label on change/end to be robust across browsers
  exposureEl.addEventListener('change', ()=> {
    const v = Number(exposureEl.value || 1);
    const exposureValEl = document.getElementById('exposure-val');
    if (exposureValEl) exposureValEl.textContent = v.toFixed(2);
  });
}
if (toneMappingEl) toneMappingEl.addEventListener('change', ()=> { renderSettings.applyToneMapping(toneMappingEl.value); });
if (fxaaEl) fxaaEl.addEventListener('change', ()=> { renderSettings.enableFXAA(!!fxaaEl.checked); });

// ======= Camera presets =======
function camPreset(view) {
  const root = currentModel || sceneMgr.getScene();
  const box = new THREE.Box3().setFromObject(root);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const center = sphere.center;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const dist = sphere.radius / Math.sin(Math.min(Math.PI / 4, fov / 2));
  const m = dist * 1.2;
  let dirv = new THREE.Vector3(1, 1, 1);
  switch (view) {
    case 'front':
      dirv.set(0, 0, 1);
      break;
    case 'back':
      dirv.set(0, 0, -1);
      break;
    case 'left':
      dirv.set(-1, 0, 0);
      break;
    case 'right':
      dirv.set(1, 0, 0);
      break;
    case 'top':
      dirv.set(0, 1, 0);
      break;
    case 'bottom':
      dirv.set(0, -1, 0);
      break;
    case 'iso':
    default:
      dirv.set(1, 1, 1);
      break;
  }
  camera.position.copy(center.clone().addScaledVector(dirv.normalize(), m));
  controls.target.copy(center);
  controls.update();
}

const camPresets = document.getElementById('cam-presets');
if (camPresets) {
  camPresets.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => camPreset(btn.dataset.view));
  });
}


// Render loop
let lastFpsUpdate = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  animMgr.update(dt);
  
  // Update animation UI if an animation is playing
  if (animMgr.activeAction && !animMgr.activeAction.paused) {
    updateAnimTimeUI(animMgr.getCurrentTime(), animMgr.getCurrentDuration());
  }
  
  controls.update();
  rendererMgr.render(sceneMgr.getScene(), camera);
  // fps update
  const fpsEl = document.getElementById('fps');
  if (fpsEl) {
    const now = performance.now();
    if (!lastFpsUpdate) lastFpsUpdate = now;
    if (now - lastFpsUpdate >= 500) {
      const fps = Math.round(1 / dt);
      fpsEl.textContent = String(fps);
      lastFpsUpdate = now;
    }
  }
}
animate();

// Expose debug helpers
window.clearCurrentModel = clearCurrentModel;
window.openInspector = (open) => {
  const inspector = document.getElementById('scene-inspector');
  if (!inspector) return;
  inspector.classList.toggle('right-0', !!open);
};

// Diagnostic helper: check required DOM elements and report missing ones.
// Appends at end of bootstrap to run after initialization attempts.
(function runDiagnostics(){
  try {
    const expected = [
      'viewport','file-input','reset-camera','clear-scene','reset-all',
      'toggle-shadows','toggle-fxaa','toggle-lightonly','toggle-grid',
      'bg-select','bg-color','hdri-url','apply-hdri',
      'mat-override','toggle-wireframe',
      'anim-select','anim-playpause','anim-stop','anim-loop','anim-speed','anim-progress','anim-time',
      'tree','scene-inspector','open-inspector','toast','overlay','meter','progress-title','progress-sub'
    ];
    const missing = expected.filter(id => !document.getElementById(id));
    if (missing.length) {
      console.warn('[DIAG] Missing DOM elements:', missing);
      const toastEl = document.getElementById('toast');
      if (toastEl) {
        toastEl.textContent = 'Diagnostic: missing DOM elements: ' + missing.slice(0,6).join(', ') + (missing.length>6 ? (' +'+(missing.length-6)+' more') : '');
        toastEl.classList.add('show');
        setTimeout(()=> toastEl.classList.remove('show'), 8000);
      }
    } else {
      console.info('[DIAG] All expected DOM elements are present.');
    }
  } catch (e) {
    console.error('[DIAG] Diagnostics failed', e);
  }
})();
