// Integration example for PolygonSelectionManager with your existing architecture

import { SceneManager } from './Scene.js';
import { RendererManager } from './Renderer.js';
import { initInspector } from './Inspector.js';
import { AnimationManager } from './Animation.js';
import { PolygonSelectionManager } from './PolygonSelection.js';

class App3D {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Initialize your existing managers
    this.sceneManager = new SceneManager();
    this.rendererManager = new RendererManager({ canvas: this.canvas });
    this.animationManager = new AnimationManager();
    
    // Initialize inspector
    this.inspector = initInspector({
      sceneManager: this.sceneManager,
      onSelect: (objects) => this.onInspectorSelection(objects),
      onFocus: (object) => this.focusOnObject(object),
      // ... other inspector options
    });
    
    // Initialize polygon selection
    this.polygonSelection = new PolygonSelectionManager({
      canvas: this.canvas,
      camera: this.camera,
      sceneManager: this.sceneManager,
      rendererManager: this.rendererManager,
      inspector: this.inspector,
      onSelection: (objects) => this.onPolygonSelection(objects)
    });
    
    this.setupUI();
    this.animate();
  }
  
  setupUI() {
    // Add polygon selection toggle button
    const polygonBtn = document.createElement('button');
    polygonBtn.className = 'btn';
    polygonBtn.innerHTML = '<i class="fa-solid fa-draw-polygon"></i> Polygon Select';
    polygonBtn.title = 'Toggle polygon selection mode (Click and drag to select multiple objects)';
    
    polygonBtn.addEventListener('click', () => {
      const isActive = this.polygonSelection.toggle();
      polygonBtn.classList.toggle('active', isActive);
      
      if (isActive) {
        polygonBtn.innerHTML = '<i class="fa-solid fa-times"></i> Exit Polygon';
        // Disable other selection modes if needed
        this.disableOtherSelectionModes();
      } else {
        polygonBtn.innerHTML = '<i class="fa-solid fa-draw-polygon"></i> Polygon Select';
        this.enableOtherSelectionModes();
      }
    });
    
    // Add to your existing toolbar
    const toolbar = document.querySelector('.toolbar') || document.body;
    toolbar.appendChild(polygonBtn);
    
    // Add keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          polygonBtn.click();
        }
      }
    });
  }
  
  disableOtherSelectionModes() {
    // Disable transform controls or other selection modes
    if (this.transformControls) {
      this.transformControls.enabled = false;
    }
    
    // Disable orbit controls while in polygon selection mode
    if (this.orbitControls) {
      this.orbitControls.enabled = false;
    }
  }
  
  enableOtherSelectionModes() {
    // Re-enable other controls
    if (this.transformControls) {
      this.transformControls.enabled = true;
    }
    
    if (this.orbitControls) {
      this.orbitControls.enabled = true;
    }
  }
  
  onInspectorSelection(objects) {
    console.log('Inspector selected objects:', objects);
    
    // Update outline pass for selected objects
    if (this.rendererManager.setOutlineObjects) {
      this.rendererManager.setOutlineObjects(objects);
    }
  }
  
  onPolygonSelection(objects) {
    console.log('Polygon selected objects:', objects);
    
    // You can perform additional actions on polygon-selected objects
    if (objects.length > 0) {
      // Example: Change material color temporarily
      this.highlightSelectedObjects(objects);
      
      // Update outline pass
      if (this.rendererManager.setOutlineObjects) {
        this.rendererManager.setOutlineObjects(objects);
      }
      
      // Show selection info in UI
      this.showSelectionInfo(objects);
    }
  }
  
  highlightSelectedObjects(objects) {
    // Temporarily change material properties to highlight selection
    objects.forEach(obj => {
      if (obj.isMesh && obj.material) {
        // Store original material properties
        if (!obj.userData.originalMaterial) {
          obj.userData.originalMaterial = {
            color: obj.material.color?.clone(),
            emissive: obj.material.emissive?.clone()
          };
        }
        
        // Apply highlight
        if (obj.material.emissive) {
          obj.material.emissive.setHex(0x0066ff);
        }
        obj.material.needsUpdate = true;
      }
    });
    
    // Restore after delay
    setTimeout(() => {
      objects.forEach(obj => {
        if (obj.isMesh && obj.material && obj.userData.originalMaterial) {
          if (obj.material.emissive && obj.userData.originalMaterial.emissive) {
            obj.material.emissive.copy(obj.userData.originalMaterial.emissive);
          }
          obj.material.needsUpdate = true;
        }
      });
    }, 2000);
  }
  
  showSelectionInfo(objects) {
    // Create or update selection info panel
    let infoPanel = document.getElementById('selection-info');
    if (!infoPanel) {
      infoPanel = document.createElement('div');
      infoPanel.id = 'selection-info';
      infoPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        z-index: 1000;
        max-width: 300px;
      `;
      document.body.appendChild(infoPanel);
    }
    
    const meshCount = objects.filter(o => o.isMesh).length;
    const lightCount = objects.filter(o => o.isLight).length;
    const cameraCount = objects.filter(o => o.isCamera).length;
    
    infoPanel.innerHTML = `
      <strong>Polygon Selection:</strong><br>
      Total: ${objects.length}<br>
      Meshes: ${meshCount}<br>
      Lights: ${lightCount}<br>
      Cameras: ${cameraCount}<br>
      <hr style="margin: 5px 0;">
      ${objects.slice(0, 5).map(o => `• ${o.name || o.type}`).join('<br>')}
      ${objects.length > 5 ? `<br>... and ${objects.length - 5} more` : ''}
    `;
    
    // Auto-hide after delay
    setTimeout(() => {
      if (infoPanel && infoPanel.parentNode) {
        infoPanel.parentNode.removeChild(infoPanel);
      }
    }, 5000);
  }
  
  focusOnObject(object) {
    // Implement focus logic - move camera to object
    if (this.orbitControls && object) {
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // Calculate optimal camera distance
      const maxSize = Math.max(size.x, size.y, size.z);
      const distance = maxSize * 2;
      
      // Animate camera to position
      this.orbitControls.target.copy(center);
      this.camera.position.copy(center).add(new THREE.Vector3(distance, distance, distance));
      this.orbitControls.update();
    }
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Update animation manager
    this.animationManager.update(0.016); // Assuming 60 FPS
    
    // Render scene
    this.rendererManager.render(this.sceneManager.getScene(), this.camera);
  }
  
  dispose() {
    // Clean up polygon selection
    if (this.polygonSelection) {
      this.polygonSelection.dispose();
    }
    
    // Clean up other managers
    this.rendererManager?.dispose();
    this.sceneManager?.dispose();
    this.animationManager?.dispose();
  }
}

// Usage
const app = new App3D();

// Handle window resize
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  app.camera.aspect = width / height;
  app.camera.updateProjectionMatrix();
  app.rendererManager.setSize(width, height);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  app.dispose();
});