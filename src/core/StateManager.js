import * as THREE from 'three';

export class StateManager {
  #state = {
    scene: {
      models: [],
      selectedObject: null,
      textures: new Map(),
      environment: null,
      boundingBox: null
    },
    input: {
      pressedKeys: new Set(),
      mouseState: {
        isLeftMouseDown: false,
        isRightMouseDown: false,
        lastMousePosition: { x: 0, y: 0 },
        rightClickStartPosition: { x: 0, y: 0 }
      }
    },
    animation: {
      clips: [],
      activeAction: null,
      currentTime: 0,
      duration: 0
    },
    ui: {
      isInspectorOpen: false,
      animSectionVisible: false,
      filename: ''
    },
    app: {
      zipTextures: new Map(),
      currentZipFile: null,
      originalUVs: new Map(),
      clock: null
    }
  };

  #listeners = new Map();

  constructor() {
    this.#state.app.clock = new THREE.Clock();
  }

  // State access methods
  getSceneState() {
    return this.#state.scene;
  }

  getInputState() {
    return this.#state.input;
  }

  getAnimationState() {
    return this.#state.animation;
  }

  getUIState() {
    return this.#state.ui;
  }

  getAppState() {
    return this.#state.app;
  }

  // State update methods
  updateSceneState(patch) {
    this.#state.scene = { ...this.#state.scene, ...patch };
    this.#notifyListeners('scene', this.#state.scene);
  }

  updateInputState(patch) {
    this.#state.input = { ...this.#state.input, ...patch };
    this.#notifyListeners('input', this.#state.input);
  }

  updateAnimationState(patch) {
    this.#state.animation = { ...this.#state.animation, ...patch };
    this.#notifyListeners('animation', this.#state.animation);
  }

  updateUIState(patch) {
    this.#state.ui = { ...this.#state.ui, ...patch };
    this.#notifyListeners('ui', this.#state.ui);
  }

  updateAppState(patch) {
    this.#state.app = { ...this.#state.app, ...patch };
    this.#notifyListeners('app', this.#state.app);
  }

  // Specific state setters for convenience
  addModel(model) {
    this.#state.scene.models.push(model);
    this.#notifyListeners('scene', this.#state.scene);
  }

  removeModel(model) {
    const index = this.#state.scene.models.indexOf(model);
    if (index > -1) {
      this.#state.scene.models.splice(index, 1);
      this.#notifyListeners('scene', this.#state.scene);
      // Clear original UVs when a model is removed
      this.#state.app.originalUVs.clear();
    }
  }

  setSelectedObject(object) {
    this.#state.scene.selectedObject = object;
    this.#notifyListeners('scene', this.#state.scene);
  }

  addPressedKey(key) {
    this.#state.input.pressedKeys.add(key);
    this.#notifyListeners('input', this.#state.input);
  }

  removePressedKey(key) {
    this.#state.input.pressedKeys.delete(key);
    this.#notifyListeners('input', this.#state.input);
  }

  setMouseState(mouseState) {
    this.#state.input.mouseState = { ...this.#state.input.mouseState, ...mouseState };
    this.#notifyListeners('input', this.#state.input);
  }

  // Event subscription
  subscribe(eventType, callback) {
    if (!this.#listeners.has(eventType)) {
      this.#listeners.set(eventType, new Set());
    }
    this.#listeners.get(eventType).add(callback);
  }

  unsubscribe(eventType, callback) {
    if (this.#listeners.has(eventType)) {
      this.#listeners.get(eventType).delete(callback);
    }
  }

  #notifyListeners(eventType, data) {
    if (this.#listeners.has(eventType)) {
      this.#listeners.get(eventType).forEach(callback => callback(data));
    }
  }

  // Utility methods
  getState() {
    return this.#state;
  }

  reset() {
    this.#state = {
      scene: {
        models: [],
        selectedObject: null,
        textures: new Map(),
        environment: null,
        boundingBox: null
      },
      input: {
        pressedKeys: new Set(),
        mouseState: {
          isLeftMouseDown: false,
          isRightMouseDown: false,
          lastMousePosition: { x: 0, y: 0 },
          rightClickStartPosition: { x: 0, y: 0 }
        }
      },
      animation: {
        clips: [],
        activeAction: null,
        currentTime: 0,
        duration: 0
      },
      ui: {
        isInspectorOpen: false,
        animSectionVisible: false,
        filename: ''
      },
      app: {
        zipTextures: new Map(),
        currentZipFile: null,
        originalUVs: new Map(),
        clock: new THREE.Clock()
      }
    };
  }
}