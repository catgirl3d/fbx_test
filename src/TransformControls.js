import { TransformControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/TransformControls.js';
import Logger from './core/Logger.js';

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
      
      // Ensure object transformation is updated during transformation
      if (this.controls.object) {
        const obj = this.controls.object;
        
        // Update matrix
        obj.updateMatrix();
        obj.updateMatrixWorld();
        
        // Special handling for SkinnedMesh
        if (obj.isSkinnedMesh) {
          // Update skeleton if it exists
          if (obj.skeleton) {
            obj.skeleton.update();
          }
          
          // Force matrix world update for the mesh
          obj.matrixWorldNeedsUpdate = true;
        }
        
        // Force a render update
        if (obj.parent) {
          obj.parent.updateMatrixWorld();
        }
      }
    });
  }

  attach(obj) {
    try {
      // Validate object before attaching
      if (!obj || typeof obj.updateMatrixWorld !== 'function' || !obj.type || !obj.parent) {
        Logger.warn('Invalid object for TransformControls attach:', obj);
        return;
      }
      
      // Validate object before attaching
      if (!obj || typeof obj.updateMatrixWorld !== 'function' || !obj.type || !obj.parent) {
        Logger.warn('Invalid object for TransformControls attach:', obj);
        return;
      }
      
      // Special handling for SkinnedMesh objects
      if (obj.isSkinnedMesh) {
        // For SkinnedMesh, we need to ensure the skeleton is also updated
        if (obj.skeleton && obj.skeleton.bones) {
        }
        
        // Ensure the mesh is not bound to a skeleton that would override transformations
        obj.matrixAutoUpdate = true;
        obj.matrixWorldNeedsUpdate = true;
        
        // Force immediate update
        obj.updateMatrix();
        obj.updateMatrixWorld();
      } else {
        // Regular mesh handling
        obj.matrixAutoUpdate = true;
      }
      
      // Let transform controls handle the transformation naturally
      this.controls.attach(obj);
      
      // Force immediate update of the object's transformation
      if (this.controls.object) {
        this.controls.object.updateMatrix();
        this.controls.object.updateMatrixWorld();
        
        // For SkinnedMesh, also update the skeleton
        if (this.controls.object.isSkinnedMesh && this.controls.object.skeleton) {
          this.controls.object.skeleton.update();
        }
        
        // Force a render update
        if (this.controls.object.parent) {
          this.controls.object.parent.updateMatrixWorld();
        }
      }
      
    } catch(e) {
      Logger.warn('Failed to attach TransformControls:', e);
    }
  }
  detach() {
    try {
      this.controls.detach();
    } catch(e) {
      Logger.warn('Failed to detach TransformControls:', e);
    }
  }
  setMode(mode = 'translate') { try { this.controls.setMode(mode); } catch(e){ Logger.error('[TransformControls] Failed to set mode:', e); }}
  enable(v) {
    this.controls.enabled = !!v;
    this.controls.visible = !!v;
  }

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