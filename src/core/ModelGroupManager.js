import * as THREE from 'three';
import Logger from './Logger.js';
import { EVENTS } from './EventSystem.js';

/**
 * ModelGroupManager
 * Управляет группами моделей и их метаданными
 * Автоматически создает группы при загрузке моделей
 */
export class ModelGroup {
  constructor(id, name, metadata = {}) {
    this.id = id;
    this.name = name;
    this.metadata = metadata;
    this.objects = new Set(); // Все объекты группы (меши, материалы, кости и т.д.)
    this.rootObject = null; // Основной объект группы
    this.children = new Set(); // Дочерние объекты
    this.createdAt = new Date();
    this.isVisible = true;
    this.transform = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    };
  }

  addObject(object) {
    if (object) {
      this.objects.add(object);
      if (!this.rootObject) {
        this.rootObject = object;
      }
      Logger.log(`[ModelGroup] Added object ${object.name || object.uuid} to group ${this.name}`);
    }
  }

  removeObject(object) {
    if (object && this.objects.has(object)) {
      this.objects.delete(object);
      if (this.rootObject === object) {
        this.rootObject = this.objects.size > 0 ? Array.from(this.objects)[0] : null;
      }
      Logger.log(`[ModelGroup] Removed object ${object.name || object.uuid} from group ${this.name}`);
    }
  }

  getBounds() {
    if (this.objects.size === 0) return null;

    const box = new THREE.Box3();
    this.objects.forEach(obj => {
      if (obj.isMesh || obj.isObject3D) {
        box.expandByObject(obj);
      }
    });
    return box;
  }

  setVisible(visible) {
    this.isVisible = visible;
    this.objects.forEach(obj => {
      obj.visible = visible;
    });
    Logger.log(`[ModelGroup] Group ${this.name} visibility set to ${visible}`);
  }

  dispose() {
    // Очистка ресурсов группы
    this.objects.forEach(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.objects.clear();
    this.children.clear();
    Logger.log(`[ModelGroup] Group ${this.name} disposed`);
  }
}

export class ModelGroupManager {
  constructor(eventSystem, sceneManager) {
    this.eventSystem = eventSystem;
    this.sceneManager = sceneManager;
    this.groups = new Map(); // id -> ModelGroup
    this.selectedGroup = null;

    this.setupEventListeners();
    Logger.log('[ModelGroupManager] Initialized');
  }

  setupEventListeners() {
    if (this.eventSystem) {
      this.eventSystem.on(EVENTS.MODEL_LOADED, this.handleModelLoaded.bind(this));
      this.eventSystem.on(EVENTS.SCENE_CLEARED, this.handleSceneCleared.bind(this));
      this.eventSystem.on(EVENTS.OBJECT_SELECTED, this.handleObjectSelected.bind(this));
    }
  }

  handleModelLoaded(data) {
    const { model, source } = data;
    if (model) {
      this.createGroupForModel(model, source);
    }
  }

  handleSceneCleared() {
    Logger.log('[ModelGroupManager] Clearing all model groups');
    this.groups.forEach(group => group.dispose());
    this.groups.clear();
    this.selectedGroup = null;
  }

  handleObjectSelected(data) {
    if (data && (data.isMesh || data.isObject3D)) {
      // Найти группу, содержащую выбранный объект
      const group = this.findGroupByObject(data);
      if (group && group !== this.selectedGroup) {
        this.selectedGroup = group;
        Logger.log(`[ModelGroupManager] Selected group: ${group.name}`);
        this.eventSystem?.emit('model-group-selected', { group });
      }
    }
  }

  createGroupForModel(model, source = {}) {
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const groupName = source.name || model.name || `Model ${this.groups.size + 1}`;

    // Извлечение метаданных из модели
    const metadata = this.extractMetadataFromModel(model, source);

    const group = new ModelGroup(groupId, groupName, metadata);

    // Добавление всех объектов модели в группу
    this.addModelToGroup(model, group);

    this.groups.set(groupId, group);
    Logger.log(`[ModelGroupManager] Created group ${groupName} with ${group.objects.size} objects`);

    this.eventSystem?.emit('model-group-created', { group });
    return group;
  }

  addModelToGroup(model, group) {
    // Рекурсивно добавляем все объекты модели
    model.traverse(obj => {
      group.addObject(obj);
    });

    // Устанавливаем корневой объект
    group.rootObject = model;
  }

  extractMetadataFromModel(model, source) {
    const metadata = {
      fileName: source.name || 'Unknown',
      filePath: source.path || '',
      loadTime: new Date().toISOString(),
      fileSize: source.size || 0,
      format: this.detectFormat(source.name),
      createdAt: new Date(),
      uuid: model.uuid
    };

    // Извлечение FBX-специфичных метаданных
    if (model.userData && model.userData.fbxMetadata) {
      const fbxMeta = model.userData.fbxMetadata;
      metadata.fbxVersion = fbxMeta.version;
      metadata.software = fbxMeta.software;
      metadata.creationTime = fbxMeta.creationTime;
      metadata.units = fbxMeta.units;
      metadata.coordinateSystem = fbxMeta.coordinateSystem;
    }

    // Статистика модели
    metadata.stats = this.calculateModelStats(model);

    return metadata;
  }

  calculateModelStats(model) {
    const stats = {
      meshes: 0,
      materials: 0,
      textures: 0,
      animations: 0,
      bones: 0,
      vertices: 0,
      triangles: 0
    };

    const materials = new Set();
    const textures = new Set();

    model.traverse(obj => {
      if (obj.isMesh) {
        stats.meshes++;
        stats.vertices += obj.geometry?.attributes?.position?.count || 0;
        stats.triangles += obj.geometry?.index?.count ? obj.geometry.index.count / 3 : obj.geometry?.attributes?.position?.count / 3 || 0;

        // Подсчет материалов
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => materials.add(mat));
          } else {
            materials.add(obj.material);
          }
        }

        // Подсчет текстур
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(mat => {
            if (mat.map) textures.add(mat.map);
            if (mat.normalMap) textures.add(mat.normalMap);
            if (mat.roughnessMap) textures.add(mat.roughnessMap);
            if (mat.metalnessMap) textures.add(mat.metalnessMap);
          });
        }
      }

      if (obj.isSkinnedMesh && obj.skeleton) {
        stats.bones += obj.skeleton.bones.length;
      }
    });

    stats.materials = materials.size;
    stats.textures = textures.size;

    // Анимации
    if (model.animations) {
      stats.animations = model.animations.length;
    }

    return stats;
  }

  detectFormat(fileName) {
    if (!fileName) return 'Unknown';
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'fbx': return 'FBX';
      case 'gltf':
      case 'glb': return 'GLTF';
      case 'obj': return 'OBJ';
      default: return ext.toUpperCase();
    }
  }

  findGroupByObject(object) {
    for (const group of this.groups.values()) {
      if (group.objects.has(object)) {
        return group;
      }
    }
    return null;
  }

  getGroupById(id) {
    return this.groups.get(id);
  }

  getAllGroups() {
    return Array.from(this.groups.values());
  }

  getSelectedGroup() {
    return this.selectedGroup;
  }

  selectGroup(group) {
    if (group && this.groups.has(group.id)) {
      this.selectedGroup = group;
      this.eventSystem?.emit('model-group-selected', { group });
      Logger.log(`[ModelGroupManager] Selected group: ${group.name}`);
    }
  }

  deleteGroup(groupId) {
    const group = this.groups.get(groupId);
    if (group) {
      group.dispose();
      this.groups.delete(groupId);

      if (this.selectedGroup === group) {
        this.selectedGroup = null;
      }

      this.eventSystem?.emit('model-group-deleted', { groupId });
      Logger.log(`[ModelGroupManager] Deleted group: ${group.name}`);
    }
  }

  getGroupMetadata(groupId) {
    const group = this.groups.get(groupId);
    return group ? group.metadata : null;
  }

  updateGroupMetadata(groupId, newMetadata) {
    const group = this.groups.get(groupId);
    if (group) {
      group.metadata = { ...group.metadata, ...newMetadata };
      this.eventSystem?.emit('model-group-updated', { group });
      Logger.log(`[ModelGroupManager] Updated metadata for group: ${group.name}`);
    }
  }

  dispose() {
    this.groups.forEach(group => group.dispose());
    this.groups.clear();
    this.selectedGroup = null;
    Logger.log('[ModelGroupManager] Disposed');
  }
}

export default ModelGroupManager;