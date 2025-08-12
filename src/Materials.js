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

/**
 * Apply textures from a texture map to materials in a 3D object
 * This is used as a fallback when texture resolver doesn't work
 * @param {THREE.Object3D} rootObject - The root object to traverse
 * @param {Map<string, THREE.Texture>} textureMap - Map of texture paths to textures
 */
/**
 * Normalize a material name for matching by removing common suffixes and separators
 * @param {string} materialName - The material name to normalize
 * @returns {string} Normalized material name (lowercase, no suffixes)
 */
function normalizeMaterialName(materialName) {
  if (!materialName) return '';
  // Remove common suffixes (mt, mtl, mat, material) and separators
  return materialName.toLowerCase()
    .replace(/(?:mtl|mt|mat|material)$/i, '')
    .replace(/[-_\s]+/g, '');
}

/**
 * Parse a texture filename to extract material prefix and map type
 * @param {string} filename - The texture filename
 * @returns {{materialPrefix: string, mapType: string} | null} Parsed components or null if not matching expected pattern
 */
function parseTextureFilename(filename) {
  if (!filename) return null;
  
  const baseName = filename.toLowerCase();
  
  // Expected pattern: MaterialName_MapType.tga (e.g., DevilBodyMtl_BaseColor.tga)
  // Handle both simple (DevilHeadMtl_BaseColor) and complex paths (Textures/DevilHeadMtl_BaseColor.tga)
  const pathParts = baseName.split(/[\\/]/);
  const fileName = pathParts[pathParts.length - 1];
  
  const match = fileName.match(/^([^_]+(?:mtl|mt|mat|material)?)_([^_]+)(?:\.tga)?$/i);
  if (!match) return null;
  
  const materialPrefix = normalizeMaterialName(match[1]);
  const mapTypeSuffix = match[2];
  
  // Map suffix to Three.js map type
  const mapTypeMap = {
    'basecolor': 'map',
    'basecolour': 'map',
    'diffuse': 'map',
    'albedo': 'map',
    'color': 'map',
    'base': 'map',
    'normal': 'normalMap',
    'norm': 'normalMap',
    'roughness': 'roughnessMap',
    'rough': 'roughnessMap',
    'metallic': 'metalnessMap',
    'metal': 'metalnessMap',
    'metalic': 'metalnessMap', // Handle typo in your texture files
    'ao': 'aoMap',
    'ambientocclusion': 'aoMap',
    'emissive': 'emissiveMap',
    'emission': 'emissiveMap',
    'emit': 'emissiveMap',
    'alpha': 'alphaMap',
    'transparency': 'alphaMap',
    'bump': 'bumpMap',
    'height': 'bumpMap',
    'displacement': 'displacementMap'
  };
  
  const mapType = mapTypeMap[mapTypeSuffix] || null;
  
  return {
    materialPrefix,
    mapType
  };
}

/**
 * Build a material-texture index from the texture map
 * @param {Map<string, THREE.Texture>} textureMap - Map of texture paths to textures
 * @returns {Map<string, Map<string, THREE.Texture>>} Map of normalized material names to map type -> texture
 */
function buildMaterialTextureIndex(textureMap) {
  const materialIndex = new Map();
  
  console.log('[Materials] === Debug: Building material-texture index ===');
  console.log('[Materials] Available texture keys:', Array.from(textureMap.keys()).slice(0, 10));
  
  for (const [textureKey, texture] of textureMap) {
    // Use texture.name if available, otherwise use textureKey
    const filename = texture.name || textureKey;
    console.log(`[Materials] Processing texture: "${filename}"`);
    
    const parsed = parseTextureFilename(filename);
    if (!parsed || !parsed.mapType) {
      console.log(`[Materials]  -> Failed to parse (no mapType)`);
      continue;
    }
    
    console.log(`[Materials]  -> Parsed: materialPrefix="${parsed.materialPrefix}", mapType="${parsed.mapType}"`);
    
    const { materialPrefix, mapType } = parsed;
    
    if (!materialIndex.has(materialPrefix)) {
      materialIndex.set(materialPrefix, new Map());
    }
    
    const materialTextures = materialIndex.get(materialPrefix);
    // Only set if not already set (prefer first match)
    if (!materialTextures.has(mapType)) {
      materialTextures.set(mapType, texture);
      console.log(`[Materials]  -> Added ${mapType} for ${materialPrefix}`);
    } else {
      console.log(`[Materials]  -> ${mapType} already exists for ${materialPrefix}, skipping`);
    }
  }
  
  console.log('[Materials] === Debug: Index building complete ===');
  console.log('[Materials] Final index materials:', Array.from(materialIndex.keys()));
  return materialIndex;
}

/**
 * Apply textures from a texture map to materials in a 3D object
 * This is used as a fallback when texture resolver doesn't work
 * @param {THREE.Object3D} rootObject - The root object to traverse
 * @param {Map<string, THREE.Texture>} textureMap - Map of texture paths to textures
 */
export function applyTexturesFromMap(rootObject, textureMap) {
  if (!rootObject || !textureMap) return;
  
  console.log('[Materials] applyTexturesFromMap: starting on rootObject', rootObject?.name || rootObject?.uuid);
  
  // Build material-texture index for deterministic matching
  const materialIndex = buildMaterialTextureIndex(textureMap);
  console.log(`[Materials] Built material-texture index with ${materialIndex.size} materials:`,
    Array.from(materialIndex.keys()));
  
  // Supported material map types
  const supportedMapTypes = [
    'map', 'normalMap', 'metalnessMap', 'roughnessMap',
    'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap', 'displacementMap'
  ];
  
  // Warn if scene-level overrideMaterial is present (it will prevent visible changes)
  if (rootObject && rootObject.type === 'Scene' && rootObject.overrideMaterial) {
    console.warn('[Materials] Scene has overrideMaterial set - texture application may not be visible', rootObject.overrideMaterial);
  }
  
  const mappingSummary = new Map();
  
  rootObject.traverse((object) => {
    if (!object.isMesh) return;
    
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    
    materials.forEach((material, matIndex) => {
      if (!material) return;
      
      console.debug(`[Materials] Processing mesh "${object.name || object.uuid}" material[${matIndex}] name="${material.name || ''}" type=${material.type}`);
      
      // Dump some pre-state for debugging
      try {
        console.debug('[Materials] Material pre-state:', {
          name: material.name,
          color: material.color?.getHexString?.() ?? null,
          map: material.map?.name ?? (material.map ? '<texture without name>' : null),
          normalMap: material.normalMap?.name ?? null,
          metalness: material.metalness,
          roughness: material.roughness,
          vertexColors: material.vertexColors,
          transparent: material.transparent,
          visible: material.visible,
          side: material.side
        });
      } catch(e){/* ignore debug errors */ }
      
      // Try deterministic material-texture index matching first
      let appliedByIndex = false;
      if (material.name) {
        const normalizedMaterialName = normalizeMaterialName(material.name);
        console.debug(`[Materials] Normalized material name: "${material.name}" -> "${normalizedMaterialName}"`);
        
        if (materialIndex.has(normalizedMaterialName)) {
          const materialTextures = materialIndex.get(normalizedMaterialName);
          console.log(`[Materials] Found ${materialTextures.size} textures for material "${material.name}"`);
          
          // Apply all supported map types found in the index
          supportedMapTypes.forEach(mapType => {
            if (materialTextures.has(mapType)) {
              const texture = materialTextures.get(mapType);
              
              try {
                // Set texture properties based on type
                if (mapType === 'map' || mapType === 'emissiveMap') {
                  if (typeof THREE !== 'undefined') texture.encoding = THREE.sRGBEncoding;
                }
                if (typeof texture.flipY !== 'undefined') texture.flipY = false;
                texture.needsUpdate = true;
                
                // Special handling for aoMap - copy UV to UV2 on geometry if not already set
                if (mapType === 'aoMap') {
                  // Find the mesh that uses this material
                  let mesh = null;
                  object.parent?.traverse((child) => {
                    if (child.isMesh && child.material === material) {
                      mesh = child;
                    }
                  });
                  
                  if (mesh && mesh.geometry) {
                    // Copy UV attributes to UV2 for aoMap
                    if (mesh.geometry.attributes.uv && !mesh.geometry.attributes.uv2) {
                      mesh.geometry.setAttribute('uv2', mesh.geometry.attributes.uv.clone());
                    }
                  }
                }
                
                // Apply the texture
                material[mapType] = texture;
                material.needsUpdate = true;
                appliedByIndex = true;
                
                console.log(`[Materials] Applied ${mapType} texture by material-index: ${texture.name} for material: ${material.name}`);
                console.debug(`[Materials] Applied ${mapType} details:`, {
                  materialName: material.name,
                  mapType,
                  textureName: texture.name,
                  textureImage: texture.image,
                  textureReady: texture.image?.complete,
                  textureWidth: texture.image?.width,
                  textureHeight: texture.image?.height,
                  textureFlipY: texture.flipY,
                  textureEncoding: texture.encoding,
                  matchedBy: 'material-index'
                });
                
                // Update mapping summary
                if (!mappingSummary.has(material.name)) {
                  mappingSummary.set(material.name, new Map());
                }
                mappingSummary.get(material.name).set(mapType, texture.name);
                
              } catch (e) {
                console.warn(`[Materials] Error applying texture ${texture.name} to ${mapType} for material ${material.name}:`, e);
              }
            }
          });
        } else {
          console.debug(`[Materials] No textures found in material index for "${material.name}" (normalized: "${normalizedMaterialName}")`);
          console.debug(`[Materials] Available materials in index:`, Array.from(materialIndex.keys()));
        }
      }
      
      // If we didn't find any textures via material index, fall back to existing logic
      if (!appliedByIndex) {
        console.debug(`[Materials] No textures found via material index for "${material.name}", falling back to existing logic`);
        
        // Try to replace each supported map type
        supportedMapTypes.forEach(mapType => {
          // If the material already had a referenced texture, prefer that path
          if (material[mapType]) {
            const textureInfo = material[mapType];
            let texturePath = null;
            
            // Extract texture path from different possible sources
            if (textureInfo && typeof textureInfo === 'object') {
              if (textureInfo.name) {
                texturePath = textureInfo.name;
              } else if (textureInfo.sourceFileName) {
                texturePath = textureInfo.sourceFileName;
              } else if (textureInfo.url) {
                texturePath = textureInfo.url;
              }
            } else if (typeof textureInfo === 'string') {
              texturePath = textureInfo;
            }
            
            if (texturePath) {
              console.debug(`[Materials] Attempting to match texture for path "${texturePath}" on mapType "${mapType}"`);
              // Try to find matching texture in the map
              const matchedTexture = matchTexturePath(texturePath, textureMap);
              
              if (matchedTexture) {
                // Prepare texture for FBX/THREE usage: common fixes
                try {
                  // If this is a color map ('map') ensure correct encoding
                  if (mapType === 'map' && typeof THREE !== 'undefined') {
                    matchedTexture.encoding = THREE.sRGBEncoding;
                  }
                  // FBX often uses flipped Y for UVs; try flipY = false when applying
                  if (typeof matchedTexture.flipY !== 'undefined') matchedTexture.flipY = false;
                  // Mark texture needing update
                  matchedTexture.needsUpdate = true;
                } catch (e) {
                  console.debug('[Materials] Error preparing matchedTexture:', e);
                }
                
                // Replace the texture
                material[mapType] = matchedTexture;
                material.needsUpdate = true;
                
                console.log(`[Materials] Applied texture ${texturePath} -> ${matchedTexture.name} (fallback)`);
                console.debug(`[Materials] Applied texture details:`, {
                  materialName: material.name,
                  mapType,
                  texturePath,
                  textureName: matchedTexture.name,
                  textureImage: matchedTexture.image,
                  textureReady: matchedTexture.image?.complete,
                  textureWidth: matchedTexture.image?.width,
                  textureHeight: matchedTexture.image?.height,
                  textureFlipY: matchedTexture.flipY,
                  textureEncoding: matchedTexture.encoding
                });
                
                // Update mapping summary
                if (!mappingSummary.has(material.name)) {
                  mappingSummary.set(material.name, new Map());
                }
                mappingSummary.get(material.name).set(mapType, matchedTexture.name);
                
                // Dump material post-state
                try {
                  console.debug('[Materials] Material post-state:', {
                    name: material.name,
                    map: material.map?.name ?? (material.map ? '<texture without name>' : null),
                    normalMap: material.normalMap?.name ?? null,
                    metalness: material.metalness,
                    roughness: material.roughness,
                    needsUpdate: material.needsUpdate
                  });
                } catch(e){}
                
              } else {
                console.warn(`[Materials] No matching texture found for: ${texturePath}`);
                console.debug(`[Materials] Available texture keys:`, Array.from(textureMap.keys()).slice(0,50));
              }
            } else {
              console.debug('[Materials] textureInfo present but could not extract path:', textureInfo);
            }
          }
        });
        
        // If we didn't find any referenced texture maps, try a strict material-prefix search for base color
        // This avoids broad partial/keyword matches that can apply unrelated textures (e.g. "devil" token)
        if (!material.map && material.name) {
          const normalizedMaterialNameCandidate = normalizeMaterialName(material.name);
          let foundTex = null;
          
          // Prefer exact prefix match (e.g., devilhead -> DevilHeadMtl_BaseColor)
          for (const [textureKey, texture] of textureMap) {
            const filename = texture.name || textureKey;
            const parsed = parseTextureFilename(filename);
            if (!parsed || parsed.mapType !== 'map') continue;
            if (parsed.materialPrefix === normalizedMaterialNameCandidate) {
              foundTex = texture;
              break;
            }
          }
          
          // If no exact prefix, allow color-prefixed variants (e.g., whitedevilhead -> devilhead)
          if (!foundTex) {
            for (const [textureKey, texture] of textureMap) {
              const filename = texture.name || textureKey;
              const parsed = parseTextureFilename(filename);
              if (!parsed || parsed.mapType !== 'map') continue;
              const prefix = parsed.materialPrefix;
              if (prefix.endsWith(normalizedMaterialNameCandidate) || normalizedMaterialNameCandidate.endsWith(prefix)) {
                foundTex = texture;
                break;
              }
            }
          }
          
          if (foundTex) {
            try {
              if (typeof foundTex.flipY !== 'undefined') foundTex.flipY = false;
              foundTex.needsUpdate = true;
              if (typeof THREE !== 'undefined') foundTex.encoding = THREE.sRGBEncoding;
            } catch(e){/* ignore */ }
            
            material.map = foundTex;
            material.needsUpdate = true;
            console.log(`[Materials] Applied base-color by strict material-prefix ${material.name} -> ${foundTex.name} (fallback)`);
            
            if (!mappingSummary.has(material.name)) mappingSummary.set(material.name, new Map());
            mappingSummary.get(material.name).set('map', foundTex.name);
          } else {
            console.debug(`[Materials] No strict material-prefix basecolor match for "${material.name}"`);
          }
        }

        // NEW: Try to apply all texture types by strict material-prefix matching
        // This replaces the overly broad keyword matching that was applying unrelated textures
        const textureTypes = [
          { pattern: /_basecolor|_basecolour|_diffuse|_albedo|_color|_base/i, mapType: 'map', isColorMap: true },
          { pattern: /_normal|_norm/i, mapType: 'normalMap', isColorMap: false },
          { pattern: /_roughness|_rough/i, mapType: 'roughnessMap', isColorMap: false },
          { pattern: /_metalness|_metal/i, mapType: 'metalnessMap', isColorMap: false },
          { pattern: /_ao|_ambientocclusion/i, mapType: 'aoMap', isColorMap: false },
          { pattern: /_emissive|_emission|_emit/i, mapType: 'emissiveMap', isColorMap: false },
          { pattern: /_alpha|_transparency/i, mapType: 'alphaMap', isColorMap: false },
          { pattern: /_bump|_height/i, mapType: 'bumpMap', isColorMap: false },
          { pattern: /_displacement/i, mapType: 'displacementMap', isColorMap: false }
        ];

        let appliedAny = false;
        
        // For each material, find textures that belong to it by strict prefix matching
        if (material.name) {
          const normalizedMaterialName = normalizeMaterialName(material.name);
          console.debug(`[Materials] Material "${material.name}" normalized: "${normalizedMaterialName}"`);
          
          textureTypes.forEach(({ pattern, mapType, isColorMap }) => {
            if (!supportedMapTypes.includes(mapType)) return;

            // Find textures that match this material and texture type by strict prefix
            let bestMatch = null;
            let bestScore = 0;
            
            for (const [textureKey, texture] of textureMap) {
              const filename = texture.name || textureKey;
              const parsed = parseTextureFilename(filename);
              if (!parsed || parsed.mapType !== mapType) continue;
              
              // Only match if the texture prefix exactly matches or endsWith the material name
              const prefix = parsed.materialPrefix;
              if (prefix === normalizedMaterialName ||
                  prefix.endsWith(normalizedMaterialName) ||
                  normalizedMaterialName.endsWith(prefix)) {
                
                // Prefer exact matches over partial matches
                let score = 1;
                if (prefix === normalizedMaterialName) score = 3;
                else if (prefix.endsWith(normalizedMaterialName) || normalizedMaterialName.endsWith(prefix)) score = 2;
                
                if (score > bestScore) {
                  bestScore = score;
                  bestMatch = texture;
                }
              }
            }
            
            if (bestMatch) {
              // Apply texture to appropriate map type
              try {
                const tex = bestMatch;
                
                // Set texture properties based on type
                if (isColorMap || mapType === 'emissiveMap') {
                  if (typeof THREE !== 'undefined') tex.encoding = THREE.sRGBEncoding;
                  if (typeof tex.flipY !== 'undefined') tex.flipY = false;
                }
                
                tex.needsUpdate = true;
                
                // Special handling for aoMap - copy UV to UV2 on geometry if not already set
                if (mapType === 'aoMap') {
                  // Find the mesh that uses this material
                  let mesh = null;
                  object.parent?.traverse((child) => {
                    if (child.isMesh && child.material === material) {
                      mesh = child;
                    }
                  });
                  
                  if (mesh && mesh.geometry) {
                    // Copy UV attributes to UV2 for aoMap
                    if (mesh.geometry.attributes.uv && !mesh.geometry.attributes.uv2) {
                      mesh.geometry.setAttribute('uv2', mesh.geometry.attributes.uv.clone());
                    }
                  }
                }
                
                // Apply the texture
                material[mapType] = tex;
                material.needsUpdate = true;
                appliedAny = true;
                
                console.log(`[Materials] Applied ${mapType} texture: ${tex.name} for material: ${material.name} (strict prefix fallback)`);
                console.debug(`[Materials] Applied ${mapType} details:`, {
                  materialName: material.name,
                  mapType,
                  textureName: tex.name,
                  textureImage: tex.image,
                  textureReady: tex.image?.complete,
                  textureWidth: tex.image?.width,
                  textureHeight: tex.image?.height,
                  textureFlipY: tex.flipY,
                  textureEncoding: tex.encoding,
                  isColorMap,
                  matchedBy: 'strict-prefix-matching',
                  materialPrefix: normalizedMaterialName,
                  texturePrefix: parseTextureFilename(tex.name || textureKey)?.materialPrefix
                });
                
                // Update mapping summary
                if (!mappingSummary.has(material.name)) {
                  mappingSummary.set(material.name, new Map());
                }
                mappingSummary.get(material.name).set(mapType, tex.name);
                
              } catch (e) {
                console.warn(`[Materials] Error applying texture to ${mapType} for material ${material.name}:`, e);
              }
            }
          });
          
          // Log unmatched textures for debugging
          if (!appliedAny) {
            console.debug(`[Materials] No textures found for material "${material.name}". Available textures:`,
              Array.from(textureMap.keys()));
          }
        }
      }
    });
  });
  
  // Print mapping summary
  console.info('[Materials] === Texture Mapping Summary ===');
  for (const [materialName, maps] of mappingSummary) {
    const mapEntries = Array.from(maps.entries()).map(([mapType, textureName]) => `${mapType}:${textureName}`);
    console.info(`[Materials] ${materialName} -> { ${mapEntries.join(', ')} }`);
  }
  console.info('[Materials] === End Mapping Summary ===');
}

/**
 * Match a texture path against a texture map with different strategies
 * @param {string} path - The texture path to match
 * @param {Map<string, THREE.Texture>} textureMap - The map of available textures
 * @returns {THREE.Texture|null} The matched texture or null if not found
 */
function matchTexturePath(path, textureMap) {
  if (!path || !textureMap) return null;
  
  const pathLower = path.toLowerCase();
  
  // 1. Try exact match (case-insensitive)
  if (textureMap.has(pathLower)) {
    return textureMap.get(pathLower);
  }
  
  // 2. Try basename match (case-insensitive)
  const basename = path.split('/').pop().split('\\').pop().toLowerCase();
  for (const [key, texture] of textureMap) {
    if (key.split('/').pop().split('\\').pop().toLowerCase() === basename) {
      return texture;
    }
  }
  
  // 3. Try partial match (path ends with texture name)
  for (const [key, texture] of textureMap) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes(basename) || basename.includes(keyLower)) {
      return texture;
    }
  }
  
  return null;
}

// Export supported map types for reference
export const SUPPORTED_MAP_TYPES = [
  'map', 'normalMap', 'metalnessMap', 'roughnessMap',
  'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap', 'displacementMap'
];

/**
 * Extract keywords from a string by splitting on capital letters
 * @param {string} str - Input string
 * @returns {string[]} Array of keywords
 */
function extractKeywords(str) {
  if (!str) return [];
  
  // Remove numbers and special characters, split by capital letters
  const cleaned = str.replace(/[0-9_\-]/g, '');
  const keywords = [];
  
  // Split by capital letters and filter out empty strings
  const parts = cleaned.split(/(?=[A-Z])/);
  parts.forEach(part => {
    if (part && part.length > 1) {
      keywords.push(part.toLowerCase());
    }
  });
  
  return keywords;
}

/**
 * Find the best matching texture for a material based on keywords
 * @param {string} materialName - Name of the material
 * @param {Map<string, THREE.Texture>} textureMap - Available textures
 * @param {Object} textureType - Texture type info (pattern, mapType, isColorMap)
 * @returns {THREE.Texture|null} Best matching texture or null
 */
function findBestTextureForMaterial(materialName, textureMap, textureType) {
  if (!materialName || !textureMap || !textureType) return null;
  
  const materialKeywords = extractKeywords(materialName);
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [textureKey, texture] of textureMap) {
    const textureName = textureKey.toLowerCase();
    
    // Check if texture matches the type pattern
    if (!textureType.pattern.test(textureName)) continue;
    
    // Extract keywords from texture filename
    const textureKeywords = extractKeywords(textureKey);
    
    // Calculate match score
    let score = 0;
    materialKeywords.forEach(mKeyword => {
      textureKeywords.forEach(tKeyword => {
        if (tKeyword.includes(mKeyword) || mKeyword.includes(tKeyword)) {
          score += mKeyword.length + tKeyword.length;
        }
      });
    });
    
    // Update best match if this one is better
    if (score > bestScore) {
      bestScore = score;
      bestMatch = texture;
    }
  }
  
  return bestMatch;
}

// default export grouping
export default {
  enhanceMaterial,
  makeOverride,
  applyMaterialOverride,
  applyEnvIntensityToMaterial,
  setLightOnly,
  disposeMaterialResources,
  applyTexturesFromMap,
  SUPPORTED_MAP_TYPES,
  extractKeywords,
  findBestTextureForMaterial
};