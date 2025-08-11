/**
 * Simple Settings manager (localStorage)
 * - Centralizes load/save for UI and module settings
 * - Provides a small observable API for subscribers
 *
 * Usage:
 *   import Settings from './Settings.js';
 *   const settings = new Settings('viewerSettings.v1');
 *   settings.set('theme','dark');
 *   settings.subscribe((key,value)=>{ ... });
 */

const DEFAULT_KEY = 'viewerSettings.v1';

export class Settings {
  constructor(lsKey = DEFAULT_KEY, defaults = {}) {
    this.key = lsKey;
    this.defaults = defaults;
    this.store = Object.assign({}, defaults, this._loadRaw() || {});
    this.listeners = new Set();
  }

  _loadRaw() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[Settings] failed to parse', e);
      return null;
    }
  }

  load() {
    this.store = Object.assign({}, this.defaults, this._loadRaw() || {});
    return this.store;
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.store));
    } catch (e) {
      console.warn('[Settings] save failed', e);
    }
  }

  get(key, fallback) {
    if (key === undefined) return this.store;
    const v = this.store[key];
    return v === undefined ? fallback : v;
  }

  // Getter for movement sensitivity
  getMovementSensitivity() {
    return this.get('movementSensitivity', 5.0);
  }

  // Setter for movement sensitivity
  setMovementSensitivity(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      console.warn('[Settings] Invalid movementSensitivity value:', value);
      return;
    }
    this.set('movementSensitivity', Math.max(0.1, Math.min(50, value)));
  }

  set(key, value) {
    this.store[key] = value;
    this.save();
    this._emit(key, value);
    return value;
  }

  remove(key) {
    delete this.store[key];
    this.save();
    this._emit(key, undefined);
  }

  clear() {
    this.store = Object.assign({}, this.defaults);
    this.save();
    this._emit('__clear__', null);
  }

  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  _emit(key, value) {
    this.listeners.forEach(cb => {
      try { cb(key, value); } catch (e) { console.warn('[Settings] listener error', e); }
    });
  }
}

export default Settings;