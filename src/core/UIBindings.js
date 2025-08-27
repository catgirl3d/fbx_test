import * as THREE from 'three';
import { EVENTS } from './EventSystem.js';
import Logger from './Logger.js';

export class UIBindings {
  constructor(stateManager, eventSystem, dom) {
    Logger.log('[UIBindings] UIBindings constructor called');
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
    this.bindInspectorButtons();
    this.bindPolygonSelection();
  }

  bind(element, event, handler) {
    if (element) {
      element.addEventListener(event, handler);
      this.listeners.push({ element, event, handler });
    }
  }

  unbind(element, event, handler) {
    if (element) {
      element.removeEventListener(event, handler);
      this.listeners = this.listeners.filter(
        (listener) => !(listener.element === element && listener.event === event && listener.handler === handler)
      );
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
    this.bind(this.dom?.get('toggle-load-default'), 'change', () => {
      this.eventSystem?.emit(EVENTS.SETTINGS_CHANGED, { loadDefaultModel: this.dom?.isChecked('toggle-load-default') });
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
      if (state === 'playing') {
        this.eventSystem?.emit(EVENTS.ANIMATION_PAUSE);
      } else {
        const index = Number(this.dom?.getValue('anim-select'));
        this.eventSystem?.emit(EVENTS.ANIMATION_PLAY, { index });
      }
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

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      isDragging = false;
      startPos.set(e.clientX, e.clientY);

      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mouseup', onMouseUp);
    };

    // Store the handler to be able to bind/unbind it dynamically
    this.onMouseDownHandler = onMouseDown;
  }

  bindLighting() {
    this.bind(this.dom?.get('dir-intensity'), 'input', () => {
      const value = Number(this.dom?.getValue('dir-intensity'));
      this.eventSystem?.emit(EVENTS.LIGHTING_SETTINGS_CHANGED, { directional: { intensity: value } });
      this.dom?.get('dir-intensity-val') && (this.dom.get('dir-intensity-val').textContent = value.toFixed(1));
    });
    this.bind(this.dom?.get('dir-angle'), 'input', () => {
      const value = Number(this.dom?.getValue('dir-angle'));
      this.eventSystem?.emit(EVENTS.LIGHTING_SETTINGS_CHANGED, { directional: { angle: value } });
      this.dom?.get('dir-angle-val') && (this.dom.get('dir-angle-val').textContent = value.toFixed(0));
    });
    this.bind(this.dom?.get('dir-softness'), 'input', () => {
      const value = Number(this.dom?.getValue('dir-softness'));
      this.eventSystem?.emit(EVENTS.LIGHTING_SETTINGS_CHANGED, { directional: { softness: value } });
      this.dom?.get('dir-softness-val') && (this.dom.get('dir-softness-val').textContent = value.toFixed(2));
    });
    this.bind(this.dom?.get('env-intensity'), 'input', () => {
      const value = Number(this.dom?.getValue('env-intensity'));
      this.eventSystem?.emit(EVENTS.LIGHTING_SETTINGS_CHANGED, { environment: { intensity: value } });
      this.dom?.get('env-intensity-val') && (this.dom.get('env-intensity-val').textContent = value.toFixed(2));
    });
  }

  bindRenderSettings() {
    this.bind(this.dom?.get('exposure'), 'input', () => {
      const value = Number(this.dom?.getValue('exposure'));
      this.eventSystem?.emit(EVENTS.RENDER_SETTINGS_CHANGED, { exposure: value });
      this.dom?.get('exposure-val') && (this.dom.get('exposure-val').textContent = value.toFixed(2));
    });
    this.bind(this.dom?.get('tone-mapping'), 'change', () => {
      const value = this.dom?.getValue('tone-mapping');
      this.eventSystem?.emit(EVENTS.RENDER_SETTINGS_CHANGED, { toneMapping: value });
      this.dom?.get('tone-mapping-val') && (this.dom.get('tone-mapping-val').textContent = value);
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

  bindPolygonSelection() {
    const canvas = this.dom?.get('canvas');
    if (!canvas) return;
 
    // Use explicit ID selectors to avoid cache/lookup timing issues
    const polygonSelectionModeCheckbox = this.dom?.get('polygon-selection-mode');
    const polygonSelectionModeSelect = this.dom?.get('polygon-select-mode'); // new select
    const clearPolygonSelectionButton = this.dom?.get('#clear-polygon-selection');
 
    const onCanvasClick = (e) => {
      if (!polygonSelectionModeCheckbox?.checked) return;

      // If user selected 'click' mode, treat canvas clicks as polygon face selection
      const mode = polygonSelectionModeSelect ? (polygonSelectionModeSelect.value || 'click') : 'click';
      if (mode !== 'click') return; // ignore clicks in lasso mode (handled by PolygonSelectionManager)

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.eventSystem?.emit(EVENTS.POLYGON_SELECTED, { x, y, ctrlKey: e.ctrlKey || e.metaKey });
      Logger.log(`[UIBindings] Canvas click rect: ${JSON.stringify(rect)}, x: ${x}, y: ${y}`);
    };
 
    // Dynamically bind/unbind onCanvasClick based on the selected polygon mode
    const updateCanvasClickHandler = () => {
      const currentPolygonSelectMode = polygonSelectionModeSelect ? (polygonSelectionModeSelect.value || 'click') : 'click';
      if (polygonSelectionModeCheckbox?.checked && currentPolygonSelectMode === 'click') {
        this.bind(canvas, 'click', onCanvasClick);
        Logger.log('[UIBindings] onCanvasClick bound for "Click select" mode.');
      } else {
        this.unbind(canvas, 'click', onCanvasClick);
        Logger.log('[UIBindings] onCanvasClick unbound (not in "Click select" mode).');
      }
    };
 
    this.bind(clearPolygonSelectionButton, 'click', () => {
      this.eventSystem?.emit(EVENTS.POLYGON_SELECTION_CLEARED);
    });
 
    // When checkbox toggled, switch overall selection mode (object vs polygon)
    this.bind(polygonSelectionModeCheckbox, 'change', () => {
      const isPolygonMode = polygonSelectionModeCheckbox?.checked;
      this.eventSystem?.emit(EVENTS.SELECTION_MODE_CHANGED, {
        mode: isPolygonMode ? 'polygon' : 'object'
      });

      // Mutually exclusive listeners: bind one, unbind the other
      if (isPolygonMode) {
        this.unbind(canvas, 'mousedown', this.onMouseDownHandler);
        Logger.log('[UIBindings] Object picking (mousedown) unbound.');
      } else {
        this.bind(canvas, 'mousedown', this.onMouseDownHandler);
        Logger.log('[UIBindings] Object picking (mousedown) bound.');
      }

      updateCanvasClickHandler(); // Update click handler state immediately
    });
 
    // When the explicit polygon-select-mode changes, emit an event and update click handler
    if (polygonSelectionModeSelect) {
      this.bind(polygonSelectionModeSelect, 'change', () => {
        const value = polygonSelectionModeSelect.value || 'click';
        Logger.log('[UIBindings] polygon-select-mode changed to', value);
        this.eventSystem?.emit(EVENTS.SETTINGS_CHANGED, { polygonSelectMode: value });
        updateCanvasClickHandler(); // Update click handler state immediately
      });
    }
 
    // Initial setup: bind object picking by default, polygon click handler is managed by its own logic
    if (!polygonSelectionModeCheckbox?.checked) {
      this.bind(canvas, 'mousedown', this.onMouseDownHandler);
      Logger.log('[UIBindings] Initial bind of object picking (mousedown).');
    }
    updateCanvasClickHandler();
  }

  bindInspectorButtons() {
    const toggleInspectorBtn = this.dom?.get('open-inspector');
    this.bind(toggleInspectorBtn, 'click', () => {
      const currentState = toggleInspectorBtn?.getAttribute('data-state') === 'open';
      this.eventSystem?.emit(currentState ? EVENTS.INSPECTOR_CLOSE : EVENTS.INSPECTOR_OPEN);
    });

    // Keep the existing "Hide" button inside the inspector (optional secondary control)
    const closeInspectorBtn = this.dom?.get('inspector-close');
    this.bind(closeInspectorBtn, 'click', () => {
      this.eventSystem?.emit(EVENTS.INSPECTOR_CLOSE);
    });
  }

  dispose() {
    this.unbindAll();
  }
}