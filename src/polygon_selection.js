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
    inputHandler = null, // New: inputHandler instance
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
    this.inputHandler = inputHandler; // Store inputHandler
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
    this.maxDebugMarkers = 1000; // Лимит для предотвращения утечек памяти

    this.init();
  }

  init() {
    this.createOverlay();
    this.bindEvents();
  }

  createOverlay() {
    // Create overlay canvas for drawing selection polygon
    this.selectionOverlay = document.createElement('canvas');
    this.selectionOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 1000;
      width: 100%;
      height: 100%;
    `;
    this.selectionOverlay.width = this.canvas.width;
    this.selectionOverlay.height = this.canvas.height;
    
    // Insert overlay into the same parent as the main canvas
    if (this.canvas.parentNode) {
      this.canvas.parentNode.appendChild(this.selectionOverlay);
      Logger.log('[PolygonSelection] Overlay created and appended to parentNode:', this.canvas.parentNode);
    } else {
      Logger.warn('[PolygonSelection] Canvas parentNode not found, cannot append overlay.');
    }
 
    this.overlayContext = this.selectionOverlay.getContext('2d');
    Logger.log('[PolygonSelection] Overlay context obtained.');
  }

  bindEvents() {
    // Store bound methods for proper event removal
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundResize = this.onResize.bind(this);

    // Initially not bound - activated by toggle
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('resize', this.boundResize);
  }

  activate() {
    if (this.isActive) {
      Logger.log('[PolygonSelection] Already active, returning.');
      return;
    }
    
    this.isActive = true;
    this.canvas.style.cursor = 'crosshair';
    this.selectionOverlay.style.pointerEvents = 'all';
    this.selectionOverlay.style.display = 'block'; // Ensure overlay is visible
    Logger.log('[PolygonSelection] Overlay pointer-events set to "all" and display "block" on activate.');
    
    this.selectionOverlay.addEventListener('mousedown', this.boundMouseDown);
    this.selectionOverlay.addEventListener('mousemove', this.boundMouseMove);
    this.selectionOverlay.addEventListener('mouseup', this.boundMouseUp);
    
    Logger.log('[PolygonSelection] Activated - Click and drag to create selection polygon');
  }

  deactivate() {
    if (!this.isActive) {
      Logger.log('[PolygonSelection] Already inactive, returning.');
      return;
    }
    
    this.isActive = false;
    this.isDrawing = false;
    this.canvas.style.cursor = 'default';
    this.selectionOverlay.style.pointerEvents = 'none';
    this.selectionOverlay.style.display = 'none'; // Hide overlay when inactive
    Logger.log('[PolygonSelection] Overlay pointer-events set to "none" and display "none" on deactivate.');
    
    this.selectionOverlay.removeEventListener('mousedown', this.boundMouseDown);
    this.selectionOverlay.removeEventListener('mousemove', this.boundMouseMove);
    this.selectionOverlay.removeEventListener('mouseup', this.boundMouseUp);
    
    this.clearPolygon();
    Logger.log('[PolygonSelection] Deactivated');
  }

  toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
    return this.isActive;
  }

  onMouseDown(event) {
    if (!this.isActive || event.button !== 0) return; // Only left mouse button
    
    Logger.log('[PolygonSelection] onMouseDown. event:', { button: event.button, clientX: event.clientX, clientY: event.clientY });
    event.preventDefault();
    event.stopPropagation();
    
    // While drawing, the overlay must capture pointer events
    this.selectionOverlay.style.pointerEvents = 'all';
    // Also disable pointer events on the underlying canvas and renderer.domElement
    // so OrbitControls/InputHandler do not receive the pointer
    try {
      this.canvas.style.pointerEvents = 'none';
      if (this.rendererManager?.renderer?.domElement) {
        this.rendererManager.renderer.domElement.style.pointerEvents = 'none';
        Logger.log('[PolygonSelection] Canvas and renderer.domElement pointer-events disabled for drawing');
      } else {
        Logger.log('[PolygonSelection] Canvas pointer-events disabled for drawing');
      }
    } catch(e) {
      Logger.warn('[PolygonSelection] Failed to disable canvas/renderer pointer-events', e);
    }
    
    this.isDrawing = true;
    this.polygonPoints = [];
    // Update canvas rect based on the main canvas (overlay uses same positioning)
    this.canvasRect = this.canvas.getBoundingClientRect();
    if (this.inputHandler) {
      Logger.log('[PolygonSelection] Disabling OrbitControls via InputHandler for drawing');
      this.inputHandler.disableControls();
    } else if (this.controls) {
      // Fallback if inputHandler is not provided
      Logger.log('[PolygonSelection] Disabling OrbitControls directly for drawing (no InputHandler)');
      this.controls.enabled = false;
    }
    
    const point = this.getMousePosition(event);
    this.polygonPoints.push(point);
    
    this.clearCanvas();
    Logger.log('[PolygonSelection] Started drawing. initial point:', point);
  }

  onMouseMove(event) {
    if (!this.isActive || !this.isDrawing) return;
    
    event.preventDefault();
    
    const point = this.getMousePosition(event);
    this.polygonPoints.push(point);
    
    this.drawPolygon();
    // Log a sampled set to avoid flooding console
    if (this.polygonPoints.length % 10 === 0) {
      Logger.log('[PolygonSelection] onMouseMove - points collected:', this.polygonPoints.length);
    }
  }

  onMouseUp(event) {
    if (!this.isActive || !this.isDrawing || event.button !== 0) return;
    
    Logger.log('[PolygonSelection] onMouseUp. event:', { button: event.button, clientX: event.clientX, clientY: event.clientY });
    event.preventDefault();
    event.stopPropagation();
    
    this.isDrawing = false;
    
    // Restore overlay to let pointer events pass through to OrbitControls
    this.selectionOverlay.style.pointerEvents = 'none';
    // Restore pointer-events on canvas and renderer.domElement
    try {
      this.canvas.style.pointerEvents = '';
      if (this.rendererManager?.renderer?.domElement) {
        this.rendererManager.renderer.domElement.style.pointerEvents = '';
        Logger.log('[PolygonSelection] Canvas and renderer.domElement pointer-events restored after drawing');
      } else {
        Logger.log('[PolygonSelection] Canvas pointer-events restored after drawing');
      }
    } catch(e) {
      Logger.warn('[PolygonSelection] Failed to restore canvas/renderer pointer-events', e);
    }
    
    if (this.inputHandler) {
      Logger.log('[PolygonSelection] Re-enabling OrbitControls via InputHandler after drawing');
      this.inputHandler.enableControls();
    } else if (this.controls) {
      // Fallback if inputHandler is not provided
      Logger.log('[PolygonSelection] Re-enabling OrbitControls directly after drawing (no InputHandler)');
      this.controls.enabled = true;
    }
    
    // Minimum polygon size check
    if (this.polygonPoints.length < 3) {
      Logger.log('[PolygonSelection] Polygon too small, cancelling');
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
      this.selectionOverlay.width = this.canvas.width;
      this.selectionOverlay.height = this.canvas.height;
    }
  }

  getMousePosition(event) {
    if (!this.canvasRect) {
      this.canvasRect = this.canvas.getBoundingClientRect();
    }
    
    return {
      x: event.clientX - this.canvasRect.left,
      y: event.clientY - this.canvasRect.top
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
    
    // Draw polygon outline
    ctx.beginPath();
    ctx.moveTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
    
    for (let i = 1; i < this.polygonPoints.length; i++) {
      ctx.lineTo(this.polygonPoints[i].x, this.polygonPoints[i].y);
    }
    
    // Style for active drawing
    if (this.isDrawing) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.8;
    } else {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    }
    
    ctx.stroke();
    
    // Fill with semi-transparent color
    if (!this.isDrawing) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fill();
    }
    
    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
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
    
    // Очищаем предыдущие debug маркеры с безопасной проверкой
    this.clearDebugMarkers();
    
    this.selectedObjects = [];
    const selectedFaces = []; // ✅ НОВОЕ: массив для отдельных полигонов
    
    // Получаем все выделяемые объекты из сцены
    const selectableObjects = [];
    scene.traverse(obj => {
      if (obj.isMesh || obj.isLight || obj.isCamera) {
        if (!obj.visible) return;
        selectableObjects.push(obj);
      }
    });
    
    Logger.log('[PolygonSelection] performSelection - selectableObjects count:', selectableObjects.length);
    
    // Конвертируем точки полигона в normalized device coordinates
    const polygonNDC = this.polygonPoints.map(point => ({
      x: (point.x / this.canvas.clientWidth) * 2 - 1,
      y: -(point.y / this.canvas.clientHeight) * 2 + 1
    }));
    
    // ✅ НОВОЕ: Проверяем каждый полигон в каждом mesh
    selectableObjects.forEach(obj => {
      if (obj.isMesh && obj.geometry) {
        const selectedFacesForMesh = this.getPolygonsInPolygon(obj, polygonNDC);
        if (selectedFacesForMesh.length > 0) {
          selectedFacesForMesh.forEach(faceIndex => {
            selectedFaces.push({ mesh: obj, faceIndex });
          });
          this.selectedObjects.push(obj); // Добавляем объект если у него есть выделенные полигоны
        }
      } else if (this.isObjectInPolygon(obj, polygonNDC)) {
        this.selectedObjects.push(obj);
      }
    });
    
    Logger.log(`[PolygonSelection] Selected ${this.selectedObjects.length} objects and ${selectedFaces.length} polygons`);
    
    // ✅ ИСПРАВЛЕНО: Визуализируем выделенные полигоны
    try {
      if (this.rendererManager) {
        if (selectedFaces.length > 0) {
          // Показываем контуры отдельных полигонов
          this.rendererManager.setFaceOutlines(selectedFaces);
          Logger.log('[PolygonSelection] setFaceOutlines called for selected faces:', selectedFaces.length);
        } else if (this.selectedObjects.length > 0) {
          // Fallback: показываем контуры целых объектов
          this.rendererManager.setOutlineObjects(this.selectedObjects);
          Logger.log('[PolygonSelection] setOutlineObjects called for selected objects:', this.selectedObjects.length);
        } else {
          // Очищаем выделение
          this.rendererManager.setOutlineObjects([]);
          this.rendererManager.setFaceOutlines([]);
        }
      }
    } catch (e) {
      Logger.warn('[PolygonSelection] Failed to set outline objects/faces via rendererManager', e);
    }
    
    // Обновляем inspector выделения если доступен
    if (this.inspector && this.inspector.selectObject) {
      if (this.selectedObjects.length === 1) {
        this.inspector.selectObject(this.selectedObjects[0]);
      } else if (this.selectedObjects.length > 1) {
        this.inspector.selectObject(this.selectedObjects[0]);
        Logger.log('[PolygonSelection] Multiple objects selected:', this.selectedObjects.map(o => o.name || o.type));
      } else {
        this.inspector.selectObject(null);
      }
    }
    
    // Вызываем кастомный callback выделения
    if (this.onSelection) {
      Logger.log('[PolygonSelection] Calling onSelection callback with', selectedFaces.length, 'faces and', this.selectedObjects.length, 'objects');
      this.onSelection({
        objects: this.selectedObjects,
        faces: selectedFaces // ✅ НОВОЕ: передаем информацию о полигонах
      });
    }
  }

  // Безопасное добавление debug маркера с контролем памяти
  addDebugMarker(marker) {
    if (!this.debugMarkers) this.debugMarkers = [];
    
    // Если достигли лимита, удаляем старые маркеры
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

  // Безопасная очистка всех debug маркеров
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

// ✅ НОВЫЙ МЕТОД: Получить полигоны объекта, попадающие в область выделения
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
    
    // Определяем количество треугольников
    const triangleCount = index ? (index.count / 3) : (position.count / 3);
    
    // Обновляем матрицу мира перед использованием
    mesh.updateMatrixWorld();
    
    // Проверяем каждый треугольник
    for (let i = 0; i < triangleCount; i++) {
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
      
      // Получаем позиции вершин треугольника
      const vA = new THREE.Vector3().fromBufferAttribute(position, a);
      const vB = new THREE.Vector3().fromBufferAttribute(position, b);
      const vC = new THREE.Vector3().fromBufferAttribute(position, c);
      
      // Переводим в мировые координаты
      vA.applyMatrix4(mesh.matrixWorld);
      vB.applyMatrix4(mesh.matrixWorld);
      vC.applyMatrix4(mesh.matrixWorld);
      
      // Проецируем в экранные координаты
      const screenA = new THREE.Vector3().copy(vA).project(this.camera);
      const screenB = new THREE.Vector3().copy(vB).project(this.camera);
      const screenC = new THREE.Vector3().copy(vC).project(this.camera);
      
      // Проверяем, находится ли треугольник перед камерой
      if (screenA.z > 1 || screenB.z > 1 || screenC.z > 1) continue;
      
      // Проверяем, попадает ли центр треугольника в область выделения
      const center = new THREE.Vector3()
        .addVectors(screenA, screenB)
        .add(screenC)
        .divideScalar(3);
      
      if (this.isPointInPolygon(center.x, center.y, polygonNDC)) {
        selectedFaces.push(i);
      }
    }
  } catch (e) {
    Logger.error('[PolygonSelection] Error in getPolygonsInPolygon:', e);
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
  }

  dispose() {
    this.deactivate();
    
    // Remove event listeners
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('resize', this.boundResize);
    
    // Remove overlay
    if (this.selectionOverlay && this.selectionOverlay.parentNode) {
      this.selectionOverlay.parentNode.removeChild(this.selectionOverlay);
    }
    
    // Безопасная очистка debug маркеров
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
  }
}

export default PolygonSelectionManager;