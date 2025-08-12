import * as THREE from 'three';

/**
 * SceneManager
 * @param {Object} opts - Options
 * @param {THREE.Scene} [opts.scene] - Optional scene instance
 * @param {THREE.HemisphereLight} [opts.hemi] - Optional hemisphere light
 */
export class SceneManager {
  constructor({ scene = null } = {}) { // Removed hemi parameter
    this.scene = scene || new THREE.Scene();
    this.grid = null;

    // Removed HemisphereLight creation and addition, as it's handled by LightingManager
    // this.hemi = hemi || new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.5);
    // this.scene.add(this.hemi);

    this.measure = { group: new THREE.Group(), pts: [] };
    this.scene.add(this.measure.group);

    this.bboxHelper = null;
    this.env = null;
    this.measureLine = null;

    this.createGrid(10, 20);
  }

  getScene() {
    return this.scene;
  }

  createGrid(size = 10, divisions = 20, c1 = 0x8892a6, c2 = 0xcbd5e1) {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry?.dispose?.();
      this.grid.material?.dispose?.();
      this.grid = null;
    }
    this.grid = new THREE.GridHelper(size, divisions, new THREE.Color(c1), new THREE.Color(c2));
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.6;
    this.grid.position.y = 0;
    this.scene.add(this.grid);
  }

  setGridVisible(v) { if (this.grid) this.grid.visible = !!v; }

  setBackground(colorOrNull) {
    if (colorOrNull === null) {
      this.scene.background = null;
    } else if (typeof colorOrNull === 'string') {
      this.scene.background = new THREE.Color(colorOrNull);
    } else if (typeof colorOrNull === 'number') {
      this.scene.background = new THREE.Color(colorOrNull);
    }
  }

  setEnvironment(tex) {
    if (this.env && this.env.dispose) { this.env.dispose(); }
    this.env = tex || null;
    this.scene.environment = this.env;
  }

  applyEnvIntensity(intensity, root = this.scene) {
    root.traverse(o => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.filter(Boolean).forEach(m => {
          if ('envMapIntensity' in m) { m.envMapIntensity = intensity; m.needsUpdate = true; }
        });
      }
    });
  }

  disposeObject(obj) {
    obj.traverse(o => {
      if (o.isMesh) {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.filter(Boolean).forEach(m => {
          ['map','normalMap','metalnessMap','roughnessMap','emissiveMap','aoMap','alphaMap','bumpMap','envMap']
            .forEach(k => { if (m && m[k]?.isTexture) m[k].dispose(); });
          m?.dispose?.();
        });
      }
    });
  }

  add(root) { this.scene.add(root); }
  remove(root) {
    this.scene.remove(root);
    this.disposeObject(root);
  }

  updateBBox(root) {
    if (this.bboxHelper) {
      this.scene.remove(this.bboxHelper);
      this.bboxHelper.geometry?.dispose?.();
      this.bboxHelper.material?.dispose?.();
      this.bboxHelper = null;
    }
    if (!root) return null;
    const box = new THREE.Box3().setFromObject(root);
    if (!isFinite(box.min.x) || !isFinite(box.max.x)) return null;
    this.bboxHelper = new THREE.Box3Helper(box, 0x93c5fd);
    this.scene.add(this.bboxHelper);
    const size = new THREE.Vector3(); box.getSize(size);
    return { x: size.x, y: size.y, z: size.z };
  }

  // Measure helpers
  clearMeasure() {
    while (this.measure.group.children.length) {
      const c = this.measure.group.children.pop();
      c.geometry?.dispose?.(); c.material?.dispose?.();
    }
    this.measure.pts.length = 0;
    this.measureLine = null;
  }

  addMeasurePoint(p, gridSize = 10) {
    this.measure.pts.push(p.clone());
    const s = Math.max(0.01, gridSize * 0.01);
    const geom = new THREE.SphereGeometry(s, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const m = new THREE.Mesh(geom, mat);
    m.position.copy(p);
    this.measure.group.add(m);
    if (this.measure.pts.length === 2) this.drawMeasureLine(gridSize);
    if (this.measure.pts.length > 2) { this.clearMeasure(); this.addMeasurePoint(p, gridSize); }
  }

  // Add HDRI loading helper
  async loadHDRI(url) {
    const loader = new RGBELoader();
    return new Promise((resolve, reject) => {
      loader.load(url, texture => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.setEnvironment(texture);
        resolve(texture);
      }, undefined, reject);
    });
  }

  drawMeasureLine(gridSize = 10) {
    if (this.measureLine) {
      this.measure.group.remove(this.measureLine);
      this.measureLine.geometry.dispose(); this.measureLine.material.dispose();
      this.measureLine = null;
    }
    const pts = this.measure.pts.slice(0,2);
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color: 0x60a5fa, dashSize: 0.05*gridSize, gapSize: 0.025*gridSize });
    const line = new THREE.Line(g, mat);
    line.computeLineDistances();
    this.measure.group.add(line);
    this.measureLine = line;
    const d = pts[0].distanceTo(pts[1]);
    return d;
  }
  
  dispose() {
    // Remove and dispose all objects in the scene
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    // Dispose grid
    if (this.grid) {
      this.grid.geometry.dispose();
      this.grid.material.dispose();
    }

    // Dispose bboxHelper
    if (this.bboxHelper) {
      this.bboxHelper.geometry.dispose();
      this.bboxHelper.material.dispose();
    }

    // Dispose measure group
    this.measure.group.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });

    // Dispose environment texture
    if (this.env && this.env.dispose) {
      this.env.dispose();
    }

    // Clear references
    this.scene = null;
    this.grid = null;
    // this.hemi = null; // Removed reference cleanup for removed hemi
    this.measure = null;
    this.bboxHelper = null;
    this.env = null;
    this.measureLine = null;
  }
}