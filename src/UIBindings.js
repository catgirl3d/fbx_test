// UIBindings.js
// Extracted from src/app.js to separate UI binding logic from app orchestration

import * as THREE from 'three';
import Materials, { applyMaterialOverride, setLightOnly } from './Materials.js';

/**
 * Binds UI controls to managers and DOM elements.
 * @param {Object} managers - Manager instances to bind to
 * @param {Object} dom - DOM element cache
 * @param {Object} opts - Options
 * @param {Object} opts.currentModel - Reference to current model
 * @param {Object} opts.camera - Camera instance
 * @param {Object} opts.controls - OrbitControls instance
 * @param {Object} opts.inspectorApi - Inspector API
 * @param {Function} opts.setInspectorOpen - Function to open/close inspector
 * @param {Function} opts.updateAnimTimeUI - Function to update animation time UI
 * @param {Function} opts.setAnimSectionVisible - Function to show/hide animations section
 */
export function bindUI(managers, dom, opts) {
  const {
    rendererMgr, sceneMgr, animMgr, tControls, lighting, renderSettings
  } = managers;

  const {
    getCurrentModel, camera, controls, inspectorApi, setInspectorOpen, updateAnimTimeUI, setAnimSectionVisible, selectedObject, setSelectedObject
  } = opts;

  // helper to obtain the live current model (supports older callers that passed `currentModel` directly on opts)
  function _getCurrentModel() {
    if (typeof getCurrentModel === 'function') return getCurrentModel();
    return opts.currentModel || null;
  }

  // Transform controls
  function applySnap() {
    if (!dom.toggleSnap) return;
    if (dom.isChecked('toggleSnap')) {
      tControls.setTranslationSnap(Number(dom.getValue('snapPos')) || 0);
      tControls.setRotationSnap(THREE.MathUtils.degToRad(Number(dom.getValue('snapRot')) || 0));
      tControls.setScaleSnap(Number(dom.getValue('snapScale')) || 0);
    } else {
      tControls.setTranslationSnap(null);
      tControls.setRotationSnap(null);
      tControls.setScaleSnap(null);
    }
  }

  dom.on(dom.get('toggleTransform'), 'change', () => {
    const on = dom.isChecked('toggleTransform');
    console.log('Transform controls toggle:', on);
    
    tControls.enable(on);
    
    // Get the actual selected object (not the function)
    let selectedObj = null;
    try {
      selectedObj = selectedObject();
      if (typeof selectedObj === 'function') {
        selectedObj = selectedObj(); // If it's a function, call it
      }
    } catch (e) {
      console.warn('Error getting selected object:', e);
    }
    
    console.log('Selected object for transform:', selectedObj);
    
    if (on && selectedObj) {
      let transformTarget = selectedObj;

      // For SkinnedMesh, we must transform the root bone, not the mesh itself.
      let rootBone = null;
      selectedObj.traverse(child => {
        if (child.isBone && child.name === 'root') {
          rootBone = child;
        }
        // Fallback for skinned mesh without a 'root' bone, find the first bone
        if (!rootBone && child.isSkinnedMesh && child.skeleton && child.skeleton.bones && child.skeleton.bones.length > 0) {
            // Find the top-level bone in the skeleton hierarchy
            let topBone = child.skeleton.bones[0];
            while(topBone.parent && topBone.parent.isBone) {
                topBone = topBone.parent;
            }
            rootBone = topBone;
        }
      });

      if (rootBone) {
        console.log('Found root bone for transform:', rootBone.name);
        transformTarget = rootBone;
      } else if (selectedObj.isSkinnedMesh) {
        console.warn('Could not find a root bone for the selected SkinnedMesh.');
        tControls.detach();
        return;
      }
      
      // Validate that the object is a proper Three.js object with required methods
      if (transformTarget && typeof transformTarget.updateMatrixWorld === 'function' &&
          transformTarget.type && (transformTarget.parent || transformTarget.isBone)) {
        console.log('Attaching transform controls to:', transformTarget.name || transformTarget.type);
        tControls.attach(transformTarget);
        console.log('Transform controls attached, current object:', tControls.controls.object);
      } else {
        console.warn('Invalid object selected for transform controls:', transformTarget);
        tControls.detach();
        // Optionally show error to user
        const toastEl = dom.get('toast');
        if (toastEl) {
          toastEl.textContent = 'Cannot transform this object type';
          toastEl.classList.add('show');
          setTimeout(() => toastEl.classList.remove('show'), 3000);
        }
      }
    } else {
      console.log('Detaching transform controls');
      tControls.detach();
    }
  });

  dom.on(dom.get('transformMode'), 'change', () => tControls.setMode(dom.getValue('transformMode')));
  dom.on(dom.get('toggleSnap'), 'change', applySnap);
  [dom.get('snapPos'), dom.get('snapRot'), dom.get('snapScale')].forEach(el => el && dom.on(el, 'change', applySnap));

  // Toggles
  dom.on(dom.get('toggleShadows'), 'change', () => {
    const on = dom.isChecked('toggleShadows');
    rendererMgr.renderer.shadowMap.enabled = on;
    lighting.enableShadows(on);
    // Apply castShadow/receiveShadow to all meshes in scene or current model
    const root = _getCurrentModel() || sceneMgr.getScene();
    if (root) {
      root.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = on;
          obj.receiveShadow = on;
        }
      });
    }
    // Also ensure the scene's own directional light (if exists) has shadows enabled
    const sceneDirLight = sceneMgr.getScene()?.children?.find?.(child => child.isDirectionalLight);
    if (sceneDirLight) {
      sceneDirLight.castShadow = on;
    }
  });

  dom.on(dom.get('toggleFXAA'), 'change', () => { rendererMgr.enableFXAA(dom.isChecked('toggleFXAA')); });
  dom.on(dom.get('toggleLightOnly'), 'change', () => { setLightOnly(_getCurrentModel(), dom.isChecked('toggleLightOnly')); });
  dom.on(dom.get('toggleGrid'), 'change', () => { sceneMgr.setGridVisible(!!dom.isChecked('toggleGrid')); });

  // Background selection
  function updateBackground() {
    const bgSelectValue = dom.getValue('bgSelect');
    if (bgSelectValue === 'custom') {
      sceneMgr.setBackground(dom.getValue('bgColor') || '#ffffff');
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

  const bgSelectEl = dom.get('bgSelect');
  const bgColorEl = dom.get('bgColor');
  if (bgSelectEl) dom.on(bgSelectEl, 'change', updateBackground);
  if (bgColorEl) dom.on(bgColorEl, 'input', updateBackground);

  // Material override
  const matOverrideEl = dom.get('matOverride');
  const toggleWireframeEl = dom.get('toggleWireframe');
  const envIntensityEl = dom.get('envIntensity');
  
  if (matOverrideEl) {
    dom.on(matOverrideEl, 'change', () => {
      applyMaterialOverride(_getCurrentModel(), {
        overrideType: dom.getValue('matOverride'),
        wire: !!dom.isChecked('toggleWireframe'),
        envIntensity: Number(dom.getValue('envIntensity') || 1)
      });
    });
  }

  if (toggleWireframeEl) {
    dom.on(toggleWireframeEl, 'change', () => {
      applyMaterialOverride(_getCurrentModel(), {
        overrideType: dom.getValue('matOverride') || 'none',
        wire: !!dom.isChecked('toggleWireframe'),
        envIntensity: Number(dom.getValue('envIntensity') || 1)
      });
    });
  }

  // Animations UI
  const animSelectEl = dom.get('animSelect');
  const animPlayPauseEl = dom.get('animPlayPause');
  const animStopEl = dom.get('animStop');
  const animLoopEl = dom.get('animLoop');
  const animSpeedEl = dom.get('animSpeed');
  const animProgressEl = dom.get('animProgress');
  const langEl = dom.get('lang');

  if (animSelectEl) {
    dom.on(animSelectEl, 'change', () => {
      if (!animMgr.hasClips()) return;
      animMgr.select(Number(dom.getValue('animSelect')));
      updateAnimTimeUI(0, animMgr.getCurrentDuration());
    });
  }

  if (animPlayPauseEl) {
    dom.on(animPlayPauseEl, 'click', () => {
      if (!animMgr.hasClips()) return;
      if (animPlayPauseEl.dataset.state !== 'playing') {
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
        animPlayPauseEl.dataset.state = 'playing';
        animPlayPauseEl.textContent = (dom.getValue('lang') === 'ru') ? 'Пауза' : 'Pause';
      } else {
        animMgr.pause();
        animPlayPauseEl.dataset.state = 'paused';
        animPlayPauseEl.textContent = (dom.getValue('lang') === 'ru') ? 'Пуск' : 'Play';
      }
    });
  }

  if (animStopEl) {
    dom.on(animStopEl, 'click', () => {
      animMgr.stop();
      animPlayPauseEl.dataset.state = 'stopped';
      animPlayPauseEl.textContent = (dom.getValue('lang') === 'ru') ? 'Пуск' : 'Play';
      updateAnimTimeUI(0, animMgr.getCurrentDuration());
    });
  }

  if (animLoopEl) {
    dom.on(animLoopEl, 'change', () => { animMgr.setLoop(dom.isChecked('animLoop')); });
  }

  if (animSpeedEl) {
    dom.on(animSpeedEl, 'change', () => { animMgr.setSpeed(Number(dom.getValue('animSpeed') || 1)); });
  }

  if (animProgressEl) {
    dom.on(animProgressEl, 'input', () => {
      if (!animMgr.hasClips()) return;
      const dur = animMgr.getCurrentDuration();
      const t = parseFloat(dom.getValue('animProgress')) * dur;
      // set active action time directly if available
      if (animMgr.activeAction) {
        animMgr.activeAction.time = t;
        animMgr.update(0);
        updateAnimTimeUI(t, dur);
      }
    });
  }

  // Camera presets use main app implementation
  const camPreset = opts.camPreset;

  const camPresetsEl = dom.get('camPresets');
  if (camPresetsEl) {
    const buttons = camPresetsEl.querySelectorAll('button');
    buttons.forEach(btn => {
      const handler = () => camPreset(btn.dataset.view);
      btn.addEventListener('click', handler);
      btn._camPresetHandler = handler;
    });
  }

  // Picking
  const canvasEl = dom.get('canvas');
  if (canvasEl) {
    canvasEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const rect = canvasEl.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX-rect.left)/rect.width)*2 - 1,
        -((e.clientY-rect.top)/rect.height)*2 + 1
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const meshes = [];
      const cm = _getCurrentModel();
      if (cm) cm.traverse(o => { if (o.isMesh) meshes.push(o); });
      else sceneMgr.getScene().traverse(o => { if (o.isMesh) meshes.push(o); });
      const hit = ray.intersectObjects(meshes, true)[0];
      if (hit) {
        // Set the selected object globally
        if (setSelectedObject) {
          setSelectedObject(hit.object);
        } else {
          // Fallback: directly set the selected object
          opts.selectedObject = hit.object;
        }
        rendererMgr.setOutlineObjects(hit.object);
        sceneMgr.updateBBox(hit.object);
        if (inspectorApi && typeof inspectorApi.selectObject === 'function') {
          try { inspectorApi.selectObject(hit.object); } catch(e) {}
        }
        setInspectorOpen(true);
      }
    });
  }

  // Resize
  function onResize() {
    const size = dom.getWindowSize();
    rendererMgr.setSize(size.width, size.height);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  }
  dom.onResize(onResize);

  // Lighting UI inputs
  const dirIntensityEl = dom.get('dirIntensity');
  const dirAngleEl = dom.get('dirAngle');
  const dirSoftnessEl = dom.get('dirSoftness');
  const envIntensityEl2 = dom.get('envIntensity');

  if (dirIntensityEl) {
    dom.on(dirIntensityEl, 'input', () => {
      const v = Number(dom.getValue('dirIntensity') || 0);
      lighting.setDirIntensity(v);
      const dirIntensityValEl = dom.get('dirIntensityVal');
      if (dirIntensityValEl) dirIntensityValEl.textContent = v.toFixed(2);
    });
  }

  if (dirAngleEl) {
    dom.on(dirAngleEl, 'input', () => {
      const v = Number(dom.getValue('dirAngle') || 0);
      lighting.setDirFromAngle(v);
      const dirAngleValEl = dom.get('dirAngleVal');
      if (dirAngleValEl) dirAngleValEl.textContent = `${Math.round(v)}°`;
    });
  }

  if (dirSoftnessEl) {
    dom.on(dirSoftnessEl, 'input', () => {
      const v = Number(dom.getValue('dirSoftness') || 0);
      lighting.setDirSoftness(v);
      const dirSoftnessValEl = dom.get('dirSoftnessVal');
      if (dirSoftnessValEl) dirSoftnessValEl.textContent = v.toFixed(1);
    });
  }

  if (envIntensityEl2) {
    dom.on(envIntensityEl, 'input', () => {
      const v = Number(dom.getValue('envIntensity') || 1);
      sceneMgr.applyEnvIntensity(v, _getCurrentModel() || sceneMgr.getScene());
      const envIntensityValEl = dom.get('envIntensityVal');
      if (envIntensityValEl) envIntensityValEl.textContent = v.toFixed(2);
    });
  }

  // Render settings UI
  const exposureEl = dom.get('exposure');
  const toneMappingEl = dom.get('toneMapping');
  const fxaaEl = dom.get('fxaa');

  if (exposureEl) {
    dom.on(exposureEl, 'input', ()=> {
      const v = Number(dom.getValue('exposure') || 1);
      renderSettings.applyExposure(v);
      const exposureValEl = dom.get('exposureVal');
      if (exposureValEl) exposureValEl.textContent = v.toFixed(2);
    });
    // also update the label on change/end to be robust across browsers
    dom.on(exposureEl, 'change', ()=> {
      const v = Number(dom.getValue('exposure') || 1);
      const exposureValEl = dom.get('exposureVal');
      if (exposureValEl) exposureValEl.textContent = v.toFixed(2);
    });
  }

  if (toneMappingEl) {
    dom.on(toneMappingEl, 'change', ()=> {
      renderSettings.applyToneMapping(dom.getValue('toneMapping'));
    });
  }

  if (fxaaEl) {
    dom.on(fxaaEl, 'change', ()=> {
      renderSettings.enableFXAA(!!dom.isChecked('fxaa'));
    });
  }

  // Return unbind function to clean up event listeners
  return function unbind() {
    // Remove transform controls listeners
    dom.off(dom.get('toggleTransform'), 'change');
    dom.off(dom.get('transformMode'), 'change');
    dom.off(dom.get('toggleSnap'), 'change', applySnap);
    [dom.get('snapPos'), dom.get('snapRot'), dom.get('snapScale')].forEach(el => el && dom.off(el, 'change', applySnap));

    // Remove toggles listeners
    dom.off(dom.get('toggleShadows'), 'change');
    dom.off(dom.get('toggleFXAA'), 'change');
    dom.off(dom.get('toggleLightOnly'), 'change');
    dom.off(dom.get('toggleGrid'), 'change');

    // Remove background listeners
    const bgSelectEl = dom.get('bgSelect');
    const bgColorEl = dom.get('bgColor');
    if (bgSelectEl) dom.off(bgSelectEl, 'change', updateBackground);
    if (bgColorEl) dom.off(bgColorEl, 'input', updateBackground);

    // Remove material override listeners
    dom.off(dom.get('matOverride'), 'change');
    dom.off(dom.get('toggleWireframe'), 'change');

    // Remove animations UI listeners
    dom.off(dom.get('animSelect'), 'change');
    dom.off(dom.get('animPlayPause'), 'click');
    dom.off(dom.get('animStop'), 'click');
    dom.off(dom.get('animLoop'), 'change');
    dom.off(dom.get('animSpeed'), 'change');
    dom.off(dom.get('animProgress'), 'input');

    // Remove camera presets listeners
    const camPresetsEl = dom.get('camPresets');
    if (camPresetsEl) {
      const buttons = camPresetsEl.querySelectorAll('button');
      buttons.forEach(btn => {
        if (btn._camPresetHandler) {
          btn.removeEventListener('click', btn._camPresetHandler);
          delete btn._camPresetHandler;
        } else {
          // Fallback: replace node with clone to remove all listeners
          const clone = btn.cloneNode(true);
          btn.parentNode.replaceChild(clone, btn);
        }
      });
    }

    // Remove picking listener
    const canvasEl = dom.get('canvas');
    if (canvasEl) canvasEl.removeEventListener('mousedown', () => {});

    // Remove resize listener
    dom.offResize(onResize);

    // Remove lighting UI listeners
    dom.off(dom.get('dirIntensity'), 'input');
    dom.off(dom.get('dirAngle'), 'input');
    dom.off(dom.get('dirSoftness'), 'input');
    dom.off(envIntensityEl2, 'input');

    // Remove render settings UI listeners
    dom.off(dom.get('exposure'), 'input');
    dom.off(dom.get('exposure'), 'change');
    dom.off(dom.get('toneMapping'), 'change');
    dom.off(dom.get('fxaa'), 'change');

    // Remove apply textures button listener
    const applyTexturesBtn = dom.get('apply-textures');
    if (applyTexturesBtn) {
      applyTexturesBtn.removeEventListener('click', applyTexturesBtn._handler);
    }
  };
}