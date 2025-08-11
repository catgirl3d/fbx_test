import * as THREE from 'three';
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
  constructor({ canvas, antialias = false, alpha = true, powerPreference = 'high-performance' } = {}) {
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
    try { this.composer.setSize(window.innerWidth, window.innerHeight); } catch(e){}
    this.renderPass = null; // created on first render when scene/camera are available
    this.outlinePass = null;
    this.fxaaPass = null;

    // FXAA enabled by default (matches original app)
    this._fxaaEnabled = true;

    // axis overlay scene & camera
    this.axisScene = new THREE.Scene();
    this.axisCam = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    this.axisCam.position.set(0,0,2);
    this.axisHelper = new THREE.AxesHelper(1.2);
    this.axisScene.add(this.axisHelper);

    this.navSize = 96;
    this.navPad = 12;

    this._outlineTargets = [];
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
    if (this.outlinePass) this.outlinePass.selectedObjects = this._outlineTargets;
  }

  render(scene, camera) {
    // lazy init passes so we can pass scene/camera from caller
    if (!this.renderPass) this.initPasses(scene, camera);

    // debug: log exposure/toneMapping prior to render
    try {
      if (typeof console !== 'undefined') {
        console.debug('[renderer] toneMapping=', this.renderer.toneMapping, 'exposure=', this.renderer.toneMappingExposure);
      }
    } catch (e) {}

    // ensure full viewport for main composer
    const w = window.innerWidth, h = window.innerHeight;
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
    try { this.renderer.toneMappingExposure = this.exposure; } catch(e){ console.warn('setExposure failed', e); }
  }

  dispose() {
    // dispose composer passes & renderer resources
    try {
      this.composer.passes.forEach(p => {
        if (p.dispose) p.dispose();
      });
    } catch (e) {}
    this.renderer.dispose();
  }
}