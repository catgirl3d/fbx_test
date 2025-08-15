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
      
      // Set up texture resolver if provided
      if (this.textureResolver) {
        this._setupTextureResolver();
      }
      
      const url = URL.createObjectURL(file);
      this.loader.load(url, (obj) => {
        // Restore original texture loading method
        this._restoreTextureResolver();
        try { URL.revokeObjectURL(url); } catch (e) {}
        resolve(obj);
      }, (evt) => {
        if (onProgress) onProgress(evt);
      }, (err) => {
        // Restore original texture loading method even on error
        this._restoreTextureResolver();
        try { URL.revokeObjectURL(url); } catch (e) {}
        reject(err);
      });
    });
  }

  /**
   * Set up the texture resolver hook for the FBX loader
   * @private
   */
  _setupTextureResolver() {
    if (!this.textureResolver) return;
    
    // Check if the FBX loader has a loadTexture method
    if (typeof this.loader.loadTexture === 'function') {
      this._originalLoadTexture = this.loader.loadTexture;
      
      // Override the loadTexture method
      this.loader.loadTexture = (path, ...args) => {
        try {
          // Try to resolve the texture using our resolver
          const resolved = this.textureResolver(path);
          
          if (resolved) {
            if (resolved instanceof Promise) {
              // If it's a promise, wait for it and return the result
              return resolved.then(texture => {
                console.log(`[FBXLoader] Texture resolved from ZIP: ${path}`);
                console.debug(`[FBXLoader] Resolved texture details:`, {
                  path,
                  textureName: texture?.name,
                  textureImage: texture?.image,
                  textureReady: texture?.image?.complete,
                  textureWidth: texture?.image?.width,
                  textureHeight: texture?.image?.height
                });
                return texture;
              }).catch(error => {
                console.warn(`[FBXLoader] Texture resolver promise failed for ${path}:`, error);
                // Fallback to original method
                return this._originalLoadTexture.call(this.loader, path, ...args);
              });
            } else if (resolved && resolved.isTexture) {
              // If it's a texture object, return it directly
              console.log(`[FBXLoader] Texture resolved from ZIP: ${path}`);
              console.debug(`[FBXLoader] Resolved texture details:`, {
                path,
                textureName: resolved?.name,
                textureImage: resolved?.image,
                textureReady: resolved?.image?.complete,
                textureWidth: resolved?.image?.width,
                textureHeight: resolved?.image?.height
              });
              return resolved;
            }
          }
          
          // Fallback to original method
          return this._originalLoadTexture.call(this.loader, path, ...args);
        } catch (error) {
          console.warn(`[FBXLoader] Texture resolver failed for ${path}:`, error);
          // Fallback to original method
          return this._originalLoadTexture.call(this.loader, path, ...args);
        }
      };
    } else {
      console.warn('[FBXLoader] FBXLoader does not have a loadTexture method. Texture resolver may not work.');
      // Alternative approach: post-process materials after loading
      // This will be handled in the app.js as a fallback
    }
  }

  /**
   * Restore the original texture loading method
   * @private
   */
  _restoreTextureResolver() {
    if (this._originalLoadTexture && typeof this.loader.loadTexture === 'function') {
      this.loader.loadTexture = this._originalLoadTexture;
      this._originalLoadTexture = null;
    }
    // Also clear the textureResolver reference
    this.textureResolver = null;
  }

  dispose() {
    try { this.draco?.dispose?.(); } catch (e) { console.error(e); }
  }
}

export async function loadFBXFromFile(file, textureResolver = null) {
  const w = new FBXLoaderWrapper(textureResolver);
  return w.loadFromFile(file);
}