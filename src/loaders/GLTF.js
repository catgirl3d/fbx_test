import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
import Logger from '../core/Logger.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.20.0/meshopt_decoder.module.js';

/**
 * GLTFLoaderWrapper
 * Simple wrapper around three.js loaders to load .gltf/.glb files from File objects.
 *
 * Usage:
 *   const w = new GLTFLoaderWrapper();
 *   w.init(renderer); // optional but recommended for KTX2 detection
 *   const result = await w.loadFromFile(file); // { scene, animations, parser, userData }
 */
export class GLTFLoaderWrapper {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.draco = new DRACOLoader();
    // default decoder path (CDN)
    this.draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/libs/draco/');
    this.gltfLoader.setDRACOLoader(this.draco);

    this.ktx2 = new KTX2Loader();
    this.ktx2.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/libs/basis/');
    // meshopt support
    try {
      this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    } catch (e) {
      // ignore if not available
    }

    this._inited = false;
  }

  /**
   * Initialize with renderer to allow KTX2 detection.
   * @param {THREE.WebGLRenderer} renderer
   */
  init(renderer) {
    if (!renderer) return;
    this.ktx2.detectSupport(renderer);
    this.gltfLoader.setKTX2Loader(this.ktx2);
    this._inited = true;
  }

  /**
   * Load a File (.gltf or .glb) and return a Promise resolving to the gltf object.
   * The loader uses createObjectURL and revokes it after load.
   * @param {File} file
   * @param {(p:ProgressEvent)=>void} [onProgress]
   * @returns {Promise<{scene:THREE.Group, animations:Array, parser:Object}>}
   */
  loadFromFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file provided'));
      const url = URL.createObjectURL(file);
      this.gltfLoader.load(url, (gltf) => {
        // revoke URL and resolve
        try { URL.revokeObjectURL(url); } catch(e) { Logger.error('[GLTFLoader] Failed to revoke object URL on success:', e); }
        resolve(gltf);
      }, (evt) => {
        if (onProgress) onProgress(evt);
      }, (err) => {
        try { URL.revokeObjectURL(url); } catch(e) { Logger.error('[GLTFLoader] Failed to revoke object URL on error:', e); }
        reject(err);
      });
    });
  }

  dispose() {
    try { this.draco?.dispose?.(); } catch(e) { Logger.error('[GLTFLoader] Failed to dispose DracoLoader:', e); }
    try { this.ktx2?.dispose?.(); } catch(e) { Logger.error('[GLTFLoader] Failed to dispose KTX2Loader:', e); }
  }
}

/**
 * Helper convenience function
 * @param {File} file
 * @param {THREE.WebGLRenderer} [renderer]
 */
export async function loadGLTFFromFile(file, renderer) {
  const w = new GLTFLoaderWrapper();
  if (renderer) w.init(renderer);
  return w.loadFromFile(file);
}