import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/FBXLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/DRACOLoader.js';
import { TGALoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/TGALoader.js';
import * as THREE from 'three';

/**
 * FBXLoaderWrapper
 * Wrapper to load FBX files from File objects using createObjectURL.
 *
 * Usage:
 *   const w = new FBXLoaderWrapper();
 *   await w.init(renderer); // optional
 *   const obj = await w.loadFromFile(file, onProgress);
 */
export class FBXLoaderWrapper {
  constructor(textureResolver = null) {
    this.loadingManager = new THREE.LoadingManager();
    this.loader = new FBXLoader(this.loadingManager);
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/libs/draco/');
    if (this.loader.setDRACOLoader) this.loader.setDRACOLoader(this.draco);
    this._inited = false;
    this.textureResolver = textureResolver;
    this._originalLoadTexture = null;

    // Register TGALoader with the FBXLoader's manager
    this.loadingManager.addHandler(/\.tga$/i, new TGALoader());
  }

  init(renderer) {
    // FBX doesn't require KTX2/meshopt initialization, but keep parity with other loaders
    this._inited = true;
  }

  loadFromFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file provided'));
      
      const url = URL.createObjectURL(file);
      this.loader.load(url, (obj) => {
        try { URL.revokeObjectURL(url); } catch (e) { console.error(e); }
        resolve(obj);
      }, (evt) => {
        if (onProgress) onProgress(evt);
      }, (err) => {
        try { URL.revokeObjectURL(url); } catch (e) { console.error(e); }
        reject(err);
      });
    });
  }

  dispose() {
    try { this.draco?.dispose?.(); } catch (e) { console.error(e); }
  }
}

export async function loadFBXFromFile(file) {
  const w = new FBXLoaderWrapper();
  return w.loadFromFile(file);
}