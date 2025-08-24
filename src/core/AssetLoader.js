import { GLTFLoaderWrapper } from '../loaders/GLTF.js';
import { FBXLoaderWrapper } from '../loaders/FBX.js';
import { OBJLoaderWrapper } from '../loaders/OBJ.js';
import { loadTexturesFromZIP, matchTexturePath } from '../utils/zipTextures.js';
import * as THREE from 'three';
import { EVENTS } from './EventSystem.js'; // Import EVENTS from EventSystem
import Logger from './Logger.js';

export class AssetLoader {
  constructor(eventSystem, stateManager, rendererManager) {
    this.eventSystem = eventSystem;
    this.stateManager = stateManager;
    this.rendererManager = rendererManager; // Store rendererManager
    this.loaders = new Map();
    this.initLoaders();
  }

  initLoaders() {
    Logger.log('[AssetLoader] Initializing loaders with renderer:', this.rendererManager?.renderer);
    // Initialize GLTF loader
    const gltfLoader = new GLTFLoaderWrapper();
    this.rendererManager?.renderer && gltfLoader.init(this.rendererManager.renderer);
    this.loaders.set('gltf', gltfLoader);
    this.loaders.set('glb', gltfLoader);

    // Initialize FBX loader
    const fbxLoader = new FBXLoaderWrapper();
    this.rendererManager?.renderer && fbxLoader.init(this.rendererManager.renderer);
    this.loaders.set('fbx', fbxLoader);

    // Initialize OBJ loader
    const objLoader = new OBJLoaderWrapper();
    this.loaders.set('obj', objLoader);
  }

  async loadModel(file, options = {}) {
    const extension = file.name.split('.').pop().toLowerCase();
    const loader = this.loaders.get(extension);

    if (!loader) {
      throw new Error(`Unsupported file format: ${extension}`);
    }

    this.eventSystem?.emit(EVENTS.ASSET_LOADING_START, { file, type: extension });

    try {
      let result;
      const textureResolver = this.createTextureResolver();

      if (extension === 'fbx') {
        // Reuse cached loader created by initLoaders() so lifecycle/cleanup is centralised
        const fbxLoader = loader; // loader === this.loaders.get(extension) (set earlier)
        // Attach the per-load texture resolver created from state
        fbxLoader.textureResolver = textureResolver;
        // Ensure renderer initialization (no-op if already inited)
        this.rendererManager?.renderer && fbxLoader.init(this.rendererManager.renderer);
        result = await this.loadWithProgress(fbxLoader, file, options);
      } else {
        result = await this.loadWithProgress(loader, file, options);
      }

      this.eventSystem?.emit(EVENTS.MODEL_LOADED, {
        model: result,
        source: file.name,
        type: extension
      });
      Logger.log('[AssetLoader] Fired MODEL_LOADED event');
      return result;
    } catch (error) {
      Logger.error('[AssetLoader] Error loading model:', error);
      this.eventSystem?.emit(EVENTS.ASSET_LOAD_ERROR, {
        file,
        error: error.message,
        type: extension
      });
      throw error;
    } finally {
      this.eventSystem?.emit(EVENTS.ASSET_LOADING_END, { file, type: extension });
    }
  }

  async loadWithProgress(loader, file, options = {}) {
    return new Promise((resolve, reject) => {
      const loadOptions = {
        file,
        onProgress: (event) => {
          if (typeof options.onProgress === 'function') {
            options.onProgress(event);
          }
          this.eventSystem?.emitIfSubscribed(EVENTS.ASSET_PROGRESS, {
            file,
            progress: event
          });
        },
        fileName: file.name
      };

      loader.loadFromFile(loadOptions.file, loadOptions.onProgress, loadOptions.fileName)
        .then(resolve)
        .catch(reject);
    });
  }

  createTextureResolver() {
    const zipTextures = this.stateManager?.getAppState().zipTextures;
    
    return (path) => {
      if (!path || !zipTextures?.size) return null;
      
      const texture = matchTexturePath(path, zipTextures);
      
      if (texture) {
        Logger.log(`[AssetLoader] Texture resolver found: ${path} -> ${texture.name}`);
        return texture;
      } else {
        Logger.warn(`[AssetLoader] Texture resolver failed to find: ${path}`);
        return null;
      }
    };
  }

  async loadTexturesFromZIP(zipFile, onProgress) {
    try {
      this.eventSystem?.emit(EVENTS.TEXTURE_LOADING_START, { zipFile });
      
      const zipTextures = await loadTexturesFromZIP(zipFile, THREE, onProgress);
      
      this.stateManager?.updateAppState({
        zipTextures,
        currentZipFile: zipFile
      });

      this.eventSystem?.emit(EVENTS.TEXTURES_LOADED, {
        count: zipTextures.size,
        zipFile
      });

      return zipTextures;
    } catch (error) {
      this.eventSystem?.emit(EVENTS.ASSET_LOAD_ERROR, {
        zipFile,
        error: error.message,
        type: 'zip-textures'
      });
      throw error;
    } finally {
      this.eventSystem?.emit(EVENTS.TEXTURE_LOADING_END, { zipFile });
    }
  }

  async applyTexturesToModel(model) {
    const zipTextures = this.stateManager?.getAppState().zipTextures;
    
    if (zipTextures && zipTextures.size > 0) {
      try {
        Logger.log(`[AssetLoader] Applying ${zipTextures.size} ZIP textures to model: ${model.name || model.uuid}`);
        
        // Import the applyTexturesFromMap function and await its completion
        const { applyTexturesFromMap } = await import('../Materials.js');
        applyTexturesFromMap(model, zipTextures);
        this.eventSystem?.emit(EVENTS.TEXTURE_APPLIED, {
          model,
          textureCount: zipTextures.size
        });
        Logger.log(`[AssetLoader] Finished applying ${zipTextures.size} ZIP textures to model: ${model.name || model.uuid}`);
        
      } catch (error) {
        Logger.warn('[AssetLoader] Failed to apply ZIP textures:', error);
        this.eventSystem?.emit(EVENTS.ASSET_LOAD_ERROR, {
          model,
          error: error.message,
          type: 'texture-application'
        });
        throw error; // Re-throw to propagate the error
      }
    }
  }

  clearTextures() {
    const zipTextures = this.stateManager?.getAppState().zipTextures;
    
    // Dispose all textures
    if (zipTextures) {
      for (const [path, texture] of zipTextures) {
        if (texture && texture.dispose) {
          texture.dispose();
        }
      }
    }
    
    this.stateManager?.updateAppState({
      zipTextures: new Map(),
      currentZipFile: null
    });

    this.eventSystem?.emit(EVENTS.ZIP_TEXTURES_CLEARED);
  }

  async loadHDRI(url) {
    try {
      this.eventSystem?.emit(EVENTS.HDRI_LOADING_START, { url });
      
      const loaderModule = await import('https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/RGBELoader.js');
      const loader = new loaderModule.RGBELoader();
      
      return new Promise((resolve, reject) => {
        loader.load(url,
          (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.eventSystem?.emit(EVENTS.HDRI_LOADED, { texture, url });
            resolve(texture);
          },
          undefined,
          (error) => {
            this.eventSystem?.emit(EVENTS.ASSET_LOAD_ERROR, { url, error: error.message, type: 'hdri' });
            reject(error);
          }
        );
      });
    } catch (error) {
      this.eventSystem?.emit(EVENTS.ASSET_LOAD_ERROR, { url, error: error.message, type: 'hdri' });
      throw error;
    } finally {
      this.eventSystem?.emit(EVENTS.HDRI_LOADING_END, { url });
    }
  }

  dispose() {
    // Clean up loaders
    this.loaders.forEach(loader => {
      if (loader.dispose) {
        loader.dispose();
      }
    });
    this.loaders.clear();
    
    // Clear textures
    this.clearTextures();
  }
}
