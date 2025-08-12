/**
 * Inspector module
 * - Renders a searchable tree into #tree (used by index.html)
 * - Allows assigning a "layer" (group) name to objects via userData._layer
 * - Provides visibility toggle and lock toggle per object
 *
 * Usage:
 *   import { initInspector } from './Inspector.js';
 *   initInspector({ sceneManager, onSelect });
 *
 * The module mutates DOM inside element with id="tree".
 */

export function initInspector({ sceneManager, onSelect, getCurrentModel } = {}) {
  const treeRoot = document.getElementById('tree');
  if (!treeRoot) throw new Error('Inspector: #tree element not found');

  // create header controls
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.flexDirection = 'column';
  header.style.gap = '8px';
  header.style.padding = '8px';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.alignItems = 'center';

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search...';
  search.style.flex = '1';
  search.className = 'field';
  search.id = 'inspector-search';

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'btn';
  refreshBtn.textContent = 'Refresh';

  row.appendChild(search);
  row.appendChild(refreshBtn);
  header.appendChild(row);

  // group management area
  const groupRow = document.createElement('div');
  groupRow.style.display = 'flex';
  groupRow.style.gap = '8px';
  groupRow.style.alignItems = 'center';

  const groupLabel = document.createElement('label');
  groupLabel.textContent = 'Groups';
  groupLabel.className = 'small';

  const groupSelect = document.createElement('select');
  groupSelect.className = 'field';
  groupSelect.style.minWidth = '120px';
  groupSelect.id = 'inspector-group-select';

  const newGroupInput = document.createElement('input');
  newGroupInput.type = 'text';
  newGroupInput.placeholder = 'New group';
  newGroupInput.className = 'field';
  newGroupInput.style.width = '120px';
  const addGroupBtn = document.createElement('button');
  addGroupBtn.className = 'btn';
  addGroupBtn.textContent = 'Add';

  groupRow.appendChild(groupLabel);
  groupRow.appendChild(groupSelect);
  groupRow.appendChild(newGroupInput);
  groupRow.appendChild(addGroupBtn);
  header.appendChild(groupRow);

  // clear tree and insert header
  treeRoot.innerHTML = '';
  treeRoot.appendChild(header);

  // container for tree list
  const listContainer = document.createElement('div');
  listContainer.style.padding = '8px';
  listContainer.style.overflow = 'auto';
  listContainer.style.maxHeight = 'calc(100% - 120px)'; // leave space for header
  treeRoot.appendChild(listContainer);

  // Internal state
  let currentFilter = '';
  let groups = new Set();
  let nodeMap = new WeakMap(); // object -> node element
  let visibleGroups = new Map(); // groupName -> boolean
  let showSystemObjects = false; // Whether to show system objects

  function collectGroups(root) {
    groups.clear();
    root.traverse(o => {
      const g = o.userData && o.userData._layer;
      if (g) groups.add(g);
    });
  }

  function refreshGroupSelect() {
    const prev = groupSelect.value;
    groupSelect.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = '__all';
    optAll.textContent = '— All —';
    groupSelect.appendChild(optAll);
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      groupSelect.appendChild(opt);
    });
    if ([...groups].length === 0) {
      const opt = document.createElement('option');
      opt.value = '__none';
      opt.textContent = 'No groups';
      groupSelect.appendChild(opt);
    }
    groupSelect.value = prev || '__all';
  }

  function setGroupVisibility(groupName, visible) {
    visibleGroups.set(groupName, !!visible);
    // apply to scene
    sceneManager.getScene().traverse(o => {
      const g = o.userData && o.userData._layer;
      if (groupName === '__all') {
        o.visible = true;
      } else if (g === groupName) {
        o.visible = !!visible;
      }
    });
    renderTree();
  }

  function addGroup(name) {
    if (!name) return;
    groups.add(name);
    visibleGroups.set(name, true);
    refreshGroupSelect();
  }

  addGroup('__default');

  // Helper function to check if object belongs to current model
  function isModelObject(obj) {
    if (!getCurrentModel || typeof getCurrentModel !== 'function') return false;
    const currentModel = getCurrentModel();
    if (!currentModel) return false;
    
    // Check if object is a descendant of current model
    let parent = obj.parent;
    while (parent) {
      if (parent === currentModel) return true;
      parent = parent.parent;
    }
    return false;
  }

  // Build tree
  function renderTree() {
    listContainer.innerHTML = '';
    nodeMap = new WeakMap();
    
    // Create main container for both categories
    const mainContainer = document.createElement('div');
    listContainer.appendChild(mainContainer);

    const root = sceneManager.getScene();
    
    // Collect objects by category
    const modelObjects = [];
    const systemObjects = [];
    
    // Debug: print scene hierarchy (name, parent) to help diagnose orphaned nodes
    // (temporarily logs; safe to remove after troubleshooting)
    try {
      console.groupCollapsed && console.groupCollapsed('Inspector: scene hierarchy');
      root.traverse(obj => {
        if (obj !== root) {
          const name = obj.name || obj.type || '<anon>';
          const parentName = obj.parent ? (obj.parent.name || obj.parent.type || '<anon>') : '<root>';
          const isModel = !!isModelObject(obj);
          console.log(`[Inspector] ${name} — parent: ${parentName} — isModelObject: ${isModel}`);
        }
      });
      console.groupEnd && console.groupEnd();
    } catch (err) {
      console.warn('[Inspector] Hierarchy debug failed', err);
    }
    
    // Determine current model. Prefer provided getCurrentModel(), otherwise fall back
    // to a heuristic: pick the node with the largest number of descendants (likely the loaded model root).
    let currentModel = (typeof getCurrentModel === 'function') ? getCurrentModel() : null;
    
    if (!currentModel) {
      try {
        // Find candidate nodes that are direct children of the scene (or Groups) and count descendants
        let best = null;
        let bestCount = 0;
        root.traverse(node => {
          if (node === root) return;
          // skip non-candidate nodes like helpers / lights by heuristics: prefer Groups or Objects with children
          const hasChildren = !!(node.children && node.children.length);
          if (!hasChildren) return;
          // count descendants (cheap DFS)
          let cnt = 0;
          node.traverse(() => cnt++);
          if (cnt > bestCount) {
            best = node;
            bestCount = cnt;
          }
        });
        if (best && bestCount > 1) {
          currentModel = best;
          console.info('[Inspector] Heuristic selected model root:', currentModel.name || currentModel.type, 'descendants:', bestCount);
        }
      } catch (err) {
        console.warn('[Inspector] Model heuristic failed', err);
      }
    }
    
    if (currentModel) {
      // Use the model root as the single top-level model entry so addNode will recurse children
      modelObjects.push(currentModel);
      // collect system objects as before
      root.traverse(obj => {
        if (obj !== root && !isModelObject(obj)) systemObjects.push(obj);
      });
    } else {
      // No current model: fall back to previous behavior (classify by isModelObject)
      root.traverse(obj => {
        if (obj !== root) {
          if (isModelObject(obj)) modelObjects.push(obj);
          else systemObjects.push(obj);
        }
      });
    }
    
    // Debug: which objects were collected for each category
    try {
      console.groupCollapsed && console.groupCollapsed('Inspector: collected categories');
      console.log('[Inspector] modelObjects:', modelObjects.map(o => o.name || o.type || '<anon>').slice(0,200));
      console.log('[Inspector] systemObjects:', systemObjects.map(o => o.name || o.type || '<anon>').slice(0,200));
      console.groupEnd && console.groupEnd();
    } catch (err) {
      console.warn('[Inspector] Category debug failed', err);
    }

    // Render Model category
    if (modelObjects.length > 0) {
      const modelCategory = createCategory('Model', modelObjects);
      mainContainer.appendChild(modelCategory);
    }

    // Render System category (only if showSystemObjects is true)
    if (showSystemObjects && systemObjects.length > 0) {
      const systemCategory = createCategory('System', systemObjects);
      mainContainer.appendChild(systemCategory);
    }
  }

   // Helper function to create a category section
   function createCategory(categoryName, objects) {
     const categoryDiv = document.createElement('div');
     categoryDiv.style.marginBottom = '16px';
     
     // Category header with toggle + visibility icon
     const header = document.createElement('div');
     header.style.display = 'flex';
     header.style.alignItems = 'center';
     header.style.gap = '8px';
     header.style.cursor = 'pointer';
     header.style.padding = '6px 10px';
     header.style.borderRadius = '6px';
     header.style.backgroundColor = 'transparent';
     
     // Visibility icon (uses FontAwesome)
     const catVis = document.createElement('i');
     catVis.className = 'fa-regular fa-eye toggle-icon category-eye';
     catVis.title = 'Toggle category visibility';
     catVis.style.fontSize = '14px';
     catVis.style.color = 'var(--muted)';
     catVis.style.cursor = 'pointer';
     
     // Expand/collapse caret
     const caret = document.createElement('i');
     caret.className = 'fa-solid fa-chevron-right toggle-icon chev';
     caret.style.fontSize = '12px';
     caret.style.color = 'var(--muted)';
     caret.style.transition = 'transform 0.18s';
     
     const title = document.createElement('span');
     title.textContent = categoryName;
     title.style.fontWeight = '700';
     title.style.fontSize = '13px';
     title.style.marginLeft = '4px';
     
     const count = document.createElement('span');
     count.textContent = `(${objects.length})`;
     count.style.fontSize = '12px';
     count.style.color = 'var(--muted)';
     count.style.marginLeft = '6px';
     
     header.appendChild(catVis);
     header.appendChild(caret);
     header.appendChild(title);
     header.appendChild(count);
     categoryDiv.appendChild(header);
     
     // Category content
     const content = document.createElement('div');
     content.style.paddingLeft = '22px';
     
     // Add objects to this category
     objects.forEach(obj => {
       const ul = document.createElement('ul');
       ul.style.listStyle = 'none';
       ul.style.paddingLeft = '12px';
       content.appendChild(ul);
       addNode(obj, ul);
     });
     
     categoryDiv.appendChild(content);
     
     // Toggle functionality for expand/collapse
     let isExpanded = false; // Initially collapsed
     const setExpanded = (v) => {
       isExpanded = !!v;
       caret.classList.toggle('fa-rotate-180', isExpanded);
       content.style.display = isExpanded ? 'block' : 'none';
     };
     // Clicking header toggles (except when clicking visibility icon)
     header.addEventListener('click', (e) => {
       if (e.target === catVis) return;
       setExpanded(!isExpanded);
     });
     // Also make the caret itself a reliable toggle target (handles clicks on the icon)
     caret.addEventListener('click', (e) => {
       e.stopPropagation();
       setExpanded(!isExpanded);
     });
     // Initially collapse the content
     setExpanded(false);
   
     // Initialize category visibility icon based on objects' visibility
     const allVisible = objects.length > 0 && objects.every(o => !!o.visible);
     catVis.classList.toggle('inactive', !allVisible);
     catVis.classList.toggle('fa-eye', allVisible);
     catVis.classList.toggle('fa-eye-slash', !allVisible);
   
     // Category visibility cascade: immediate cascade to all children/objects
     catVis.addEventListener('click', (e) => {
       e.stopPropagation();
       // Determine next state: if eye is active (visible) -> hide, else show
       const isActive = !catVis.classList.contains('inactive');
       const nextVisible = !isActive;
       // update icon state
       catVis.classList.toggle('inactive', !nextVisible);
       catVis.classList.toggle('fa-eye', nextVisible);
       catVis.classList.toggle('fa-eye-slash', !nextVisible);
       // apply to objects (and their descendants)
       objects.forEach(obj => {
         obj.visible = nextVisible;
         obj.traverse(child => { child.visible = nextVisible; });
       });
       // re-render to reflect changes
       renderTree();
     });
   
     return categoryDiv;
   }

  function addNode(o, parentUl) {
      // filter
      const labelText = o.name || o.type || 'Object';
      if (currentFilter && !labelText.toLowerCase().includes(currentFilter.toLowerCase())) {
        // do not include, but still recurse to check children
        let childIncluded = false;
        if (o.children?.length) {
          for (const c of o.children) {
            // quick check child
            if ((c.name || c.type || '').toLowerCase().includes(currentFilter.toLowerCase())) { childIncluded = true; break; }
          }
        }
        if (!childIncluded) return;
      }

      const li = document.createElement('li');
      li.style.margin = '6px 0';
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';

      // visibility icon (FontAwesome) - replaces checkbox
      const visIcon = document.createElement('i');
      visIcon.className = (!!o.visible) ? 'fa-regular fa-eye toggle-icon' : 'fa-regular fa-eye-slash toggle-icon inactive';
      visIcon.title = 'Toggle visibility';
      visIcon.style.fontSize = '14px';
      visIcon.style.color = 'var(--muted)';
      visIcon.style.cursor = 'pointer';
      visIcon.style.width = '18px';
      visIcon.style.textAlign = 'center';
      visIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextVisible = !o.visible;
        o.visible = nextVisible;
        // sync children visibility when toggling an object's visibility
        o.traverse(child => { child.visible = nextVisible; });
        // update icon class
        visIcon.classList.toggle('inactive', !nextVisible);
        visIcon.classList.toggle('fa-eye', nextVisible);
        visIcon.classList.toggle('fa-eye-slash', !nextVisible);
      });
      
      // lock toggle (FontAwesome) - replaces emoji button
      const lockBtn = document.createElement('i');
      const locked = !!(o.userData && o.userData._locked);
      lockBtn.className = locked ? 'fa-solid fa-lock toggle-icon' : 'fa-solid fa-unlock toggle-icon';
      lockBtn.title = 'Lock / Unlock';
      lockBtn.style.fontSize = '14px';
      lockBtn.style.color = 'var(--muted)';
      lockBtn.style.cursor = 'pointer';
      lockBtn.style.width = '18px';
      lockBtn.style.textAlign = 'center';
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        o.userData = o.userData || {};
        o.userData._locked = !o.userData._locked;
        const isLocked = !!o.userData._locked;
        lockBtn.className = isLocked ? 'fa-solid fa-lock toggle-icon' : 'fa-solid fa-unlock toggle-icon';
        // visual hint: reduce opacity
        o.traverse(node => {
          if (node.material && node.material.transparent === false) {
            node.material.transparent = true;
            node.material.opacity = isLocked ? 0.6 : 1.0;
          } else if (node.material) {
            node.material.opacity = isLocked ? 0.6 : 1.0;
          }
        });
      });
      
      // name / select button
      const btn = document.createElement('button');
      btn.textContent = labelText;
      btn.className = 'btn';
      btn.style.flex = '1';
      btn.style.justifyContent = 'flex-start';
      btn.addEventListener('click', () => {
        if (onSelect) onSelect(o);
      });
      
      // group input
      const grpInput = document.createElement('input');
      grpInput.type = 'text';
      grpInput.placeholder = 'group';
      grpInput.value = (o.userData && o.userData._layer) || '';
      grpInput.className = 'field';
      grpInput.style.width = '100px';
      grpInput.addEventListener('change', () => {
        const v = grpInput.value.trim();
        o.userData = o.userData || {};
        if (v) {
          o.userData._layer = v;
          groups.add(v);
          visibleGroups.set(v, visibleGroups.has(v) ? visibleGroups.get(v) : true);
        } else {
          delete o.userData._layer;
        }
        refreshGroupSelect();
      });
      
      // append new icons/buttons
      row.appendChild(visIcon);
      row.appendChild(lockBtn);
      row.appendChild(btn);
      row.appendChild(grpInput);
      
      li.appendChild(row);
      parentUl.appendChild(li);
      nodeMap.set(o, li);
      
      // children
      if (o.children?.length) {
        const childUl = document.createElement('ul');
        childUl.style.listStyle = 'none';
        childUl.style.paddingLeft = '12px';
        li.appendChild(childUl);
        
        // keep collapsed by default; visibility controlled by li.expanded class via CSS
        li.classList.remove('expanded');
        
        // Add expand/collapse button (FontAwesome caret)
        const expandBtn = document.createElement('i');
        expandBtn.className = 'fa-solid fa-chevron-right toggle-icon';
        expandBtn.style.fontSize = '12px';
        expandBtn.style.marginRight = '6px';
        expandBtn.style.cursor = 'pointer';
        expandBtn.style.transition = 'transform 0.18s';
        
        // Insert expand button before the row content
        row.insertBefore(expandBtn, row.firstChild);
        
        // Toggle functionality for children — show/hide the child list directly
        let childrenExpanded = false;
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering parent click
          childrenExpanded = !childrenExpanded;
          expandBtn.classList.toggle('fa-rotate-180', childrenExpanded);
          childUl.style.display = childrenExpanded ? 'block' : 'none';
        });
        
        o.children.forEach(c => addNode(c, childUl));
      }
    }

  // Interactions
  search.addEventListener('input', (e) => {
    currentFilter = e.target.value || '';
    renderTree();
  });
  refreshBtn.addEventListener('click', () => {
    collectGroups(sceneManager.getScene());
    renderTree();
  });
  addGroupBtn.addEventListener('click', () => {
    const v = newGroupInput.value.trim();
    if (!v) return;
    addGroup(v);
    newGroupInput.value = '';
  });
  groupSelect.addEventListener('change', () => {
    const v = groupSelect.value;
    if (v === '__all') {
      // show all
      sceneManager.getScene().traverse(o => o.visible = true);
    } else if (v === '__none') {
      // nothing
    } else {
      // toggle visibility only for that group
      const current = visibleGroups.get(v);
      const next = !current;
      setGroupVisibility(v, next);
    }
    renderTree();
  });

  // initial collect and render
  collectGroups(sceneManager.getScene());
  renderTree();

  // Add toggle for system objects visibility
  const systemToggle = document.createElement('div');
  systemToggle.style.margin = '8px 0';
  systemToggle.style.padding = '8px';
  systemToggle.style.backgroundColor = '#f9fafb';
  systemToggle.style.borderRadius = '4px';
  
  const systemToggleLabel = document.createElement('label');
  systemToggleLabel.style.display = 'flex';
  systemToggleLabel.style.alignItems = 'center';
  systemToggleLabel.style.gap = '8px';
  systemToggleLabel.style.cursor = 'pointer';
  
  const systemToggleInput = document.createElement('input');
  systemToggleInput.type = 'checkbox';
  systemToggleInput.checked = showSystemObjects;
  
  const systemToggleText = document.createElement('span');
  systemToggleText.textContent = 'Show system objects';
  systemToggleText.style.fontSize = '12px';
  systemToggleText.style.color = '#666';
  
  systemToggleLabel.appendChild(systemToggleInput);
  systemToggleLabel.appendChild(systemToggleText);
  systemToggle.appendChild(systemToggleLabel);
  
  // Insert after header but before tree
  treeRoot.insertBefore(systemToggle, listContainer);
  
  systemToggleInput.addEventListener('change', (e) => {
    showSystemObjects = e.target.checked;
    renderTree();
  });

  // expose a small API
  return {
    renderTree,
    collectGroups,
    addGroup,
    setGroupVisibility,
    refresh: () => {
      collectGroups(sceneManager.getScene());
      renderTree();
    }
  };
}

export default initInspector;