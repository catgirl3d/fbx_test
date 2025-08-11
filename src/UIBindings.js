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
    getCurrentModel, camera, controls, inspectorApi, setInspectorOpen, updateAnimTimeUI, setAnimSectionVisible
  } = opts;

  // helper to obtain the live current model (supports older callers that passed `currentModel` directly on opts)
  function _getCurrentModel() {
    if (typeof getCurrentModel === 'function') return getCurrentModel();
    return opts.currentModel || null;
  }

  // Transform controls
  function applySnap() {
    if (!dom.toggleSnap) return;
    if (dom.toggleSnap.checked) {
      tControls.setTranslationSnap(Number(dom.snapPos.value) || 0);
      tControls.setRotationSnap(THREE.MathUtils.degToRad(Number(dom.snapRot.value) || 0));
      tControls.setScaleSnap(Number(dom.snapScale.value) || 0);
    } else {
      tControls.setTranslationSnap(null);
      tControls.setRotationSnap(null);
      tControls.setScaleSnap(null);
    }
  }

  dom.toggleTransform?.addEventListener('change', () => {
    const on = dom.toggleTransform.checked;
    tControls.enable(on);
    const cm = _getCurrentModel();
    if (on && cm) tControls.attach(cm);
    else tControls.detach();
  });

  dom.transformMode?.addEventListener('change', () => tControls.setMode(dom.transformMode.value));
  dom.toggleSnap?.addEventListener('change', applySnap);
  [dom.snapPos, dom.snapRot, dom.snapScale].forEach(el => el?.addEventListener('change', applySnap));

  // Toggles
  dom.toggleShadows?.addEventListener('change', () => {
    const on = dom.toggleShadows.checked;
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

  dom.toggleFXAA?.addEventListener('change', () => { rendererMgr.enableFXAA(dom.toggleFXAA.checked); });
  dom.toggleLightOnly?.addEventListener('change', () => { setLightOnly(_getCurrentModel(), dom.toggleLightOnly.checked); });
  dom.toggleGrid?.addEventListener('change', () => { sceneMgr.setGridVisible(!!dom.toggleGrid.checked); });

  // Background selection
  function updateBackground() {
    const bgSelectValue = dom.bgSelect?.value;
    if (bgSelectValue === 'custom') {
      sceneMgr.setBackground(dom.bgColor?.value || '#ffffff');
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

  dom.bgSelect?.addEventListener('change', updateBackground);
  dom.bgColor?.addEventListener('input', updateBackground);

  // Material override
  dom.matOverride?.addEventListener('change', () => {
    applyMaterialOverride(_getCurrentModel(), {
      overrideType: dom.matOverride.value,
      wire: !!dom.toggleWireframe?.checked,
      envIntensity: Number(dom.envIntensity?.value || 1)
    });
  });

  dom.toggleWireframe?.addEventListener('change', () => {
    applyMaterialOverride(_getCurrentModel(), {
      overrideType: dom.matOverride?.value || 'none',
      wire: !!dom.toggleWireframe?.checked,
      envIntensity: Number(dom.envIntensity?.value || 1)
    });
  });

  // Animations UI
  dom.animSelect?.addEventListener('change', () => {
    if (!animMgr.hasClips()) return;
    animMgr.select(Number(dom.animSelect.value));
    updateAnimTimeUI(0, animMgr.getCurrentDuration());
  });

  dom.animPlayPause?.addEventListener('click', () => {
    if (!animMgr.hasClips()) return;
    if (dom.animPlayPause.dataset.state !== 'playing') {
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
      dom.animPlayPause.dataset.state = 'playing';
      dom.animPlayPause.textContent = (dom.lang?.value === 'ru') ? 'Пауза' : 'Pause';
    } else {
      animMgr.pause();
      dom.animPlayPause.dataset.state = 'paused';
      dom.animPlayPause.textContent = (dom.lang?.value === 'ru') ? 'Пуск' : 'Play';
    }
  });

  dom.animStop?.addEventListener('click', () => {
    animMgr.stop();
    dom.animPlayPause.dataset.state = 'stopped';
    dom.animPlayPause.textContent = (dom.lang?.value === 'ru') ? 'Пуск' : 'Play';
    updateAnimTimeUI(0, animMgr.getCurrentDuration());
  });

  dom.animLoop?.addEventListener('change', () => { animMgr.setLoop(dom.animLoop.checked); });
  dom.animSpeed?.addEventListener('change', () => { animMgr.setSpeed(Number(dom.animSpeed.value || 1)); });

  dom.animProgress?.addEventListener('input', () => {
    if (!animMgr.hasClips()) return;
    const dur = animMgr.getCurrentDuration();
    const t = parseFloat(dom.animProgress.value) * dur;
    // set active action time directly if available
    if (animMgr.activeAction) {
      animMgr.activeAction.time = t;
      animMgr.update(0);
      updateAnimTimeUI(t, dur);
    }
  });

  // Camera presets
  function camPreset(view) {
    const root = _getCurrentModel() || sceneMgr.getScene();
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

  if (dom.camPresets) {
    dom.camPresets.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => camPreset(btn.dataset.view));
    });
  }

  // Picking
  dom.canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const rect = dom.canvas.getBoundingClientRect();
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

  // Lighting UI inputs
  if (dom.dirIntensity) dom.dirIntensity.addEventListener('input', () => {
    const v = Number(dom.dirIntensity.value || 0);
    lighting.setDirIntensity(v);
    if (dom.dirIntensityVal) dom.dirIntensityVal.textContent = v.toFixed(2);
  });

  if (dom.dirAngle) dom.dirAngle.addEventListener('input', () => {
    const v = Number(dom.dirAngle.value || 0);
    lighting.setDirFromAngle(v);
    if (dom.dirAngleVal) dom.dirAngleVal.textContent = `${Math.round(v)}°`;
  });

  if (dom.dirSoftness) dom.dirSoftness.addEventListener('input', () => {
    const v = Number(dom.dirSoftness.value || 0);
    lighting.setDirSoftness(v);
    if (dom.dirSoftnessVal) dom.dirSoftnessVal.textContent = v.toFixed(1);
  });

  if (dom.envIntensity) dom.envIntensity.addEventListener('input', () => {
    const v = Number(dom.envIntensity.value || 1);
    sceneMgr.applyEnvIntensity(v, _getCurrentModel() || sceneMgr.getScene());
    if (dom.envIntensityVal) dom.envIntensityVal.textContent = v.toFixed(2);
  });

  // Render settings UI
  if (dom.exposure) {
    dom.exposure.addEventListener('input', ()=> {
      const v = Number(dom.exposure.value || 1);
      renderSettings.applyExposure(v);
      if (dom.exposureVal) dom.exposureVal.textContent = v.toFixed(2);
    });
    // also update the label on change/end to be robust across browsers
    dom.exposure.addEventListener('change', ()=> {
      const v = Number(dom.exposure.value || 1);
      if (dom.exposureVal) dom.exposureVal.textContent = v.toFixed(2);
    });
  }

  if (dom.toneMapping) dom.toneMapping.addEventListener('change', ()=> {
    renderSettings.applyToneMapping(dom.toneMapping.value);
  });

  if (dom.fxaa) dom.fxaa.addEventListener('change', ()=> {
    renderSettings.enableFXAA(!!dom.fxaa.checked);
  });

  // Return unbind function to clean up event listeners
  return function unbind() {
    // Remove transform controls listeners
    dom.toggleTransform?.removeEventListener('change', () => {});
    dom.transformMode?.removeEventListener('change', () => {});
    dom.toggleSnap?.removeEventListener('change', applySnap);
    [dom.snapPos, dom.snapRot, dom.snapScale].forEach(el => el?.removeEventListener('change', applySnap));

    // Remove toggles listeners
    dom.toggleShadows?.removeEventListener('change', () => {});
    dom.toggleFXAA?.removeEventListener('change', () => {});
    dom.toggleLightOnly?.removeEventListener('change', () => {});
    dom.toggleGrid?.removeEventListener('change', () => {});

    // Remove background listeners
    dom.bgSelect?.removeEventListener('change', updateBackground);
    dom.bgColor?.removeEventListener('input', updateBackground);

    // Remove material override listeners
    dom.matOverride?.removeEventListener('change', () => {});
    dom.toggleWireframe?.removeEventListener('change', () => {});

    // Remove animations UI listeners
    dom.animSelect?.removeEventListener('change', () => {});
    dom.animPlayPause?.removeEventListener('click', () => {});
    dom.animStop?.removeEventListener('click', () => {});
    dom.animLoop?.removeEventListener('change', () => {});
    dom.animSpeed?.removeEventListener('change', () => {});
    dom.animProgress?.removeEventListener('input', () => {});

    // Remove camera presets listeners
    if (dom.camPresets) {
      dom.camPresets.querySelectorAll('button').forEach(btn => {
        btn.removeEventListener('click', () => {});
      });
    }

    // Remove picking listener
    dom.canvas.removeEventListener('mousedown', () => {});

    // Remove resize listener
    window.removeEventListener('resize', onResize);

    // Remove lighting UI listeners
    if (dom.dirIntensity) dom.dirIntensity.removeEventListener('input', () => {});
    if (dom.dirAngle) dom.dirAngle.removeEventListener('input', () => {});
    if (dom.dirSoftness) dom.dirSoftness.removeEventListener('input', () => {});
    if (dom.envIntensity) dom.envIntensity.removeEventListener('input', () => {});

    // Remove render settings UI listeners
    if (dom.exposure) {
      dom.exposure.removeEventListener('input', () => {});
      dom.exposure.removeEventListener('change', () => {});
    }
    if (dom.toneMapping) dom.toneMapping.removeEventListener('change', () => {});
    if (dom.fxaa) dom.fxaa.removeEventListener('change', () => {});
  };
}