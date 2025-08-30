/**
 * FBX Metadata Extractor
 * Utility for extracting and parsing FBX file metadata
 * Integrates with the existing FBX loader to provide detailed file information
 */

import * as THREE from 'three';
import Logger from '../core/Logger.js';

export class FBXMetadataExtractor {
  constructor() {
    this.supportedProperties = [
      'CreationTime',
      'Creator',
      'SceneInfo',
      'GlobalSettings',
      'Documents',
      'References',
      'Definitions'
    ];
  }

  /**
   * Extract metadata from loaded FBX object and file
   * @param {THREE.Object3D} fbxObject - Loaded FBX object
   * @param {File} file - Original file object
   * @returns {Object} Extracted metadata
   */
  extractMetadata(fbxObject, file) {
    Logger.log('[FBXMetadataExtractor] Extracting metadata from FBX object');
    
    const metadata = {
      // File information
      fileName: file.name,
      fileSize: this.formatFileSize(file.size),
      lastModified: file.lastModified ? new Date(file.lastModified).toLocaleString() : 'Unknown',
      
      // FBX specific data
      creationTime: this.extractCreationTime(fbxObject),
      software: this.extractSoftware(fbxObject),
      version: this.extractVersion(fbxObject),
      units: this.detectUnits(fbxObject),
      coordinateSystem: this.detectCoordinateSystem(fbxObject),
      
      // Scene statistics
      meshCount: this.countMeshes(fbxObject),
      materialCount: this.countMaterials(fbxObject),
      textureCount: this.countTextures(fbxObject),
      animationCount: this.countAnimations(fbxObject),
      boneCount: this.countBones(fbxObject),
      
      // Additional properties
      hasAnimations: this.hasAnimations(fbxObject),
      hasSkeleton: this.hasSkeleton(fbxObject),
      hasTextures: this.hasTextures(fbxObject)
    };

    Logger.log('[FBXMetadataExtractor] Metadata extracted:', metadata);
    return metadata;
  }

  /**
   * Extract creation time from FBX userData
   */
  extractCreationTime(fbxObject) {
    try {
      // Check various possible locations for creation time
      if (fbxObject.userData?.CreationTime) {
        return new Date(fbxObject.userData.CreationTime).toLocaleString();
      }
      
      if (fbxObject.userData?.SceneInfo?.CreationTime) {
        return new Date(fbxObject.userData.SceneInfo.CreationTime).toLocaleString();
      }

      // Look in children for scene info
      let creationTime = null;
      fbxObject.traverse(child => {
        if (child.userData?.CreationTime && !creationTime) {
          creationTime = new Date(child.userData.CreationTime).toLocaleString();
        }
      });

      return creationTime || 'Unknown';
    } catch (error) {
      Logger.warn('[FBXMetadataExtractor] Failed to extract creation time:', error);
      return 'Unknown';
    }
  }

  /**
   * Extract software information
   */
  extractSoftware(fbxObject) {
    try {
      // Check userData for software info
      if (fbxObject.userData?.Creator) {
        return fbxObject.userData.Creator;
      }

      if (fbxObject.userData?.SceneInfo?.Creator) {
        return fbxObject.userData.SceneInfo.Creator;
      }

      // Common software signatures in FBX files
      const softwareSignatures = [
        'Maya', 'Blender', '3ds Max', 'Cinema 4D', 'MotionBuilder', 
        'Unity', 'Unreal', 'Houdini', 'Modo', 'Lightwave'
      ];

      // Search in userData strings
      const userDataStr = JSON.stringify(fbxObject.userData || {});
      for (const software of softwareSignatures) {
        if (userDataStr.toLowerCase().includes(software.toLowerCase())) {
          return software;
        }
      }

      return 'Unknown';
    } catch (error) {
      Logger.warn('[FBXMetadataExtractor] Failed to extract software info:', error);
      return 'Unknown';
    }
  }

  /**
   * Extract FBX version
   */
  extractVersion(fbxObject) {
    try {
      if (fbxObject.userData?.Version) {
        return fbxObject.userData.Version;
      }

      if (fbxObject.userData?.FBXVersion) {
        return fbxObject.userData.FBXVersion;
      }

      // Default version detection based on features
      if (this.hasAnimations(fbxObject)) {
        return '7.4+'; // Newer versions typically have better animation support
      }

      return 'Unknown';
    } catch (error) {
      Logger.warn('[FBXMetadataExtractor] Failed to extract version:', error);
      return 'Unknown';
    }
  }

  /**
   * Detect units used in the FBX file
   */
  detectUnits(fbxObject) {
    try {
      // Check userData for unit information
      if (fbxObject.userData?.GlobalSettings?.UnitScaleFactor) {
        const scaleFactor = fbxObject.userData.GlobalSettings.UnitScaleFactor;
        return this.scaleFactorToUnits(scaleFactor);
      }

      // Analyze object scales to guess units
      const boundingBox = this.calculateBoundingBox(fbxObject);
      const size = boundingBox.max.distanceTo(boundingBox.min);
      
      if (size < 0.1) return 'mm';
      if (size < 10) return 'cm';
      if (size < 1000) return 'm';
      return 'Unknown';
    } catch (error) {
      Logger.warn('[FBXMetadataExtractor] Failed to detect units:', error);
      return 'Unknown';
    }
  }

  /**
   * Detect coordinate system
   */
  detectCoordinateSystem(fbxObject) {
    try {
      // Check userData for coordinate system info
      if (fbxObject.userData?.GlobalSettings?.CoordAxis) {
        return fbxObject.userData.GlobalSettings.CoordAxis;
      }

      // Analyze mesh orientations to guess coordinate system
      let hasYUp = false;
      let hasZUp = false;

      fbxObject.traverse(child => {
        if (child.isMesh && child.geometry) {
          const bbox = child.geometry.boundingBox;
          if (bbox) {
            if (Math.abs(bbox.max.y - bbox.min.y) > Math.abs(bbox.max.z - bbox.min.z)) {
              hasYUp = true;
            } else {
              hasZUp = true;
            }
          }
        }
      });

      if (hasYUp && !hasZUp) return 'Y-Up';
      if (hasZUp && !hasYUp) return 'Z-Up';
      return 'Mixed/Unknown';
    } catch (error) {
      Logger.warn('[FBXMetadataExtractor] Failed to detect coordinate system:', error);
      return 'Unknown';
    }
  }

  /**
   * Count meshes in the FBX object
   */
  countMeshes(fbxObject) {
    let count = 0;
    fbxObject.traverse(child => {
      if (child.isMesh) count++;
    });
    return count;
  }

  /**
   * Count materials
   */
  countMaterials(fbxObject) {
    const materials = new Set();
    fbxObject.traverse(child => {
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => materials.add(mat.uuid));
        } else {
          materials.add(child.material.uuid);
        }
      }
    });
    return materials.size;
  }

  /**
   * Count textures
   */
  countTextures(fbxObject) {
    const textures = new Set();
    fbxObject.traverse(child => {
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(material => {
          Object.values(material).forEach(value => {
            if (value && value.isTexture) {
              textures.add(value.uuid);
            }
          });
        });
      }
    });
    return textures.size;
  }

  /**
   * Count animations
   */
  countAnimations(fbxObject) {
    return fbxObject.animations ? fbxObject.animations.length : 0;
  }

  /**
   * Count bones
   */
  countBones(fbxObject) {
    let count = 0;
    fbxObject.traverse(child => {
      if (child.isBone) count++;
      if (child.isSkinnedMesh && child.skeleton) {
        count += child.skeleton.bones.length;
      }
    });
    return count;
  }

  /**
   * Check if object has animations
   */
  hasAnimations(fbxObject) {
    return fbxObject.animations && fbxObject.animations.length > 0;
  }

  /**
   * Check if object has skeleton
   */
  hasSkeleton(fbxObject) {
    let hasSkeleton = false;
    fbxObject.traverse(child => {
      if (child.isSkinnedMesh && child.skeleton) {
        hasSkeleton = true;
      }
    });
    return hasSkeleton;
  }

  /**
   * Check if object has textures
   */
  hasTextures(fbxObject) {
    return this.countTextures(fbxObject) > 0;
  }

  /**
   * Helper methods
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  scaleFactorToUnits(scaleFactor) {
    const unitMap = {
      1: 'cm',
      10: 'mm', 
      100: 'm',
      2.54: 'inches',
      30.48: 'feet'
    };
    return unitMap[scaleFactor] || `Scale: ${scaleFactor}`;
  }

  calculateBoundingBox(object) {
    const box = new THREE.Box3();
    object.traverse(child => {
      if (child.isMesh && child.geometry) {
        child.geometry.computeBoundingBox();
        if (child.geometry.boundingBox) {
          box.union(child.geometry.boundingBox);
        }
      }
    });
    return box;
  }
}

export default FBXMetadataExtractor;