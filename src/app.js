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
  const tree = document.getElementById('tree'); if (tree) tree.innerHTML = '';
  const animSelect = document.getElementById('anim-select'); if (animSelect) animSelect.innerHTML = '';
  tControls.detach();
}

// Scene tree builder
function buildSceneTree(root) {
  const treeRoot = document.getElementById('tree');
  if (!treeRoot) return;
  treeRoot.innerHTML = '';
  const ul = document.createElement('ul');
  treeRoot.appendChild(ul);
  function addNode(o, parent) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = o.name || o.type;
    btn.addEventListener('click', () => {
      rendererMgr.setOutlineObjects(o);
      sceneMgr.updateBBox(o);
      const inspector = document.getElementById('scene-inspector');
      if (inspector) inspector.classList.add('right-0');
    });
    li.appendChild(btn);
    parent.appendChild(li);
    if (o.children?.length) {
      const ul2 = document.createElement('ul');
      li.appendChild(ul2);
      o.children.forEach(c => addNode(c, ul2));
    }
  }
  (root || sceneMgr.getScene()).children.forEach(o => addNode(o, ul));
}

// Post-load common operations
async function postLoad(gltf, sourceType = 'gltf') {
  clearCurrentModel();
  const root = gltf.scene || gltf;
  sceneMgr.add(root);
  currentModel = root;

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

  buildSceneTree(currentModel);
}

// UI bindings via initUI
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

  onResetAll: () => {
    clearCurrentModel();
    ui.toast('Settings reset');
  },

  onFrame: () => { frameObject(currentModel || sceneMgr.getScene()); },

  onClearScene: () => { clearCurrentModel(); ui.toast('Scene cleared'); }
});

// Reveal UI that was hidden by the original preload guard
document.body.classList.remove('preload');
// Apply language strings from the lang select (if UI exposes applyLang)
const langEl = document.getElementById('lang');
if (ui && ui.applyLang && langEl) ui.applyLang(langEl.value || 'en');

// initialize render settings UI state
const tmEl = document.getElementById('tone-mapping');
if (tmEl) tmEl.value = renderSettings.getState().tonemapping || tmEl.value;
const exEl = document.getElementById('exposure');
if (exEl) exEl.value = renderSettings.getState().exposure || exEl.value;
const fxaaToggle = document.getElementById('toggle-fxaa');
if (fxaaToggle) fxaaToggle.checked = renderSettings.getState().fxaa;
// Initialize inspector (optional)
import('./Inspector.js').then(mod => {
  const initInspectorFn = mod.initInspector || mod.default;
  if (initInspectorFn) {
    try {
      initInspectorFn({
        sceneManager: sceneMgr,
        onSelect: (obj) => {
          rendererMgr.setOutlineObjects(obj);
          sceneMgr.updateBBox(obj);
        }
      });
    } catch (e) {
      console.warn('Inspector init error', e);
    }
  }
}).catch(err => { /* inspector optional */ console.debug('Inspector not loaded', err); });

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
  });
  toggleFXAA?.addEventListener('change', () => { rendererMgr.enableFXAA(toggleFXAA.checked); });
  toggleLightOnly?.addEventListener('change', () => { setLightOnly(currentModel, toggleLightOnly.checked); });
  toggleGrid?.addEventListener('change', () => { sceneMgr.setGridVisible(!!toggleGrid.checked); });

  // Material override
  matOverride?.addEventListener('change', () => {
    applyMaterialOverride(currentModel, { overrideType: matOverride.value, wire: !!toggleWireframe?.checked, envIntensity: Number(document.getElementById('env-intensity')?.value || 1) });
  });
  toggleWireframe?.addEventListener('change', () => {
    applyMaterialOverride(currentModel, { overrideType: matOverride?.value || 'none', wire: !!toggleWireframe?.checked, envIntensity: Number(document.getElementById('env-intensity')?.value || 1) });
  });

  // Animations UI
  function updateAnimTimeUI(time, dur) {
    const t = Math.max(0, Math.min(time, dur || 0));
    const d = dur || 0;
    if (animTime) animTime.textContent = `${t.toFixed(2)} / ${d.toFixed(2)}s`;
    if (animProgress) animProgress.value = d ? (t / d) : 0;
  }

  animSelect?.addEventListener('change', () => {
    if (!animMgr.hasClips()) return;
    animMgr.select(Number(animSelect.value));
    updateAnimTimeUI(0, animMgr.getCurrentDuration());
  });

  animPlayPause?.addEventListener('click', () => {
    if (!animMgr.hasClips()) return;
    if (animPlayPause.dataset.state !== 'playing') {
      animMgr.play();
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
    buildSceneTree(currentModel || sceneMgr.getScene());
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
if (dirIntensityEl) dirIntensityEl.addEventListener('input', () => { lighting.setDirIntensity(Number(dirIntensityEl.value || 0)); });
if (dirAngleEl) dirAngleEl.addEventListener('input', () => { lighting.setDirFromAngle(Number(dirAngleEl.value || 0)); });
if (dirSoftnessEl) dirSoftnessEl.addEventListener('input', () => { lighting.setDirSoftness(Number(dirSoftnessEl.value || 0)); });
if (envIntensityEl) envIntensityEl.addEventListener('input', () => { sceneMgr.applyEnvIntensity(Number(envIntensityEl.value || 1), currentModel || sceneMgr.getScene()); });

// Bind render settings UI to manager
const exposureEl = document.getElementById('exposure');
const toneMappingEl = document.getElementById('tone-mapping');
const fxaaEl = document.getElementById('toggle-fxaa');
if (exposureEl) exposureEl.addEventListener('input', ()=> { renderSettings.applyExposure(Number(exposureEl.value || 1)); });
if (toneMappingEl) toneMappingEl.addEventListener('change', ()=> { renderSettings.applyToneMapping(toneMappingEl.value); });
if (fxaaEl) fxaaEl.addEventListener('change', ()=> { renderSettings.enableFXAA(!!fxaaEl.checked); });

// Ensure exposure value display matches saved render settings
const exposureValEl = document.getElementById('exposure-val');
if (exposureValEl) exposureValEl.textContent = (renderSettings.getState().exposure || 1).toFixed(2);

// Render loop
let lastFpsUpdate = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  animMgr.update(dt);
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
