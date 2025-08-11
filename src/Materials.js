import * as THREE from 'three';

// Material utilities
const savedOriginal = new WeakMap();

export function enhanceMaterial(material) {
  if (!material) return material;
  if (Array.isArray(material)) return material.map(m => enhanceMaterial(m));
  if (!(material instanceof THREE.MeshStandardMaterial)) {
    const m = new THREE.MeshStandardMaterial({
      name: material.name || '',
      color: material.color ? material.color.clone() : new THREE.Color(0xcccccc),
      opacity: material.opacity ?? 1,
      transparent: !!material.transparent,
      side: material.side ?? THREE.FrontSide,
      wireframe: !!material.wireframe
    });
    if (material.map) { m.map = material.map; if (m.map) m.map.encoding = THREE.sRGBEncoding; }
    m.metalness = material.metalness ?? 0.0;
    m.roughness = material.roughness ?? 0.5;
    material = m;
  } else {
    if (material.map) material.map.encoding = THREE.sRGBEncoding;
  }
  material.needsUpdate = true;
  return material;
}

export function makeOverride(type) {
  switch(type){
    case 'standard': return new THREE.MeshStandardMaterial({ color: 0xffffff, metalness:0, roughness:0.5 });
    case 'phong':    return new THREE.MeshPhongMaterial({ color: 0xffffff, shininess:30 });
    case 'basic':    return new THREE.MeshBasicMaterial({ color: 0xffffff });
    case 'normal':   return new THREE.MeshNormalMaterial();
    case 'toon':     return new THREE.MeshToonMaterial({ color: 0xffffff });
    default: return null;
  }
}

export function applyEnvIntensityToMaterial(material, intensity) {
  const list = Array.isArray(material) ? material : [material];
  list.filter(Boolean).forEach(m=>{
    if ('envMapIntensity' in m){ m.envMapIntensity = intensity; m.needsUpdate = true; }
  });
}

export function applyMaterialOverride(root, options = {}) {
  if (!root) return;
  const { overrideType = 'none', wire = false, envIntensity = 1 } = options;
  const overrideMat = makeOverride(overrideType);
  root.traverse(o=>{
    if (!o.isMesh) return;
    if (overrideMat){
      const base = overrideMat.clone();
      base.wireframe = !!wire;
      o.material = base;
    } else {
      if (Array.isArray(o.material)) o.material = o.material.map(m => enhanceMaterial(m));
      else o.material = enhanceMaterial(o.material);
      o.material.wireframe = !!wire || o.material.wireframe;
    }
    applyEnvIntensityToMaterial(o.material, envIntensity);
    o.material.needsUpdate = true;
  });
}

export function setLightOnly(root, on) {
  if (!root) return;
  root.traverse(o=>{
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m=>{
      if (!m) return;
      if (on){
        if (!savedOriginal.has(m)){
          savedOriginal.set(m, {
            color: m.color?.clone?.(),
            emissive: m.emissive?.clone?.(),
            map: m.map || null,
            emissiveMap: m.emissiveMap || null,
            roughness: m.roughness,
            metalness: m.metalness
          });
        }
        m.map = null;
        m.emissiveMap = null;
        m.color?.set?.(0xffffff);
        if ('roughness' in m) m.roughness = 0.6;
        if ('metalness' in m) m.metalness = 0.0;
        m.needsUpdate = true;
      } else {
        const saved = savedOriginal.get(m);
        if (saved){
          try {
            m.map = saved.map;
            m.emissiveMap = saved.emissiveMap;
            saved.color && m.color?.copy?.(saved.color);
            saved.emissive && m.emissive?.copy?.(saved.emissive);
            if ('roughness' in m && saved.roughness !== undefined) m.roughness = saved.roughness;
            if ('metalness' in m && saved.metalness !== undefined) m.metalness = saved.metalness;
            m.needsUpdate = true;
          } catch(e){}
        }
      }
    });
  });
}

export function disposeMaterialResources(root) {
  root.traverse(o=>{
    if (o.isMesh){
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.filter(Boolean).forEach(m=>{
        ['map','normalMap','metalnessMap','roughnessMap','emissiveMap','aoMap','alphaMap','bumpMap','envMap']
          .forEach(k=>{ if (m[k]?.isTexture) m[k].dispose?.(); });
        m?.dispose?.();
      });
      if (o.geometry) o.geometry.dispose?.();
    }
  });
}

// default export grouping
export default {
  enhanceMaterial,
  makeOverride,
  applyMaterialOverride,
  applyEnvIntensityToMaterial,
  setLightOnly,
  disposeMaterialResources
};