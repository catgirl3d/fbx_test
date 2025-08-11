/**
 * RenderSettings
 * Centralizes renderer-related settings (exposure, tone mapping, FXAA)
 * and persists them via provided Settings instance.
 *
 * Usage:
 *   import RenderSettings from './RenderSettings.js';
 *   const rs = new RenderSettings(rendererMgr, settings);
 *   rs.applyExposure(1.2);
 *   rs.applyToneMapping('ACES');
 *   rs.enableFXAA(true);
 *
 * It does not directly bind UI elements — the bootstrap (`src/app.js`) wires UI -> this API.
 */

import * as THREE from 'three';

const TM_MAP = {
  'ACES': THREE.ACESFilmicToneMapping,
  'Linear': THREE.LinearToneMapping,
  'Reinhard': THREE.ReinhardToneMapping,
  'Cineon': THREE.CineonToneMapping,
  'Neutral': THREE.NeutralToneMapping,
  'None': THREE.NoToneMapping
};

export class RenderSettings {
  /**
   * @param {Object} opts - Options
   * @param {RendererManager} opts.rendererMgr - instance of RendererManager (has renderer and composer)
   * @param {Settings} [opts.settings] - optional Settings instance for persistence
   */
  constructor({ rendererMgr, settings = null } = {}) {
    this.rendererMgr = rendererMgr;
    this.settings = settings;
    this._exposure = rendererMgr.renderer?.toneMappingExposure ?? 1.0;
    this._tone = Object.keys(TM_MAP).find(k => TM_MAP[k] === (rendererMgr.renderer?.toneMapping)) || 'ACES';
    this._fxaa = true;
    // try to read persisted values
    if (this.settings) {
      const s = this.settings.get('render', {});
      if (s.exposure !== undefined) this._exposure = s.exposure;
      if (s.tonemapping) this._tone = s.tonemapping;
      if (s.fxaa !== undefined) this._fxaa = s.fxaa;
    }
    // apply to renderer
    this.applyExposure(this._exposure);
    this.applyToneMapping(this._tone);
    this.enableFXAA(this._fxaa);
  }

  applyExposure(v) {
    const val = Number(v) || 0;
    this._exposure = val;
    try {
      if (this.rendererMgr && this.rendererMgr.setExposure) {
        // prefer renderer manager helper
        this.rendererMgr.setExposure(val);
      } else if (this.rendererMgr && this.rendererMgr.renderer) {
        this.rendererMgr.renderer.toneMappingExposure = val;
      }
    } catch (e) {
      console.warn('[RenderSettings] applyExposure failed', e);
    }
    this._save();
  }

  applyToneMapping(key) {
    const k = key || 'ACES';
    const tm = TM_MAP[k] || THREE.ACESFilmicToneMapping;
    try {
      if (this.rendererMgr && this.rendererMgr.renderer) {
        this.rendererMgr.renderer.toneMapping = tm;
      }
    } catch (e) {
      console.warn('[RenderSettings] applyToneMapping failed', e);
    }
    this._tone = k;
    this._save();
  }

  enableFXAA(on) {
    this._fxaa = !!on;
    try {
      if (this.rendererMgr) this.rendererMgr.enableFXAA(this._fxaa);
    } catch (e) {
      console.warn('[RenderSettings] enableFXAA failed', e);
    }
    this._save();
  }

  getState() {
    return { exposure: this._exposure, tonemapping: this._tone, fxaa: this._fxaa };
  }

  _save() {
    if (!this.settings) return;
    const cur = this.settings.get('render') || {};
    cur.exposure = this._exposure;
    cur.tonemapping = this._tone;
    cur.fxaa = this._fxaa;
    this.settings.set('render', cur);
  }
  dispose() {
    // Clear references
    this.rendererMgr = null;
    this.settings = null;
  }
}

export default RenderSettings;