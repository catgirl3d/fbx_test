/**
 * Utility helpers extracted from the original inline script.
 * - getNumber: safe numeric parsing with fallback
 * - loadWithObjectURL: safely load a File via ObjectURL and revoke on completion/error
 * - disposeObject: dispose geometries/materials/textures for an Object3D subtree
 * - applyEnvIntensityToMaterial / applyEnvIntensity: helpers to set envMapIntensity on materials
 *
 * Keep these functions small and dependency-free so other modules can import them.
 */

export function getNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function loadWithObjectURL(loader, file, onSuccess, onProgress, onError) {
  const url = URL.createObjectURL(file);
  try {
    loader.load(url,
      (asset) => {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        onSuccess && onSuccess(asset);
      },
      (evt) => {
        if (evt && evt.lengthComputable) onProgress && onProgress(evt);
        else onProgress && onProgress(evt);
      },
      (err) => {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        onError && onError(err);
      }
    );
  } catch (e) {
    try { URL.revokeObjectURL(url); } catch (er) { /* ignore */ }
    onError && onError(e);
  }
}

/**
 * Dispose geometries, materials and commonly used texture maps for all Meshes in subtree.
 * Safe to call multiple times.
 */
export function disposeObject(root) {
  if (!root) return;
  root.traverse((o) => {
    if (!o) return;
    if (o.isMesh) {
      if (o.geometry) {
        try { o.geometry.dispose(); } catch (e) {}
      }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.filter(Boolean).forEach((m) => {
        try {
          ['map','normalMap','metalnessMap','roughnessMap','emissiveMap','aoMap','alphaMap','bumpMap','envMap']
            .forEach(k => { if (m[k] && m[k].isTexture) { try { m[k].dispose(); } catch (e) {} } });
        } catch (e) {}
        try { m.dispose && m.dispose(); } catch (e) {}
      });
    }
  });
}

/**
 * Apply envMapIntensity to material(s).
 * Accepts a single material or array.
 */
export function applyEnvIntensityToMaterial(material, intensity) {
  if (!material) return;
  const list = Array.isArray(material) ? material : [material];
  list.filter(Boolean).forEach(m => {
    if ('envMapIntensity' in m) {
      try { m.envMapIntensity = intensity; } catch(e) {}
      try { m.needsUpdate = true; } catch(e) {}
    }
  });
}

/**
 * Walk subtree and apply env intensity to meshes' materials.
 */
export function applyEnvIntensity(root, intensity) {
  if (!root) return;
  root.traverse(o => {
    if (o.isMesh) applyEnvIntensityToMaterial(o.material, intensity);
  });
}