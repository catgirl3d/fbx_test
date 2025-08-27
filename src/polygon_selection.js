import * as THREE from 'three';
import Logger from './core/Logger.js';

/**
 * PolygonSelectionManager
 * Implements polygon/lasso selection functionality for 3D scenes
 * Integrates with existing SceneManager, RendererManager, and Inspector
 */
export class PolygonSelectionManager {
  constructor({
    canvas,
    camera,
    sceneManager,
    rendererManager,
    inspector = null,
    inputHandler = null,
    onSelection = null
  } = {}) {
    if (!canvas) {
      Logger.error('[PolygonSelection] Constructor: "canvas" parameter is required.');
      throw new Error('PolygonSelectionManager: canvas parameter is required.');
    }
    if (!camera) {
      Logger.error('[PolygonSelection] Constructor: "camera" parameter is required.');
      throw new Error('PolygonSelectionManager: camera parameter is required.');
    }
    if (!sceneManager) {
      Logger.error('[PolygonSelection] Constructor: "sceneManager" parameter is required.');
      throw new Error('PolygonSelectionManager: sceneManager parameter is required.');
    }
    if (!rendererManager) {
      Logger.error('[PolygonSelection] Constructor: "rendererManager" parameter is required.');
      throw new Error('PolygonSelectionManager: rendererManager parameter is required.');
    }

    this.canvas = canvas;
    this.camera = camera;
    this.sceneManager = sceneManager;
    this.rendererManager = rendererManager;
    this.inspector = inspector;
    this.inputHandler = inputHandler;
    this.onSelection = onSelection;
 
    this.controls = null;

    // Selection state
    this.isActive = false;
    this.isDrawing = false;
    this.polygonPoints = [];
    this.selectedObjects = [];

    // Visual elements
    this.selectionOverlay = null;
    this.polygonPath = null;
    this.selectionBox = null;

    // Raycaster for object detection
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 0.1;
    this.raycaster.params.Line.threshold = 0.1;

    // Temporary storage for canvas operations
    this.canvasRect = null;
    
    // Debug markers with memory management
    this.debugMarkers = [];
    this.maxDebugMarkers = 1000; // Limit to prevent memory leaks
    
    // Store original pointer-events values for proper restoration
    this.originalCanvasPointerEvents = null;
    this.originalRendererPointerEvents = null;

    this.init();
  }

  init() {
    this.createOverlay();
    this.bindEvents();
    this.registerKeyboardHandlers();
  }

  registerKeyboardHandlers() {
    // Register Escape key handler with the centralized keyboard manager
    if (this.inputHandler?.keyboardManager) {
      this.inputHandler.keyboardManager.registerKeyHandler('Escape', (event) => {
        if (this.isActive) {
          this.deactivate();
        }
      });
      Logger.log('[PolygonSelection] Escape key handler registered with centralized keyboard manager');
    } else {
      Logger.warn('[PolygonSelection] InputHandler or keyboard manager not available for Escape key registration');
    }
  }

  createOverlay() {
    // Create overlay canvas for drawing selection polygon
    this.selectionOverlay = document.createElement('canvas');
    this.selectionOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 999999;
      display: none;
    `;
    
    // Try to insert overlay next to canvas in same parent
    if (this.canvas.parentNode) {
      // Ensure parent has relative positioning
      const computedStyle = window.getComputedStyle(this.canvas.parentNode);
      if (computedStyle.position === 'static') {
        this.canvas.parentNode.style.position = 'relative';
      }
      
      // Insert AFTER canvas so it appears on top
      if (this.canvas.nextSibling) {
        this.canvas.parentNode.insertBefore(this.selectionOverlay, this.canvas.nextSibling);
      } else {
        this.canvas.parentNode.appendChild(this.selectionOverlay);
      }
    } else {
      // Fallback to body
      document.body.appendChild(this.selectionOverlay);
    }
 
    this.overlayContext = this.selectionOverlay.getContext('2d');
    this.updateOverlaySize();
  }

  updateOverlaySize() {
    if (!this.selectionOverlay) return;
    
    const canvasRect = this.canvas.getBoundingClientRect();
    const width = this.canvas.offsetWidth || canvasRect.width;
    const height = this.canvas.offsetHeight || canvasRect.height;
    
    // Set canvas actual size
    this.selectionOverlay.width = width;
    this.selectionOverlay.height = height;
    
    if (this.selectionOverlay.parentNode === document.body) {
      // If in body, use absolute positioning with scroll
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      this.selectionOverlay.style.width = width + 'px';
      this.selectionOverlay.style.height = height + 'px';
      this.selectionOverlay.style.left = (canvasRect.left + scrollX) + 'px';
      this.selectionOverlay.style.top = (canvasRect.top + scrollY) + 'px';
    } else {
      // If in canvas parent, position directly over canvas
      this.selectionOverlay.style.width = width + 'px';
      this.selectionOverlay.style.height = height + 'px';
      this.selectionOverlay.style.left = this.canvas.offsetLeft + 'px';
      this.selectionOverlay.style.top = this.canvas.offsetTop + 'px';
    }
  }

  bindEvents() {
    // Store bound methods for proper event removal
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundResize = this.onResize.bind(this);

    // Initially not bound - activated by toggle
    // Keyboard event handling moved to centralized manager
    window.addEventListener('resize', this.boundResize);
  }

  activate() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.canvas.style.cursor = 'crosshair';
    
    // Store original pointer events and disable controls immediately
    this.storeOriginalPointerEvents();
    this.canvas.style.pointerEvents = 'none';
    if (this.rendererManager?.renderer?.domElement) {
      this.rendererManager.renderer.domElement.style.pointerEvents = 'none';
    }
    
    // Disable OrbitControls immediately when activating lasso tool
    if (this.inputHandler) {
      this.inputHandler.disableControls();
    } else if (this.controls) {
      this.controls.enabled = false;
    }
    
    // Enable overlay for all pointer events
    this.selectionOverlay.style.pointerEvents = 'all';
    this.selectionOverlay.style.display = 'block';
    
    this.selectionOverlay.addEventListener('mousedown', this.boundMouseDown);
    this.selectionOverlay.addEventListener('mousemove', this.boundMouseMove);
    this.selectionOverlay.addEventListener('mouseup', this.boundMouseUp);
  }

  deactivate() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.isDrawing = false;
    this.canvas.style.cursor = 'default';
    this.selectionOverlay.style.pointerEvents = 'none';
    this.selectionOverlay.style.display = 'none';
    
    this.selectionOverlay.removeEventListener('mousedown', this.boundMouseDown);
    this.selectionOverlay.removeEventListener('mousemove', this.boundMouseMove);
    this.selectionOverlay.removeEventListener('mouseup', this.boundMouseUp);
    
    // Restore pointer events and re-enable controls
    this.restorePointerEvents();
    
    if (this.inputHandler) {
      this.inputHandler.enableControls();
    } else if (this.controls) {
      this.controls.enabled = true;
    }
    
    this.clearPolygon();
  }

  toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
    return this.isActive;
  }

  storeOriginalPointerEvents() {
    this.originalCanvasPointerEvents = this.canvas.style.pointerEvents || 'auto';
    if (this.rendererManager?.renderer?.domElement) {
      this.originalRendererPointerEvents = this.rendererManager.renderer.domElement.style.pointerEvents || 'auto';
    }
  }

  restorePointerEvents() {
    if (this.originalCanvasPointerEvents !== null) {
      this.canvas.style.pointerEvents = this.originalCanvasPointerEvents;
      this.originalCanvasPointerEvents = null;
    }
    
    if (this.originalRendererPointerEvents !== null && this.rendererManager?.renderer?.domElement) {
      this.rendererManager.renderer.domElement.style.pointerEvents = this.originalRendererPointerEvents;
      this.originalRendererPointerEvents = null;
    }
  }

  onMouseDown(event) {
    if (!this.isActive || event.button !== 0) return; // Only left mouse button
    
    event.preventDefault();
    event.stopPropagation();
    
    this.isDrawing = true;
    this.polygonPoints = [];
    
    // Force overlay to be visible and update size
    this.updateOverlaySize();
    this.selectionOverlay.style.display = 'block';
    
    const point = this.getMousePosition(event);
    this.polygonPoints.push(point);
    
    this.clearCanvas();
    
    // Draw initial point as a small circle for immediate feedback
    if (this.overlayContext) {
      this.overlayContext.save();
      this.overlayContext.fillStyle = '#3b82f6';
      this.overlayContext.beginPath();
      this.overlayContext.arc(point.x, point.y, 3, 0, Math.PI * 2);
      this.overlayContext.fill();
      this.overlayContext.restore();
    }
  }

  onMouseMove(event) {
    if (!this.isActive) return;
    
    if (!this.isDrawing) {
      // Change cursor when hovering over overlay in active mode
      this.canvas.style.cursor = 'crosshair';
      return;
    }
    
    event.preventDefault();
    
    const point = this.getMousePosition(event);
    this.polygonPoints.push(point);
    
    this.drawPolygon();
  }

  onMouseUp(event) {
    if (!this.isActive || !this.isDrawing || event.button !== 0) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    this.isDrawing = false;
    
    // Minimum polygon size check
    if (this.polygonPoints.length < 3) {
      this.clearPolygon();
      return;
    }
    
    // Close the polygon
    this.polygonPoints.push(this.polygonPoints[0]);
    this.drawPolygon();
    
    // Perform selection
    this.performSelection();
    
    // Clear after a short delay to show result
    setTimeout(() => this.clearPolygon(), 500);
  }

  onKeyDown(event) {
    if (event.key === 'Escape' && this.isActive) {
      this.deactivate();
    }
  }

  onResize() {
    if (this.selectionOverlay) {
      this.updateOverlaySize();
    }
  }

  getMousePosition(event) {
    // Get position relative to the canvas, not overlay
    const canvasRect = this.canvas.getBoundingClientRect();
    
    return {
      x: event.clientX - canvasRect.left,
      y: event.clientY - canvasRect.top
    };
  }

  clearCanvas() {
    if (this.overlayContext) {
      this.overlayContext.clearRect(0, 0, this.selectionOverlay.width, this.selectionOverlay.height);
    }
  }

  drawPolygon() {
    if (!this.overlayContext || this.polygonPoints.length < 2) return;
    
    this.clearCanvas();
    
    const ctx = this.overlayContext;
    
    // Force immediate rendering
    ctx.save();
    
    // Draw polygon outline
    ctx.beginPath();
    ctx.moveTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
    
    for (let i = 1; i < this.polygonPoints.length; i++) {
      ctx.lineTo(this.polygonPoints[i].x, this.polygonPoints[i].y);
    }
    
    // Style for active drawing
    if (this.isDrawing) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3; // Increased line width for better visibility
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 1.0; // Full opacity for better visibility
    } else {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    }
    
    ctx.stroke();
    
    // Fill with semi-transparent color
    if (!this.isDrawing) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fill();
    }
    
    ctx.restore();
    
    // Force canvas update
    ctx.canvas.style.display = 'block';
  }

  clearPolygon() {
    this.polygonPoints = [];
    this.clearCanvas();
    Logger.log('[PolygonSelection] Polygon points cleared.');
  }

  performSelection() {
    Logger.log('[PolygonSelection] performSelection() called. polygonPoints:', this.polygonPoints.length);
    if (!this.sceneManager || this.polygonPoints.length < 3) {
      Logger.log('[PolygonSelection] performSelection aborted - no sceneManager or insufficient points');
      return;
    }
    
    const scene = this.sceneManager.getScene();
    if (!scene) {
      Logger.log('[PolygonSelection] performSelection aborted - no scene returned by sceneManager');
      return;
    }
    
    // Clear previous debug markers safely
    this.clearDebugMarkers();
    
    this.selectedObjects = [];
    const selectedFaces = []; // Array for individual polygons
    
    // Get all selectable objects from scene
    const selectableObjects = [];
    scene.traverse(obj => {
      if (obj.isMesh || obj.isLight || obj.isCamera) {
        if (!obj.visible) return;
        selectableObjects.push(obj);
      }
    });
    
    Logger.log('[PolygonSelection] performSelection - selectableObjects count:', selectableObjects.length);
    
    // Convert polygon points to normalized device coordinates
    // Use the canvas size for proper NDC conversion
    const canvasRect = this.canvas.getBoundingClientRect();
    const polygonNDC = this.polygonPoints.map(point => ({
      x: (point.x / canvasRect.width) * 2 - 1,
      y: -(point.y / canvasRect.height) * 2 + 1
    }));
    
    Logger.log('[PolygonSelection] Polygon NDC points:', polygonNDC.slice(0, 5), '... (showing first 5)');
    
    // Check each object
    selectableObjects.forEach(obj => {
      if (obj.isMesh && obj.geometry) {
        // For meshes, check individual polygons/faces
        const selectedFacesForMesh = this.getPolygonsInPolygon(obj, polygonNDC);
        if (selectedFacesForMesh.length > 0) {
          selectedFacesForMesh.forEach(faceIndex => {
            selectedFaces.push({ mesh: obj, faceIndex });
          });
          // Only add object if it has selected faces, not the whole object
          if (!this.selectedObjects.includes(obj)) {
            this.selectedObjects.push(obj);
          }
        }
      } else {
        // For non-mesh objects (lights, cameras), check object center
        if (this.isObjectInPolygon(obj, polygonNDC)) {
          this.selectedObjects.push(obj);
        }
      }
    });
    
    Logger.log(`[PolygonSelection] Selected ${this.selectedObjects.length} objects and ${selectedFaces.length} faces`);
    
    // Visualize selected polygons
    try {
      if (this.rendererManager) {
        if (selectedFaces.length > 0) {
          // Show outlines of individual polygons
          this.rendererManager.setFaceOutlines(selectedFaces);
          Logger.log('[PolygonSelection] setFaceOutlines called for selected faces:', selectedFaces.length);
        } else if (this.selectedObjects.length > 0) {
          // Fallback: show outlines of entire objects
          this.rendererManager.setOutlineObjects(this.selectedObjects);
          Logger.log('[PolygonSelection] setOutlineObjects called for selected objects:', this.selectedObjects.length);
        } else {
          // Clear selection
          this.rendererManager.setOutlineObjects([]);
          this.rendererManager.setFaceOutlines([]);
        }
      }
    } catch (e) {
      console.warn('[PolygonSelection] Failed to set outline objects/faces via rendererManager', e);
    }
    
    // Update inspector selection if available
    if (this.inspector && this.inspector.selectObject) {
      if (this.selectedObjects.length === 1) {
        this.inspector.selectObject(this.selectedObjects[0]);
      } else if (this.selectedObjects.length > 1) {
        this.inspector.selectObject(this.selectedObjects[0]);
      } else {
        this.inspector.selectObject(null);
      }
    }
    
    // Call custom selection callback
    if (this.onSelection) {
      this.onSelection({
        objects: this.selectedObjects,
        faces: selectedFaces // Pass information about polygons
      });
    }
  }

  // Safe addition of debug marker with memory control
  addDebugMarker(marker) {
    if (!this.debugMarkers) this.debugMarkers = [];
    
    // If we've reached the limit, remove old markers
    if (this.debugMarkers.length >= this.maxDebugMarkers) {
      const oldMarkers = this.debugMarkers.splice(0, this.debugMarkers.length - this.maxDebugMarkers + 1);
      oldMarkers.forEach(m => {
        if (m && m.parent && typeof m.parent.remove === 'function') {
          m.parent.remove(m);
        }
        if (m && m.geometry && typeof m.geometry.dispose === 'function') {
          m.geometry.dispose();
        }
        if (m && m.material) {
          if (Array.isArray(m.material)) {
            m.material.forEach(mat => {
              if (mat && typeof mat.dispose === 'function') {
                mat.dispose();
              }
            });
          } else if (typeof m.material.dispose === 'function') {
            m.material.dispose();
          }
        }
      });
      Logger.log(`[PolygonSelection] Removed ${oldMarkers.length} old debug markers to prevent memory leak`);
    }
    
    this.debugMarkers.push(marker);
  }

  // Safe clearing of all debug markers
  clearDebugMarkers() {
    if (!this.debugMarkers) return;
    
    this.debugMarkers.forEach(m => {
      if (m && m.parent && typeof m.parent.remove === 'function') {
        m.parent.remove(m);
      }
      if (m && m.geometry && typeof m.geometry.dispose === 'function') {
        m.geometry.dispose();
      }
      if (m && m.material) {
        if (Array.isArray(m.material)) {
          m.material.forEach(mat => {
            if (mat && typeof mat.dispose === 'function') {
              mat.dispose();
            }
          });
        } else if (typeof m.material.dispose === 'function') {
          m.material.dispose();
        }
      }
    });
    this.debugMarkers.length = 0;
    Logger.log('[PolygonSelection] All debug markers cleared');
  }

  // NEW METHOD: Get polygons of an object that fall within selection area
  getPolygonsInPolygon(mesh, polygonNDC) {
    const selectedFaces = [];
    
    if (!mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes.position) {
      Logger.warn('[PolygonSelection] getPolygonsInPolygon aborted - mesh missing geometry or position attributes.');
      return selectedFaces;
    }
    
    try {
      const geometry = mesh.geometry;
      const position = geometry.attributes.position;
      const index = geometry.index;
      
      // Determine number of triangles
      const triangleCount = index ? (index.count / 3) : (position.count / 3);
      
      // Update world matrix before use
      mesh.updateMatrixWorld();
      
      let checkedTriangles = 0;
      let selectedTriangles = 0;
      
      // Check each triangle (but limit for performance)
      const maxTrianglesToCheck = Math.min(triangleCount, 10000); // Limit for performance
      const step = Math.max(1, Math.floor(triangleCount / maxTrianglesToCheck));
      
      for (let i = 0; i < triangleCount; i += step) {
        checkedTriangles++;
        let a, b, c;
        
        if (index) {
          // Indexed geometry
          a = index.getX(i * 3);
          b = index.getX(i * 3 + 1);
          c = index.getX(i * 3 + 2);
        } else {
          // Non-indexed geometry
          a = i * 3;
          b = i * 3 + 1;
          c = i * 3 + 2;
        }
        
        // Get triangle vertex positions
        const vA = new THREE.Vector3().fromBufferAttribute(position, a);
        const vB = new THREE.Vector3().fromBufferAttribute(position, b);
        const vC = new THREE.Vector3().fromBufferAttribute(position, c);
        
        // Transform to world coordinates
        vA.applyMatrix4(mesh.matrixWorld);
        vB.applyMatrix4(mesh.matrixWorld);
        vC.applyMatrix4(mesh.matrixWorld);
        
        // Project to screen coordinates
        const screenA = new THREE.Vector3().copy(vA).project(this.camera);
        const screenB = new THREE.Vector3().copy(vB).project(this.camera);
        const screenC = new THREE.Vector3().copy(vC).project(this.camera);
        
        // Check if triangle is in front of camera
        if (screenA.z > 1 || screenB.z > 1 || screenC.z > 1) continue;
        
        // Check if triangle center falls within selection area
        const center = new THREE.Vector3()
          .addVectors(screenA, screenB)
          .add(screenC)
          .divideScalar(3);
        
        if (this.isPointInPolygon(center.x, center.y, polygonNDC)) {
          selectedFaces.push(i);
          selectedTriangles++;
        }
      }
      
    } catch (e) {
      console.error('[PolygonSelection] Error in getPolygonsInPolygon:', e);
    }
    
    return selectedFaces;
  }

  isObjectInPolygon(obj, polygonNDC) {
    // Get object's position in screen space
    const objectPosition = new THREE.Vector3();
    
    // For meshes, use the center of the bounding box
    if (obj.isMesh && obj.geometry) {
      if (!obj.geometry.boundingBox) { // Check if bounding box is already computed
        obj.geometry.computeBoundingBox();
      }
      if (obj.geometry.boundingBox) {
        obj.geometry.boundingBox.getCenter(objectPosition);
        objectPosition.applyMatrix4(obj.matrixWorld);
      } else {
        obj.getWorldPosition(objectPosition);
      }
    } else {
      obj.getWorldPosition(objectPosition);
    }
    
    // Project to screen coordinates
    const screenPosition = objectPosition.clone().project(this.camera);
    
    // Check if the object is in front of the camera
    if (screenPosition.z > 1) return false;
    
    // Check if point is inside polygon using ray casting algorithm
    return this.isPointInPolygon(screenPosition.x, screenPosition.y, polygonNDC);
  }

  isPointInPolygon(x, y, polygon) {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > y) !== (polygon[j].y > y)) &&
          (x < (polygon[j].x - polygon[i].x) * (y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  setOrbitControls(controls) {
    this.controls = controls;
    Logger.log('[PolygonSelection] setOrbitControls called. controls set:', !!controls);
  }

  // Additional selection methods
  selectObjectsInBox(startPoint, endPoint) {
    if (!this.sceneManager) {
      Logger.warn('[PolygonSelection] selectObjectsInBox aborted - no sceneManager.');
      return [];
    }
    
    const scene = this.sceneManager.getScene();
    if (!scene) {
      Logger.warn('[PolygonSelection] selectObjectsInBox aborted - no scene returned by sceneManager.');
      return [];
    }
    
    const selected = [];
    const box = {
      minX: Math.min(startPoint.x, endPoint.x),
      maxX: Math.max(startPoint.x, endPoint.x),
      minY: Math.min(startPoint.y, endPoint.y),
      maxY: Math.max(startPoint.y, endPoint.y)
    };
    
    scene.traverse(obj => {
      if ((obj.isMesh || obj.isLight || obj.isCamera) && obj.visible) {
        const position = new THREE.Vector3();
        obj.getWorldPosition(position);
        const screenPos = position.project(this.camera);
        
        // Convert to canvas coordinates
        const canvasX = (screenPos.x + 1) * this.canvas.clientWidth / 2;
        const canvasY = (-screenPos.y + 1) * this.canvas.clientHeight / 2;
        
        if (canvasX >= box.minX && canvasX <= box.maxX &&
            canvasY >= box.minY && canvasY <= box.maxY &&
            screenPos.z <= 1) {
          selected.push(obj);
        }
      }
    });
    
    return selected;
  }

  getSelectedObjects() {
    return [...this.selectedObjects];
  }

  clearSelection() {
    this.selectedObjects = [];
    if (this.inspector && this.inspector.selectObject) {
      this.inspector.selectObject(null);
    }
    
    // Clear visual selection indicators
    try {
      if (this.rendererManager) {
        this.rendererManager.setOutlineObjects([]);
        this.rendererManager.setFaceOutlines([]);
      }
    } catch (e) {
      Logger.warn('[PolygonSelection] Failed to clear selection via rendererManager', e);
    }
  }

  dispose() {
    this.deactivate();
    
    // Remove event listeners
    // Keyboard event handling moved to centralized manager
    window.removeEventListener('resize', this.boundResize);
    
    // Remove overlay from its parent (body or canvas parent)
    if (this.selectionOverlay && this.selectionOverlay.parentNode) {
      this.selectionOverlay.parentNode.removeChild(this.selectionOverlay);
    }
    
    // Safe cleanup of debug markers
    this.clearDebugMarkers();
    
    // Clear references
    this.canvas = null;
    this.camera = null;
    this.sceneManager = null;
    this.rendererManager = null;
    this.inspector = null;
    this.inputHandler = null;
    this.onSelection = null;
    this.selectionOverlay = null;
    this.overlayContext = null;
    this.raycaster = null;
    this.selectedObjects = [];
    this.polygonPoints = [];
    this.debugMarkers = null;
    this.originalCanvasPointerEvents = null;
    this.originalRendererPointerEvents = null;
  }
}

export default PolygonSelectionManager;