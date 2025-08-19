import * as THREE from 'three';
import Logger from './core/Logger.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/OutlinePass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/shaders/FXAAShader.js';

/**
 * RendererManager encapsulates WebGLRenderer + EffectComposer and related passes.
 * Usage:
 *   const rm = new RendererManager({ canvas });
 *   rm.setSize(window.innerWidth, window.innerHeight);
 *   rm.render(scene, camera);
 */
export class RendererManager {
  /**
   * @param {Object} opts - Options
   * @param {HTMLCanvasElement} opts.canvas - Canvas element
   * @param {boolean} [opts.antialias=false] - Enable antialiasing
   * @param {boolean} [opts.alpha=true] - Enable alpha
   * @param {string} [opts.powerPreference='high-performance'] - Power preference
   * @param {THREE.Scene} [opts.axisScene] - Optional axis scene
   * @param {THREE.PerspectiveCamera} [opts.axisCam] - Optional axis camera
   */
  constructor({
    canvas,
    antialias = false,
    alpha = true,
    powerPreference = 'high-performance',
    axisScene = null,
    axisCam = null
  } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias, alpha, powerPreference });
    // updated: use outputColorSpace (three r152+), outputEncoding removed
    if ('outputColorSpace' in this.renderer) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;

    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);

    // track exposure locally (helper API)
    this.exposure = this.renderer.toneMappingExposure ?? 1.0;

    // composer and passes
    this.composer = new EffectComposer(this.renderer);
    // ensure composer has initial size matching renderer
    try {
      this.composer.setSize(window.innerWidth, window.innerHeight);
      Logger.log(`[Renderer] Initial composer size set to: ${window.innerWidth}x${window.innerHeight}`);
    } catch(e){ Logger.error('[Renderer] Failed to set composer size:', e); }
    this.renderPass = null; // created on first render when scene/camera are available
    this.outlinePass = null;
    this.fxaaPass = null;

    // FXAA enabled by default (matches original app)
    this._fxaaEnabled = true;

    // axis overlay scene & camera
    this.axisScene = axisScene || new THREE.Scene();
    this.axisCam = axisCam || new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    this.axisCam.position.set(0,0,2);
    this.axisHelper = new THREE.AxesHelper(1.2);
    this.axisScene.add(this.axisHelper);

    this.navSize = 96;
    this.navPad = 12;

    this._outlineTargets = [];
    this.faceOutlines = null;
  }

  initPasses(scene, camera) {
    if (!this.renderPass) {
      this.renderPass = new RenderPass(scene, camera);
      this.composer.addPass(this.renderPass);

      this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
      // tuned defaults (kept similar to original)
      this.outlinePass.edgeStrength = 12.0;
      this.outlinePass.edgeGlow = 1.0;
      this.outlinePass.edgeThickness = 3.0;
      this.outlinePass.pulsePeriod = 0.0;
      this.outlinePass.visibleEdgeColor.set(0xa7d3ff);
      this.outlinePass.hiddenEdgeColor.set(0x0);
      this.composer.addPass(this.outlinePass);

      this.fxaaPass = new ShaderPass(FXAAShader);
      this.fxaaPass.material.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
      this.fxaaPass.enabled = this._fxaaEnabled;
      // Make FXAA the final pass to screen (ensure post-processing outputs to canvas)
      this.fxaaPass.renderToScreen = true;
      this.composer.addPass(this.fxaaPass);
    }
  }

  setSize(w, h) {
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    if (this.outlinePass) this.outlinePass.setSize(w, h);
    if (this.fxaaPass) this.fxaaPass.material.uniforms['resolution'].value.set(1 / w, 1 / h);
    Logger.log(`[Renderer] setSize called with: ${w}x${h}. Canvas actual size: ${this.canvas.offsetWidth}x${this.canvas.offsetHeight}`);
  }

  setPixelRatio(r) {
    this.pixelRatio = r;
    this.renderer.setPixelRatio(r);
  }

  enableFXAA(enabled) {
    this._fxaaEnabled = !!enabled;
    if (this.fxaaPass) this.fxaaPass.enabled = this._fxaaEnabled;
  }

  setOutlineObjects(list) {
    this._outlineTargets = Array.isArray(list) ? list : (list ? [list] : []);
    if (this.outlinePass) {
      this.outlinePass.selectedObjects = this._outlineTargets.filter(o => o instanceof THREE.Object3D);
    }
  }

  setFaceOutlines(faces) {
    this.clearFaceOutlines();
 
    if (!faces || faces.length === 0) return;
 
    const lineVertices = [];
    faces.forEach(({ mesh, faceIndex }, idx) => {
        if (!mesh || !mesh.geometry) {
          Logger.warn('[Renderer] setFaceOutlines: invalid mesh at index', idx);
          return;
        }
        const geometry = mesh.geometry;
        const position = geometry.attributes && geometry.attributes.position;
        const index = geometry.index;
 
        if (!position) {
          Logger.warn('[Renderer] setFaceOutlines: mesh has no position attribute, skipping', mesh.name || mesh.uuid);
          return;
        }
 
        if (faceIndex === null || faceIndex === undefined || !Number.isFinite(faceIndex)) {
          Logger.warn('[Renderer] setFaceOutlines: invalid faceIndex for mesh', mesh.name || mesh.uuid, faceIndex);
          return;
        }
 
        let a, b, c;
 
        if (index && index.count) {
          // Indexed geometry: indices reference vertices in the position attribute
          const triStart = faceIndex * 3;
          if (triStart + 2 >= index.count) {
            Logger.warn('[Renderer] setFaceOutlines: faceIndex out of range, skipping', { mesh: mesh.name || mesh.uuid, faceIndex, indexCount: index.count });
            return;
          }
 
          try {
            // read three indices for the triangle
            a = index.getX(triStart);
            b = index.getX(triStart + 1);
            c = index.getX(triStart + 2);
          } catch (e) {
            const arr = index.array;
            if (arr && arr.length > triStart + 2) {
              a = arr[triStart];
              b = arr[triStart + 1];
              c = arr[triStart + 2];
            } else {
              Logger.warn('[Renderer] setFaceOutlines: failed to read indices for mesh', mesh.name || mesh.uuid, e);
              return;
            }
          }
        } else {
          // Non-indexed geometry: each triangle's vertices are consecutive in the position attribute
          const posCount = position.count || (position.array ? position.array.length / 3 : 0);
          const triStart = faceIndex * 3;
          if (triStart + 2 >= posCount) {
            Logger.warn('[Renderer] setFaceOutlines: non-indexed faceIndex out of range, skipping', { mesh: mesh.name || mesh.uuid, faceIndex, posCount });
            return;
          }
          Logger.log('[Renderer] setFaceOutlines: using non-indexed fallback for mesh', mesh.name || mesh.uuid);
          a = triStart;
          b = triStart + 1;
          c = triStart + 2;
        }
 
        const posCount = position.count || (position.array ? position.array.length / 3 : 0);
        if (a >= posCount || b >= posCount || c >= posCount) {
          Logger.warn('[Renderer] setFaceOutlines: vertex index out of range, skipping', { a, b, c, posCount, mesh: mesh.name || mesh.uuid });
          return;
        }
 
        const vA = new THREE.Vector3().fromBufferAttribute(position, a);
        const vB = new THREE.Vector3().fromBufferAttribute(position, b);
        const vC = new THREE.Vector3().fromBufferAttribute(position, c);
 
        mesh.localToWorld(vA);
        mesh.localToWorld(vB);
        mesh.localToWorld(vC);
 
        lineVertices.push(vA, vB, vB, vC, vC, vA);
    });
 
    if (lineVertices.length === 0) {
      // Nothing valid to draw
      return;
    }
 
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(lineVertices);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    this.faceOutlines = new THREE.LineSegments(lineGeometry, lineMaterial);
    
    const scene = this.renderPass && this.renderPass.scene;
    if (scene) {
        scene.add(this.faceOutlines);
    } else {
        Logger.warn('[Renderer] setFaceOutlines: renderPass.scene not available, cannot add face outlines');
    }
  }

  clearFaceOutlines() {
    if (this.faceOutlines) {
        const scene = this.renderPass.scene;
        if (scene) {
            scene.remove(this.faceOutlines);
        }
        this.faceOutlines.geometry.dispose();
        this.faceOutlines.material.dispose();
        this.faceOutlines = null;
    }
  }
 
  render(scene, camera) {
    // lazy init passes so we can pass scene/camera from caller
    if (!this.renderPass) this.initPasses(scene, camera);


    // ensure full viewport for main composer
    const w = window.innerWidth, h = window.innerHeight;
    Logger.log(`[Renderer] Render loop window dimensions: ${w}x${h}`);
    this.renderer.setViewport(0,0,w,h);
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    this.composer.render();

    // axes overlay in corner
    this.renderer.setScissorTest(true);
    const vx = window.innerWidth - this.navSize - this.navPad;
    const vy = this.navPad;
    this.renderer.setViewport(vx, vy, this.navSize, this.navSize);
    this.renderer.setScissor(vx, vy, this.navSize, this.navSize);
    // copy camera rotation so axes follow orientation
    this.axisCam.quaternion.copy(camera.quaternion);
    this.renderer.render(this.axisScene, this.axisCam);
    this.renderer.setScissorTest(false);
  }

  // convenience API to set exposure centrally
  setExposure(v){
    this.exposure = Number(v) || 1;
    try { this.renderer.toneMappingExposure = this.exposure; } catch(e){ Logger.warn('[Renderer] Failed to set exposure:', e); }
  }

  dispose() {
    // dispose composer passes & renderer resources
    try {
      this.composer.passes.forEach(p => {
        if (p.dispose) p.dispose();
      });
    } catch (e) { Logger.error('[Renderer] Error disposing renderer:', e); }
    this.renderer.dispose();

    this.clearFaceOutlines();
 
    // dispose axis scene resources
    if (this.axisScene) {
      this.axisScene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
  }
}