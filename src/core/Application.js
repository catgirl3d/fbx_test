import { StateManager } from './StateManager.js';
import Logger from './Logger.js';
import { EventSystem, EVENTS } from './EventSystem.js';
import { AssetLoader } from './AssetLoader.js';
import { SceneManager } from '../Scene.js';
import { RendererManager } from '../Renderer.js';
import { AnimationManager } from '../Animation.js';
import { TransformControlsWrapper } from '../TransformControls.js';
import { LightingManager } from '../Lighting.js';
import { RenderSettings } from '../RenderSettings.js';
import { Settings } from '../Settings.js';
import { initInspector } from '../Inspector.js';
import { initUI } from '../UI.js';
import { UIBindings } from './UIBindings.js';
import { createDOMManager } from '../DOMManager.js';
import { loadLanguage, t, getCurrentLanguage } from '../i18n.js';
import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js';
import { InputHandler } from './InputHandler.js';
import * as BufferGeometryUtils from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/utils/BufferGeometryUtils.js';

export class Application {
  constructor(canvas) {
    Logger.log('[Application] Constructor started.');
    this.canvas = canvas;
    this.isRunning = false;
    this.rafId = null;
    
    // Initialize core systems
    Logger.log('[Application] Initializing StateManager...');
    this.stateManager = new StateManager();
    Logger.log('[Application] StateManager initialized.');
    
    Logger.log('[Application] Initializing EventSystem...');
    this.eventSystem = new EventSystem();
    Logger.log('[Application] EventSystem initialized.');
    
    Logger.log('[Application] Initializing RendererManager...');
    this.rendererManager = new RendererManager({
      canvas: this.canvas,
      antialias: false,
      alpha: true
    });
    Logger.log('[Application] RendererManager initialized.');
    
    Logger.log('[Application] Initializing AssetLoader...');
    this.assetLoader = new AssetLoader(this.eventSystem, this.stateManager, this.rendererManager);
    Logger.log('[Application] AssetLoader initialized.');
    
    // Initialize managers
    this.sceneManager = null;
    this.animationManager = null;
    this.transformControls = null;
    this.lightingManager = null;
    this.renderSettings = null;
    this.settings = null;
    this.inspectorApi = null;
    
    // Initialize Three.js core objects
    this.camera = null;
    this.controls = null;
    this.clock = null;
    
    // Initialize UI
    this.dom = null;
    this.uiBindings = null;
    this.inputHandler = null;
    
    Logger.log('[Application] Constructor finished.');
  }

  static async create(canvas) {
    const app = new Application(canvas);
    await app.init();
    return app;
  }

  async init() {
    Logger.log('[Application] init() started.');
    // Initialize DOM Manager
    Logger.log('[Application] Initializing DOMManager...');
    this.dom = createDOMManager({ t });
    Logger.log('[Application] DOMManager initialized.');
    
    // Initialize Three.js core objects
    Logger.log('[Application] Calling initThreeJS()...');
    this.initThreeJS();
    Logger.log('[Application] initThreeJS() finished.');
    
    // Initialize managers
    Logger.log('[Application] Calling initManagers()...');
    this.initManagers();
    Logger.log('[Application] initManagers() finished.');
    
    // Initialize UI
    Logger.log('[Application] Calling initUI()...');
    this.initUI();
    Logger.log('[Application] initUI() finished.');
    
    // Initialize UI bindings
    Logger.log('[Application] Calling initUIBindings()...');
    try {
      this.initUIBindings();
    } catch (e) {
      Logger.error('[Application] initUIBindings() failed:', e);
    }
    Logger.log('[Application] initUIBindings() finished.');
    
    // Initialize event listeners
    Logger.log('[Application] Calling initEventListeners()...');
    this.initEventListeners();
    Logger.log('[Application] initEventListeners() finished.');
    
    // Load default model
    Logger.log('[Application] Calling loadDefaultModel()...');
    await this.loadDefaultModel();
    Logger.log('[Application] loadDefaultModel() finished.');
    
    // Start the application
    Logger.log('[Application] Calling start()...');
    this.start();
    Logger.log('[Application] start() finished.');
    
    Logger.log('[Application] init() finished.');
  }

  initThreeJS() {
    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 50000);
    this.camera.position.set(2, 1.2, 3);
    
    // Initialize controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.8, 0);
    this.controls.update();
    
    // Initialize clock
    this.clock = new THREE.Clock();
  }

  initManagers() {
    Logger.log('[Application] initManagers() started.');
    Logger.log('[Application] Initializing SceneManager...');
    this.sceneManager = new SceneManager({ stateManager: this.stateManager });
    Logger.log('[Application] SceneManager initialized.');
    
    Logger.log('[Application] Initializing AnimationManager...');
    this.animationManager = new AnimationManager();
    Logger.log('[Application] AnimationManager initialized.');
    
    Logger.log('[Application] Initializing TransformControlsWrapper...');
    this.transformControls = new TransformControlsWrapper(this.camera, this.canvas);
    const scene = this.sceneManager?.getScene();
    if (scene) {
      scene.add(this.transformControls.controls);
    }
    Logger.log('[Application] TransformControlsWrapper initialized.');
    
    // Wire transform dragging to OrbitControls
    this.transformControls.on('dragging-changed', (isDragging) => {
      this.controls.enabled = !isDragging;
    });
    
    Logger.log('[Application] Initializing Settings...');
    this.settings = new Settings();
    Logger.log('[Application] Settings initialized.');
    
    Logger.log('[Application] Initializing RenderSettings...');
    this.renderSettings = new RenderSettings({
      rendererMgr: this.rendererManager,
      settings: this.settings
    });
    Logger.log('[Application] RenderSettings initialized.');
    
    Logger.log('[Application] Initializing LightingManager...');
    const sceneForLighting = this._getSafeScene();
    if (sceneForLighting) {
      this.lightingManager = new LightingManager({
        scene: sceneForLighting
      });
      Logger.log('[Application] LightingManager initialized.');
    } else {
      Logger.warn('[Application] SceneManager not available, LightingManager not fully initialized.');
    }
    
    if (this.lightingManager) {
      Logger.log('[Application] Calling initInspector()...');
      this.initInspector();
      Logger.log('[Application] initInspector() finished.');
    } else {
      Logger.error('[Application] FATAL: LightingManager failed to initialize, Inspector will not be created.');
    }
    Logger.log('[Application] initManagers() finished.');
  }

  initUI() {
    Logger.log('[Application] initUI() started.');
    // Initialize external UI components
    Logger.log('[Application] Calling initUI (external)...');
    this.ui = initUI({
      t: t,
      toast: this.showToast.bind(this),
      onLoadFile: this.handleFileLoad.bind(this),
      onApplyHDRI: this.handleHDRIApply.bind(this),
      onApplyTextures: this.handleTexturesApply.bind(this),
      onResetAll: this.resetAll.bind(this),
      onFrame: this.handleFrame.bind(this),
      onClearScene: this.handleClearScene.bind(this),
      getSettings: () => this.settings.get(),
      setSettings: (s) => {
        Object.keys(s).forEach(key => {
          this.settings.set(key, s[key]);
        });
      }
    });
    Logger.log('[Application] initUI (external) finished.');
    
    // Initialize UI bindings
    Logger.log('[Application] Calling initUIBindings()...');
    
    // Initialize UI state
    Logger.log('[Application] Calling initUIState()...');
    this.initUIState();
    Logger.log('[Application] initUIState() finished.');
    // Reveal UI that was hidden by the original preload guard
    if (this.dom) {
      this.dom.body().classList.remove('preload');
    }
    Logger.log('[Application] initUI() finished.');
  }

  initEventListeners() {
    // Handle window resize
    if (this.dom) {
      this.dom.onResize(this.handleResize.bind(this));
    }
    
    // Handle runtime errors
    window.addEventListener('error', (e) => {
      this.reportRuntimeError(e.error || e.message || 'Runtime error', e);
    });
    
    window.addEventListener('unhandledrejection', (e) => {
      this.reportRuntimeError(e.reason || 'Unhandled promise rejection', e);
    });
    
    // Initialize InputHandler
    this.inputHandler = new InputHandler(
      this.stateManager,
      this.eventSystem,
      this.dom,
      this.camera,
      this.controls,
      this.rendererManager?.renderer?.domElement // Use optional chaining here
    );

    // Subscribe to state changes
    if (this.stateManager) {
      this.stateManager.subscribe('scene', this.handleSceneStateChange.bind(this));
      this.stateManager.subscribe('input', this.handleInputStateChange.bind(this));
      this.stateManager.subscribe('animation', this.handleAnimationStateChange.bind(this));
      this.stateManager.subscribe('ui', this.handleUIStateChange.bind(this));
    }
    
    // Subscribe to events
    this.eventSystem.on(EVENTS.OBJECT_SELECTED, this.handleObjectSelected.bind(this));
    this.eventSystem.on(EVENTS.SCENE_CLEARED, this.handleSceneCleared.bind(this));
    this.eventSystem.on(EVENTS.MODEL_LOADED, this.handleModelLoaded.bind(this));
    this.eventSystem.on(EVENTS.KEY_PRESS, this.handleKeyPress.bind(this));
    this.eventSystem.on(EVENTS.CONTEXT_MENU, this.handleContextMenu.bind(this));
    this.eventSystem.on(EVENTS.SETTINGS_CHANGED, this.handleSettingsChanged.bind(this));
    this.eventSystem.on(EVENTS.RENDER_SETTINGS_CHANGED, this.handleRenderSettingsChanged.bind(this));
    this.eventSystem.on(EVENTS.LIGHTING_SETTINGS_CHANGED, this.handleLightingSettingsChanged.bind(this));
    this.eventSystem.on(EVENTS.UI_RESET_RENDER, this.resetRender.bind(this));
    this.eventSystem.on(EVENTS.UI_RESET_DIR, this.resetDir.bind(this));
    this.eventSystem.on(EVENTS.UI_RESET_ENV, this.resetEnv.bind(this));
    this.eventSystem.on(EVENTS.UI_RESET_GIZMOS, this.resetGizmos.bind(this));
    this.eventSystem.on(EVENTS.UI_RESET_ALL, this.resetAll.bind(this));
    this.eventSystem.on(EVENTS.CAMERA_PRESET, ({ view }) => this.handleCameraPreset(view));
    
    // Animation events
    if (this.eventSystem) {
      this.eventSystem.on(EVENTS.ANIMATION_PLAY, ({ index }) => this.animationManager?.select(index));
      this.eventSystem.on(EVENTS.ANIMATION_PAUSE, () => this.animationManager?.pause());
      this.eventSystem.on(EVENTS.ANIMATION_STOP, () => this.animationManager?.stop());
      this.eventSystem.on(EVENTS.ANIMATION_TIME_UPDATE, ({ progress }) => this.animationManager?.setTime(progress));
    }

    this.handleResize();
  }

  initInspector() {
    try {
      this.inspectorApi = initInspector({
        sceneManager: this.sceneManager,
        lighting: this.lightingManager,
        tControls: this.transformControls,
        getLoadedModels: () => this.stateManager.getSceneState().models,
        getCurrentModel: () => this.stateManager.getSceneState().selectedObject || 
          (this.stateManager.getSceneState().models.length > 0 ? 
           this.stateManager.getSceneState().models[0] : null),
        onSelect: (obj) => {
          this.rendererManager?.setOutlineObjects(obj);
          const objectToUpdate = Array.isArray(obj) ? (obj.length > 0 ? obj[0] : null) : obj;
          this.stateManager?.setSelectedObject(objectToUpdate);
          this.sceneManager?.updateBBox(objectToUpdate);
          this.setInspectorOpen(true);
        },
        onFocus: (obj) => {
          this.frameObject(obj);
        }
      });
    } catch (e) {
      Logger.warn('Inspector init error', e);
      this.inspectorApi = null;
    }
  }

  initUIBindings() {
    // FIX: This was missing
    this.uiBindings = new UIBindings(this.stateManager, this.eventSystem, this.dom);
  }

  initUIState() {
    // Initialize render settings UI state
    const tmEl = this.dom?.get('tone-mapping');
    if (tmEl && this.renderSettings) tmEl.value = this.renderSettings.getState().tonemapping || tmEl.value;
    
    const exposureEl = this.dom?.get('exposure');
    if (exposureEl && this.renderSettings) exposureEl.value = this.renderSettings.getState().exposure || exposureEl.value;
    
    const exposureValEl = this.dom?.get('exposure-val');
    if (exposureValEl && this.renderSettings) exposureValEl.textContent = (this.renderSettings.getState().exposure || Number(exposureEl?.value || 1)).toFixed(2);
    
    const fxaaToggle = this.dom?.get('toggle-fxaa');
    if (fxaaToggle && this.renderSettings) fxaaToggle.checked = this.renderSettings.getState().fxaa;
    
    // Initialize lighting UI labels
    const dirIntensityValEl = this.dom.get('dir-intensity-val');
    const dirAngleValEl = this.dom.get('dir-angle-val');
    const dirSoftnessValEl = this.dom.get('dir-softness-val');
    const envIntensityValEl = this.dom.get('env-intensity-val');
    
    if (dirIntensityValEl && this.lightingManager) dirIntensityValEl.textContent = (this.lightingManager.getDirIntensity?.() || Number(this.dom?.get('dir-intensity')?.value || 0.9)).toFixed(2);
    if (dirAngleValEl && this.lightingManager) dirAngleValEl.textContent = `${Math.round(Number(this.dom?.get('dir-angle')?.value || 34))}°`;
    if (dirSoftnessValEl && this.lightingManager) dirSoftnessValEl.textContent = (this.lightingManager.getDirSoftness?.() || Number(this.dom?.get('dir-softness')?.value || 1)).toFixed(1);
    if (envIntensityValEl && this.sceneManager) envIntensityValEl.textContent = (Number(this.dom?.get('env-intensity')?.value || 1)).toFixed(2);
    
    // Hide animations section on startup
    if (this.dom) {
      this.setAnimSectionVisible(false);
    }
  }

  // Event handlers
  handleFileLoad = async (files) => {
    const fileList = Array.from(files);
    Logger.log(`[Application] onLoadFile received ${fileList.length} files.`);

    // Separate files by type
    const modelFiles = [];
    const mtlFiles = new Map();
    const textureFiles = [];
    const zipFiles = [];

    for (const file of fileList) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.obj') || name.endsWith('.fbx') || name.endsWith('.gltf') || name.endsWith('.glb')) {
        modelFiles.push(file);
      } else if (name.endsWith('.mtl')) {
        mtlFiles.set(file.name, file);
      } else if (name.endsWith('.zip')) {
        zipFiles.push(file);
      } else {
        textureFiles.push(file);
      }
    }

    // Handle ZIP files first
    for (const file of zipFiles) {
      try {
        this.dom?.showOverlay(t('loading_textures'), file.name);
        await this.assetLoader?.loadTexturesFromZIP(file, (p) => this.dom?.setProgress(p));
        this.dom?.hideOverlay();
        this.dom?.showToast(t('textures_loaded_from_zip'));
      } catch (err) {
        this.dom?.hideOverlay();
        this.dom?.showToast(t('zip_load_error', { message: err.message || err }));
      }
    }

    // Handle model files
    for (const file of modelFiles) {
      try {
        await this.loadModel(file);
      } catch (err) {
        this.dom?.showToast(t('loading_error', { message: err.message || err }));
      }
    }
  };

  handleHDRIApply = async (url) => {
    if (!url) {
      this.sceneManager?.setEnvironment(null);
      this.dom?.showToast(t('hdri_cleared'));
      return;
    }
    
    try {
      this.dom?.showOverlay(t('hdri'), t('loading_environment'));
      const texture = await this.assetLoader?.loadHDRI(url);
      this.sceneManager?.setEnvironment(texture);
      this.sceneManager?.applyEnvIntensity && this.sceneManager?.applyEnvIntensity(
        Number(this.dom?.get('env-intensity')?.value || 1),
        this.stateManager?.getSceneState().models.length > 0 ?
          this.stateManager?.getSceneState().models : this._getSafeScene() || null // Use _getSafeScene
      );
      this.dom?.hideOverlay();
      this.dom?.showToast(t('hdri_applied'));
    } catch (err) {
      this.dom?.hideOverlay();
      this.dom?.showToast(t('failed_to_load_hdri'));
    }
  };

  handleTexturesApply = async (file) => {
    if (!file) {
      this.dom?.showToast(t('select_zip_file_textures'));
      return;
    }
    
    if (!file.name.toLowerCase().endsWith('.zip')) {
      this.dom?.showToast(t('select_zip_file'));
      return;
    }
    
    try {
      this.dom?.showOverlay(t('loading_textures'), file.name);
      await this.assetLoader?.loadTexturesFromZIP(file, (p) => this.dom?.setProgress(p));
      
      const models = this.stateManager?.getSceneState().models;
      if (models && models.length > 0) {
        models.forEach(model => {
          this.assetLoader?.applyTexturesToModel(model);
        });
        this.dom?.showToast(t('applying_zip_textures', {
          count: this.stateManager?.getAppState().zipTextures.size
        }));
      } else {
        this.dom?.showToast(t('load_fbx_before_applying_textures'));
      }
      
      this.dom?.hideOverlay();
    } catch (error) {
      this.dom?.hideOverlay();
      this.dom?.showToast(t('error_loading_textures', { message: error.message }));
    }
  };

  handleFrame = () => {
    const models = this.stateManager?.getSceneState().models;
    const scene = this._getSafeScene(); // Use _getSafeScene
    this.frameObject(models && models.length > 0 ? models : (scene || null));
  };

  handleClearScene = () => {
    this.clearScene();
  };

  handleSceneStateChange = (state) => {
    // Update scene based on state changes
    if (state.models.length === 0) {
      this.sceneManager?.clearMeasure();
      this.sceneManager?.updateBBox(null);
    }
  };

  handleInputStateChange = (state) => {
    // Camera movement is now handled by InputHandler directly updating camera/controls
    // No direct action needed here, but can be used for other input-related state changes
  };

  handleAnimationStateChange = (state) => {
    // Handle animation state changes
    if (state.activeAction && !state.activeAction.paused) {
      this.updateAnimTimeUI(state.currentTime, state.duration);
    }
  };

  handleUIStateChange = (state) => {
    // Handle UI state changes
    if (state.isInspectorOpen !== undefined) {
      const inspectorEl = this.dom?.get('scene-inspector');
      if (!inspectorEl) return;
      const isCurrentlyOpen = inspectorEl.classList.contains('right-0');
      if (isCurrentlyOpen !== state.isInspectorOpen) {
        this.setInspectorOpen(state.isInspectorOpen);
      }
    }
  };

  handleObjectSelected = ({ ndc }) => {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const intersects = raycaster.intersectObjects(this.sceneManager.getScene().children, true);

    if (intersects.length > 0) {
      const selectedObject = intersects[0].object;
      this.rendererManager?.setOutlineObjects([selectedObject]);
      this.sceneManager?.updateBBox(selectedObject);
      this.stateManager?.setSelectedObject(selectedObject);
      if (this.inspectorApi && typeof this.inspectorApi.selectObject === 'function') {
        this.inspectorApi.selectObject(selectedObject);
      }
    } else {
      this.rendererManager?.setOutlineObjects([]);
      this.sceneManager?.updateBBox(null);
      this.stateManager?.setSelectedObject(null);
    }
  };

  handleSceneCleared = () => {
    // Handle scene cleared
    this.animationManager?.dispose();
    if (this.inspectorApi && typeof this.inspectorApi.refresh === 'function') {
      this.inspectorApi.refresh();
    }
  };

  handleModelLoaded = ({ model, source }) => {
    // Handle model loaded
    this.sceneManager?.add(model);
    this.stateManager?.addModel(model);
    
    Logger.log('[Application] Model added to scene and state:', model);
    
    // Update filename display
    this.updateFilenameDisplay(source);

    // Apply textures if available
    this.assetLoader?.applyTexturesToModel(model);
    
    // Apply model settings (shadows, materials)
    this.applyModelSettings(model);

    // Frame the model
    this.frameObject([model]);
    this.updateStatsUI();
    this.sceneManager?.updateBBox([model]);

    // Refresh the inspector to show the new model
    if (this.inspectorApi && typeof this.inspectorApi.refresh === 'function') {
      this.inspectorApi.refresh();
    }

    // Attempt to triangulate geometry and compute normals
    model.traverse((child) => {
      if (child.isMesh && child.geometry) {
        if (!child.geometry.isBufferGeometry) {
          child.geometry = new THREE.BufferGeometry().fromGeometry(child.geometry);
        }
        // Ensure geometry is triangulated
        if (child.geometry.index) {
          child.geometry = BufferGeometryUtils.toTrianglesDrawMode(child.geometry, THREE.TriangleStripDrawMode);
        }
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
        Logger.log(`[Application] Processed geometry for mesh: ${child.name || child.uuid}. Triangles: ${child.geometry.index ? child.geometry.index.count / 3 : child.geometry.attributes.position.count / 3}`);
      }
    });

    // Load attachment state
    this.loadAttachmentState();
  };

  handleKeyPress = ({ code }) => {
    switch(code) {
      case 'KeyF':
        const selectedObject = this.stateManager.getSceneState().selectedObject;
        if (selectedObject) {
          this.frameObject(selectedObject);
        }
        break;
      case 'KeyR':
        // Reset camera to initial transform
        this.camera.position.set(2, 1.2, 3);
        this.controls.target.set(0, 0.8, 0);
        this.controls.update();
        break;
      case 'Delete':
        this.clearSelection();
        break;
    }
  };

  handleContextMenu = ({ clientX, clientY }) => {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const rendererDom = this.rendererManager?.renderer?.domElement;
    if (!rendererDom) return;
    const rect = rendererDom.getBoundingClientRect();

    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, this.camera);
    const scene = this.sceneManager?.getScene();
    if (!scene) return;
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      if (this.inspectorApi && this.inspectorApi.selectObject) {
        this.inspectorApi.selectObject(clickedObject);
      }
      if (this.inspectorApi && this.inspectorApi.showContextMenu) {
        this.inspectorApi.showContextMenu(clientX, clientY);
      }
    }
  };

  clearSelection = () => {
    this.stateManager?.setSelectedObject(null);
    this.rendererManager?.setOutlineObjects([]);
    this.sceneManager?.updateBBox(null);
    if(this.inspectorApi?.refresh) this.inspectorApi.refresh();
  };

  updateFilenameDisplay = (filename) => {
    Logger.log('[Application] updateFilenameDisplay called with:', filename);
    const filenameDisplayEl = this.dom?.get('filename-display');
    if (filenameDisplayEl) {
      filenameDisplayEl.textContent = filename;
      Logger.log('[Application] filenameDisplayEl.textContent set to:', filenameDisplayEl.textContent);
    } else {
      Logger.warn('[Application] filename-display element not found in DOM.');
    }
  };

  applyModelSettings = (model) => {
    // If shadows are enabled, set cast/receive flags for new meshes
    const shadowsEnabled = this.dom?.get('toggle-shadows')?.checked;
    if (shadowsEnabled) {
      model.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
    }

    // Apply material override default behavior if any UI toggles are set
    const matOverrideEl = this.dom?.get('mat-override');
    const wireframeEl = this.dom?.get('toggle-wireframe');
    const envIntensityEl = this.dom?.get('env-intensity');
    const lightOnlyEl = this.dom?.get('toggle-lightonly');

    const overrideType = matOverrideEl?.value || 'none';
    const wire = !!(wireframeEl && wireframeEl.checked);
    const envI = envIntensityEl ? Number(envIntensityEl.value) : 1;

    // Dynamically import Materials and apply
    import('../Materials.js').then(({ applyMaterialOverride, setLightOnly }) => {
      applyMaterialOverride(model, { overrideType, wire, envIntensity: envI });
      if (lightOnlyEl) {
        setLightOnly(model, lightOnlyEl.checked);
      }
    });
  };

  flipUVs = (flip) => {
    const loadedModels = this.stateManager?.getSceneState().models;
    if (!loadedModels || loadedModels.length === 0) return;

    loadedModels.forEach(model => {
      model.traverse(obj => {
        if (obj.isMesh && obj.geometry && obj.geometry.attributes.uv) {
          const uvAttribute = obj.geometry.attributes.uv;
          const uuid = obj.uuid;
          const originalUVs = this.stateManager?.getAppState().originalUVs;

          if (flip) {
            // Store original UVs if not already stored
            if (originalUVs && !originalUVs.has(uuid)) {
              originalUVs.set(uuid, uvAttribute.array.slice()); // Create a copy
              this.stateManager?.updateAppState({ originalUVs }); // Update state
            }
            // Apply flip: u = 1 - u
            for (let i = 0; i < uvAttribute.array.length; i += 2) {
              uvAttribute.array[i] = 1 - uvAttribute.array[i];
            }
          } else {
            // Restore original UVs if stored
            if (originalUVs && originalUVs.has(uuid)) {
              const original = originalUVs.get(uuid);
              for (let i = 0; i < uvAttribute.array.length; i++) {
                uvAttribute.array[i] = original[i];
              }
            }
          }
          uvAttribute.needsUpdate = true;
        }
      });
    });
    this.dom?.showToast(flip ? t('uvs_flipped') : t('uvs_restored'));
  };

  loadAttachmentState = () => {
    const loadedModels = this.stateManager?.getSceneState().models;
    if (!loadedModels || loadedModels.length === 0) return;

    try {
      const savedState = localStorage.getItem('threejs_model_attachments');
      if (!savedState) return;
 
       const attachments = JSON.parse(savedState);
       Logger.log('[Application] Loading attachment state:', attachments);
 
       attachments.forEach(att => {
         let childObject = null;
         let parentBone = null;

        // Search for child and parent in all loaded models
        for (const model of loadedModels) {
          childObject = model.getObjectByProperty('uuid', att.childUuid);
          if (childObject) break;
        }
        for (const model of loadedModels) {
          parentBone = model.getObjectByProperty('uuid', att.parentBoneUuid);
          if (parentBone) break;
        }

        if (childObject && parentBone && parentBone.isBone) {
          // Detach from current parent if any
          if (childObject.parent) {
            childObject.parent.remove(childObject);
          }
          
          // Attach to the bone
          parentBone.add(childObject); // Use add, as attach() would recalculate world position.
                                      // We want to restore local position relative to bone
          
          // Restore local transform
          childObject.position.fromArray(att.localPosition);
          childObject.quaternion.fromArray(att.localQuaternion);
          childObject.scale.fromArray(att.localScale);
          
          childObject.updateMatrix();
          childObject.updateMatrixWorld(true); // Force update world matrix for attached object
          Logger.log(`[Application] Restored attachment: ${childObject.name} to ${parentBone.name}`);
        } else {
          Logger.warn(`[Application] Failed to restore attachment for child ${att.childUuid} to bone ${att.parentBoneUuid}. Objects not found or parent is not a bone.`);
        }
      });
      // After loading all attachments, refresh inspector to reflect new hierarchy
      if (this.inspectorApi && typeof this.inspectorApi.refresh === 'function') this.inspectorApi.refresh();
      this.dom?.showToast(t('attachments_loaded'));
    } catch (e) {
      Logger.warn('[Application] Failed to load attachment state from localStorage:', e);
      this.dom?.showToast(t('error_loading_attachments', { message: e.message }));
    }
  };

  // Utility methods
  loadModel = async (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    
    this.dom?.showOverlay(
      extension === 'gltf' || extension === 'glb' ? t('loading_gltf_glb') :
      extension === 'fbx' ? t('loading_fbx') : t('loading_obj'),
      file.name
    );
    
    try {
      const model = await this.assetLoader?.loadModel(file);
      this.dom?.hideOverlay();
      return model;
    } catch (err) {
      this.dom?.hideOverlay();
      throw err;
    }
  };

  loadDefaultModel = async () => {
    try {
      Logger.log('[Application] Loading default model: model/devilgirl.fbx');
      
      const defaultModelPath = 'model/devilgirl.fbx';
      const response = await fetch(defaultModelPath);
      
      if (!response.ok) {
        throw new Error(`Failed to load default model: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const defaultModelFile = new File([arrayBuffer], 'devilgirl.fbx', { type: 'application/octet-stream' });
      
      this.dom?.showOverlay(t('loading_model'), 'devilgirl.fbx');
      
      const model = await this.loadModel(defaultModelFile);
      this.dom?.hideOverlay();
      
      Logger.log('[Application] Default model loaded successfully:', model);
      if (model) {
        const box = new THREE.Box3().setFromObject(model);
        Logger.log('[Application] Default model bounding box:', box);
        Logger.log('[Application] Default model position:', model.position);
      }
    } catch (error) {
      Logger.error('[Application] Failed to load default model:', error);
    }
  };

  frameObject = (objects) => {
    if (!objects || (Array.isArray(objects) && objects.length === 0)) return;

    const targetObjects = Array.isArray(objects) ? objects : [objects];

    const box = new THREE.Box3();
    targetObjects.forEach(obj => {
      if (obj instanceof THREE.Object3D) {
        box.union(new THREE.Box3().setFromObject(obj));
      }
    });

    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (!isFinite(sphere.radius)) return;
    
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = sphere.radius / Math.sin(Math.min(Math.PI / 4, fov / 2));
    const dirTo = new THREE.Vector3(0, 0.2, 1).normalize();
    
    this.camera.position.copy(sphere.center.clone().addScaledVector(dirTo, dist * 1.2));
    this.controls.target.copy(sphere.center);
    this.controls.update();
  };

  updateStatsUI = () => {
    const polyCountEl = this.dom?.get('poly-count');
    const objCountEl = this.dom?.get('obj-count');
    
    let tris = 0, objs = 0;
    const scene = this._getSafeScene(); // Use _getSafeScene
    if (scene) {
      scene.traverse(o => {
        objs++;
      if (o.isMesh && o.geometry) {
        const index = o.geometry.index;
        const pos = o.geometry.attributes.position;
        if (index) tris += index.count / 3;
        else if (pos) tris += pos.count / 3;
      }
    });
    }
    
    if (polyCountEl) polyCountEl.textContent = new Intl.NumberFormat(getCurrentLanguage()).format(tris) + ' ' + t('tris');
    if (objCountEl) objCountEl.textContent = objs;
  };

  updateAnimTimeUI = (time, dur) => {
    const t = Math.max(0, Math.min(time, dur || 0));
    const d = dur || 0;
    const animTime = this.dom?.get('anim-time');
    const animProgress = this.dom?.get('anim-progress');
    
    if (animTime) animTime.textContent = `${t.toFixed(2)} / ${d.toFixed(2)}s`;
    if (animProgress) animProgress.value = d ? (t / d) : 0;
  };

  setAnimSectionVisible = (visible) => {
    const animSection = this.dom?.query('details[data-sec="anim"]');
    if (!animSection) return;
    animSection.style.display = visible ? '' : 'none';
  };

  setInspectorOpen = (open) => {
    const inspectorEl = this.dom?.get('scene-inspector');
    if (!inspectorEl) return;
    inspectorEl.classList.toggle('right-0', !!open);
    inspectorEl.classList.toggle('right-[-360px]', !open);
    
    this.stateManager?.updateUIState({ isInspectorOpen: open });
  };

  handleResize = () => {
    const size = this.dom?.getWindowSize();
    if (size) {
      this.rendererManager?.setSize(size.width, size.height);
      this.camera.aspect = size.width / size.height;
      this.camera.updateProjectionMatrix();
    }
  };

  handleSettingsChanged = (settings) => {
    if (settings.flipUV !== undefined) {
      this.flipUVs(settings.flipUV);
    }
    if (settings.transform) {
      if (settings.transform.enabled !== undefined) {
        this.transformControls?.enable(settings.transform.enabled);
      }
      if (settings.transform.mode) {
        this.transformControls?.setMode(settings.transform.mode);
      }
      if (settings.transform.snap) {
        const { enabled, translation, rotation, scale } = settings.transform.snap;
        this.transformControls?.setTranslationSnap(enabled ? translation : null);
        this.transformControls?.setRotationSnap(enabled ? rotation : null);
        this.transformControls?.setScaleSnap(enabled ? scale : null);
      }
    }
    if (settings.gridVisible !== undefined) {
      this.sceneManager?.setGridVisible(settings.gridVisible);
    }
    if (settings.background) {
      this.sceneManager?.setBackground(settings.background);
    }
  };

  handleRenderSettingsChanged = (settings) => {
    if (settings.exposure !== undefined) {
      this.renderSettings?.applyExposure(settings.exposure);
    }
    if (settings.fxaa !== undefined) {
      this.renderSettings?.enableFXAA(settings.fxaa);
    }
    if (settings.toneMapping) {
      this.renderSettings?.applyToneMapping(settings.toneMapping);
    }
    const loadedModels = this.stateManager?.getSceneState().models;
    loadedModels?.forEach(model => {
      this.applyModelSettings(model); // Reapply all model settings
    });
  };

  handleLightingSettingsChanged = (settings) => {
    if (settings.directional) {
      if (settings.directional.intensity !== undefined) {
        this.lightingManager?.setDirIntensity(settings.directional.intensity);
      }
      if (settings.directional.angle !== undefined) {
        this.lightingManager?.setDirFromAngle(settings.directional.angle);
      }
      if (settings.directional.softness !== undefined) {
        this.lightingManager?.setDirSoftness(settings.directional.softness);
      }
    }
    if (settings.environment) {
      if (settings.environment.intensity !== undefined) {
        const scene = this._getSafeScene(); // Use _getSafeScene
        this.sceneManager?.applyEnvIntensity(settings.environment.intensity, this.stateManager?.getSceneState().models.length > 0 ? this.stateManager?.getSceneState().models : (scene || null));
      }
    }
  };

  resetRender = () => {
    const exposureEl = this.dom?.get('exposure');
    if (exposureEl) {
      exposureEl.value = 1;
      try { this.renderSettings?.applyExposure(1); } catch(e){ Logger.error(e); }
      const exposureValEl = this.dom?.get('exposure-val');
      if (exposureValEl) exposureValEl.textContent = (1).toFixed(2);
    }
    const toneMappingEl = this.dom?.get('tone-mapping');
    if (toneMappingEl) {
      toneMappingEl.value = 'ACES';
      try { this.renderSettings?.applyToneMapping('ACES'); } catch(e){ Logger.error(e); }
    }
    this.dom?.showToast(t('reset_render'));
  };

  resetDir = () => {
    const dirIntensityEl = this.dom?.get('dir-intensity');
    const dirAngleEl = this.dom?.get('dir-angle');
    const dirSoftnessEl = this.dom?.get('dir-softness');
    const dirIntensityVal = this.dom?.get('dir-intensity-val');
    const dirAngleVal = this.dom?.get('dir-angle-val');
    const dirSoftnessVal = this.dom?.get('dir-softness-val');
 
     if (dirIntensityEl) { dirIntensityEl.value = 0.9; try { this.lightingManager?.setDirIntensity(0.9); } catch(e){ Logger.error(e); } if (dirIntensityVal) dirIntensityVal.textContent = (0.9).toFixed(2); }
     if (dirAngleEl) { dirAngleEl.value = 34; try { this.lightingManager?.setDirFromAngle(34); } catch(e){ Logger.error(e); } if (dirAngleVal) dirAngleVal.textContent = `${Math.round(34)}°`; }
     if (dirSoftnessEl) { dirSoftnessEl.value = 1; try { this.lightingManager?.setDirSoftness(1); } catch(e){ Logger.error(e); } if (dirSoftnessVal) dirSoftnessVal.textContent = (1).toFixed(1); }
 
     this.dom?.showToast(t('reset_directional_light'));
  };

  resetEnv = () => {
    const envIntensityEl = this.dom?.get('env-intensity');
    const envIntensityVal = this.dom?.get('env-intensity-val');
    const hdriUrlInput = this.dom?.get('hdri-url');

    if (envIntensityEl) { envIntensityEl.value = 1; try { const scene = this._getSafeScene(); this.sceneManager?.applyEnvIntensity(1, this.stateManager?.getSceneState().models.length > 0 ? this.stateManager?.getSceneState().models : (scene || null)); } catch(e){ Logger.error(e); } if (envIntensityVal) envIntensityVal.textContent = (1).toFixed(2); }
    if (hdriUrlInput) { hdriUrlInput.value = ''; }
    try { this.sceneManager?.setEnvironment(null); } catch(e){ Logger.error(e); }
    this.dom?.showToast(t('reset_environment'));
  };

  resetGizmos = () => {
    const toggleTransformEl = this.dom?.get('toggle-transform');
    const transformModeEl = this.dom?.get('transform-mode');
    const toggleSnapEl = this.dom?.get('toggle-snap');
    const snapPosEl = this.dom?.get('snap-pos');
    const snapRotEl = this.dom?.get('snap-rot');
    const snapScaleEl = this.dom?.get('snap-scale');
    const measureToggleEl = this.dom?.get('measure-toggle');
    const measureOutEl = this.dom?.get('measure-out');

    if (toggleTransformEl) { toggleTransformEl.checked = false; }
    try { this.transformControls?.enable(false); this.transformControls?.detach(); } catch(e){ Logger.error(e); }
    if (transformModeEl) transformModeEl.value = 'translate';
    if (toggleSnapEl) toggleSnapEl.checked = false;
    try { this.transformControls?.setTranslationSnap(null); this.transformControls?.setRotationSnap(null); this.transformControls?.setScaleSnap(null); } catch(e){ Logger.error(e); }

    if (snapPosEl) snapPosEl.value = 0.1;
    if (snapRotEl) snapRotEl.value = 15;
    if (snapScaleEl) snapScaleEl.value = 0.1;

    try { this.sceneManager?.clearMeasure(); } catch(e){ Logger.error(e); }
    if (measureToggleEl) measureToggleEl.classList.remove('ok');
    if (measureOutEl) measureOutEl.textContent = '—';

    this.dom?.showToast(t('reset_gizmos'));
  };

  resetAll = () => {
    // toggles
    const toggleShadowsEl = this.dom?.get('toggle-shadows');
    const toggleFXAAEl = this.dom?.get('toggle-fxaa');
    const toggleLightOnlyEl = this.dom?.get('toggle-lightonly');
    const toggleGridEl = this.dom?.get('toggle-grid');
    const toggleFlipUVEl = this.dom?.get('toggle-flipuv');

    if (toggleShadowsEl) { toggleShadowsEl.checked = false; toggleShadowsEl.dispatchEvent(new Event('change')); }
    if (toggleFXAAEl) { toggleFXAAEl.checked = true; toggleFXAAEl.dispatchEvent(new Event('change')); }
    if (toggleLightOnlyEl) { toggleLightOnlyEl.checked = false; toggleLightOnlyEl.dispatchEvent(new Event('change')); }
    if (toggleGridEl) { toggleGridEl.checked = true; toggleGridEl.dispatchEvent(new Event('change')); }
    if (toggleFlipUVEl) { toggleFlipUVEl.checked = false; toggleFlipUVEl.dispatchEvent(new Event('change')); }

    // background & hdri
    const bgSelectEl = this.dom?.get('bg-select');
    const bgColorEl = this.dom?.get('bg-color');
    const hdriUrlInput = this.dom?.get('hdri-url');
    if (bgSelectEl) { bgSelectEl.value = 'white'; }
    if (bgColorEl) { bgColorEl.value = '#ffffff'; }
    try { this.sceneManager?.setBackground('#ffffff'); } catch(e){ Logger.error(e); }
    if (hdriUrlInput) hdriUrlInput.value = '';
    try { this.sceneManager?.setEnvironment(null); } catch(e){ Logger.error(e); }

    // materials
    const matOverrideEl = this.dom?.get('mat-override');
    const toggleWireframeEl = this.dom?.get('toggle-wireframe');
    if (matOverrideEl) matOverrideEl.value = 'none';
    if (toggleWireframeEl) toggleWireframeEl.checked = false;
    try {
      const loadedModels = this.stateManager?.getSceneState().models;
      loadedModels?.forEach(model => {
        import('../Materials.js').then(({ applyMaterialOverride }) => {
          applyMaterialOverride(model, { overrideType: (matOverrideEl?.value || 'none'), wire: !!toggleWireframeEl?.checked, envIntensity: Number(document.getElementById('env-intensity')?.value || 1) });
        });
      });
    } catch(e){ Logger.error(e); }

    // sections / helpers
    this.resetRender();
    this.resetDir();
    this.resetEnv();
    this.resetGizmos();

    // camera & selection (clear outlines, detach gizmos)
    try { this.rendererManager?.setOutlineObjects([]); } catch(e){ Logger.error(e); }
    try { const scene = this._getSafeScene(); this.frameObject(this.stateManager?.getSceneState().models.length > 0 ? this.stateManager?.getSceneState().models : (scene || null)); } catch(e){ Logger.error(e); }

    // persist defaults by clearing settings store
    try { this.settings?.clear(); } catch(e){ Logger.error(e); }
    this.dom?.showToast(t('settings_reset_to_defaults'));
  };

  handleCameraPreset = (view) => {
    const models = this.stateManager?.getSceneState().models;
    const scene = this._getSafeScene(); // Use _getSafeScene
    const targetObjects = models && models.length > 0 ? models : (scene ? [scene] : []);
    
    const box = new THREE.Box3();
    targetObjects.forEach(obj => {
      box.union(new THREE.Box3().setFromObject(obj));
    });

    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const center = sphere.center;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = sphere.radius / Math.sin(Math.min(Math.PI / 4, fov / 2));
    const m = dist * 1.2;
    
    let dirv = new THREE.Vector3(1, 1, 1);
    switch (view) {
      case 'front': dirv.set(0, 0, 1); break;
      case 'back': dirv.set(0, 0, -1); break;
      case 'left': dirv.set(-1, 0, 0); break;
      case 'right': dirv.set(1, 0, 0); break;
      case 'top': dirv.set(0, 1, 0); break;
      case 'bottom': dirv.set(0, -1, 0); break;
      case 'iso':
      default: dirv.set(1, 1, 1); break;
    }
    
    this.camera.position.copy(center.clone().addScaledVector(dirv.normalize(), m));
    this.controls.target.copy(center);
    this.controls.update();
  };

  /**
   * Safely gets the THREE.Scene instance from SceneManager.
   * @returns {THREE.Scene|null} The scene instance or null if not available.
   * @private
   */
  _getSafeScene = () => {
    if (!this.sceneManager) {
      Logger.warn('[Application] SceneManager is not initialized when trying to get scene.');
      return null;
    }
    return this.sceneManager.getScene();
  };

  clearScene = () => {
    const models = [...(this.stateManager?.getSceneState().models || [])];
    models.forEach(model => {
      this.sceneManager?.remove(model);
      this.stateManager?.removeModel(model);
    });
    
    this.assetLoader?.clearTextures();
    this.dom?.showToast(t('scene_cleared'));
  };

  showToast = (msg) => {
    try {
      if (typeof this.dom !== 'undefined' && this.dom && this.dom.showToast) {
        this.dom.showToast(msg);
        return;
      }
    } catch(e){ Logger.error(e); }
    
    const toastEl = this.dom.get('toast');
    if (toastEl){
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      setTimeout(()=> toastEl.classList.remove('show'), 2600);
    }
  };

  reportRuntimeError = (msg, detail) => {
    Logger.error('[RuntimeError]', msg, detail);
    try {
      const toastEl = this.dom.get('toast');
      if (toastEl){
        const text = msg && msg.message ? msg.message : (typeof msg === 'string' ? msg : JSON.stringify(msg));
        toastEl.textContent = 'Error: ' + text;
        toastEl.classList.add('show');
        setTimeout(()=> toastEl.classList.remove('show'), 6000);
      }
    } catch(e){ Logger.error(e); }
  };

  // Animation loop
  animate = () => {
    if (!this.isRunning) return;
    
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    
    // Update animation
    this.animationManager?.update(dt);
    
    // Update loaded models
    const models = this.stateManager?.getSceneState().models;
    models?.forEach(model => {
      if (model) {
        model.updateMatrixWorld(true);
      }
    });
    
    // Update controls
    this.controls.update();
    
    // Render
    const scene = this._getSafeScene(); // Use _getSafeScene
    if (scene) {
      this.rendererManager?.render(scene, this.camera);
    }
    
    // Update FPS
    if (this.dom?.get('fps')) {
      const now = performance.now();
      if (!this.lastFpsUpdate) this.lastFpsUpdate = now;
      if (now - this.lastFpsUpdate >= 500) {
        const fps = Math.round(1 / dt);
        const fpsEl = this.dom?.get('fps');
        if (fpsEl) {
          fpsEl.textContent = String(fps);
        }
        this.lastFpsUpdate = now;
      }
    }
  };

  start = () => {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.animate();
  };

  stop = () => {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  dispose = () => {
    this.stop();
    
    if (this.uiBindings) {
      this.uiBindings.dispose();
      this.uiBindings = null;
    }
    
    // Clean up resources
    this.assetLoader?.dispose();
    
    // Clean up InputHandler
    if (this.inputHandler) {
      this.inputHandler.dispose();
      this.inputHandler = null;
    }
    
    // Remove event listeners
    this.dom?.offResize(this.handleResize);
    
    // Save state
    this.saveAttachmentState();
  };

  saveAttachmentState = () => {
    const models = this.stateManager?.getSceneState().models;
    if (!models || models.length === 0) {
      localStorage.removeItem('threejs_model_attachments');
      return;
    }

    const attachments = [];
    models.forEach(model => {
      model.traverse(obj => {
        if (obj.parent && obj.parent.isBone) {
          attachments.push({
            childUuid: obj.uuid,
            parentBoneUuid: obj.parent.uuid,
            localPosition: obj.position.toArray(),
            localQuaternion: obj.quaternion.toArray(),
            localScale: obj.scale.toArray()
          });
        }
      });
    });

    try {
      localStorage.setItem('threejs_model_attachments', JSON.stringify(attachments));
      Logger.log('[Application] Attachment state saved:', attachments);
    } catch (e) {
      Logger.warn('[Application] Failed to save attachment state to localStorage:', e);
    }
  };
}