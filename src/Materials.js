import * as THREE from 'three';
import Logger from './core/Logger.js';

// Утилиты для работы с материалами
const savedOriginal = new WeakMap();
const savedOverride = new WeakMap();

/**
 * Улучшает материал, приводя его к MeshStandardMaterial, если он таковым не является.
 * @param {THREE.Material | THREE.Material[]} material - Исходный материал или массив материалов.
 * @returns {THREE.Material | THREE.Material[]} Улучшенный материал.
 */
export function enhanceMaterial(material) {
  if (!material) return material;
  if (Array.isArray(material)) return material.map(m => enhanceMaterial(m));

  // Если материал не является стандартным, создаем новый на его основе
  if (!(material instanceof THREE.MeshStandardMaterial)) {
    const m = new THREE.MeshStandardMaterial({
      name: material.name || '',
      color: material.color ? material.color.clone() : new THREE.Color(0xcccccc),
      opacity: material.opacity ?? 1,
      transparent: !!material.transparent,
      side: material.side ?? THREE.FrontSide,
      wireframe: false,
      flatShading: !!material.flatShading
    });
    if (material.map) { m.map = material.map; if (m.map) m.map.colorSpace = THREE.SRGBColorSpace; }
    m.metalness = material.metalness ?? 0.0;
    m.roughness = material.roughness ?? 0.5;
    material = m;
  } else {
    // Для стандартных материалов просто настраиваем цветовое пространство карты
    if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
  }
  material.needsUpdate = true;
  return material;
}

/**
 * Создает материал для переопределения.
 * @param {string} type - Тип материала ('standard', 'phong', 'basic', 'normal', 'toon').
 * @returns {THREE.Material | null} Новый материал или null.
 */
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

/**
 * Применяет интенсивность окружения к материалу.
 * @param {THREE.Material | THREE.Material[]} material - Материал или массив материалов.
 * @param {number} intensity - Интенсивность.
 */
export function applyEnvIntensityToMaterial(material, intensity) {
  const list = Array.isArray(material) ? material : [material];
  list.filter(Boolean).forEach(m=>{
    if ('envMapIntensity' in m){ m.envMapIntensity = intensity; m.needsUpdate = true; }
  });
}

/**
 * Применяет переопределение материала или каркасный режим к объекту и его дочерним элементам.
 * @param {THREE.Object3D} root - Корневой объект.
 * @param {object} options - Опции.
 * @param {string} [options.overrideType='none'] - Тип материала для переопределения.
 * @param {boolean} [options.wire=false] - Включить ли каркасный режим.
 * @param {number} [options.envIntensity=1] - Интенсивность окружения.
 */
export function applyMaterialOverride(root, options = {}) {
  if (!root) return;
  const { overrideType = 'none', wire = false, envIntensity = 1 } = options;
  const overrideMat = makeOverride(overrideType);

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
      if (savedOverride.has(o)){
        const orig = savedOverride.get(o);
        const current = o.material;
        o.material = orig;
        savedOverride.delete(o);
        if (current && current !== orig) _disposeMaterial(current);
      } else {
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

/**
 * Переключает режим "только освещение", скрывая все текстурные карты.
 * @param {THREE.Object3D} root - Корневой объект.
 * @param {boolean} on - Включить или выключить режим.
 */
export function setLightOnly(root, on) {
  if (!root) return;

  root.traverse(o=>{
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];

    if (on){
      if (!savedOriginal.has(o)){
        const snapshot = mats.map(m => ({
          ref: m, color: m?.color?.clone?.(), emissive: m?.emissive?.clone?.(),
          emissiveIntensity: m?.emissiveIntensity, map: m?.map || null,
          emissiveMap: m?.emissiveMap || null, normalMap: m?.normalMap || null,
          roughnessMap: m?.roughnessMap || null, metalnessMap: m?.metalnessMap || null,
          aoMap: m?.aoMap || null, bumpMap: m?.bumpMap || null,
          displacementMap: m?.displacementMap || null, alphaMap: m?.alphaMap || null,
          side: m?.side, transparent: m?.transparent, opacity: m?.opacity,
          alphaTest: m?.alphaTest, depthWrite: m?.depthWrite, visible: m?.visible,
          roughness: m?.roughness, metalness: m?.metalness, envMapIntensity: m?.envMapIntensity
        }));
        savedOriginal.set(o, snapshot);
      }

      mats.forEach(m=>{
        if (!m) return;
        m.map = null; m.emissiveMap = null;
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
          let saved = snapshot.find(s => s.ref === cm) || snapshot[idx];
          if (!saved) return;
          try {
            Object.assign(cm, {
              map: saved.map, emissiveMap: saved.emissiveMap, normalMap: saved.normalMap,
              roughnessMap: saved.roughnessMap, metalnessMap: saved.metalnessMap, aoMap: saved.aoMap,
              bumpMap: saved.bumpMap, displacementMap: saved.displacementMap, alphaMap: saved.alphaMap,
              emissiveIntensity: saved.emissiveIntensity, roughness: saved.roughness, metalness: saved.metalness,
              side: saved.side, transparent: saved.transparent, opacity: saved.opacity,
              alphaTest: saved.alphaTest, depthWrite: saved.depthWrite, visible: saved.visible,
              envMapIntensity: saved.envMapIntensity
            });
            saved.color && cm.color?.copy?.(saved.color);
            saved.emissive && cm.emissive?.copy?.(saved.emissive);
            cm.needsUpdate = true;
          } catch(e){ Logger.error('[Materials] Error updating material color:', e); }
        });
        savedOriginal.delete(o);
      }
    }
  });
}

/**
 * Освобождает ресурсы материалов и геометрий.
 * @param {THREE.Object3D} root - Корневой объект.
 */
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
 * Нормализует имя материала для сопоставления.
 * @param {string} materialName - Имя материала.
 * @returns {string} Нормализованное имя.
 */
function normalizeMaterialName(materialName) {
  if (!materialName) return '';
  return materialName.toLowerCase()
    .replace(/(?:_mtl|_mat|_material)$/i, '') // Удаляет популярные суффиксы
    .replace(/[-_\s]+/g, ''); // Удаляет разделители
}

/**
 * Разбирает имя файла текстуры для извлечения префикса материала и типа карты.
 * Эта версия более надежна и разделяет имя по последнему знаку подчеркивания.
 * @param {string} filename - Имя файла текстуры.
 * @returns {{materialPrefix: string, mapType: string} | null} Разобранные компоненты или null.
 */
function parseTextureFilename(filename) {
  if (!filename) return null;

  const baseName = filename.toLowerCase();
  const pathParts = baseName.split(/[\\/]/);
  const fileName = pathParts[pathParts.length - 1];
  
  const dotIndex = fileName.lastIndexOf('.');
  const nameNoExt = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;

  const lastUnderscoreIndex = nameNoExt.lastIndexOf('_');
  if (lastUnderscoreIndex === -1) {
    return null; // Разделитель не найден
  }
  
  const materialPrefix = normalizeMaterialName(nameNoExt.substring(0, lastUnderscoreIndex));
  let mapTypeSuffix = nameNoExt.substring(lastUnderscoreIndex + 1).replace(/[^a-z0-9]/g, '');

  const mapTypeMap = {
    'basecolor': 'map', 'basecolour': 'map', 'diffuse': 'map', 'albedo': 'map', 'color': 'map', 'base': 'map',
    'normal': 'normalMap', 'norm': 'normalMap',
    'roughness': 'roughnessMap', 'rough': 'roughnessMap',
    'metallic': 'metalnessMap', 'metal': 'metalnessMap', 'metalic': 'metalnessMap',
    'ao': 'aoMap', 'ambientocclusion': 'aoMap',
    'emissive': 'emissiveMap', 'emission': 'emissiveMap', 'emit': 'emissiveMap',
    'alpha': 'alphaMap', 'transparency': 'alphaMap',
    'bump': 'bumpMap', 'height': 'bumpMap',
    'displacement': 'displacementMap'
  };

  const mapType = mapTypeMap[mapTypeSuffix] || null;

  return { materialPrefix, mapType };
}

/**
 * Создает индекс "материал -> текстуры" из карты текстур.
 * @param {Map<string, THREE.Texture>} textureMap - Карта путей текстур к текстурам.
 * @returns {Map<string, Map<string, THREE.Texture>>} Карта нормализованных имен материалов к (тип карты -> текстура).
 */
function buildMaterialTextureIndex(textureMap) {
  const materialIndex = new Map();
  
  for (const [textureKey, texture] of textureMap) {
    const filename = texture.name || textureKey;
    const parsed = parseTextureFilename(filename);
    
    if (parsed && parsed.materialPrefix && parsed.mapType) {
      const { materialPrefix, mapType } = parsed;
      if (!materialIndex.has(materialPrefix)) {
        materialIndex.set(materialPrefix, new Map());
      }
      materialIndex.get(materialPrefix).set(mapType, texture);
    }
  }
  
  return materialIndex;
}

/**
 * Применяет текстуры из карты текстур к материалам в 3D-объекте.
 * Эта версия упрощена и полагается исключительно на детерминированный индекс материалов и текстур.
 * @param {THREE.Object3D} rootObject - Корневой объект для обхода.
 * @param {Map<string, THREE.Texture>} textureMap - Карта текстур, загруженных из ZIP.
 */
export function applyTexturesFromMap(rootObject, textureMap) {
  if (!rootObject || !textureMap || textureMap.size === 0) return;

  Logger.log('[Materials] Applying textures from map...');
  const materialIndex = buildMaterialTextureIndex(textureMap);

  if (materialIndex.size === 0) {
    Logger.warn('[Materials] Texture index is empty. No textures will be applied. Check texture naming.');
    return;
  }
  
  Logger.log(`[Materials] Built material-texture index with ${materialIndex.size} materials.`);
  
  const mappingSummary = new Map();

  rootObject.traverse((object) => {
    if (!object.isMesh || !object.material) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];

    materials.forEach((material) => {
      if (!material || !material.name) return;
      
      const normalizedMaterialName = normalizeMaterialName(material.name);
      
      if (materialIndex.has(normalizedMaterialName)) {
        const materialTextures = materialIndex.get(normalizedMaterialName);

        // Если для материала нашлась основная текстура цвета (map),
        // то принудительно отключаем цвета вершин и сбрасываем базовый цвет.
        if (materialTextures.has('map')) {
          material.vertexColors = false; // Игнорировать цвета вершин из модели
          if (material.color) {
              material.color.set(0xffffff); // Сбросить цвет материала на белый
          }
        }

        for (const [mapType, texture] of materialTextures.entries()) {
          // Настройка свойств текстуры
          if (mapType === 'map' || mapType === 'emissiveMap') {
            texture.colorSpace = THREE.SRGBColorSpace;
          }
          
          // >>> НАЧАЛО ИСПРАВЛЕНИЯ <<<
          // Для FBX моделей часто требуется переворачивать текстуру по оси Y.
          texture.flipY = true;
          // >>> КОНЕЦ ИСПРАВЛЕНИЯ <<<
          
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          
          texture.needsUpdate = true;
          
          // Применение текстуры
          material[mapType] = texture;
          material.needsUpdate = true;

          // Логирование для отладки
          if (!mappingSummary.has(material.name)) {
            mappingSummary.set(material.name, new Map());
          }
          mappingSummary.get(material.name).set(mapType, texture.name);
        }
      }
    });
  });

  // Вывод итоговой информации о сопоставлении
  Logger.info('[Materials] === Texture Mapping Summary ===');
  if (mappingSummary.size === 0) {
    Logger.info('[Materials] No textures were applied. Check material and texture names for mismatches.');
  } else {
    for (const [materialName, maps] of mappingSummary) {
      const mapEntries = Array.from(maps.entries()).map(([mapType, textureName]) => `${mapType}: ${textureName}`);
      Logger.info(`[Materials] ${materialName} -> { ${mapEntries.join(', ')} }`);
    }
  }
  Logger.info('[Materials] === End Mapping Summary ===');
}

// Экспорт поддерживаемых типов карт для справки
export const SUPPORTED_MAP_TYPES = [
  'map', 'normalMap', 'metalnessMap', 'roughnessMap',
  'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap', 'displacementMap'
];

// Группировка экспорта по умолчанию
export default {
  enhanceMaterial,
  makeOverride,
  applyMaterialOverride,
  applyEnvIntensityToMaterial,
  setLightOnly,
  disposeMaterialResources,
  applyTexturesFromMap,
  SUPPORTED_MAP_TYPES,
};
