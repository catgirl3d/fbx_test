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

export function initInspector({ sceneManager, onSelect } = {}) {
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

  // Build tree
  function renderTree() {
    listContainer.innerHTML = '';
    nodeMap = new WeakMap();
    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.paddingLeft = '12px';
    listContainer.appendChild(ul);

    const root = sceneManager.getScene();
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

      // visibility checkbox
      const vis = document.createElement('input');
      vis.type = 'checkbox';
      vis.checked = !!o.visible;
      vis.title = 'Visible';
      vis.style.transform = 'scale(.9)';

      vis.addEventListener('change', (e) => {
        o.visible = vis.checked;
      });

      // lock toggle
      const lock = document.createElement('button');
      lock.className = 'btn';
      lock.textContent = (o.userData && o.userData._locked) ? '🔒' : '🔓';
      lock.title = 'Lock / Unlock';
      lock.addEventListener('click', () => {
        o.userData = o.userData || {};
        o.userData._locked = !o.userData._locked;
        lock.textContent = o.userData._locked ? '🔒' : '🔓';
        // visual hint: reduce opacity
        o.traverse(node => {
          if (node.material && node.material.transparent === false) {
            node.material.transparent = true;
            node.material.opacity = o.userData._locked ? 0.6 : 1.0;
          } else if (node.material) {
            node.material.opacity = o.userData._locked ? 0.6 : 1.0;
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

      row.appendChild(vis);
      row.appendChild(lock);
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
        o.children.forEach(c => addNode(c, childUl));
      }
    }
    (root.children || []).forEach(o => addNode(o, ul));
    refreshGroupSelect();
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