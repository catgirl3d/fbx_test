import Logger from './Logger.js';
export const EVENTS = {
  // Scene events
  MODEL_LOADED: 'model-loaded',
  MODEL_REMOVED: 'model-removed',
  OBJECT_SELECTED: 'object-selected',
  OBJECT_DESELECTED: 'object-deselected',
  SCENE_CLEARED: 'scene-cleared',
  
  // Texture events
  TEXTURES_LOADED: 'textures-loaded',
  TEXTURE_APPLIED: 'texture-applied',
  ZIP_TEXTURES_CLEARED: 'zip-textures-cleared',
  
  // Animation events
  ANIMATION_PLAY: 'animation-play',
  ANIMATION_PAUSE: 'animation-pause',
  ANIMATION_STOP: 'animation-stop',
  ANIMATION_TIME_UPDATE: 'animation-time-update',
  ANIMATION_CLIPS_CHANGED: 'animation-clips-changed',
  
  // UI events
  INSPECTOR_OPEN: 'inspector-open',
  INSPECTOR_CLOSE: 'inspector-close',
  TOAST_SHOW: 'toast-show',
  UI_RESET_RENDER: 'ui-reset-render',
  UI_RESET_DIR: 'ui-reset-dir',
  UI_RESET_ENV: 'ui-reset-env',
  UI_RESET_GIZMOS: 'ui-reset-gizmos',
  UI_RESET_ALL: 'ui-reset-all',
  
  // Input events
  KEY_PRESS: 'key-press',
  KEY_RELEASE: 'key-release',
  MOUSE_DOWN: 'mouse-down',
  MOUSE_UP: 'mouse-up',
  MOUSE_MOVE: 'mouse-move',
  CONTEXT_MENU: 'context-menu',
  
  // Camera events
  CAMERA_FRAME: 'camera-frame',
  CAMERA_RESET: 'camera-reset',
  CAMERA_PRESET: 'camera-preset',
  
  // Settings events
  SETTINGS_CHANGED: 'settings-changed',
  RENDER_SETTINGS_CHANGED: 'render-settings-changed',
  LIGHTING_SETTINGS_CHANGED: 'lighting-settings-changed',
  
  // Error events
  ERROR_OCCURRED: 'error-occurred',
  ASSET_LOAD_ERROR: 'asset-load-error'
};

export class EventSystem {
  #channels = new Map();
  #onceCallbacks = new Map();

  constructor() {
    // Initialize default channels
    Object.values(EVENTS).forEach(event => {
      this.#channels.set(event, new Set());
    });
  }

  // Subscribe to an event channel
  on(eventType, callback) {
    if (!this.#channels.has(eventType)) {
      this.#channels.set(eventType, new Set());
    }
    this.#channels.get(eventType).add(callback);
    return () => this.off(eventType, callback); // Return unsubscribe function
  }

  // Subscribe to an event only once
  once(eventType, callback) {
    if (!this.#onceCallbacks.has(eventType)) {
      this.#onceCallbacks.set(eventType, new Set());
    }
    this.#onceCallbacks.get(eventType).add(callback);
    return () => this.off(eventType, callback);
  }

  // Unsubscribe from an event channel
  off(eventType, callback) {
    if (this.#channels.has(eventType)) {
      this.#channels.get(eventType).delete(callback);
    }
    if (this.#onceCallbacks.has(eventType)) {
      this.#onceCallbacks.get(eventType).delete(callback);
    }
  }

  // Emit an event to all subscribers
  emit(eventType, data) {
    // Regular callbacks
    if (this.#channels.has(eventType)) {
      this.#channels.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          Logger.error(`Error in event callback for ${eventType}:`, error);
        }
      });
    }

    // One-time callbacks
    if (this.#onceCallbacks.has(eventType)) {
      const callbacks = this.#onceCallbacks.get(eventType);
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          Logger.error(`Error in one-time event callback for ${eventType}:`, error);
        }
      });
      // Clear one-time callbacks after execution
      this.#onceCallbacks.delete(eventType);
    }
  }

  // Emit an event only if there are subscribers
  emitIfSubscribed(eventType, data) {
    if (this.#channels.has(eventType) && this.#channels.get(eventType).size > 0) {
      this.emit(eventType, data);
    }
  }

  // Check if there are subscribers for an event
  hasSubscribers(eventType) {
    return this.#channels.has(eventType) && this.#channels.get(eventType).size > 0;
  }

  // Get the number of subscribers for an event
  getSubscriberCount(eventType) {
    return this.#channels.has(eventType) ? this.#channels.get(eventType).size : 0;
  }

  // Remove all subscribers for an event
  clear(eventType) {
    if (this.#channels.has(eventType)) {
      this.#channels.get(eventType).clear();
    }
    if (this.#onceCallbacks.has(eventType)) {
      this.#onceCallbacks.get(eventType).clear();
    }
  }

  // Remove all subscribers from all events
  clearAll() {
    this.#channels.forEach(channel => channel.clear());
    this.#onceCallbacks.forEach(callbacks => callbacks.clear());
  }

  // Create a promise that resolves when an event is emitted
  waitFor(eventType, timeout = 5000) {
    return new Promise((resolve, reject) => {
      let timeoutId;
      
      const handler = (data) => {
        this.off(eventType, handler);
        if (timeoutId) clearTimeout(timeoutId);
        resolve(data);
      };

      this.on(eventType, handler);

      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          this.off(eventType, handler);
          reject(new Error(`Event ${eventType} not emitted within ${timeout}ms`));
        }, timeout);
      }
    });
  }

  // Batch emit multiple events
  emitBatch(events) {
    events.forEach(({ type, data }) => {
      this.emit(type, data);
    });
  }
}

// Create a singleton instance for the application
export const eventSystem = new EventSystem();