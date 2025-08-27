import * as THREE from 'three';
import { EVENTS } from './EventSystem.js';
import Logger from './Logger.js';

/**
 * ============================================================================
 * CENTRALIZED KEYBOARD EVENT MANAGER - DEVELOPER GUIDE
 * ============================================================================
 *
 * This class provides a centralized system for managing keyboard shortcuts
 * and hotkeys throughout the application.
 *
 * KEY FEATURES:
 * - Automatic input field detection (prevents hotkeys when typing)
 * - Centralized registration of all keyboard handlers
 * - Proper cleanup and memory management
 * - Support for multiple handlers per key
 *
 * BASIC USAGE:
 *
 * 1. Get access to the keyboard manager:
 *    const keyboardManager = app.inputHandler.keyboardManager;
 *
 * 2. Register a hotkey handler:
 *    keyboardManager.registerKeyHandler('KeyF', (event) => {
 *      // Your hotkey logic here
 *      console.log('F key pressed!');
 *    });
 *
 * 3. Keys can be registered by:
 *    - event.code (recommended): 'KeyF', 'Digit1', 'ArrowUp', 'Escape'
 *    - event.key: 'f', '1', 'F' (case-sensitive)
 *
 * COMMON KEY CODES:
 * - Letters: KeyA, KeyB, KeyC, ... KeyZ
 * - Numbers: Digit0, Digit1, Digit2, ... Digit9
 * - Arrows: ArrowUp, ArrowDown, ArrowLeft, ArrowRight
 * - Special: Escape, Enter, Space, Tab, Backspace, Delete
 * - Modifiers: ShiftLeft, ShiftRight, CtrlLeft, CtrlRight, AltLeft, AltRight
 *
 * HANDLER FUNCTION SIGNATURE:
 * function(event, options) {
 *   // event: KeyboardEvent object
 *   // options: Object passed during registration
 * }
 *
 * ADVANCED USAGE:
 *
 * Register with options:
 * keyboardManager.registerKeyHandler('KeyF', (event, options) => {
 *   if (options.ctrlKey && event.ctrlKey) {
 *     // Ctrl+F pressed
 *   }
 * }, { ctrlKey: true });
 *
 * Unregister a handler:
 * keyboardManager.unregisterKeyHandler('KeyF', handlerFunction);
 *
 * Check registered keys:
 * const keys = keyboardManager.getRegisteredKeys();
 *
 * ============================================================================
 * INPUT FIELD DETECTION
 * ============================================================================
 *
 * The system automatically detects and suppresses hotkeys when user is typing
 * in input fields. Supported input types:
 * - <input> elements (except buttons, checkboxes, radio, submit, reset)
 * - <textarea> elements
 * - <select> elements
 * - Elements with contentEditable="true"
 * - Elements with contenteditable attribute
 * - Elements inside contenteditable containers
 *
 * ============================================================================
 * BEST PRACTICES
 * ============================================================================
 *
 * 1. Use event.code instead of event.key for better cross-platform compatibility
 * 2. Always check event modifiers if your hotkey uses them
 * 3. Handle preventDefault() if you need to prevent default browser behavior
 * 4. Use descriptive handler names for debugging
 * 5. Register hotkeys in component initialization, unregister on cleanup
 * 6. Test hotkeys work correctly and don't conflict with input fields
 *
 * ============================================================================
 * EXAMPLES
 * ============================================================================
 *
 * // Simple hotkey
 * keyboardManager.registerKeyHandler('KeyF', (event) => {
 *   event.preventDefault();
 *   this.frameSelectedObject();
 * });
 *
 * // Hotkey with modifier
 * keyboardManager.registerKeyHandler('KeyS', (event) => {
 *   if (event.ctrlKey) {
 *     event.preventDefault();
 *     this.saveProject();
 *   }
 * });
 *
 * // Multiple handlers for same key (called in registration order)
 * keyboardManager.registerKeyHandler('Escape', () => this.closeDialog());
 * keyboardManager.registerKeyHandler('Escape', () => this.clearSelection());
 *
 * ============================================================================
 * DEBUGGING
 * ============================================================================
 *
 * The system provides detailed logging for:
 * - Handler registration/unregistration
 * - Input field detection
 * - Event processing
 *
 * Check browser console for logs with '[KeyboardManager]' prefix
 *
 * ============================================================================
 */

class KeyboardEventManager {
  constructor(eventSystem) {
    this.eventSystem = eventSystem;
    this.listeners = new Map();
    this.isBound = false;
  }

  /**
   * Register a keyboard event handler
   * @param {string} key - The key to listen for (e.g., 'Escape', 'KeyF', 'F')
   * @param {function} handler - The handler function
   * @param {object} options - Options for the handler
   */
  registerKeyHandler(key, handler, options = {}) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push({ handler, options });
    Logger.log(`[KeyboardManager] Registered handler for key: ${key}`);
  }

  /**
   * Unregister a keyboard event handler
   * @param {string} key - The key to stop listening for
   * @param {function} handler - The handler function to remove
   */
  unregisterKeyHandler(key, handler) {
    if (this.listeners.has(key)) {
      const handlers = this.listeners.get(key);
      const index = handlers.findIndex(h => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
        Logger.log(`[KeyboardManager] Unregistered handler for key: ${key}`);
      }
    }
  }

  /**
   * Process a keyboard event
   * @param {KeyboardEvent} event - The keyboard event
   * @param {boolean} isInputField - Whether the event originated from an input field
   */
  processKeyEvent(event, isInputField) {
    if (isInputField) {
      Logger.log(`[KeyboardManager] Skipping key processing for ${event.code} (input field)`);
      return;
    }

    const handlers = this.listeners.get(event.code) || this.listeners.get(event.key) || [];
    handlers.forEach(({ handler, options }) => {
      try {
        handler(event, options);
      } catch (error) {
        Logger.error(`[KeyboardManager] Error in key handler for ${event.code}:`, error);
      }
    });
  }

  /**
   * Bind all keyboard event listeners
   */
  bindEvents() {
    if (this.isBound) return;

    this.globalKeyDownHandler = (e) => {
      // Check if the event target is an input field that should accept text input
      const target = e.target || document.activeElement;
      const isInputField = target && (
        (target.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(target.type)) ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable="true"]') ||
        target.isContentEditable
      );

      if (isInputField) {
        Logger.log(`[KeyboardManager] Skipping KEY_PRESS for ${e.code} (input field detected: ${target.tagName})`);
        e.stopPropagation();
        return;
      }

      // Emit general keydown event for other systems
      Logger.log(`[KeyboardManager] Emitting KEY_PRESS for code: ${e.code}`);
      this.eventSystem?.emit(EVENTS.KEY_PRESS, e);

      // Process registered handlers
      this.processKeyEvent(e, isInputField);
    };

    this.globalKeyUpHandler = (e) => {
      // Check if the event target is an input field that should accept text input
      const target = e.target || document.activeElement;
      const isInputField = target && (
        (target.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(target.type)) ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable="true"]') ||
        target.isContentEditable
      );

      if (isInputField) {
        Logger.log(`[KeyboardManager] Skipping KEY_RELEASE for ${e.code} (input field detected: ${target.tagName})`);
        e.stopPropagation();
        return;
      }

      Logger.log(`[KeyboardManager] Emitting KEY_RELEASE for code: ${e.code}`);
      this.eventSystem?.emit(EVENTS.KEY_RELEASE, { code: e.code, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey });
    };

    window.addEventListener('keydown', this.globalKeyDownHandler);
    window.addEventListener('keyup', this.globalKeyUpHandler);
    this.isBound = true;
    Logger.log('[KeyboardManager] Global keyboard event listeners bound');
  }

  /**
   * Unbind all keyboard event listeners
   */
  unbindEvents() {
    if (!this.isBound) return;

    window.removeEventListener('keydown', this.globalKeyDownHandler);
    window.removeEventListener('keyup', this.globalKeyUpHandler);
    this.isBound = false;
    Logger.log('[KeyboardManager] Global keyboard event listeners unbound');
  }

  /**
   * Get all registered keys
   */
  getRegisteredKeys() {
    return Array.from(this.listeners.keys());
  }

  /**
   * Clear all registered handlers
   */
  clear() {
    this.listeners.clear();
    Logger.log('[KeyboardManager] All handlers cleared');
  }
}

export class InputHandler {
  constructor(stateManager, eventSystem, dom, camera, controls, rendererDomElement) {
    this.stateManager = stateManager;
    this.eventSystem = eventSystem;
    this.dom = dom;
    this.camera = camera;
    this.controls = controls;
    this.rendererDomElement = rendererDomElement;
    this.listeners = [];

    // Initialize centralized keyboard event manager
    this.keyboardManager = new KeyboardEventManager(eventSystem);

    this.init();
  }

  init() {
    this.bindKeyboardEvents();
    this.bindMouseEvents();
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

  bindKeyboardEvents() {
    // Bind the centralized keyboard event manager
    this.keyboardManager.bindEvents();

    // Register camera movement keys for state management
    const cameraKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'];
    cameraKeys.forEach(key => {
      this.keyboardManager.registerKeyHandler(key, (event) => {
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) {
          this.stateManager?.addPressedKey(event.code);
          event.preventDefault();
        }
      });

      // Handle key release for camera keys
      this.keyboardManager.registerKeyHandler(`${key}_release`, (event) => {
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) {
          this.stateManager?.removePressedKey(event.code);
          event.preventDefault();
        }
      });
    });

    Logger.log('[InputHandler] Centralized keyboard event management initialized');
  }

  bindMouseEvents() {
    this.bind(this.rendererDomElement, 'mousedown', (e) => {
      const mouseState = this.stateManager?.getInputState().mouseState;
      if (!mouseState) return; // Add null-check for mouseState
      if (e.button === 0) { // Left button
        mouseState.isLeftMouseDown = true;
      } else if (e.button === 2) { // Right button
        mouseState.isRightMouseDown = true;
        mouseState.rightClickStartPosition.x = e.clientX;
        mouseState.rightClickStartPosition.y = e.clientY;
      }
      this.stateManager?.setMouseState(mouseState);

      if (mouseState.isLeftMouseDown && mouseState.isRightMouseDown) {
        this.disableControls(); // Disable OrbitControls
        mouseState.lastMousePosition.x = e.clientX;
        mouseState.lastMousePosition.y = e.clientY;
        this.stateManager?.setMouseState(mouseState);
      }
      this.eventSystem?.emit(EVENTS.MOUSE_DOWN, { button: e.button, clientX: e.clientX, clientY: e.clientY });
    });

    this.bind(window, 'mouseup', (e) => {
      const mouseState = this.stateManager?.getInputState().mouseState;
      if (!mouseState) return; // Add null-check for mouseState
      if (e.button === 0) {
        mouseState.isLeftMouseDown = false;
      } else if (e.button === 2) {
        mouseState.isRightMouseDown = false;
        const slop = 5; // pixels
        const dx = Math.abs(e.clientX - mouseState.rightClickStartPosition.x);
        const dy = Math.abs(e.clientY - mouseState.rightClickStartPosition.y);

        // If it was a click (not a drag/pan), show the context menu
        if (dx <= slop && dy <= slop) {
          this.eventSystem?.emit(EVENTS.CONTEXT_MENU, { clientX: e.clientX, clientY: e.clientY });
        }
      }
      this.stateManager?.setMouseState(mouseState);

      if (!mouseState.isLeftMouseDown || !mouseState.isRightMouseDown) {
        this.enableControls(); // Re-enable OrbitControls
      }
      this.eventSystem?.emit(EVENTS.MOUSE_UP, { button: e.button, clientX: e.clientX, clientY: e.clientY });
    });

    this.bind(window, 'mousemove', (e) => {
      const mouseState = this.stateManager?.getInputState().mouseState;
      if (!mouseState) return; // Add null-check for mouseState
      if (mouseState.isLeftMouseDown && mouseState.isRightMouseDown) {
        const deltaX = e.clientX - mouseState.lastMousePosition.x;
        const deltaY = e.clientY - mouseState.lastMousePosition.y;

        const distance = this.camera.position.distanceTo(this.controls.target);
        const panSpeed = distance * 0.001;

        const panOffset = new THREE.Vector3();
        const up = this.camera.up.clone();
        const right = new THREE.Vector3().crossVectors(this.camera.getWorldDirection(new THREE.Vector3()), up).normalize();

        panOffset.add(right.multiplyScalar(-deltaX * panSpeed));
        panOffset.add(up.multiplyScalar(deltaY * panSpeed));

        this.camera.position.add(panOffset);
        this.controls.target.add(panOffset);

        mouseState.lastMousePosition.x = e.clientX;
        mouseState.lastMousePosition.y = e.clientY;
        this.stateManager?.setMouseState(mouseState);
      }
      this.eventSystem?.emit(EVENTS.MOUSE_MOVE, { clientX: e.clientX, clientY: e.clientY });
    });

    // Prevent the default context menu from ever appearing on the canvas
    this.bind(this.rendererDomElement, 'contextmenu', (e) => e.preventDefault());
  }

  /**
   * Explicitly enable OrbitControls.
   */
  enableControls() {
    if (this.controls) {
      this.controls.enabled = true;
      Logger.log('[InputHandler] OrbitControls enabled.');
    }
  }

  /**
   * Explicitly disable OrbitControls.
   */
  disableControls() {
    if (this.controls) {
      this.controls.enabled = false;
      Logger.log('[InputHandler] OrbitControls disabled.');
    }
  }

  dispose() {
    this.unbindAll();

    // Dispose of the centralized keyboard manager
    if (this.keyboardManager) {
      this.keyboardManager.unbindEvents();
      this.keyboardManager.clear();
    }
  }
}