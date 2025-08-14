import * as THREE from 'three';
import { EVENTS } from './EventSystem.js';

export class InputHandler {
  constructor(stateManager, eventSystem, dom, camera, controls, rendererDomElement) {
    this.stateManager = stateManager;
    this.eventSystem = eventSystem;
    this.dom = dom;
    this.camera = camera;
    this.controls = controls;
    this.rendererDomElement = rendererDomElement;
    this.listeners = [];

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
    this.bind(window, 'keydown', (e) => {
      const code = e.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(code)) {
        this.stateManager?.addPressedKey(code);
        e.preventDefault();
      }
      // Emit general keydown event for other hotkeys
      this.eventSystem?.emit(EVENTS.KEY_PRESS, { code: e.code, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey });
    });

    this.bind(window, 'keyup', (e) => {
      const code = e.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(code)) {
        this.stateManager?.removePressedKey(code);
        e.preventDefault();
      }
      this.eventSystem?.emit(EVENTS.KEY_RELEASE, { code: e.code, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey });
    });
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
        this.controls.enabled = false; // Disable OrbitControls
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
        this.controls.enabled = true; // Re-enable OrbitControls
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

  dispose() {
    this.unbindAll();
  }
}