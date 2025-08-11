import * as THREE from 'three';

// Material utilities
const savedOriginal = new WeakMap();
const savedOverride = new WeakMap();

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
      wireframe: false
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

  // helper: dispose a material or array of materials (textures + material)
  function _disposeMaterial(mat){
    if (!mat) return;
    const list = Array.isArray(mat) ? mat : [mat];
    list.forEach(m=>{
      if (!m) return;
      ['map','normalMap','metalnessMap','roughnessMap','emissiveMap','aoMap','alphaMap','bumpMap','envMap']
        .forEach(k=>{ if (m[k]?.isTexture) m[k].dispose?.(); });
      m.dispose?.();
    });
  }

  root.traverse(o=>{
    if (!o.isMesh) return;

    if (overrideMat){
      // Save original material once so we can restore it later
      if (!savedOverride.has(o)){
        savedOverride.set(o, o.material);
      }
      const base = overrideMat.clone();
      if (Array.isArray(base)){
        base.forEach(m=>{ if (m) m.wireframe = !!wire; });
      } else if (base) {
        base.wireframe = !!wire;
      }
      o.material = base;
    } else {
      // Restore saved original material if present
      if (savedOverride.has(o)){
        const orig = savedOverride.get(o);
        const current = o.material;
        o.material = orig;
        savedOverride.delete(o);
        // Dispose override material(s) we no longer use (if different from orig)
        if (current && current !== orig) _disposeMaterial(current);
      } else {
        // Enhance existing material(s) if we don't have a saved original
        if (Array.isArray(o.material)){
          o.material = o.material.map(m => enhanceMaterial(m));
          o.material.forEach(m=>{ if (m) m.wireframe = !!wire; });
        } else {
          o.material = enhanceMaterial(o.material);
          if (o.material) o.material.wireframe = !!wire;
        }
      }
    }

    applyEnvIntensityToMaterial(o.material, envIntensity);
    if (Array.isArray(o.material)){
      o.material.forEach(m=>{ if (m) m.needsUpdate = true; });
    } else if (o.material){
      o.material.needsUpdate = true;
    }
  });
}

export function setLightOnly(root, on) {
  if (!root) return;

  // We save/restore material state per-mesh (not per-material) so restoration
  // works even if the mesh's material object is swapped while "light-only" is active.
  root.traverse(o=>{
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];

    if (on){
      if (!savedOriginal.has(o)){
        const snapshot = mats.map(m => ({
          ref: m,
          color: m?.color?.clone?.(),
          emissive: m?.emissive?.clone?.(),
          emissiveIntensity: m?.emissiveIntensity,
          map: m?.map || null,
          emissiveMap: m?.emissiveMap || null,
          normalMap: m?.normalMap || null,
          roughnessMap: m?.roughnessMap || null,
          metalnessMap: m?.metalnessMap || null,
          aoMap: m?.aoMap || null,
          bumpMap: m?.bumpMap || null,
          displacementMap: m?.displacementMap || null,
          alphaMap: m?.alphaMap || null,
          side: m?.side,
          transparent: m?.transparent,
          opacity: m?.opacity,
          alphaTest: m?.alphaTest,
          depthWrite: m?.depthWrite,
          visible: m?.visible,
          roughness: m?.roughness,
          metalness: m?.metalness,
          envMapIntensity: m?.envMapIntensity
        }));
        savedOriginal.set(o, snapshot);
      }

      // Apply "light-only" modifications to the active material(s)
      mats.forEach(m=>{
        if (!m) return;
        m.map = null;
        m.emissiveMap = null;
        if ('normalMap' in m) m.normalMap = null;
        if ('roughnessMap' in m) m.roughnessMap = null;
        if ('metalnessMap' in m) m.metalnessMap = null;
        if ('aoMap' in m) m.aoMap = null;
        if ('bumpMap' in m) m.bumpMap = null;
        if ('displacementMap' in m) m.displacementMap = null;
        if ('alphaMap' in m) m.alphaMap = null;
        m.color?.set?.(0xffffff);
        if ('roughness' in m) m.roughness = 0.6;
        if ('metalness' in m) m.metalness = 0.0;
        m.needsUpdate = true;
      });

    } else {
      const snapshot = savedOriginal.get(o);
      if (snapshot){
        const currentMats = mats;
        currentMats.forEach((cm, idx)=>{
          if (!cm) return;
          // prefer exact material reference match; otherwise fall back to index
          let saved = snapshot.find(s => s.ref === cm);
          if (!saved) saved = snapshot[idx];
          if (!saved) return;
          try {
            cm.map = saved.map;
            cm.emissiveMap = saved.emissiveMap;
            cm.normalMap = saved.normalMap;
            cm.roughnessMap = saved.roughnessMap;
            cm.metalnessMap = saved.metalnessMap;
            cm.aoMap = saved.aoMap;
            cm.bumpMap = saved.bumpMap;
            cm.displacementMap = saved.displacementMap;
            cm.alphaMap = saved.alphaMap;

            saved.color && cm.color?.copy?.(saved.color);
            saved.emissive && cm.emissive?.copy?.(saved.emissive);

            if ('emissiveIntensity' in cm && saved.emissiveIntensity !== undefined) cm.emissiveIntensity = saved.emissiveIntensity;
            if ('roughness' in cm && saved.roughness !== undefined) cm.roughness = saved.roughness;
            if ('metalness' in cm && saved.metalness !== undefined) cm.metalness = saved.metalness;

            if ('side' in cm && saved.side !== undefined) cm.side = saved.side;
            if ('transparent' in cm && saved.transparent !== undefined) cm.transparent = saved.transparent;
            if ('opacity' in cm && saved.opacity !== undefined) cm.opacity = saved.opacity;
            if ('alphaTest' in cm && saved.alphaTest !== undefined) cm.alphaTest = saved.alphaTest;
            if ('depthWrite' in cm && saved.depthWrite !== undefined) cm.depthWrite = saved.depthWrite;
            if ('visible' in cm && saved.visible !== undefined) cm.visible = saved.visible;
            if ('envMapIntensity' in cm && saved.envMapIntensity !== undefined) cm.envMapIntensity = saved.envMapIntensity;

            cm.needsUpdate = true;
          } catch(e){}
        });
        savedOriginal.delete(o);
      }
    }
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