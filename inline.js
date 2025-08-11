<script type="text/plain" data-original-module="true">
    import * as THREE from 'three';
    import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js';
    import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
    import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/FBXLoader.js';
    import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/DRACOLoader.js';
    import { KTX2Loader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/KTX2Loader.js';
    import { MeshoptDecoder } from 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.20.0/meshopt_decoder.module.js';
    import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/EffectComposer.js';
    import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/RenderPass.js';
    import { OutlinePass } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/OutlinePass.js';
    import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/ShaderPass.js';
    import { FXAAShader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/shaders/FXAAShader.js';
    import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/RGBELoader.js';
    import { TransformControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/TransformControls.js';

    // ======= i18n (existing keys; new sections use English labels directly) =======
    const i18n = {
      ru: {
        title: '3D Viewer', btnLoad:'Загрузить модель', btnFrame:'К камере', btnClear:'Очистить',
        toggleShadows:'Тени', toggleLight:'Только освещение', toggleGrid:'Сетка', bgLabel:'Фон', btnApply:'Применить',
        matOverride:'Материал', wireframe:'Каркас',
        animTitle:'Анимации', animPlay:'Пуск', animPause:'Пауза', animStop:'Стоп', animLoop:'Зациклить', animSpeed:'Скорость',
        animHint:'По умолчанию анимация не проигрывается.', hotkeys:'Горячие клавиши',
        hkSelect:'выбор', hkFocus:'к объекту', hkReset:'сброс камеры', hkClearSel:'снять выделение',
        inspector:'Сцена', btnHideInspector:'Скрыть', btnShowInspector:'Инспектор', objects:'Объекты:',
        btnResetAll:'Сбросить всё', btnReset:'Сбросить'
      },
      en: {
        title: '3D Viewer', btnLoad:'Load model', btnFrame:'Frame', btnClear:'Clear',
        toggleShadows:'Shadows', toggleLight:'Light only', toggleGrid:'Grid', bgLabel:'Background', btnApply:'Apply',
        matOverride:'Material', wireframe:'Wireframe',
        animTitle:'Animations', animPlay:'Play', animPause:'Pause', animStop:'Stop', animLoop:'Loop', animSpeed:'Speed',
        animHint:'By default animations do not play.', hotkeys:'Hotkeys',
        hkSelect:'select', hkFocus:'focus', hkReset:'reset camera', hkClearSel:'clear selection',
        inspector:'Scene', btnHideInspector:'Hide', btnShowInspector:'Inspector', objects:'Objects:',
        btnResetAll:'Reset all', btnReset:'Reset'
      }
    };
    function applyLang(lang){
      document.querySelectorAll('[data-i]').forEach(el=>{
        const key = el.getAttribute('data-i');
        if (i18n[lang][key] !== undefined) el.textContent = i18n[lang][key];
      });
      openInspectorBtn.title = i18n[lang].btnShowInspector;
      themeLabel.textContent = (lang==='ru' ? (isDark() ? 'Ночная' : 'Светлая') : (isDark() ? 'Dark' : 'Light'));
      saveSettings();
    }

    // ======= Local storage =======
    const LS_KEY = 'viewerSettings.v1';
    const SEC_KEY = 'viewerSections.v2';
    function loadSettings(){
      try{ return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }catch{ return {}; }
    }
    function saveSettings(){
      const s = {
        lang: langSelect.value,
        theme: isDark() ? 'dark' : 'light',
        toggles:{
          shadows: toggleShadows.checked,
          fxaa: toggleFXAA.checked,
          lightonly: toggleLightOnly.checked,
          grid: toggleGrid.checked
        },
        background:{ mode: bgSelect.value, color: bgColor.value },
        hdri: hdriUrlInput.value.trim(),
        material:{ override: matOverride.value, wireframe: toggleWireframe.checked },
        anim:{ loop: animLoop.checked, speed: parseFloat(animSpeed.value)||1 },
        render:{ exposure: parseFloat(exposure.value)||1, tonemapping: toneMapping.value },
        light:{ envIntensity: parseFloat(envIntensity.value)||1, dir:{ intensity: parseFloat(dirIntensity.value)||0.9, angle: parseFloat(dirAngle.value)||34, softness: parseFloat(dirSoftness.value)||1 } }
      };
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    }

    // ======= DOM =======
    const d = document;
    const canvas = d.getElementById('viewport');
    const leftCol = d.querySelector('.left-col');
    const inspector = d.getElementById('scene-inspector');
    const treeRoot = d.getElementById('tree');
    const inspectorClose = d.getElementById('inspector-close');
    const openInspectorBtn = d.getElementById('open-inspector');
    const polyCountEl = d.getElementById('poly-count');
    const toastEl = d.getElementById('toast');
    const overlay = d.getElementById('overlay');
    const meter = d.getElementById('meter');
    const progressTitle = d.getElementById('progress-title');
    const progressSub = d.getElementById('progress-sub');
    const objCountEl = d.getElementById('obj-count');
    const fpsEl = d.getElementById('fps');

    const langSelect = d.getElementById('lang');
    const themeToggle = d.getElementById('theme-toggle');
    const themeIcon = d.getElementById('theme-icon');
    const themeLabel = d.getElementById('theme-label');

    const fileInput = d.getElementById('file-input');
    const resetCameraBtn = d.getElementById('reset-camera');
    const clearSceneBtn = d.getElementById('clear-scene');
    const resetAllBtn = d.getElementById('reset-all');
    const toggleShadows = d.getElementById('toggle-shadows');
    const toggleFXAA = d.getElementById('toggle-fxaa');
    const toggleLightOnly = d.getElementById('toggle-lightonly');
    const toggleGrid = d.getElementById('toggle-grid');
    const bgSelect = d.getElementById('bg-select');
    const bgColor = d.getElementById('bg-color');
    const hdriUrlInput = d.getElementById('hdri-url');
    const applyHdriBtn = d.getElementById('apply-hdri');

    const exposure = d.getElementById('exposure');
    const exposureVal = d.getElementById('exposure-val');
    const toneMapping = d.getElementById('tone-mapping');

    const envIntensity = d.getElementById('env-intensity');
    const envIntensityVal = d.getElementById('env-intensity-val');

    const dirIntensity = d.getElementById('dir-intensity');
    const dirIntensityVal = d.getElementById('dir-intensity-val');
    const dirAngle = d.getElementById('dir-angle');
    const dirAngleVal = d.getElementById('dir-angle-val');
    const dirSoftness = d.getElementById('dir-softness');
    const dirSoftnessVal = d.getElementById('dir-softness-val');

    const matOverride = d.getElementById('mat-override');
    const toggleWireframe = d.getElementById('toggle-wireframe');

    const animSelect = d.getElementById('anim-select');
    const animPlayPause = d.getElementById('anim-playpause');
    const animStop = d.getElementById('anim-stop');
    const animLoop = d.getElementById('anim-loop');
    const animSpeed = d.getElementById('anim-speed');
    const animProgress = d.getElementById('anim-progress');
    const animTime = d.getElementById('anim-time');

    const dropZone = d.getElementById('drop-zone');

    // Tools & gizmos DOM
    const toggleTransform = d.getElementById('toggle-transform');
    const transformMode = d.getElementById('transform-mode');
    const toggleSnap = d.getElementById('toggle-snap');
    const snapPos = d.getElementById('snap-pos');
    const snapRot = d.getElementById('snap-rot');
    const snapScale = d.getElementById('snap-scale');
    const measureToggle = d.getElementById('measure-toggle');
    const measureClear = d.getElementById('measure-clear');
    const measureOut = d.getElementById('measure-out');
    const bboxSizeEl = d.getElementById('bbox-size');
    const camPresets = d.getElementById('cam-presets');

    // Section reset buttons
    const resetRenderBtn = d.getElementById('reset-render');
    const resetDirBtn = d.getElementById('reset-dir');
    const resetEnvBtn = d.getElementById('reset-env');
    const resetGizmosBtn = d.getElementById('reset-gizmos');

    // ======= THREE setup =======
    const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, alpha:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.autoClear = false; // allow overlay

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(getComputedStyle(d.body).getPropertyValue('--canvas-default').trim());

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 50000);
    camera.position.set(2, 1.2, 3);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.8, 0);
    controls.update();

    // Transform controls
    const tControls = new TransformControls(camera, renderer.domElement);
    scene.add(tControls);
    tControls.enabled = false;
    tControls.addEventListener('dragging-changed', e => { controls.enabled = !e.value; });
    tControls.addEventListener('change', ()=>{ updateBBox(selectedObject || currentModel); });

    // Grid (adaptive)
    let grid = null;
    function createGrid(size=10, divisions=20){
      if (grid){ scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); grid=null; }
      grid = new THREE.GridHelper(size, divisions, getColor('--grid-c1'), getColor('--grid-c2'));
      grid.material.transparent = true; grid.material.opacity = 0.6;
      grid.position.y = 0;
      scene.add(grid);
      grid.visible = toggleGrid.checked;
    }
    function getColor(cssVar){
      const v = getComputedStyle(d.body).getPropertyValue(cssVar).trim();
      return new THREE.Color(v);
    }
    createGrid(10, 20);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.5);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(3,5,2);
    dir.castShadow = false;
    dir.shadow.radius = 1;
    scene.add(dir);

    // Post-processing
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
    // Increased brightness, removed pulse
    outlinePass.edgeStrength = 12.0;     // brighter outline
    outlinePass.edgeGlow = 1.0;          // stronger glow
    outlinePass.edgeThickness = 3.0;     // a bit thicker
    outlinePass.pulsePeriod = 0.0;       // disable pulsing
    outlinePass.visibleEdgeColor.set(0xa7d3ff); // brighter tint
    outlinePass.hiddenEdgeColor.set(0x0);
    composer.addPass(outlinePass);

    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    composer.addPass(fxaaPass);

    // Camera navigator (axes overlay)
    const axisScene = new THREE.Scene();
    const axisCam = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    axisCam.position.set(0,0,2);
    const axisHelper = new THREE.AxesHelper(1.2);
    axisScene.add(axisHelper);
    const NAV_SIZE = 96; const NAV_PAD = 12;

    // Animation
    let mixer = null;
    let currentClips = [];
    let activeAction = null;
    let clock = new THREE.Clock();

    // Current model state
    let currentModel = null;
    let savedOriginal = new WeakMap();
    let selectedObject = null;
    let envHdrTex = null;

    // Loaders
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/libs/draco/');
    gltfLoader.setDRACOLoader(dracoLoader);
    const ktx2 = new KTX2Loader()
      .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/libs/basis/')
      .detectSupport(renderer);
    gltfLoader.setKTX2Loader(ktx2);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    const fbxLoader = new FBXLoader();
    const rgbeLoader = new RGBELoader();

    // ======= Measure & BBox =======
    let bboxHelper = null;
    const measure = { active:false, pts:[], group:new THREE.Group() };
    scene.add(measure.group);

    function updateBBox(target){
      if (bboxHelper){ scene.remove(bboxHelper); bboxHelper.geometry.dispose?.(); bboxHelper.material.dispose?.(); bboxHelper = null; }
      const obj = target;
      if (!obj){ if (bboxSizeEl) bboxSizeEl.textContent = 'bbox: —'; return; }
      const box = new THREE.Box3().setFromObject(obj);
      if (!isFinite(box.min.x) || !isFinite(box.max.x)){ if (bboxSizeEl) bboxSizeEl.textContent = 'bbox: —'; return; }
      bboxHelper = new THREE.Box3Helper(box, 0x93c5fd);
      scene.add(bboxHelper);
      const size = new THREE.Vector3(); box.getSize(size);
      if (bboxSizeEl) bboxSizeEl.textContent = `bbox: ${size.x.toFixed(3)}×${size.y.toFixed(3)}×${size.z.toFixed(3)} m`;
    }

    let measureLine = null;
    function clearMeasure(){
      while(measure.group.children.length){
        const c = measure.group.children.pop();
        c.geometry?.dispose?.(); c.material?.dispose?.();
      }
      measure.pts.length = 0; measureLine = null; if (measureOut) measureOut.textContent = '—';
    }
    function addMeasurePoint(p){
      measure.pts.push(p.clone());
      const gs = (typeof gridSize!=='undefined' && gridSize) ? gridSize : 10;
      const s = Math.max(0.01, gs*0.01);
      const geom = new THREE.SphereGeometry(s, 16, 16);
      const mat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const m = new THREE.Mesh(geom, mat);
      m.position.copy(p);
      measure.group.add(m);
      if (measure.pts.length === 2){ drawMeasureLine(); }
      if (measure.pts.length > 2){ clearMeasure(); addMeasurePoint(p); }
    }
    function drawMeasureLine(){
      if (measureLine){ measure.group.remove(measureLine); measureLine.geometry.dispose(); measureLine.material.dispose(); measureLine=null; }
      const pts = measure.pts.slice(0,2);
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const gs = (typeof gridSize!=='undefined' && gridSize) ? gridSize : 10;
      const mat = new THREE.LineDashedMaterial({ color: 0x60a5fa, dashSize: 0.05*gs, gapSize: 0.025*gs });
      const line = new THREE.Line(g, mat);
      line.computeLineDistances();
      measure.group.add(line);
      measureLine = line;
      const d = pts[0].distanceTo(pts[1]);
      if (measureOut) measureOut.textContent = d.toFixed(3) + ' m';
    }
    function handleMeasureClick(e){
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2 - 1, -((e.clientY-rect.top)/rect.height)*2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const meshes = [];
      if (currentModel){ currentModel.traverse(o=>{ if (o.isMesh) meshes.push(o); }); }
      else { scene.traverse(o=>{ if (o.isMesh) meshes.push(o); }); }
      let p = null;
      const hit = ray.intersectObjects(meshes, true)[0];
      if (hit){ p = hit.point.clone(); }
      else {
        const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
        const pt = new THREE.Vector3();
        if (ray.ray.intersectPlane(plane, pt)) p = pt;
      }
      if (p) addMeasurePoint(p);
    }

    // ======= Theme =======
    function isDark(){ return d.body.classList.contains('theme-dark'); }
    function setTheme(theme){
      d.body.classList.toggle('theme-dark', theme === 'dark');
      themeIcon.textContent = theme === 'dark' ? '🌙' : '🌞';
      themeLabel.textContent = (langSelect.value === 'ru') ? (theme==='dark' ? 'Ночная' : 'Светлая') : (theme==='dark' ? 'Dark' : 'Light');
      if (bgSelect.value === 'white' || bgSelect.value==='lightgray' || bgSelect.value==='midgray' || bgSelect.value==='darkgray'){
        updateBackgroundFromUI();
      } else if (bgSelect.value === 'transparent'){
        updateBackgroundFromUI();
      } else if (bgSelect.value === 'custom'){
        // keep custom
      } else {
        scene.background = new THREE.Color(getComputedStyle(d.body).getPropertyValue('--canvas-default').trim());
      }
      createGrid(gridSize, gridDiv);
      saveSettings();
    }
    themeToggle.addEventListener('click', ()=> setTheme(isDark() ? 'light' : 'dark'));

    // ======= Inspector open/close =======
    function openInspector(open) {
      inspector.classList.toggle('right-0', open);
      inspector.classList.toggle('right-[-360px]', !open);
    }
    openInspectorBtn.addEventListener('click', ()=> openInspector(true));
    leftCol.addEventListener('dblclick', () => openInspector(true));
    inspectorClose.addEventListener('click', () => openInspector(false));

    // ======= Drag & Drop =======
    ;['dragenter','dragover'].forEach(evt=>dropZone.addEventListener(evt, (e)=>{
      e.preventDefault(); e.stopPropagation();
      showOverlay('Загрузка…', 'Перетащите файл сюда');
    }));
    ;['dragleave','drop'].forEach(evt=>dropZone.addEventListener(evt, (e)=>{
      e.preventDefault(); e.stopPropagation();
      hideOverlay();
    }));
    dropZone.addEventListener('drop', (e)=>{
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    });

    // ======= File input =======
    fileInput.addEventListener('change', (e)=>{
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      fileInput.value = '';
    });

    function handleFile(file){
      const name = file.name.toLowerCase();
      if (name.endsWith('.gltf') || name.endsWith('.glb')) {
        loadGLTF(file);
      } else if (name.endsWith('.fbx')) {
        loadFBX(file);
      } else {
        toast('Поддерживаются: glTF/GLB/FBX');
      }
    }

    // ======= Safe revoke URL helper =======
    function loadWithURL(loader, file, onSuccess, onProgress, onError){
      const url = URL.createObjectURL(file);
      loader.load(url, (asset)=>{
          URL.revokeObjectURL(url);
          onSuccess && onSuccess(asset);
        }, (evt)=>{
          if (evt && evt.lengthComputable) setProgress(evt.loaded / evt.total);
          else setIndeterminate();
          onProgress && onProgress(evt);
        }, (err)=>{
          URL.revokeObjectURL(url);
          onError && onError(err);
        });
    }

    // ======= Model lifecycle =======
    function disposeObject(obj){
      obj.traverse(o=>{
        if (o.isMesh){
          if (o.geometry) o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.filter(Boolean).forEach(m=>{
            ['map','normalMap','metalnessMap','roughnessMap','emissiveMap','aoMap','alphaMap','bumpMap','envMap']
              .forEach(k=>{ if (m && m[k]?.isTexture) m[k].dispose(); });
            m?.dispose?.();
          });
        }
      });
    }
    function clearCurrentModel(){
      if (currentModel){
        outlinePass.selectedObjects = [];
        selectObject(null);
        scene.remove(currentModel);
        disposeObject(currentModel);
        currentModel = null;
        if (bboxHelper){ scene.remove(bboxHelper); bboxHelper.geometry?.dispose?.(); bboxHelper.material?.dispose?.(); bboxHelper=null; }
        if (bboxSizeEl) bboxSizeEl.textContent = 'bbox: —';
        clearMeasure();
      }
      updateStats();
      buildSceneTree(null);
      resetAnimationsUI();
    }

    // ======= Material enhancement & override =======
    function enhanceMaterial(material){
      if (!material) return material;
      if (Array.isArray(material)) return material.map(m => enhanceMaterial(m));
      if (!(material instanceof THREE.MeshStandardMaterial)){
        const m = new THREE.MeshStandardMaterial({
          name: material.name || '',
          color: material.color ? material.color.clone() : new THREE.Color(0xcccccc),
          opacity: material.opacity ?? 1,
          transparent: !!material.transparent,
          side: material.side ?? THREE.FrontSide,
          wireframe: !!material.wireframe
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

    function makeOverride(type){
      switch(type){
        case 'standard': return new THREE.MeshStandardMaterial({ color: 0xffffff, metalness:0, roughness:0.5 });
        case 'phong':    return new THREE.MeshPhongMaterial({ color: 0xffffff, shininess:30 });
        case 'basic':    return new THREE.MeshBasicMaterial({ color: 0xffffff });
        case 'normal':   return new THREE.MeshNormalMaterial();
        case 'toon':     return new THREE.MeshToonMaterial({ color: 0xffffff });
        default: return null; // none
      }
    }
    function applyMaterialOverride(root){
      if (!root) return;
      const overrideType = matOverride.value;
      const wire = toggleWireframe.checked;
      const overrideMat = makeOverride(overrideType);
      root.traverse(o=>{
        if (!o.isMesh) return;
        if (overrideMat){
          const base = overrideMat.clone();
          base.wireframe = wire;
          o.material = base;
        } else {
          if (Array.isArray(o.material)) o.material = o.material.map(m => enhanceMaterial(m));
          else o.material = enhanceMaterial(o.material);
          o.material.wireframe = wire || o.material.wireframe;
        }
        applyEnvIntensityToMaterial(o.material, getNumber(envIntensity.value, 1));
        o.material.needsUpdate = true;
      });
    }

    // ======= Env intensity helper =======
    function applyEnvIntensityToMaterial(material, intensity){
      const list = Array.isArray(material) ? material : [material];
      list.filter(Boolean).forEach(m=>{
        if ('envMapIntensity' in m){ m.envMapIntensity = intensity; m.needsUpdate = true; }
      });
    }
    function setEnvIntensity(intensity, root){
      (root || scene).traverse(o=>{
        if (o.isMesh) applyEnvIntensityToMaterial(o.material, intensity);
      });
    }

    // ======= Light-only toggle =======
    function setLightOnly(root, on){
      if (!root) return;
      root.traverse(o=>{
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m=>{
          if (!m) return;
          if (on){
            if (!savedOriginal.has(m)){
              savedOriginal.set(m, {
                color: m.color?.clone?.(),
                emissive: m.emissive?.clone?.(),
                map: m.map || null,
                emissiveMap: m.emissiveMap || null,
                roughness: m.roughness,
                metalness: m.metalness
              });
            }
            m.map = null;
            m.emissiveMap = null;
            m.color?.set?.(0xffffff);
            if ('roughness' in m) m.roughness = 0.6;
            if ('metalness' in m) m.metalness = 0.0;
            m.needsUpdate = true;
          } else {
            const saved = savedOriginal.get(m);
            if (saved){
              m.map = saved.map;
              m.emissiveMap = saved.emissiveMap;
              saved.color && m.color?.copy?.(saved.color);
              saved.emissive && m.emissive?.copy?.(saved.emissive);
              if ('roughness' in m && saved.roughness !== undefined) m.roughness = saved.roughness;
              if ('metalness' in m && saved.metalness !== undefined) m.metalness = saved.metalness;
              m.needsUpdate = true;
            }
          }
        });
      });
    }

    // ======= Camera framing =======
    function frameObject(obj){
      if (!obj) return;
      const box = new THREE.Box3().setFromObject(obj);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const dist = sphere.radius / Math.sin(Math.min(Math.PI/4, fov/2));
      const dirTo = new THREE.Vector3(0, 0.2, 1).normalize();
      camera.position.copy(sphere.center.clone().addScaledVector(dirTo, dist*1.2));
      controls.target.copy(sphere.center);
      controls.update();
    }
    function resetCamera(){ frameObject(currentModel || scene); }

    // ======= Adaptive Grid =======
    let gridSize = 10, gridDiv = 20;
    function resizeGridToModel(root){
      if (!root) { createGrid(10, 20); gridSize=10; gridDiv=20; return; }
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const radius = Math.max(size.x, size.z) * 0.6;
      const nice = (v)=>{
        const p = Math.pow(2, Math.ceil(Math.log2(Math.max(1, v))));
        return Math.min(Math.max(10, p), 32768);
      };
      gridSize = nice(radius * 2);
      gridDiv = Math.min(200, Math.max(10, Math.round(gridSize/0.5)));
      createGrid(gridSize, gridDiv);
    }

    // ======= Scene tree =======
    function buildSceneTree(root){
      treeRoot.innerHTML = '';
      const ul = document.createElement('ul');
      treeRoot.appendChild(ul);
      function addNode(o, parent){
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.textContent = o.name || o.type;
        btn.addEventListener('click', ()=> selectObject(o, btn));
        if (o === selectedObject) btn.classList.add('selected');
        li.appendChild(btn);
        parent.appendChild(li);
        if (o.children?.length){
          const ul2 = document.createElement('ul');
          li.appendChild(ul2);
          o.children.forEach(c=> addNode(c, ul2));
        }
      }
      (root || scene).children.forEach(o=> addNode(o, ul));
    }

    // ======= Selection =======
    function selectObject(obj, buttonEl){
      selectedObject = obj;
      outlinePass.selectedObjects = obj ? [obj] : [];
      if (typeof tControls !== 'undefined'){
        if (toggleTransform && toggleTransform.checked){ obj ? tControls.attach(obj) : tControls.detach(); }
        else { tControls.detach(); }
      }
      updateBBox(selectedObject || currentModel);
      document.querySelectorAll('#tree button').forEach(b=>b.classList.remove('selected'));
      if (buttonEl) buttonEl.classList.add('selected');
    }
    canvas.addEventListener('mousedown', (e)=>{
      if (e.button!==0) return;
      if (measure.active){ handleMeasureClick(e); return; }
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ( (e.clientX-rect.left) / rect.width ) * 2 - 1,
        - ( (e.clientY-rect.top) / rect.height ) * 2 + 1
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const meshes = [];
      if (currentModel){
        currentModel.traverse(o=>{ if (o.isMesh) meshes.push(o); });
      }else{
        scene.traverse(o=>{ if (o.isMesh) meshes.push(o); });
      }
      const hit = ray.intersectObjects(meshes, true)[0];
      if (hit){
        selectObject(hit.object);
        openInspector(true);
        buildSceneTree(currentModel);
      }
    });
    window.addEventListener('keydown', (e)=>{
      if (e.code==='KeyF' && selectedObject) {
        frameObject(selectedObject);
      } else if (e.code==='KeyR'){
        resetCamera();
      } else if (e.code==='Delete'){
        selectObject(null);
      }
    });

    // ======= Stats =======
    function updateStats(){
      let tris = 0; let objs = 0;
      scene.traverse(o=>{
        objs++;
        if (o.isMesh && o.geometry){
          const index = o.geometry.index;
          const pos = o.geometry.attributes.position;
          if (index) tris += index.count / 3;
          else if (pos) tris += pos.count / 3;
        }
      });
      polyCountEl.textContent = new Intl.NumberFormat('ru-RU').format(tris) + ' трис.';
      objCountEl.textContent = objs;
    }

    // ======= Overlay/progress =======
    function showOverlay(title, sub){
      overlay.classList.add('show');
      progressTitle.textContent = title || 'Загрузка…';
      progressSub.textContent = sub || '';
      setIndeterminate();
    }
    function hideOverlay(){ overlay.classList.remove('show'); }
    function setProgress(p){
      meter.classList.remove('indeterminate');
      meter.firstElementChild.style.width = Math.round(p*100)+'%';
      progressSub.textContent = Math.round(p*100) + '%';
    }
    function setIndeterminate(){
      meter.classList.add('indeterminate');
      meter.firstElementChild.style.width = '40%';
      progressSub.textContent = 'Ожидаем данные…';
    }

    function toast(msg){
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      setTimeout(()=> toastEl.classList.remove('show'), 2600);
    }

    // ======= HDRI / Background =======
    async function applyHDRI(url){
      if (!url) { scene.environment = null; updateBackgroundFromUI(); saveSettings(); return; }
      showOverlay('HDRI', 'Загружаем окружение…');
      return new Promise((resolve, reject)=>{
        const loader = new RGBELoader();
        loader.load(url, (tex)=>{
          tex.mapping = THREE.EquirectangularReflectionMapping;
          envHdrTex && envHdrTex.dispose?.();
          envHdrTex = tex;
          scene.environment = tex;
          setEnvIntensity(getNumber(envIntensity.value, 1), currentModel || scene);
          hideOverlay();
          saveSettings();
          resolve();
        }, undefined, (err)=>{ hideOverlay(); toast('Не удалось загрузить HDRI'); reject(err); });
      });
    }
    function updateBackgroundFromUI(){
      const opt = bgSelect.value;
      if (opt === 'transparent'){
        scene.background = null;
        renderer.setClearAlpha(0);
      } else if (opt === 'lightgray'){
        scene.background = new THREE.Color(isDark()?0x1f2937:0xe5e7eb);
        renderer.setClearAlpha(1);
      } else if (opt === 'midgray'){
        scene.background = new THREE.Color(isDark()?0x111827:0x9ca3af);
        renderer.setClearAlpha(1);
      } else if (opt === 'darkgray'){
        scene.background = new THREE.Color(isDark()?0x0b0d12:0x374151);
        renderer.setClearAlpha(1);
      } else if (opt === 'white'){
        scene.background = new THREE.Color(isDark()?0x0b0d12:0xffffff);
        renderer.setClearAlpha(1);
      } else if (opt === 'custom'){
        scene.background = new THREE.Color(bgColor.value);
        renderer.setClearAlpha(1);
      }
      saveSettings();
    }
    bgSelect.addEventListener('change', ()=>{ updateBackgroundFromUI(); });
    bgColor.addEventListener('input', ()=>{ bgSelect.value = 'custom'; updateBackgroundFromUI(); });

    // ======= Loaders: GLTF & FBX =======
    async function postLoad(root, animations){
      root.traverse(o=>{
        if (o.isMesh){
          o.castShadow = renderer.shadowMap.enabled;
          o.receiveShadow = renderer.shadowMap.enabled;
          if (Array.isArray(o.material)) {
            o.material = o.material.map(m => enhanceMaterial(m));
          } else {
            o.material = enhanceMaterial(o.material);
          }
          applyEnvIntensityToMaterial(o.material, getNumber(envIntensity.value, 1));
        }
      });
      scene.add(root);
      currentModel = root;
      buildSceneTree(currentModel);
      frameObject(currentModel);
      updateStats();
      resizeGridToModel(currentModel);
      updateBBox(currentModel);
      applyMaterialOverride(currentModel);
      if (toggleLightOnly.checked) setLightOnly(currentModel, true);

      setupAnimations(animations || []);
      hideOverlay();
    }

    function setupAnimations(clips){
      resetAnimationsUI();
      currentClips = clips;
      if (!currentClips.length) return;
      mixer = new THREE.AnimationMixer(currentModel);
      currentClips.forEach((clip, i)=>{
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = clip.name || ('Clip ' + (i+1));
        animSelect.appendChild(opt);
      });
      animSelect.selectedIndex = 0;
      activeAction = mixer.clipAction(currentClips[0]);
      applyLoopAndSpeed();
      updateAnimTimeUI(0, currentClips[0].duration);
    }

    function resetAnimationsUI(){
      animSelect.innerHTML = '';
      currentClips = [];
      if (activeAction){ activeAction.stop(); activeAction = null; }
      if (mixer){ mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); mixer = null; }
      animProgress.value = 0;
      animTime.textContent = '0.00 / 0.00s';
      animPlayPause.dataset.state = 'stopped';
      animPlayPause.textContent = i18n[langSelect.value].animPlay;
    }

    function playPause(){
      if (!mixer || !currentClips.length) return;
      if (!activeAction){
        activeAction = mixer.clipAction(currentClips[animSelect.selectedIndex]);
        applyLoopAndSpeed();
      }
      if (animPlayPause.dataset.state !== 'playing'){
        activeAction.paused = false;
        activeAction.play();
        animPlayPause.dataset.state = 'playing';
        animPlayPause.textContent = i18n[langSelect.value].animPause;
      } else {
        activeAction.paused = true;
        animPlayPause.dataset.state = 'paused';
        animPlayPause.textContent = i18n[langSelect.value].animPlay;
      }
      saveSettings();
    }
    function stopAnim(){
      if (!mixer) return;
      mixer.stopAllAction();
      if (activeAction){ activeAction.stop(); }
      activeAction = mixer.clipAction(currentClips[animSelect.selectedIndex] || currentClips[0]);
      applyLoopAndSpeed();
      animPlayPause.dataset.state = 'stopped';
      animPlayPause.textContent = i18n[langSelect.value].animPlay;
      updateAnimTimeUI(0, (activeAction? activeAction.getClip().duration : 0));
    }
    function applyLoopAndSpeed(){
      if (!activeAction) return;
      activeAction.setLoop(animLoop.checked ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      const s = parseFloat(animSpeed.value) || 1;
      activeAction.setEffectiveTimeScale(s);
      activeAction.setEffectiveWeight(1);
      activeAction.paused = true; // default paused
      saveSettings();
    }

    animSelect.addEventListener('change', ()=>{
      if (!mixer || !currentClips.length) return;
      const wasPlaying = (animPlayPause.dataset.state === 'playing');
      mixer.stopAllAction();
      activeAction?.stop();
      activeAction = mixer.clipAction(currentClips[animSelect.selectedIndex]);
      applyLoopAndSpeed();
      updateAnimTimeUI(0, activeAction.getClip().duration);
      if (wasPlaying){ activeAction.play(); } else { animPlayPause.textContent = i18n[langSelect.value].animPlay; animPlayPause.dataset.state='stopped'; }
      saveSettings();
    });

    animPlayPause.addEventListener('click', playPause);
    animStop.addEventListener('click', stopAnim);
    animLoop.addEventListener('change', applyLoopAndSpeed);
    animSpeed.addEventListener('change', applyLoopAndSpeed);

    animProgress.addEventListener('input', ()=>{
      if (!activeAction || !mixer) return;
      const dur = activeAction.getClip().duration;
      const t = parseFloat(animProgress.value) * dur;
      activeAction.time = t;
      mixer.update(0);
      updateAnimTimeUI(t, dur);
    });
    function updateAnimTimeUI(time, dur){
      const clamp = (v)=> Math.max(0, Math.min(v, dur||0));
      const t = clamp(time); const d = dur || 0;
      animTime.textContent = `${t.toFixed(2)} / ${d.toFixed(2)}s`;
      animProgress.value = d ? (t / d) : 0;
    }

    // ======= Exposed =======
    window.clearCurrentModel = clearCurrentModel;
    window.openInspector = openInspector;

    function loadGLTF(file){
      clearCurrentModel();
      showOverlay('Загрузка glTF/GLB', file.name);
      loadWithURL(gltfLoader, file, (gltf)=>{
        postLoad(gltf.scene, gltf.animations || []);
      }, null, (err)=>{
        hideOverlay(); toast('Ошибка GLTF: ' + err.message);
      });
    }
    function loadFBX(file){
      clearCurrentModel();
      showOverlay('Загрузка FBX', file.name);
      loadWithURL(fbxLoader, file, (obj)=>{
        postLoad(obj, obj.animations || []);
      }, null, (err)=>{
        hideOverlay(); toast('Ошибка FBX: ' + err.message);
      });
    }
    window.loadGLTF = loadGLTF;
    window.loadFBX = loadFBX;

    // ======= UI actions =======
    langSelect.addEventListener('change', ()=> applyLang(langSelect.value));

    resetCameraBtn.addEventListener('click', resetCamera);
    clearSceneBtn.addEventListener('click', ()=>{ clearCurrentModel(); buildSceneTree(null); toast('Сцена очищена'); saveSettings(); });

    toggleShadows.addEventListener('change', ()=>{
      const on = toggleShadows.checked;
      renderer.shadowMap.enabled = on;
      dir.castShadow = on;
      currentModel?.traverse?.(o=>{
        if (o.isMesh) { o.castShadow = on; o.receiveShadow = on; }
      });
      saveSettings();
    });
    toggleFXAA.addEventListener('change', ()=>{ fxaaPass.enabled = toggleFXAA.checked; saveSettings(); });
    toggleLightOnly.addEventListener('change', ()=>{ setLightOnly(currentModel, toggleLightOnly.checked); saveSettings(); });
    toggleGrid.addEventListener('change', ()=>{ grid.visible = !!toggleGrid.checked; saveSettings(); });

    applyHdriBtn.addEventListener('click', ()=> applyHDRI(hdriUrlInput.value.trim()));

    matOverride.addEventListener('change', ()=>{ applyMaterialOverride(currentModel); saveSettings(); });
    toggleWireframe.addEventListener('change', ()=>{ applyMaterialOverride(currentModel); saveSettings(); });

    // ======= Transform controls UI =======
    function applySnap(){
      if (!toggleSnap) return;
      if (toggleSnap.checked){
        tControls.setTranslationSnap(Number(snapPos.value)||0);
        tControls.setRotationSnap(THREE.MathUtils.degToRad(Number(snapRot.value)||0));
        tControls.setScaleSnap(Number(snapScale.value)||0);
      } else {
        tControls.setTranslationSnap(null);
        tControls.setRotationSnap(null);
        tControls.setScaleSnap(null);
      }
    }
    toggleTransform?.addEventListener('change', ()=>{
      const on = toggleTransform.checked; tControls.enabled = on;
      if (on && selectedObject) tControls.attach(selectedObject); else tControls.detach();
    });
    transformMode?.addEventListener('change', ()=> tControls.setMode(transformMode.value));
    toggleSnap?.addEventListener('change', applySnap);
    ;[snapPos, snapRot, snapScale].forEach(el=> el?.addEventListener('change', applySnap));

    // ======= Measure UI =======
    measureToggle?.addEventListener('click', ()=>{ measure.active = !measure.active; measureToggle.classList.toggle('ok', measure.active); toast(measure.active ? 'Линейка: выберите 2 точки' : 'Линейка отключена'); });
    measureClear?.addEventListener('click', clearMeasure);

    // ======= Camera presets =======
    function camPreset(view){
      const root = currentModel || scene;
      const box = new THREE.Box3().setFromObject(root);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const center = sphere.center; const fov = THREE.MathUtils.degToRad(camera.fov);
      const dist = sphere.radius / Math.sin(Math.min(Math.PI/4, fov/2));
      const m = dist*1.2;
      let dirv = new THREE.Vector3(1,1,1);
      switch(view){
        case 'front': dirv.set(0,0,1); break;
        case 'back': dirv.set(0,0,-1); break;
        case 'left': dirv.set(-1,0,0); break;
        case 'right': dirv.set(1,0,0); break;
        case 'top': dirv.set(0,1,0); break;
        case 'bottom': dirv.set(0,-1,0); break;
        case 'iso': default: dirv.set(1,1,1); break;
      }
      camera.position.copy(center.clone().addScaledVector(dirv.normalize(), m));
      controls.target.copy(center); controls.update();
    }
    camPresets?.querySelectorAll('button')?.forEach(btn=> btn.addEventListener('click', ()=> camPreset(btn.dataset.view)));

    // Render & lighting listeners
    exposure.addEventListener('input', ()=>{
      const v = getNumber(exposure.value, 1);
      renderer.toneMappingExposure = v;
      exposureVal.textContent = v.toFixed(2);
      saveSettings();
    });

    const TM = {
      'ACES': THREE.ACESFilmicToneMapping,
      'Linear': THREE.LinearToneMapping,
      'Reinhard': THREE.ReinhardToneMapping,
      'Cineon': THREE.CineonToneMapping,
      'Neutral': THREE.NeutralToneMapping,
      'None': THREE.NoToneMapping
    };
    toneMapping.addEventListener('change', ()=>{
      renderer.toneMapping = TM[toneMapping.value] ?? THREE.ACESFilmicToneMapping;
      saveSettings();
    });

    envIntensity.addEventListener('input', ()=>{
      const v = getNumber(envIntensity.value, 1);
      envIntensityVal.textContent = v.toFixed(2);
      setEnvIntensity(v, currentModel || scene);
      saveSettings();
    });

    function setDirFromAngle(angleDeg){
      const y = dir.position.y; // keep elevation
      const r = Math.hypot(dir.position.x, dir.position.z) || 1;
      const a = THREE.MathUtils.degToRad(angleDeg);
      dir.position.x = Math.cos(a) * r;
      dir.position.z = Math.sin(a) * r;
      dir.position.y = y;
      dir.lookAt(0,0,0);
    }
    dirIntensity.addEventListener('input', ()=>{
      const v = getNumber(dirIntensity.value, 1);
      dir.intensity = v;
      dirIntensityVal.textContent = v.toFixed(2);
      saveSettings();
    });
    dirAngle.addEventListener('input', ()=>{
      const v = getNumber(dirAngle.value, 0);
      setDirFromAngle(v);
      dirAngleVal.textContent = `${Math.round(v)}°`;
      saveSettings();
    });
    dirSoftness.addEventListener('input', ()=>{
      const v = getNumber(dirSoftness.value, 1);
      dir.shadow.radius = v; // effective with PCFSoftShadowMap
      dirSoftnessVal.textContent = v.toFixed(1);
      saveSettings();
    });

    // ======= Reset helpers =======
    function resetRender(){
      exposure.value = 1; exposure.dispatchEvent(new Event('input'));
      toneMapping.value = 'ACES'; toneMapping.dispatchEvent(new Event('change'));
      toast(i18n[langSelect.value].btnReset + ': Render');
    }
    function resetDir(){
      dirIntensity.value = 0.9; dirIntensity.dispatchEvent(new Event('input'));
      dirAngle.value = 34; dirAngle.dispatchEvent(new Event('input'));
      dirSoftness.value = 1; dirSoftness.dispatchEvent(new Event('input'));
      toast(i18n[langSelect.value].btnReset + ': Directional light');
    }
    function resetEnv(){
      envIntensity.value = 1; envIntensity.dispatchEvent(new Event('input'));
      hdriUrlInput.value = '';
      applyHDRI('');
      toast(i18n[langSelect.value].btnReset + ': Environment');
    }
    function resetGizmos(){
      toggleTransform.checked = false; tControls.enabled = false; tControls.detach();
      transformMode.value = 'translate';
      toggleSnap.checked = false;
      snapPos.value = 0.1; snapRot.value = 15; snapScale.value = 0.1; applySnap();
      clearMeasure(); measure.active = false; measureToggle.classList.remove('ok');
      if (measureOut) measureOut.textContent = '—';
      toast(i18n[langSelect.value].btnReset + ': Gizmos');
      saveSettings();
    }
    function resetAll(){
      // toggles
      toggleShadows.checked = false; toggleShadows.dispatchEvent(new Event('change'));
      toggleFXAA.checked = true; toggleFXAA.dispatchEvent(new Event('change'));
      toggleLightOnly.checked = false; toggleLightOnly.dispatchEvent(new Event('change'));
      toggleGrid.checked = true; toggleGrid.dispatchEvent(new Event('change'));
      // background & hdri
      bgSelect.value = 'white'; bgColor.value = '#ffffff'; updateBackgroundFromUI();
      hdriUrlInput.value = ''; applyHDRI('');
      // materials
      matOverride.value = 'none'; toggleWireframe.checked = false; applyMaterialOverride(currentModel);
      // sections
      resetRender(); resetDir(); resetEnv(); resetGizmos();
      // camera & selection
      selectObject(null); resetCamera();
      // persist
      localStorage.removeItem(LS_KEY); // clear saved UI settings
      saveSettings();
      toast('Настройки сброшены по умолчанию');
    }

    resetRenderBtn?.addEventListener('click', resetRender);
    resetDirBtn?.addEventListener('click', resetDir);
    resetEnvBtn?.addEventListener('click', resetEnv);
    resetGizmosBtn?.addEventListener('click', resetGizmos);
    resetAllBtn?.addEventListener('click', resetAll);

    // ======= Resize =======
    function onResize(){
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      outlinePass.setSize(w, h);
      fxaaPass.material.uniforms['resolution'].value.set(1/w, 1/h);
    }
    window.addEventListener('resize', onResize);

    // ======= Sections (no flicker) =======
    function initSections(){
      const saved = JSON.parse(localStorage.getItem(SEC_KEY) || '{}');
      const list = Array.from(document.querySelectorAll('details.section'));
      list.forEach((el, i)=>{
        const id = el.dataset.sec || ('sec-'+i);
        const open = saved[id] === true; // default closed
        if (open) el.setAttribute('open',''); else el.removeAttribute('open');
        el.querySelector('summary')?.addEventListener('click', ()=>{
          const isOpen = el.hasAttribute('open');
          saved[id] = !isOpen; // will be toggled after click
          localStorage.setItem(SEC_KEY, JSON.stringify(saved));
        });
      });
      document.body.classList.remove('preload'); // reveal after state applied
    }

    // ======= Render loop =======
    let lastFpsUpdate = 0;
    function animate(){
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      mixer?.update(dt);
      if (activeAction && animPlayPause.dataset.state === 'playing'){
        const dur = activeAction.getClip().duration;
        const t = activeAction.time % dur;
        updateAnimTimeUI(t, dur);
      }
      controls.update();
      // ensure full viewport before main compose
      renderer.setViewport(0,0,window.innerWidth, window.innerHeight);
      renderer.setScissorTest(false);
      renderer.clear();
      composer.render();
      const tnow = performance.now();
      if (!lastFpsUpdate) lastFpsUpdate = tnow;
      // Render axes overlay in corner
      renderer.setScissorTest(true);
      const vx = window.innerWidth - NAV_SIZE - NAV_PAD;
      const vy = NAV_PAD;
      renderer.setViewport(vx, vy, NAV_SIZE, NAV_SIZE);
      renderer.setScissor(vx, vy, NAV_SIZE, NAV_SIZE);
      axisCam.quaternion.copy(camera.quaternion);
      renderer.render(axisScene, axisCam);
      renderer.setScissorTest(false);
      if (tnow - lastFpsUpdate >= 500){
        const fps = (1/dt).toFixed(0);
        fpsEl.textContent = fps;
        lastFpsUpdate = tnow;
      }
    }

    // ======= Init: restore settings =======
    (function initFromSettings(){
      const s = loadSettings();
      if (s.theme) setTheme(s.theme); else setTheme('light');
      if (s.lang){ langSelect.value = s.lang; }
      applyLang(langSelect.value);

      if (s.toggles){
        toggleShadows.checked = !!s.toggles.shadows;
        toggleFXAA.checked = s.toggles.fxaa !== false;
        toggleLightOnly.checked = !!s.toggles.lightonly;
        toggleGrid.checked = s.toggles.grid !== false;
        renderer.shadowMap.enabled = toggleShadows.checked;
        dir.castShadow = toggleShadows.checked;
      }
      if (s.background){
        bgSelect.value = s.background.mode || 'white';
        bgColor.value = s.background.color || '#ffffff';
        updateBackgroundFromUI();
      } else {
        updateBackgroundFromUI();
      }
      if (s.hdri){ hdriUrlInput.value = s.hdri; }
      if (s.material){
        matOverride.value = s.material.override || 'none';
        toggleWireframe.checked = !!s.material.wireframe;
      }
      if (s.anim){
        animLoop.checked = !!s.anim.loop;
        animSpeed.value = s.anim.speed || 1;
      }
      if (s.render){
        exposure.value = getNumber(s.render.exposure, 1);
        exposure.dispatchEvent(new Event('input'));
        toneMapping.value = s.render.tonemapping || 'ACES';
        toneMapping.dispatchEvent(new Event('change'));
      } else {
        exposure.dispatchEvent(new Event('input'));
      }
      if (s.light){
        envIntensity.value = getNumber(s.light.envIntensity, 1);
        envIntensity.dispatchEvent(new Event('input'));
        dirIntensity.value = getNumber(s.light.dir?.intensity, 0.9);
        dirIntensity.dispatchEvent(new Event('input'));
        dirAngle.value = getNumber(s.light.dir?.angle, 34);
        dirAngle.dispatchEvent(new Event('input'));
        dirSoftness.value = getNumber(s.light.dir?.softness, 1);
        dirSoftness.dispatchEvent(new Event('input'));
      } else {
        envIntensity.dispatchEvent(new Event('input'));
        dirIntensity.dispatchEvent(new Event('input'));
        dirAngle.dispatchEvent(new Event('input'));
        dirSoftness.dispatchEvent(new Event('input'));
      }

      initSections();
      animate();
      saveSettings();
    })();

    // Helpers
    function getNumber(v, def){ v = Number(v); return Number.isFinite(v)?v:def; }
  </script>