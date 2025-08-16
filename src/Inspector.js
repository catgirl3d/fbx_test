/**
 * Inspector module (PRO version)
 * - Renders an interactive, searchable tree with icons, context menus, and multi-select.
 * - Allows filtering by object type and isolating selection.
 *
 * The module mutates DOM inside element with id="tree".
 */
import * as THREE from 'three';

export function initInspector({ sceneManager, onSelect, onFocus, getCurrentModel, getLoadedModels, tControls, lighting } = {}) {
  if (!lighting) {
    console.error('[Inspector] FATAL: `lighting` is null or undefined. Inspector cannot be initialized.');
    return null; // Return null or an empty API object
  }
  const treeRoot = document.getElementById('tree');
  if (!treeRoot) throw new Error('Inspector: #tree element not found');

  // --- State Management ---
  let currentFilter = '';
  let typeFilter = 'all'; // 'all', 'mesh', 'light', 'camera'
  let selectedObjects = [];
  let isIsolating = false;
  let visibilityCache = new WeakMap(); // For isolation mode
  let nodeMap = new WeakMap(); // object -> li element
  let showSystemObjects = false;

  // --- UI Elements ---
  treeRoot.innerHTML = ''; // Clear previous content
  const header = createHeader();
  const listContainer = createListContainer();
  const systemToggle = createSystemToggle();
  const contextMenu = createContextMenu();
  const propertiesPanel = createPropertiesPanel();
 
  treeRoot.appendChild(header);
  treeRoot.appendChild(systemToggle);
  treeRoot.appendChild(listContainer);
  treeRoot.appendChild(propertiesPanel);
  document.body.appendChild(contextMenu);


  // --- Helper Functions ---

  function getIconForObject(obj) {
    if (obj.isMesh) return 'fa-cube';
    if (obj.isSkinnedMesh) return 'fa-user-ninja';
    if (obj.isBone) return 'fa-bone';
    if (obj.isLight) return 'fa-lightbulb';
    if (obj.isCamera) return 'fa-video';
    if (obj.children.length > 0) return 'fa-folder';
    return 'fa-object-group';
  }

  function nodeOrDescendantsMatchFilter(obj, textFilter, typeFilterValue) {
    let typeMatch = false;
    if (typeFilterValue === 'all') {
        typeMatch = true;
    } else if (typeFilterValue === 'mesh') {
        typeMatch = obj.isMesh;
    } else if (typeFilterValue === 'light') {
        typeMatch = obj.isLight;
    } else if (typeFilterValue === 'camera') {
        typeMatch = obj.isCamera;
    }

    const labelText = obj.name || obj.type || 'Object';
    const textMatch = labelText.toLowerCase().includes(textFilter);

    if (textMatch && typeMatch) {
        return true;
    }

    if (obj.children) {
        for (let i = 0; i < obj.children.length; i++) {
            if (nodeOrDescendantsMatchFilter(obj.children[i], textFilter, typeFilterValue)) {
                return true;
            }
        }
    }
    return false;
  }

  const SkeletonUtils = ( function () {

    return {

      clone: function ( source ) {

        const sourceLookup = new Map();
        const cloneLookup = new Map();

        const clone = source.clone();

        parallelTraverse( source, clone, function ( sourceNode, clonedNode ) {

          sourceLookup.set( clonedNode, sourceNode );
          cloneLookup.set( sourceNode, clonedNode );

        } );

        clone.traverse( function ( node ) {

          if ( ! node.isSkinnedMesh ) return;

          const clonedMesh = node;
          const sourceMesh = sourceLookup.get( node );
          const sourceBones = sourceMesh.skeleton.bones;

          clonedMesh.skeleton = sourceMesh.skeleton.clone();
          clonedMesh.bindMatrix.copy( sourceMesh.bindMatrix );

          clonedMesh.skeleton.bones = sourceBones.map( function ( bone ) {

            return cloneLookup.get( bone );

          } );

          clonedMesh.bind( clonedMesh.skeleton, clonedMesh.bindMatrix );

        } );

        return clone;

      },

    };

    function parallelTraverse( a, b, callback ) {

      callback( a, b );

      for ( let i = 0; i < a.children.length; i ++ ) {

        parallelTraverse( a.children[ i ], b.children[ i ], callback );

      }

    }

  } )();

  // --- Core Rendering ---

  function renderTree() {
    listContainer.innerHTML = '';
    nodeMap = new WeakMap();

    const mainContainer = document.createElement('div');
    listContainer.appendChild(mainContainer);

    const rootScene = sceneManager?.getScene();
    if (!rootScene) return []; // Return empty array if sceneManager or scene is null
    const rootObjects = rootScene.children.filter(child => {
        // Get all loaded models from app.js
        const loadedModels = (typeof getLoadedModels === 'function' ? getLoadedModels() : []) || []; // Use the new getter
        // Check if the child is one of the loaded models
        const isLoadedModel = loadedModels.includes(child);

        // Basic filtering for system objects you might not want to see by default
        const isSystemHelper = !isLoadedModel && (
                               child.type.includes('Helper') ||
                               (tControls && child === tControls.controls) ||
                               (sceneManager.measure && child === sceneManager.measure.group) ||
                               (lighting && (child === lighting.hemi || child === lighting.dir)) ||
                               (child.isObject3D && !child.isMesh && !child.isLight && !child.isCamera)
                             );

        return showSystemObjects || !isSystemHelper;
   }).sort((a, b) => {
        // Get all loaded models from app.js for sorting
        const loadedModels = (typeof getLoadedModels === 'function' ? getLoadedModels() : []) || []; // Use the new getter
        const aIsLoadedModel = loadedModels.includes(a);
        const bIsLoadedModel = loadedModels.includes(b);

        // Calculate system status for sorting
        const aIsSystem = (a.type.includes('Helper') || (tControls && a === tControls.controls) || (sceneManager.measure && a === sceneManager.measure.group) || (lighting && (a === lighting.hemi || a === lighting.dir)) || (a.isObject3D && !a.isMesh && !a.isLight && !a.isCamera && !aIsLoadedModel));
        const bIsSystem = (b.type.includes('Helper') || (tControls && b === tControls.controls) || (sceneManager.measure && b === sceneManager.measure.group) || (lighting && (b === lighting.hemi || b === lighting.dir)) || (b.isObject3D && !b.isMesh && !b.isLight && !b.isCamera && !bIsLoadedModel));

        // Primary sort: non-system objects before system objects (only if showSystemObjects is true)
        if (showSystemObjects) {
            if (!aIsSystem && bIsSystem) return -1;
            if (aIsSystem && !bIsSystem) return 1;
        }

        // Secondary sort: meshes before non-meshes
        if (a.isMesh && !b.isMesh) return -1;
        if (!a.isMesh && b.isMesh) return 1;

        // Tertiary sort: alphabetical by name
        if (a.name && b.name) {
            return a.name.localeCompare(b.name);
        }
        return 0;
    });

    if (rootObjects.length > 0) {
        const allObjectsCategory = createCategory('Scene Objects', rootObjects);
        mainContainer.appendChild(allObjectsCategory);
    }

    // After rendering, re-apply selection styles
    updateSelectionHighlights();
  }

  function createCategory(categoryName, objects) {
    const categoryDiv = document.createElement('div');
    categoryDiv.style.marginBottom = '16px';

    const header = document.createElement('div');
    header.className = 'category-header';

    const caret = document.createElement('i');
    caret.className = 'fa-solid fa-chevron-right toggle-icon chev';

    const title = document.createElement('span');
    title.textContent = categoryName;
    title.style.fontWeight = '700';

    header.appendChild(caret);
    header.appendChild(title);
    categoryDiv.appendChild(header);

    const content = document.createElement('div');
    content.className = 'category-content';

    const rootUl = document.createElement('ul');
    rootUl.className = 'tree-list';
    content.appendChild(rootUl);
    objects.forEach(obj => {
      addNode(obj, rootUl);
    });

    categoryDiv.appendChild(content);

    let isExpanded = true;
    const setExpanded = (v) => {
      isExpanded = !!v;
      caret.classList.toggle('fa-rotate-180', isExpanded);
      content.style.display = isExpanded ? 'block' : 'none';
    };
    header.addEventListener('click', () => setExpanded(!isExpanded));
    setExpanded(true);

    return categoryDiv;
  }

  function addNode(o, parentUl) {
    if (!nodeOrDescendantsMatchFilter(o, currentFilter.toLowerCase(), typeFilter)) {
      return;
    }

    const li = document.createElement('li');
    li.className = 'tree-node';
    li.draggable = true; // Make tree nodes draggable
    nodeMap.set(o, li);

    const row = document.createElement('div');
    row.className = 'tree-row';
    
    // Expand/Collapse Caret
    const expandBtn = document.createElement('i');
    expandBtn.className = 'fa-solid fa-chevron-right toggle-icon node-chev';
    if (o.children?.length === 0) {
        expandBtn.style.visibility = 'hidden';
    }

    // Object Type Icon
    const typeIcon = document.createElement('i');
    typeIcon.className = `fa-solid ${getIconForObject(o)} type-icon`;
    
    // Label
    const label = document.createElement('span');
    label.className = 'node-label';
    label.textContent = o.name || o.type || 'Object';

    // Visibility Toggle
    const visIcon = document.createElement('i');
    visIcon.className = `fa-solid ${o.visible ? 'fa-eye' : 'fa-eye-slash'} vis-icon`;
    visIcon.title = 'Toggle visibility';
    visIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        o.visible = !o.visible;
        visIcon.className = `fa-solid ${o.visible ? 'fa-eye' : 'fa-eye-slash'} vis-icon`;
    });

    row.appendChild(expandBtn);
    row.appendChild(typeIcon);
    row.appendChild(label);
    row.appendChild(visIcon);
    li.appendChild(row);
    parentUl.appendChild(li);

    // --- Event Listeners for the node ---
    row.addEventListener('click', (e) => handleSelection(e, o));
    row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, o);
        e.stopPropagation();
        // Ensure the right-clicked object is part of the selection
        if (!selectedObjects.includes(o)) {
            handleSelection(e, o);
        }
        showContextMenu(e.clientX, e.clientY);
    });
    
    // Drag and Drop events
    li.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        // Store the UUID of the object being dragged
        e.dataTransfer.setData('text/plain', o.uuid);
        e.dataTransfer.effectAllowed = 'move';
        console.log(`[Inspector] Dragging started for: ${o.name} (${o.uuid})`);
    });

    li.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
        e.stopPropagation();
        const draggedUuid = e.dataTransfer.getData('text/plain');
        const scene = sceneManager?.getScene();
        if (!scene) return null; // Or handle appropriately
        const draggedObject = scene.getObjectByProperty('uuid', draggedUuid);
        
        // Only allow dropping an object onto a bone or a group/mesh
        if (draggedObject && o !== draggedObject && (o.isBone || o.isMesh || o.isGroup)) {
            e.dataTransfer.dropEffect = 'move';
            li.classList.add('drag-over'); // Visual feedback
        } else {
            e.dataTransfer.dropEffect = 'none';
        }
    });

    li.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        li.classList.remove('drag-over');
    });

    li.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        li.classList.remove('drag-over');

        const draggedUuid = e.dataTransfer.getData('text/plain');
        const scene = sceneManager?.getScene();
        if (!scene) return; // Or handle appropriately
        const objectToAttach = scene.getObjectByProperty('uuid', draggedUuid);
        const targetParent = o; // The object being dropped onto

        if (objectToAttach && targetParent && objectToAttach !== targetParent && (targetParent.isBone || targetParent.isMesh || targetParent.isGroup)) {
            // Detach transform controls if attached to the object being moved
            if (tControls && tControls.controls.object === objectToAttach) {
                tControls.detach();
            }

            // Use THREE.Object3D.attach to maintain world position while changing parent
            targetParent.attach(objectToAttach);
            console.log(`[Inspector] Dragged and attached ${objectToAttach.name} to ${targetParent.name}`);
            renderTree();
            // Clear selection after drop to avoid confusion
            clearSelection();
        } else {
            console.warn('[Inspector] Invalid drop target or object:', objectToAttach, targetParent);
        }
    });

    // --- Children ---
    if (o.children?.length) {
      const childUl = document.createElement('ul');
      childUl.className = 'tree-list nested';
      li.appendChild(childUl);
      
      let childrenExpanded = false;
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        childrenExpanded = !childrenExpanded;
        expandBtn.classList.toggle('fa-rotate-180', childrenExpanded);
        childUl.style.display = childrenExpanded ? 'block' : 'none';
      });
      
      o.children.forEach(c => addNode(c, childUl));
    }
  }

  // --- UI Creation ---

  function createHeader() {
    const headerEl = document.createElement('div');
    headerEl.className = 'inspector-header';

    // Search
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search...';
    searchInput.className = 'field';
    searchInput.addEventListener('input', (e) => {
      currentFilter = e.target.value || '';
      renderTree();
    });

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'inspector-toolbar';

    const filterAll = createToolbarButton('fa-border-all', 'all', 'Show All');
    const filterMesh = createToolbarButton('fa-cube', 'mesh', 'Show Meshes');
    const filterLight = createToolbarButton('fa-lightbulb', 'light', 'Show Lights');
    const filterCamera = createToolbarButton('fa-video', 'camera', 'Show Cameras');
    
    const isolateBtn = document.createElement('button');
    isolateBtn.className = 'btn small-btn';
    isolateBtn.innerHTML = '<i class="fa-solid fa-eye-low-vision"></i> Isolate';
    isolateBtn.id = 'isolate-btn';
    isolateBtn.style.display = 'none'; // Hidden by default
    isolateBtn.addEventListener('click', toggleIsolate);
    
    toolbar.append(filterAll, filterMesh, filterLight, filterCamera, isolateBtn);
    headerEl.append(searchInput, toolbar);
    return headerEl;
  }
  
  function createToolbarButton(icon, filterValue, title) {
      const btn = document.createElement('button');
      btn.className = 'btn small-btn icon-btn';
      if (filterValue === typeFilter) btn.classList.add('active');
      btn.title = title;
      btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
      btn.addEventListener('click', () => {
          typeFilter = filterValue;
          document.querySelectorAll('.inspector-toolbar .btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderTree();
      });
      return btn;
  }

  function createListContainer() {
    const container = document.createElement('div');
    container.className = 'tree-list-container';
    return container;
  }
  
  function createSystemToggle() {
      const toggleEl = document.createElement('label');
      toggleEl.className = 'system-toggle';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = showSystemObjects;
      input.addEventListener('change', (e) => {
          showSystemObjects = e.target.checked;
          renderTree();
      });
      toggleEl.append(input, ' Show system objects');
      return toggleEl;
  }

  // --- Context Menu ---
  
  function createContextMenu() {
      const menu = document.createElement('div');
      menu.id = 'inspector-context-menu';
      menu.innerHTML = `
          <button data-action="rename">Rename</button>
          <button data-action="duplicate">Duplicate</button>
          <button data-action="delete">Delete</button>
          <hr/>
          <button data-action="attach">Attach Selected Object</button>
          <hr/>
          <button data-action="isolate">Isolate</button>
          <button data-action="focus">Focus</button>
      `;
      menu.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          if (action) handleContextMenuAction(action);
          hideContextMenu();
      });
      document.addEventListener('click', hideContextMenu, true);
      return menu;
  }

  function showContextMenu(x, y) {
      contextMenu.style.left = `${x}px`;
      contextMenu.style.top = `${y}px`;
      contextMenu.style.display = 'block';
  }

  function hideContextMenu() {
      contextMenu.style.display = 'none';
  }

  function handleContextMenuAction(action) {
    if (selectedObjects.length === 0) return;
    const targetObject = selectedObjects[0]; // For single-object actions

    switch (action) {
      case 'rename':
        const newName = prompt('Enter new name:', targetObject.name);
        if (newName !== null) {
            targetObject.name = newName;
            renderTree();
        }
        break;
      case 'duplicate':
        selectedObjects.forEach(obj => {
          const clone = SkeletonUtils.clone(obj);
          
          // Ensure the clone has a unique name
          const baseName = (clone.name || 'copy').replace(/_copy\d*$/g, '');
          let copyNumber = 1;
          let newName = `${baseName}_copy${copyNumber}`;
          
          // Find a unique name
          while (obj.parent.children.some(child => child.name === newName)) {
            copyNumber++;
            newName = `${baseName}_copy${copyNumber}`;
          }
          clone.name = newName;
          
          // Add the clone to the parent
          obj.parent.add(clone);
        });
        renderTree();
        break;
      case 'delete':
        if (confirm(`Delete ${selectedObjects.length} object(s)?`)) {
            selectedObjects.forEach(obj => {
                if(tControls && tControls.object === obj) tControls.detach();
                obj.parent.remove(obj);
                // Basic resource cleanup
                obj.traverse(child => {
                    if (child.isMesh) {
                        child.geometry?.dispose();
                        // Dispose materials if they are not shared
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material?.dispose();
                        }
                    }
                });
            });
            clearSelection();
            renderTree();
        }
        break;
      case 'isolate':
        toggleIsolate();
        break;
      case 'focus':
        if (onFocus) onFocus(targetObject);
        break;
      case 'attach':
        if (selectedObjects.length === 2) {
          const objectToAttach = selectedObjects[0];
          const targetParent = selectedObjects[1];

          // Detach transform controls if attached to the object being moved
          if (tControls && tControls.controls.object === objectToAttach) {
            tControls.detach();
          }

          // Use THREE.Object3D.attach to maintain world position while changing parent
          // This automatically handles the matrix transformations
          targetParent.attach(objectToAttach);
          
          console.log(`Attached ${objectToAttach.name} to ${targetParent.name}`);
          renderTree();
        } else {
          alert(t('alert_select_two_objects'));
        }
        break;
    }
  }

  // --- Selection & Isolation Logic ---

  function handleSelection(event, obj) {
      if (event.ctrlKey || event.metaKey) {
          // Add or remove from selection
          if (selectedObjects.includes(obj)) {
              selectedObjects = selectedObjects.filter(o => o !== obj);
          } else {
              selectedObjects.push(obj);
          }
      } else {
          // Single selection
          selectedObjects = [obj];
      }
      
      // For transform controls, if a Group is selected, try to find the first mesh
      let transformTarget = obj;
      if (obj.isGroup || obj.type === 'Group') {
          // Look for the first mesh in the group hierarchy
          let firstMesh = null;
          obj.traverse(child => {
              if (child.isMesh && !firstMesh) {
                  firstMesh = child;
              }
          });
          if (firstMesh) {
              transformTarget = firstMesh;
              console.log('Group selected, using first mesh for transform:', firstMesh.name);
          }
      }
      
      // Update the global selected object for transform controls
      if (window.selectedObject) {
          window.selectedObject = transformTarget;
      }
      
      if (onSelect) onSelect(selectedObjects);
      updateSelectionHighlights();
  }

  function updateSelectionHighlights() {
      // Clear all previous highlights
      document.querySelectorAll('.tree-node.selected').forEach(el => el.classList.remove('selected'));
      // Apply new highlights
      selectedObjects.forEach(obj => {
          const node = nodeMap.get(obj);
          if (node) {
              node.classList.add('selected');
          }
      });
      // Update the properties panel
      updatePropertiesPanel();

      // If there's a selection, reveal the first selected object in the tree
      if (selectedObjects.length > 0) {
          revealObject(selectedObjects[0]);
      }
  }
  
  function clearSelection() {
      selectedObjects = [];
      if (onSelect) onSelect(selectedObjects);
      updateSelectionHighlights();
  }

  function toggleIsolate() {
      const scene = sceneManager?.getScene();
      if (!scene) return;
      const isolateBtn = document.getElementById('isolate-btn');
      
      isIsolating = !isIsolating;
      
      if (isIsolating) {
          if (selectedObjects.length === 0) {
              isIsolating = false; // Can't isolate nothing
              return;
          }
          isolateBtn.style.display = 'inline-block';
          isolateBtn.classList.add('active');
          
          scene.traverse(obj => {
              if (!obj.isLight) { // Keep lights on for better viewing
                visibilityCache.set(obj, obj.visible);
                obj.visible = false;
              }
          });

          selectedObjects.forEach(sel => {
              sel.visible = true;
              // Manually traverse up the parent chain to make ancestors visible
              let parent = sel.parent;
              while (parent) {
                  parent.visible = true;
                  parent = parent.parent;
              }
          });

      } else {
          // Unisolate
          isolateBtn.style.display = 'none';
          isolateBtn.classList.remove('active');
          scene.traverse(obj => {
              if (visibilityCache.has(obj)) {
                  obj.visible = visibilityCache.get(obj);
              }
          });
          visibilityCache = new WeakMap();
      }
  }

  function createPropertiesPanel() {
    const panel = document.createElement('div');
    panel.id = 'properties-panel';
    panel.className = 'properties-panel';
    panel.style.display = 'none'; // Initially hidden
    return panel;
  }

  function updatePropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    if (selectedObjects.length > 0) {
      const obj = selectedObjects[0]; // For now, show info for the first selected object
      
      let vertexCount = 'N/A';
      let triangleCount = 'N/A';
      if (obj.isMesh && obj.geometry) {
        vertexCount = obj.geometry.attributes.position.count.toLocaleString();
        if (obj.geometry.index) {
          triangleCount = (obj.geometry.index.count / 3).toLocaleString();
        } else {
          triangleCount = (obj.geometry.attributes.position.count / 3).toLocaleString();
        }
      }

      panel.style.display = 'block';
      panel.innerHTML = `
        <div class="properties-header">Properties</div>
        <div class="properties-content">
          <div><strong>Name:</strong> ${obj.name || 'N/A'}</div>
          <div><strong>Type:</strong> ${obj.type}</div>
          <div><strong>Visible:</strong> ${obj.visible}</div>
          <div class="properties-divider"></div>
          <div><strong>Vertices:</strong> ${vertexCount}</div>
          <div><strong>Triangles:</strong> ${triangleCount}</div>
          <div class="properties-divider"></div>
          <div><strong>UUID:</strong> <span class="uuid-text">${obj.uuid}</span></div>
        </div>
      `;
    } else {
      panel.style.display = 'none';
    }
  }

  // --- Initial Setup ---
  renderTree();
 
  function selectObject(object) {
    if (!object) {
      clearSelection();
      return;
    }
    handleSelection({
      // Mock event object
      ctrlKey: false,
      metaKey: false,
    }, object);
  }

  function revealObject(object) {
    const nodeElement = nodeMap.get(object);
    if (!nodeElement) return;

    // Expand all parent nodes
    let current = nodeElement;
    while (current && current !== listContainer) {
        if (current.tagName === 'UL' && current.classList.contains('nested')) {
            current.style.display = 'block';
            // Also activate the chevron icon
            const parentLi = current.parentElement;
            const expandBtn = parentLi.querySelector('.node-chev');
            if (expandBtn) {
                expandBtn.classList.add('fa-rotate-180');
            }
        }
        current = current.parentElement;
    }

    // Scroll the element into view
    nodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // --- Exposed API ---
  return {
    refresh: renderTree,
    getSelected: () => selectedObjects,
    selectObject,
    showContextMenu,
  };
}