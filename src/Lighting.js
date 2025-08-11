import * as THREE from 'three';

/**
 * LightingManager
 * Encapsulates scene lighting (hemisphere + directional) and helpers
 * for controlling intensity, angle and softness. Designed to be used
 * by the bootstrap app and UI module.
 *
 * Usage:
 *   const lm = new LightingManager(scene);
 *   lm.setDirFromAngle(34);
 *   lm.setDirIntensity(0.9);
 *   lm.setHemiIntensity(0.5);
 *   lm.resetDirectional();
 *   lm.dispose();
 */
export class LightingManager {
  constructor(scene) {
    if (!scene) throw new Error('LightingManager requires a THREE.Scene instance');
    this.scene = scene;

    // Hemisphere light (sky/dirt)
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.5);
    this.scene.add(this.hemi);

    // Directional light (main light)
    this.dir = new THREE.DirectionalLight(0xffffff, 0.9);
    this.dir.position.set(3, 5, 2);
    this.dir.castShadow = false;
    this.dir.shadow.radius = 1;
<<<<<<< HEAD
<<<<<<< HEAD
    // Configure shadow map for better quality and visibility of softness
    this.dir.shadow.mapSize.width = 2048;
    this.dir.shadow.mapSize.height = 2048;
    this.dir.shadow.camera.left = -10;
    this.dir.shadow.camera.right = 10;
    this.dir.shadow.camera.top = 10;
    this.dir.shadow.camera.bottom = -10;
    this.dir.shadow.camera.near = 0.5;
    this.dir.shadow.camera.far = 20;
    this.dir.shadow.bias = -0.0005;
=======
>>>>>>> d4f436b6ce7bed0f1284659aa88a051c6b23e3ad
=======
>>>>>>> d4f436b6ce7bed0f1284659aa88a051c6b23e3ad
    this.scene.add(this.dir);

    // store defaults so reset() can restore
    this._defaults = {
      hemiIntensity: this.hemi.intensity,
      dirIntensity: this.dir.intensity,
      dirPosition: this.dir.position.clone(),
      dirShadowRadius: this.dir.shadow.radius
    };
  }

  // === Hemisphere (ambient) ===
  setHemiIntensity(v) {
    this.hemi.intensity = Number(v) || 0;
  }
  getHemiIntensity() { return this.hemi.intensity; }

  // === Directional light ===
  setDirIntensity(v) {
    this.dir.intensity = Number(v) || 0;
  }
  getDirIntensity() { return this.dir.intensity; }

  // Keep elevation constant and rotate around Y by angle degrees
  setDirFromAngle(angleDeg) {
    const y = this.dir.position.y;
    const r = Math.hypot(this.dir.position.x, this.dir.position.z) || 1;
    const a = THREE.MathUtils.degToRad(angleDeg);
    this.dir.position.x = Math.cos(a) * r;
    this.dir.position.z = Math.sin(a) * r;
    this.dir.position.y = y;
    this.dir.lookAt(0, 0, 0);
  }

  setDirAngleDeg(angleDeg) { this.setDirFromAngle(angleDeg); }

  // Softness for PCFSoftShadowMap uses shadow.radius
  setDirSoftness(v) {
    this.dir.shadow.radius = Number(v) || 0;
  }
  getDirSoftness() { return this.dir.shadow.radius; }

  // Allow toggling shadows on/off
  enableShadows(on) {
    this.dir.castShadow = !!on;
    // note: renderer.shadowMap.enabled must be set by renderer manager
  }

  // Reset helpers
  resetDirectional() {
    this.dir.intensity = this._defaults.dirIntensity;
    this.dir.position.copy(this._defaults.dirPosition);
    this.dir.shadow.radius = this._defaults.dirShadowRadius;
    this.dir.lookAt(0, 0, 0);
  }

  resetHemisphere() {
    this.hemi.intensity = this._defaults.hemiIntensity;
  }

  resetAll() {
    this.resetHemisphere();
    this.resetDirectional();
  }

  // Expose underlying lights for advanced usage
  getLights() {
    return { hemi: this.hemi, dir: this.dir };
  }

  dispose() {
    try { this.scene.remove(this.hemi); } catch(e){}
    try { this.scene.remove(this.dir); } catch(e){}
    // Note: three lights do not have many disposable resources, but remove references
    this.hemi = null;
    this.dir = null;
    this.scene = null;
  }
}

export default LightingManager;