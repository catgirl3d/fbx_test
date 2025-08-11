import { TransformControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/TransformControls.js';

/**
 * TransformControlsWrapper
 * Simple wrapper for three.js TransformControls to centralize usage.
 *
 * Usage:
 *   const tc = new TransformControlsWrapper(camera, renderer.domElement);
 *   scene.add(tc.controls); // externally
 *   tc.attach(object);
 *   tc.setMode('translate'|'rotate'|'scale');
 *   tc.setSnap({ translate:0.1, rotate:THREE.MathUtils.degToRad(15), scale:0.1 });
 *   tc.on('dragging-changed', (isDragging)=> { ... });
 */
export class TransformControlsWrapper {
  constructor(camera, domElement) {
    this.controls = new TransformControls(camera, domElement);
    this.enabled = false;
    this._listeners = new Map();
    // expose events
    this.controls.addEventListener('dragging-changed', (e) => {
      this.enabled = true;
      this._emit('dragging-changed', e.value);
    });
    this.controls.addEventListener('change', (e) => {
      this._emit('change', e);
    });
  }

  attach(obj) { try { this.controls.attach(obj); } catch(e){} }
  detach() { try { this.controls.detach(); } catch(e){} }
  setMode(mode = 'translate') { try { this.controls.setMode(mode); } catch(e){} }
  enable(v) { this.controls.enabled = !!v; }

  setTranslationSnap(v) { if (v === null) this.controls.setTranslationSnap(null); else this.controls.setTranslationSnap(Number(v) || 0); }
  setRotationSnap(v) { if (v === null) this.controls.setRotationSnap(null); else this.controls.setRotationSnap(Number(v) || 0); }
  setScaleSnap(v) { if (v === null) this.controls.setScaleSnap(null); else this.controls.setScaleSnap(Number(v) || 0); }

  on(name, cb) {
    if (!this._listeners.has(name)) this._listeners.set(name, new Set());
    this._listeners.get(name).add(cb);
  }
  off(name, cb) {
    this._listeners.get(name)?.delete(cb);
  }
  _emit(name, data) {
    this._listeners.get(name)?.forEach(cb => cb(data));
  }
}

export default TransformControlsWrapper;