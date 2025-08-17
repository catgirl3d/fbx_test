import * as THREE from 'three';
import { EVENTS } from './EventSystem.js';
import Logger from './Logger.js';

export class UIBindings {
  constructor(stateManager, eventSystem, dom) {
    this.stateManager = stateManager;
    this.eventSystem = eventSystem;
    this.dom = dom;
    this.listeners = [];

    this.init();
  }

  init() {
    this.bindTransformControls();
    this.bindToggles();
    this.bindBackgroundSelection();
    this.bindMaterialOverride();
    this.bindAnimations();
    this.bindCameraPresets();
    this.bindPicking();
    this.bindLighting();
    this.bindRenderSettings();
    this.bindResetButtons();
    this.bindFlipUV();
  }

  bind(element, event, handler) {
    if (element) {
      element.addEventListener(event, handler);
      this.listeners.push({ element, event, handler });
    }
  }

  unbindAll() {
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];
  }

  bindTransformControls() {
    const applySnap = () => {
      const snapEnabled = this.dom?.isChecked('toggle-snap');
      this.eventSystem?.emit(EVENTS.SETTINGS_CHANGED, {
        transform: {
          snap: {
            enabled: snapEnabled,
            translation: snapEnabled ? Number(this.dom?.getValue('snap-pos')) : null,
            rotation: snapEnabled ? THREE.MathUtils.degToRad(Number(this.dom?.getValue('snap-rot'))) : null,
            scale: snapEnabled ? Number(this.dom?.getValue('snap-scale')) : null,
          }
        }
      });
    };

    this.bind(this.dom?.get('toggle-transform'), 'change', () => {
      this.eventSystem?.emit(EVENTS.SETTINGS_CHANGED, {
        transform: { enabled: this.dom?.isChecked('toggle-transform') }
      });
    });

    this.bind(this.dom?.get('transform-mode'), 'change', () => {
      this.eventSystem?.emit(EVENTS.SETTINGS_CHANGED, {
        transform: { mode: this.dom?.getValue('transform-mode') }
      });
    });

    this.bind(this.dom.get('toggle-snap'), 'change', applySnap);
    this.bind(this.dom.get('snap-pos'), 'change', applySnap);
    this.bind(this.dom.get('snap-rot'), 'change', applySnap);
    this.bind(this.dom.get('snap-scale'), 'change', applySnap);
  }

  bindToggles() {
    this.bind(this.dom?.get('toggle-shadows'), 'change', () => {
      this.eventSystem?.emit(EVENTS.RENDER_SETTINGS_CHANGED, { shadows: this.dom?.isChecked('toggle-shadows') });
    });
    this.bind(this.dom?.get('toggle-fxaa'), 'change', () => {
      this.eventSystem?.emit(EVENTS.RENDER_SETTINGS_CHANGED, { fxaa: this.dom?.isChecked('toggle-fxaa') });
    });
    this.bind(this.dom?.get('toggle-lightonly'), 'change', () => {
      this.eventSystem?.emit(EVENTS.RENDER_SETTINGS_CHANGED, { lightOnly: this.dom?.isChecked('toggle-lightonly') });
    });
    this.bind(this.dom?.get('toggle-grid'), 'change', () => {
      this.eventSystem?.emit(EVENTS.SETTINGS_CHANGED, { gridVisible: this.dom?.isChecked('toggle-grid') });
    });
    this.bind(this.dom?.get('debug-log-toggle'), 'change', () => {
      Logger.setEnabled(this.dom?.isChecked('debug-log-toggle'));
    });
  }

  bindBackgroundSelection() {
    const updateBackground = () => {
      const value = this.dom?.getValue('bg-select');
      const color = value === 'custom' ? this.dom?.getValue('bg-color') : value;
      this.eventSystem?.emit(EVENTS.SETTINGS_CHANGED, { background: color });
    };
    this.bind(this.dom?.get('bg-select'), 'change', updateBackground);
    this.bind(this.dom?.get('bg-color'), 'input', updateBackground);
  }

  bindMaterialOverride() {
    const updateMaterial = () => {
      this.eventSystem?.emit(EVENTS.RENDER_SETTINGS_CHANGED, {
        materialOverride: {
          type: this.dom?.getValue('mat-override'),
          wireframe: this.dom?.isChecked('toggle-wireframe'),
        }
      });
    };
    this.bind(this.dom?.get('mat-override'), 'change', updateMaterial);
    this.bind(this.dom?.get('toggle-wireframe'), 'change', updateMaterial);
  }

  bindAnimations() {
    this.bind(this.dom?.get('anim-select'), 'change', () => {
      this.eventSystem?.emit(EVENTS.ANIMATION_PLAY, { index: Number(this.dom?.getValue('anim-select')) });
    });
    this.bind(this.dom?.get('anim-playpause'), 'click', () => {
      const state = this.dom?.get('anim-playpause')?.dataset.state;
      this.eventSystem?.emit(state === 'playing' ? EVENTS.ANIMATION_PAUSE : EVENTS.ANIMATION_PLAY);
    });
    this.bind(this.dom?.get('anim-stop'), 'click', () => {
      this.eventSystem?.emit(EVENTS.ANIMATION_STOP);
    });
    this.bind(this.dom?.get('anim-loop'), 'change', () => {
      this.eventSystem?.emit(EVENTS.SETTINGS_CHANGED, { animation: { loop: this.dom?.isChecked('anim-loop') } });
    });
    this.bind(this.dom?.get('anim-speed'), 'change', () => {
      this.eventSystem?.emit(EVENTS.SETTINGS_CHANGED, { animation: { speed: Number(this.dom?.getValue('anim-speed')) } });
    });
    this.bind(this.dom?.get('anim-progress'), 'input', () => {
      const progress = parseFloat(this.dom?.getValue('anim-progress'));
      this.eventSystem?.emit(EVENTS.ANIMATION_TIME_UPDATE, { progress });
    });
  }

  bindCameraPresets() {
    const camPresetsEl = this.dom?.get('cam-presets');
    if (camPresetsEl) {
      const buttons = camPresetsEl.querySelectorAll('button');
      buttons.forEach(btn => {
        this.bind(btn, 'click', () => this.eventSystem?.emit(EVENTS.CAMERA_PRESET, { view: btn.dataset.view }));
      });
    }
  }

  bindPicking() {
    const canvas = this.dom?.get('canvas');
    if (!canvas) return;

    let isDragging = false;
    const startPos = new THREE.Vector2();
    const dragThreshold = 5;

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      isDragging = false;
      startPos.set(e.clientX, e.clientY);

      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (startPos.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) > dragThreshold) {
        isDragging = true;
      }
    };

    const onMouseUp = (e) => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);

      if (!isDragging) {
        const rect = canvas.getBoundingClientRect();
        const ndc = {
          x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
          y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
        };
        this.eventSystem?.emit(EVENTS.OBJECT_SELECTED, { ndc });
      }
    };

    this.bind(canvas, 'mousedown', onMouseDown);
  }

  bindLighting() {
    this.bind(this.dom?.get('dir-intensity'), 'input', () => {
      this.eventSystem?.emit(EVENTS.LIGHTING_SETTINGS_CHANGED, { directional: { intensity: Number(this.dom?.getValue('dir-intensity')) } });
    });
    this.bind(this.dom?.get('dir-angle'), 'input', () => {
      this.eventSystem?.emit(EVENTS.LIGHTING_SETTINGS_CHANGED, { directional: { angle: Number(this.dom?.getValue('dir-angle')) } });
    });
    this.bind(this.dom?.get('dir-softness'), 'input', () => {
      this.eventSystem?.emit(EVENTS.LIGHTING_SETTINGS_CHANGED, { directional: { softness: Number(this.dom?.getValue('dir-softness')) } });
    });
    this.bind(this.dom?.get('env-intensity'), 'input', () => {
      this.eventSystem?.emit(EVENTS.LIGHTING_SETTINGS_CHANGED, { environment: { intensity: Number(this.dom?.getValue('env-intensity')) } });
    });
  }

  bindRenderSettings() {
    this.bind(this.dom?.get('exposure'), 'input', () => {
      this.eventSystem?.emit(EVENTS.RENDER_SETTINGS_CHANGED, { exposure: Number(this.dom?.getValue('exposure')) });
    });
    this.bind(this.dom?.get('tone-mapping'), 'change', () => {
      this.eventSystem?.emit(EVENTS.RENDER_SETTINGS_CHANGED, { toneMapping: this.dom?.getValue('tone-mapping') });
    });
  }

  bindResetButtons() {
    this.bind(this.dom?.get('reset-render'), 'click', () => this.eventSystem?.emit(EVENTS.UI_RESET_RENDER));
    this.bind(this.dom?.get('reset-dir'), 'click', () => this.eventSystem?.emit(EVENTS.UI_RESET_DIR));
    this.bind(this.dom?.get('reset-env'), 'click', () => this.eventSystem?.emit(EVENTS.UI_RESET_ENV));
    this.bind(this.dom?.get('reset-gizmos'), 'click', () => this.eventSystem?.emit(EVENTS.UI_RESET_GIZMOS));
    this.bind(this.dom?.get('reset-all'), 'click', () => this.eventSystem?.emit(EVENTS.UI_RESET_ALL));
  }

  bindFlipUV() {
    this.bind(this.dom?.get('toggle-flipuv'), 'change', () => {
      this.eventSystem?.emit(EVENTS.SETTINGS_CHANGED, { flipUV: this.dom?.isChecked('toggle-flipuv') });
    });
  }

  dispose() {
    this.unbindAll();
  }
}