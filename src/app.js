import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js';
import { SceneManager } from './Scene.js';
import { RendererManager } from './Renderer.js';
import { initUI } from './UI.js';
import { GLTFLoaderWrapper } from './loaders/GLTF.js';
import { FBXLoaderWrapper } from './loaders/FBX.js';
import { AnimationManager } from './Animation.js';
import Materials, { applyMaterialOverride, setLightOnly, applyTexturesFromMap } from './Materials.js';
import { loadTexturesFromZIP, matchTexturePath } from './utils/zipTextures.js';
import TransformControlsWrapper from './TransformControls.js';
import { initInspector } from './Inspector.js';
import { LightingManager } from './Lighting.js';
import Settings from './Settings.js';
import { RenderSettings } from './RenderSettings.js';
import { bindUI } from './UIBindings.js';
import DOMManager, { createDOMManager } from './DOMManager.js';

// Bootstrap: wire modules together and re-implement core behaviors from the original inline script.
// This file replaces the monolithic inline script and uses modular building blocks.

// Initialize DOM Manager
const dom = createDOMManager();

const canvas = dom.getOrThrow('viewport', 'Canvas #viewport not found');

// Mark module loaded for diagnostics
window.__app_module_loaded = true;
console.info('[app] src/app.js loaded');

// Runtime logger: surface runtime errors to console and UI toast for quick debugging
function _reportRuntimeError(msg, detail){
  console.error('[RuntimeError]', msg, detail);
  try {
    const toastEl = dom.get('toast');
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
let selectedObject = null; // Track selected object globally
let originalUVs = new Map(); // Store original UVs for flipping

// ZIP texture handling
let zipTextures = new Map(); // Map of loaded textures from ZIP
let currentZipFile = null; // Currently loaded ZIP file

// Track pressed keys for WASDQE camera movement
const pressedKeys = new Set();

function getSelectedObject() { return selectedObject; }
function clearSelection() {
  selectedObject = null;
  rendererMgr.setOutlineObjects([]);
  sceneMgr.updateBBox(null);
  if(inspectorApi?.refresh) inspectorApi.refresh();
}

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
const renderSettings = new RenderSettings({ rendererMgr, settings });

// Lighting manager (replaces direct scene lights)
const lighting = new LightingManager({ scene: sceneMgr.getScene() });

// Wire transform dragging to OrbitControls enable/disable
tControls.on('dragging-changed', (isDragging) => {
  controls.enabled = !isDragging;
});

// Renderer initial size
rendererMgr.setSize(window.innerWidth, window.innerHeight);

// Helpers: Stats UI
function updateStatsUI() {
  const polyCountEl = dom.get('poly-count');
  const objCountEl = dom.get('obj-count');
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
  console.log('[updateStatsUI] tris:', tris, 'polyCountEl:', polyCountEl);
  if (polyCountEl) polyCountEl.textContent = new Intl.NumberFormat('ru-RU').format(tris) + ' трис.';
  if (objCountEl) objCountEl.textContent = objs;
}

// Animation UI helper
function updateAnimTimeUI(time, dur) {
  const t = Math.max(0, Math.min(time, dur || 0));
  const d = dur || 0;
  const animTime = dom.get('anim-time');
  const animProgress = dom.get('anim-progress');
  if (animTime) animTime.textContent = `${t.toFixed(2)} / ${d.toFixed(2)}s`;
  if (animProgress) animProgress.value = d ? (t / d) : 0;
}

// Show or hide the Animations section in the left panel.
// When visible is true -> show; false -> hide (display:none).
function setAnimSectionVisible(visible) {
  const animSection = dom.query('details[data-sec="anim"]');
  if (!animSection) return;
  animSection.style.display = visible ? '' : 'none';
}

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
    // Clear original UVs when model is cleared
    originalUVs.clear();
  }
  updateStatsUI();
  animMgr.dispose();
  if (inspectorApi && typeof inspectorApi.refresh === 'function') {
    try { inspectorApi.refresh(); } catch(e) { /* ignore */ }
  } else {
    const tree = dom.get('tree'); if (tree) tree.innerHTML = '';
  }
  const animSelect = dom.get('anim-select'); if (animSelect) animSelect.innerHTML = '';
  // Hide animations section when model is cleared / no animations present
  try { if (typeof setAnimSectionVisible === 'function') setAnimSectionVisible(false); } catch(e) {}
  tControls.detach();
  // Reset flip UV toggle
  const flipUVToggle = dom.get('toggle-flipuv');
  if (flipUVToggle) flipUVToggle.checked = false;
}

// Clear scene including ZIP textures
function clearScene() {
  clearCurrentModel();
  clearZipTextures();
  dom.showToast('Сцена очищена');
}

// Clear ZIP textures and resources
function clearZipTextures() {
  // Dispose all textures
  for (const [path, texture] of zipTextures) {
    if (texture && texture.dispose) {
      texture.dispose();
    }
  }
  
  // Clear the map
  zipTextures.clear();
  currentZipFile = null;
  
  console.log('[app] ZIP textures cleared');
}

// Texture resolver function for FBX loader
function createTextureResolver() {
  return (path) => {
    if (!path || !zipTextures.size) return null;
    
    // Try to find texture in ZIP
    const texture = matchTexturePath(path, zipTextures);
    
    if (texture) {
      console.log(`[app] Texture resolver found: ${path} -> ${texture.name}`);
      return texture;
    } else {
      console.warn(`[app] Texture resolver failed to find: ${path}`);
      return null;
    }
  };
}

// Load textures from ZIP file
async function loadTexturesFromZIPFile(zipFile) {
  if (!zipFile) {
    throw new Error('No ZIP file provided');
  }
  
  try {
    showOverlay('Загрузка текстур', 'Распаковка ZIP...');
    
    // Clear previous textures
    clearZipTextures();
    
    // Load new textures
    zipTextures = await loadTexturesFromZIP(zipFile, THREE);
    currentZipFile = zipFile;
    
    // Save texture map to global for debugging and manual texture application
    window.zipTextureMap = zipTextures;
    console.log('[app] Saved texture map to window.zipTextureMap for debugging');
    
    hideOverlay();
    
    if (zipTextures.size > 0) {
      dom.showToast(`Загружено ${zipTextures.size} текстур из ZIP`);
      console.log(`[app] Loaded ${zipTextures.size} textures from ZIP:`, Array.from(zipTextures.keys()));
    } else {
      dom.showToast('В ZIP не найдены текстуры');
    }
    
    return zipTextures;
  } catch (error) {
    hideOverlay();
    console.error('[app] Failed to load textures from ZIP:', error);
    dom.showToast('Ошибка загрузки текстур из ZIP: ' + error.message);
    throw error;
  }
}

// Scene tree is handled by Inspector module (src/Inspector.js). Use inspectorApi.refresh() to update the tree when available.

// Post-load common operations
async function postLoad(gltf, sourceType = 'gltf') {
  clearCurrentModel();
  const root = gltf.scene || gltf;
  sceneMgr.add(root);
  currentModel = root;

  // If shadows are enabled, set cast/receive flags for new meshes
  const shadowsEnabled = dom.get('toggle-shadows')?.checked;
  if (shadowsEnabled) {
    root.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }

  // Apply material override default behavior if any UI toggles are set
  const matOverrideEl = dom.get('mat-override');
  const wireframeEl = dom.get('toggle-wireframe');
  const envIntensityEl = dom.get('env-intensity');
  const lightOnlyEl = dom.get('toggle-lightonly');

  const overrideType = matOverrideEl?.value || 'none';
  const wire = !!(wireframeEl && wireframeEl.checked);
  const envI = envIntensityEl ? Number(envIntensityEl.value) : 1;

  applyMaterialOverride(currentModel, { overrideType, wire, envIntensity: envI });

  if (lightOnlyEl && lightOnlyEl.checked) setLightOnly(currentModel, true);

  // Apply textures from ZIP if available (fallback)
  if (zipTextures.size > 0) {
    try {
      console.log(`[app] Applying ${zipTextures.size} ZIP textures as fallback...`);
      applyTexturesFromMap(currentModel, zipTextures);
      dom.showToast(`Применено ${zipTextures.size} текстур из ZIP (fallback)`);
    } catch (error) {
      console.warn('[app] Failed to apply ZIP textures as fallback:', error);
    }
  } else {
    console.log('[app] No ZIP textures available for fallback application');
  }

  frameObject(currentModel);
  updateStatsUI();
  sceneMgr.updateBBox(currentModel);
  // Setup animations
  const clips = gltf.animations || root.animations || [];
  animMgr.dispose();
  animMgr.init(root);
  animMgr.setClips(clips);
  // Show or hide Animations UI depending on whether clips were found
  try { if (typeof setAnimSectionVisible === 'function') setAnimSectionVisible(!!(clips && clips.length)); } catch(e) {}
  // populate animation UI
  const animSelect = dom.get('anim-select');
  const animPlayPause = dom.get('anim-playpause');
  const animStop = dom.get('anim-stop');
  const animLoop = dom.get('anim-loop');
  const animSpeed = dom.get('anim-speed');
  const animProgress = dom.get('anim-progress');
  const animTime = dom.get('anim-time');

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
    animPlayPause.textContent = (dom.get('lang')?.value === 'ru') ? 'Пуск' : 'Play';
  }
  if (animStop) animStop.textContent = (dom.get('lang')?.value === 'ru') ? 'Стоп' : 'Stop';
  if (animTime) animTime.textContent = `0.00 / ${ (animMgr.getCurrentDuration()||0).toFixed(2) }s`;

  if (inspectorApi && typeof inspectorApi.refresh === 'function') inspectorApi.refresh();
}

// UI bindings via initUI
/* ===== Reset helpers for UI sections =====
   These mimic the original inline behaviors and call into
   the modular managers (renderSettings, lighting, sceneMgr, tControls).
*/
// UV flipping logic
function flipUVs(flip) {
  if (!currentModel) return;

  currentModel.traverse(obj => {
    if (obj.isMesh && obj.geometry && obj.geometry.attributes.uv) {
      const uvAttribute = obj.geometry.attributes.uv;
      const uuid = obj.uuid;

      if (flip) {
        // Store original UVs if not already stored
        if (!originalUVs.has(uuid)) {
          originalUVs.set(uuid, uvAttribute.array.slice()); // Create a copy
        }
        // Apply flip: u = 1 - u
        for (let i = 0; i < uvAttribute.array.length; i += 2) {
          uvAttribute.array[i] = 1 - uvAttribute.array[i];
        }
      } else {
        // Restore original UVs if stored
        if (originalUVs.has(uuid)) {
          const original = originalUVs.get(uuid);
          for (let i = 0; i < uvAttribute.array.length; i++) {
            uvAttribute.array[i] = original[i];
          }
        }
      }
      uvAttribute.needsUpdate = true;
    }
  });
  dom.showToast(`UVs ${flip ? 'flipped' : 'restored'}`);
}

function _showToast(msg){
  try {
    if (typeof dom !== 'undefined' && dom && dom.showToast) { dom.showToast(msg); return; }
  } catch(e){}
  const t = dom.get('toast');
  if (t){ t.textContent = msg; t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), 2600); }
}

function resetRender(){
  const exposureEl = dom.get('exposure');
  if (exposureEl) {
    exposureEl.value = 1;
    try { renderSettings.applyExposure(1); } catch(e){}
    const exposureValEl = dom.get('exposure-val');
    if (exposureValEl) exposureValEl.textContent = (1).toFixed(2);
  }
  const toneMappingEl = dom.get('tone-mapping');
  if (toneMappingEl) {
    toneMappingEl.value = 'ACES';
    try { renderSettings.applyToneMapping('ACES'); } catch(e){}
  }
  _showToast('Reset: Render');
}

function resetDir(){
  const dirIntensityEl = dom.get('dir-intensity');
  const dirAngleEl = dom.get('dir-angle');
  const dirSoftnessEl = dom.get('dir-softness');
  const dirIntensityVal = dom.get('dir-intensity-val');
  const dirAngleVal = dom.get('dir-angle-val');
  const dirSoftnessVal = dom.get('dir-softness-val');

  if (dirIntensityEl) { dirIntensityEl.value = 0.9; try { lighting.setDirIntensity(0.9); } catch(e){} if (dirIntensityVal) dirIntensityVal.textContent = (0.9).toFixed(2); }
  if (dirAngleEl) { dirAngleEl.value = 34; try { lighting.setDirFromAngle(34); } catch(e){} if (dirAngleVal) dirAngleVal.textContent = `${Math.round(34)}°`; }
  if (dirSoftnessEl) { dirSoftnessEl.value = 1; try { lighting.setDirSoftness(1); } catch(e){} if (dirSoftnessVal) dirSoftnessVal.textContent = (1).toFixed(1); }

  _showToast('Reset: Directional light');
}

function resetEnv(){
  const envIntensityEl = dom.get('env-intensity');
  const envIntensityVal = dom.get('env-intensity-val');
  const hdriUrlInput = dom.get('hdri-url');

  if (envIntensityEl) { envIntensityEl.value = 1; try { sceneMgr.applyEnvIntensity(1, currentModel || sceneMgr.getScene()); } catch(e){} if (envIntensityVal) envIntensityVal.textContent = (1).toFixed(2); }
  if (hdriUrlInput) { hdriUrlInput.value = ''; }
  try { sceneMgr.setEnvironment(null); } catch(e){}
  _showToast('Reset: Environment');
}

function resetGizmos(){
  const toggleTransformEl = dom.get('toggle-transform');
  const transformModeEl = dom.get('transform-mode');
  const toggleSnapEl = dom.get('toggle-snap');
  const snapPosEl = dom.get('snap-pos');
  const snapRotEl = dom.get('snap-rot');
  const snapScaleEl = dom.get('snap-scale');
  const measureToggleEl = dom.get('measure-toggle');
  const measureOutEl = dom.get('measure-out');

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
  const toggleShadowsEl = dom.get('toggle-shadows');
  const toggleFXAAEl = dom.get('toggle-fxaa');
  const toggleLightOnlyEl = dom.get('toggle-lightonly');
  const toggleGridEl = dom.get('toggle-grid');
  const toggleFlipUVEl = dom.get('toggle-flipuv');

  if (toggleShadowsEl) { toggleShadowsEl.checked = false; toggleShadowsEl.dispatchEvent(new Event('change')); }
  if (toggleFXAAEl) { toggleFXAAEl.checked = true; toggleFXAAEl.dispatchEvent(new Event('change')); }
  if (toggleLightOnlyEl) { toggleLightOnlyEl.checked = false; toggleLightOnlyEl.dispatchEvent(new Event('change')); }
  if (toggleGridEl) { toggleGridEl.checked = true; toggleGridEl.dispatchEvent(new Event('change')); }
  if (toggleFlipUVEl) { toggleFlipUVEl.checked = false; toggleFlipUVEl.dispatchEvent(new Event('change')); }

  // background & hdri
  const bgSelectEl = dom.get('bg-select');
  const bgColorEl = dom.get('bg-color');
  const hdriUrlInput = dom.get('hdri-url');
  if (bgSelectEl) { bgSelectEl.value = 'white'; }
  if (bgColorEl) { bgColorEl.value = '#ffffff'; }
  try { sceneMgr.setBackground('#ffffff'); } catch(e){}
  if (hdriUrlInput) hdriUrlInput.value = '';
  try { sceneMgr.setEnvironment(null); } catch(e){}

  // materials
  const matOverrideEl = dom.get('mat-override');
  const toggleWireframeEl = dom.get('toggle-wireframe');
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
  toast: toast, // Pass toast function to app
  onLoadFile: async (file) => {
    const name = file.name.toLowerCase();
    
    // Handle ZIP file (texture pack)
    if (name.endsWith('.zip')) {
      try {
        showOverlay('Загрузка текстур', file.name);
        await loadTexturesFromZIPFile(file);
        hideOverlay();
        dom.showToast('Текстуры загружены из ZIP. Теперь можно загружать FBX модель.');
      } catch (err) {
        hideOverlay();
        dom.showToast('Ошибка загрузки ZIP: ' + (err.message || err));
      }
      return;
    }
    
    // Handle 3D model files
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
        dom.showToast('Ошибка загрузки: ' + (err.message || err));
      });
    } else if (name.endsWith('.fbx')) {
      showOverlay('Загрузка FBX', file.name);
      
      // Create texture resolver if ZIP textures are available
      let textureResolver = null;
      if (zipTextures.size > 0) {
        textureResolver = createTextureResolver();
        console.log(`[app] Created texture resolver with ${zipTextures.size} textures`);
      }
      
      // Create FBX loader with texture resolver
      const fbxLoader = new FBXLoaderWrapper(textureResolver);
      
      fbxLoader.loadFromFile(file, (evt) => {
        if (evt && evt.lengthComputable) setProgress(evt.loaded / evt.total);
        else setIndeterminate();
      }).then(obj => {
        hideOverlay();
        // FBX returns Object3D — wrap in a simple shape consistent with GLTF handling
        postLoad(obj, 'fbx');
      }).catch(err => {
        hideOverlay();
        dom.showToast('Ошибка FBX: ' + (err.message || err));
      });
    } else {
      dom.showToast('Поддерживаются: glTF/GLB/FBX и ZIP с текстурами');
    }
  },

  onApplyHDRI: async (url) => {
    if (!url) {
      sceneMgr.setEnvironment(null);
      dom.showToast('HDRI cleared');
      return;
    }
    showOverlay('HDRI', 'Загружаем окружение…');
    const loaderModule = await import('https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/RGBELoader.js');
    const loader = new loaderModule.RGBELoader();
    loader.load(url, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      sceneMgr.setEnvironment(tex);
      sceneMgr.applyEnvIntensity && sceneMgr.applyEnvIntensity( Number(dom.get('env-intensity')?.value || 1), currentModel || sceneMgr.getScene());
      hideOverlay();
      dom.showToast('HDRI applied');
    }, undefined, (err) => {
      hideOverlay();
      dom.showToast('Не удалось загрузить HDRI');
    });
  },

  onApplyTextures: async (file) => {
    if (!file) {
      dom.showToast('Выберите ZIP файл с текстурами');
      return;
    }
    
    if (!file.name.toLowerCase().endsWith('.zip')) {
      dom.showToast('Выберите ZIP файл');
      return;
    }
    
    try {
      showOverlay('Загрузка текстур', file.name);
      
      // Load textures from the ZIP file
      await loadTexturesFromZIPFile(file);
      
      // Apply textures to current model if available
      if (currentModel && zipTextures.size > 0) {
        try {
          console.log(`[app] Applying ${zipTextures.size} ZIP textures to current model...`);
          applyTexturesFromMap(currentModel, zipTextures);
          dom.showToast(`Применено ${zipTextures.size} текстур из ZIP`);
        } catch (error) {
          console.warn('[app] Failed to apply ZIP textures:', error);
          dom.showToast('Ошибка применения текстур: ' + error.message);
        }
      } else if (!currentModel) {
        dom.showToast('Загрузите модель FBX перед применением текстур');
      } else {
        dom.showToast('В ZIP не найдены текстуры');
      }
      
      hideOverlay();
    } catch (error) {
      hideOverlay();
      console.error('[app] Failed to load textures from file:', error);
      dom.showToast('Ошибка загрузки текстур: ' + error.message);
    }
  },

  onResetAll: resetAll,

  onFrame: () => { frameObject(currentModel || sceneMgr.getScene()); },

  onClearScene: () => { clearScene(); },
  
  getSettings: () => settings.get(),
  setSettings: (s) => {
    // Update the settings store with new values
    Object.keys(s).forEach(key => {
      settings.set(key, s[key]);
    });
  }
});

// Reveal UI that was hidden by the original preload guard
dom.body().classList.remove('preload');
// Apply language strings from the lang select (if UI exposes applyLang)
const langEl = dom.get('lang');
if (ui && ui.applyLang && langEl) ui.applyLang(langEl.value || 'en');
// Hide animations section on startup if there are no clips
try { if (typeof setAnimSectionVisible === 'function') setAnimSectionVisible(!!animMgr.hasClips && animMgr.hasClips()); } catch(e) {}

// Section reset buttons bindings (were present in the original monolithic script
// but got omitted during refactor). Wire them to the helper functions above.
const resetRenderBtn = dom.get('reset-render');
const resetDirBtn = dom.get('reset-dir');
const resetEnvBtn = dom.get('reset-env');
const resetGizmosBtn = dom.get('reset-gizmos');

resetRenderBtn?.addEventListener('click', resetRender);
resetDirBtn?.addEventListener('click', resetDir);
resetEnvBtn?.addEventListener('click', resetEnv);
resetGizmosBtn?.addEventListener('click', resetGizmos);

// initialize render settings UI state
const tmEl = dom.get('tone-mapping');
if (tmEl) tmEl.value = renderSettings.getState().tonemapping || tmEl.value;
const exposureEl = dom.get('exposure');
if (exposureEl) exposureEl.value = renderSettings.getState().exposure || exposureEl.value;
const exposureValEl = dom.get('exposure-val');
if (exposureValEl) exposureValEl.textContent = (renderSettings.getState().exposure || Number(exposureEl?.value || 1)).toFixed(2);
const fxaaToggle = dom.get('toggle-fxaa');
if (fxaaToggle) fxaaToggle.checked = renderSettings.getState().fxaa;

// initialize lighting UI labels
const dirIntensityValEl = dom.get('dir-intensity-val');
const dirAngleValEl = dom.get('dir-angle-val');
const dirSoftnessValEl = dom.get('dir-softness-val');
const envIntensityValEl = dom.get('env-intensity-val');
if (dirIntensityValEl) dirIntensityValEl.textContent = (lighting.getDirIntensity?.() || Number(dom.get('dir-intensity')?.value || 0.9)).toFixed(2);
if (dirAngleValEl) dirAngleValEl.textContent = `${Math.round(Number(dom.get('dir-angle')?.value || 34))}°`;
if (dirSoftnessValEl) dirSoftnessValEl.textContent = (lighting.getDirSoftness?.() || Number(dom.get('dir-softness')?.value || 1)).toFixed(1);
if (envIntensityValEl) envIntensityValEl.textContent = (Number(dom.get('env-intensity')?.value || 1)).toFixed(2);
// Initialize inspector (optional)
inspectorApi = null;
try {
  if (typeof initInspector === 'function') {
    inspectorApi = initInspector({
      sceneManager: sceneMgr,
      lighting: lighting,
      getCurrentModel: () => currentModel,
      onSelect: (obj) => {
        rendererMgr.setOutlineObjects(obj);
        // Handle both single object and array of objects
        const objectToUpdate = Array.isArray(obj) ? (obj.length > 0 ? obj[0] : null) : obj;
        sceneMgr.updateBBox(objectToUpdate);
        // Update the global selected object for transform controls
        if (objectToUpdate) {
          selectedObject = objectToUpdate;
        }
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
const openInspectorBtn = dom.get('open-inspector');
const inspectorEl = dom.get('scene-inspector');
const inspectorCloseBtn = dom.get('inspector-close');
const leftColEl = dom.query('.left-col');

function setInspectorOpen(open){
  if (!inspectorEl) return;
  inspectorEl.classList.toggle('right-0', !!open);
  inspectorEl.classList.toggle('right-[-360px]', !open);
}
openInspectorBtn?.addEventListener('click', ()=> setInspectorOpen(true));
inspectorCloseBtn?.addEventListener('click', ()=> setInspectorOpen(false));
leftColEl?.addEventListener('dblclick', ()=> setInspectorOpen(true));

// Small overlay helpers (same as original)
const overlay = dom.get('overlay');
const meter = dom.get('meter');
const progressTitle = dom.get('progress-title');
const progressSub = dom.get('progress-sub');

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

// Initialize UI bindings
let unbindUI = null;
function initUIBindings() {
  const managers = {
    rendererMgr,
    sceneMgr,
    animMgr,
    tControls,
    lighting,
    renderSettings
  };

  const opts = {
    getCurrentModel: () => currentModel,
    camera,
    controls,
    inspectorApi,
    setInspectorOpen,
    updateAnimTimeUI,
    setAnimSectionVisible,
    camPreset: (view) => camPreset(view),
    selectedObject: () => selectedObject,
    setSelectedObject: (obj) => {
      selectedObject = obj;
    }
  };

  unbindUI = bindUI(managers, dom, opts);
}
 
// Call initUIBindings after UI initialization
initUIBindings();


// Resize
function onResize() {
  const size = dom.getWindowSize();
  rendererMgr.setSize(size.width, size.height);
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
}
dom.onResize(onResize);

// wire UI inputs for lighting (if present)
const dirIntensityEl = dom.get('dir-intensity');
const dirAngleEl = dom.get('dir-angle');
const dirSoftnessEl = dom.get('dir-softness');
const envIntensityEl = dom.get('env-intensity');
if (dirIntensityEl) dirIntensityEl.addEventListener('input', () => {
  const v = Number(dirIntensityEl.value || 0);
  lighting.setDirIntensity(v);
  const el = dom.get('dir-intensity-val');
  if (el) el.textContent = v.toFixed(2);
});
if (dirAngleEl) dirAngleEl.addEventListener('input', () => {
  const v = Number(dirAngleEl.value || 0);
  lighting.setDirFromAngle(v);
  const el = dom.get('dir-angle-val');
  if (el) el.textContent = `${Math.round(v)}°`;
});
if (dirSoftnessEl) dirSoftnessEl.addEventListener('input', () => {
  const v = Number(dirSoftnessEl.value || 0);
  lighting.setDirSoftness(v);
  const el = dom.get('dir-softness-val');
  if (el) el.textContent = v.toFixed(1);
});
if (envIntensityEl) envIntensityEl.addEventListener('input', () => {
  const v = Number(envIntensityEl.value || 1);
  sceneMgr.applyEnvIntensity(v, currentModel || sceneMgr.getScene());
  const el = dom.get('env-intensity-val');
  if (el) el.textContent = v.toFixed(2);
});

// Bind render settings UI to manager
const toneMappingEl = dom.get('tone-mapping');
const fxaaEl = dom.get('toggle-fxaa');
if (exposureEl) {
  exposureEl.addEventListener('input', ()=> {
    const v = Number(exposureEl.value || 1);
    renderSettings.applyExposure(v);
    const exposureValEl = dom.get('exposure-val');
    if (exposureValEl) exposureValEl.textContent = v.toFixed(2);
  });
  // also update the label on change/end to be robust across browsers
  exposureEl.addEventListener('change', ()=> {
    const v = Number(exposureEl.value || 1);
    const exposureValEl = dom.get('exposure-val');
    if (exposureValEl) exposureValEl.textContent = v.toFixed(2);
  });
}
if (toneMappingEl) toneMappingEl.addEventListener('change', ()=> { renderSettings.applyToneMapping(toneMappingEl.value); });
if (fxaaEl) fxaaEl.addEventListener('change', ()=> { renderSettings.enableFXAA(!!fxaaEl.checked); });

// Bind flip UV toggle
const flipUVToggle = dom.get('toggle-flipuv');
if (flipUVToggle) {
  flipUVToggle.addEventListener('change', () => {
    flipUVs(!!flipUVToggle.checked);
  });
}

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

const camPresets = dom.get('cam-presets');
if (camPresets) {
  dom.queryAll('cam-presets button').forEach(btn => {
    dom.on(btn, 'click', () => camPreset(btn.dataset.view));
  });
}


// Store RAF id for later cancellation
let rafId = null;

// Render loop
let lastFpsUpdate = 0;
function animate() {
  rafId = requestAnimationFrame(animate);
  const dt = clock.getDelta();
  animMgr.update(dt);

  // Update animation UI if an animation is playing
  if (animMgr.activeAction && !animMgr.activeAction.paused) {
    updateAnimTimeUI(animMgr.getCurrentTime(), animMgr.getCurrentDuration());
  }

  // Handle WASDQE camera movement
  handleCameraMovement(dt);


  controls.update();
  rendererMgr.render(sceneMgr.getScene(), camera);
  
  // fps update
  if (dom.get('fps')) {
    const now = performance.now();
    if (!lastFpsUpdate) lastFpsUpdate = now;
    if (now - lastFpsUpdate >= 500) {
      const fps = Math.round(1 / dt);
      dom.get('fps').textContent = String(fps);
      lastFpsUpdate = now;
    }
  }
}

// Handle WASDQE camera movement
function handleCameraMovement(dt) {
  // Get movement sensitivity from settings
  const moveSpeed = settings.getMovementSensitivity(); // Units per second
  const moveDistance = moveSpeed * dt;
  
  // Get camera's forward, right, and up vectors in world space
  const forward = new THREE.Vector3(0, 0, -1);
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  
  // Transform vectors by camera's rotation
  forward.applyQuaternion(camera.quaternion);
  right.applyQuaternion(camera.quaternion);
  up.applyQuaternion(camera.quaternion);
  
  // Normalize vectors to ensure consistent movement speed
  forward.normalize();
  right.normalize();
  up.normalize();
  
  // Calculate movement direction
  let moveDirection = new THREE.Vector3();
  
  if (pressedKeys.has('KeyW')) moveDirection.add(forward);
  if (pressedKeys.has('KeyS')) moveDirection.sub(forward);
  if (pressedKeys.has('KeyA')) moveDirection.sub(right);
  if (pressedKeys.has('KeyD')) moveDirection.add(right);
  if (pressedKeys.has('KeyQ')) moveDirection.sub(up);
  if (pressedKeys.has('KeyE')) moveDirection.add(up);
  
  // Apply movement if any key is pressed
  if (moveDirection.length() > 0) {
    moveDirection.normalize();
    camera.position.add(moveDirection.multiplyScalar(moveDistance));
  }
}

// Start animation loop
function start() {
  if (!rafId) {
    animate();
  }
}

// Stop animation loop
function stop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// Dispose function to clean up resources
function dispose() {
  stop();
  if (unbindUI) {
    unbindUI();
    unbindUI = null;
  }
  // Clear ZIP textures
  clearZipTextures();
  // Remove global event listeners
  dom.offResize(onResize);
  dom.offError((e) => {});
  dom.offUnhandledRejection((e) => {});
}

// Hotkey handling
// Use window so DOMManager can resolve the global event target
// Use event.code to be layout-independent (works with RU/EN layouts)
dom.on(window, 'keydown', (e) => {
  switch(e.code) {
    case 'KeyF':
      if (getSelectedObject()) {
        frameObject(getSelectedObject());
      }
      break;
    case 'KeyR':
      // Reset camera to initial transform
      camera.position.set(2, 1.2, 3);
      controls.target.set(0, 0.8, 0);
      controls.update();
      break;
    case 'Delete':
      clearSelection();
      break;
  }
});


// Keydown handler for WASDQE movement
// Use window so DOMManager can resolve the global event target
// Use event.code to be layout-independent (works with RU/EN layouts)
dom.on(window, 'keydown', (e) => {
  const code = e.code;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(code)) {
    pressedKeys.add(code);
    e.preventDefault(); // Prevent default browser behavior for these keys
  }
});

// Keyup handler for WASDQE movement
// Use window so DOMManager can resolve the global event target
// Use event.code to be layout-independent (works with RU/EN layouts)
dom.on(window, 'keyup', (e) => {
  const code = e.code;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(code)) {
    pressedKeys.delete(code);
    e.preventDefault();
  }
});

// Start the animation loop
start();

// Expose debug helpers and globals for UI access
dom.setGlobal('clearCurrentModel', clearCurrentModel);
dom.setGlobal('openInspector', (open) => {
  if (!dom.get('scene-inspector')) return;
  dom.get('scene-inspector').classList.toggle('right-0', !!open);
});
dom.setGlobal('disposeApp', dispose);
dom.setGlobal('camera', camera);
dom.setGlobal('controls', controls);
dom.setGlobal('clearSelection', clearSelection);

// Diagnostic helper: check required DOM elements and report missing ones.
// Appends at end of bootstrap to run after initialization attempts.
(function runDiagnostics(){
  try {
    const expected = [
      'viewport','file-input','reset-camera','clear-scene','reset-all',
      'toggle-shadows','toggle-fxaa','toggle-lightonly','toggle-grid','toggle-flipuv',
      'bg-select','bg-color','hdri-url','apply-hdri',
      'mat-override','toggle-wireframe',
      'anim-select','anim-playpause','anim-stop','anim-loop','anim-speed','anim-progress','anim-time',
      'tree','scene-inspector','open-inspector','toast','overlay','meter','progress-title','progress-sub'
    ];
    const missing = expected.filter(id => !dom.get(id));
    if (missing.length) {
      console.warn('[DIAG] Missing DOM elements:', missing);
      const toastEl = dom.get('toast');
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
// Load default model function
async function loadDefaultModel() {
  try {
    console.log('[app] Loading default model: model/devilgirl.fbx');
    
    // Create a File object from the default model path
    const defaultModelPath = 'model/devilgirl.fbx';
    const response = await fetch(defaultModelPath);
    
    if (!response.ok) {
      throw new Error(`Failed to load default model: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const defaultModelFile = new File([arrayBuffer], 'devilgirl.fbx', { type: 'application/octet-stream' });
    
    showOverlay('Загрузка модели', 'devilgirl.fbx');
    
    // Create texture resolver if ZIP textures are available
    let textureResolver = null;
    if (zipTextures.size > 0) {
      textureResolver = createTextureResolver();
      console.log(`[app] Created texture resolver with ${zipTextures.size} textures for default model`);
    }
    
    // Create FBX loader with texture resolver
    const fbxLoader = new FBXLoaderWrapper(textureResolver);
    
    fbxLoader.loadFromFile(defaultModelFile, (evt) => {
      if (evt && evt.lengthComputable) setProgress(evt.loaded / evt.total);
      else setIndeterminate();
    }).then(obj => {
      hideOverlay();
      // FBX returns Object3D — wrap in a simple shape consistent with GLTF handling
      postLoad(obj, 'fbx');
      console.log('[app] Default model loaded successfully');
    }).catch(err => {
      hideOverlay();
      console.error('[app] Failed to load default model:', err);
      dom.showToast('Ошибка загрузки модели по умолчанию: ' + (err.message || err));
    });
    
  } catch (error) {
    console.error('[app] Failed to load default model:', error);
    // Don't show toast error for default model loading failure to avoid spamming user
    // The app will start without a model, which is acceptable
  }
}

// Load default model on startup
loadDefaultModel();

})();
