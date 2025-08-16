# Polygon Selection System - Полная документация

## Обзор

Система Polygon Selection позволяет выбирать объекты в 3D-сцене с помощью произвольных полигонов, рисуемых мышью. Это мощный инструмент для работы с большими сценами, где нужно выбрать множество объектов нестандартной формы.

## Компоненты системы

### 1. PolygonSelectionManager (Основной класс)
Базовый функционал выбора полигонами.

**Возможности:**
- Рисование полигонов мышью
- Выбор объектов внутри полигона
- Интеграция с Inspector и Renderer
- Визуальная обратная связь
- Поддержка разных режимов выбора

### 2. AdvancedPolygonFeatures (Расширенные функции)
Дополнительные операции для работы с выбранными объектами.

**Возможности:**
- История выбора (undo/redo)
- Группировка и разгруппировка
- Изоляция и скрытие объектов
- Дублирование и удаление
- Сохранение групп выбора
- Статистика выбора

## Интеграция с существующей архитектурой

### Необходимые модули:
```javascript
import { SceneManager } from './Scene.js';
import { RendererManager } from './Renderer.js';
import { initInspector } from './Inspector.js';
import { PolygonSelectionManager } from './PolygonSelection.js';
import { AdvancedPolygonFeatures } from './AdvancedPolygonFeatures.js';
```

### Базовая инициализация:
```javascript
const polygonSelection = new PolygonSelectionManager({
  canvas: yourCanvas,
  camera: yourCamera,
  sceneManager: yourSceneManager,
  rendererManager: yourRendererManager,
  inspector: yourInspector,
  onSelection: (objects) => console.log('Selected:', objects)
});

// Расширенные функции
const advancedFeatures = new AdvancedPolygonFeatures(polygonSelection);
```

## API Reference

### PolygonSelectionManager

#### Методы инициализации:
```javascript
// Активация polygon selection
polygonSelection.activate();

// Деактивация
polygonSelection.deactivate();

// Переключение режима
const isActive = polygonSelection.toggle();
```

#### Основные методы:
```javascript
// Получить выбранные объекты
const selected = polygonSelection.getSelectedObjects();

// Очистить выбор
polygonSelection.clearSelection();

// Выбор прямоугольником (дополнительно)
const boxSelected = polygonSelection.selectObjectsInBox(startPoint, endPoint);

// Освобождение ресурсов
polygonSelection.dispose();
```

#### События:
```javascript
const polygonSelection = new PolygonSelectionManager({
  // ... другие параметры
  onSelection: (selectedObjects) => {
    console.log(`Выбрано ${selectedObjects.length} объектов`);
    // Ваша логика обработки выбора
  }
});
```

### AdvancedPolygonFeatures

#### Операции с выбором:
```javascript
// Выбрать все объекты
advancedFeatures.selectAll();

// Выбрать похожие объекты
advancedFeatures.selectSimilar();

// Выбрать по имени (регулярное выражение)
advancedFeatures.selectByName('Cube.*');
```

#### Операции с группами:
```javascript
// Группировать выбранные объекты
advancedFeatures.groupSelected();

// Разгруппировать
advancedFeatures.ungroupSelected();

// Сохранить группу выбора
advancedFeatures.saveSelectionGroup();

// Загрузить группу выбора
advancedFeatures.loadSelectionGroup('MyGroup');
```

#### Операции видимости:
```javascript
// Изолировать выбранные объекты
advancedFeatures.isolateSelected();

// Отменить изоляцию
advancedFeatures.unisolate();

// Скрыть выбранные объекты
advancedFeatures.hideSelected();

// Показать все объекты
advancedFeatures.unhideAll();
```

#### Операции с объектами:
```javascript
// Дублировать выбранные объекты
advancedFeatures.duplicateSelected();

// Удалить выбранные объекты
advancedFeatures.deleteSelected();
```

## Режимы выбора

### Типы пересечения:
1. **Intersect** - объекты, которые пересекаются с полигоном
2. **Contain** - только объекты полностью внутри полигона
3. **Touch** - объекты, которые касаются границ полигона

### Аддитивный режим:
При включении аддитивного режима новые объекты добавляются к существующему выбору вместо замены.

## Горячие клавиши

### Основные:
- **P** - переключить polygon selection
- **B** - переключить box selection
- **Escape** - выйти из режима выбора
- **Ctrl+A** - выбрать все объекты

### Операции с выбором:
- **Delete/Backspace** - удалить выбранные объекты
- **Ctrl+D** - дублировать выбранные объекты
- **Ctrl+G** - группировать выбранные объекты
- **Ctrl+I** - изолировать выбранные объекты
- **H** - скрыть выбранные объекты

### История:
- **Ctrl+Z** - отменить выбор
- **Ctrl+Y** - повторить выбор

## CSS стилизация

### Основные классы:
```css
/* Кнопка polygon selection */
.btn.polygon-select { /* стили */ }
.btn.polygon-select.active { /* активное состояние */ }

/* Панель статистики */
.selection-stats { /* стили */ }

/* Панель мульти-выбора */
.multi-selection-toolbar { /* стили */ }

/* Уведомления */
.notification { /* стили */ }
.notification-info { /* цвет для информации */ }
.notification-success { /* цвет для успеха */ }
.notification-warning { /* цвет для предупреждения */ }
.notification-error { /* цвет для ошибки */ }
```

## Примеры использования

### 1. Базовое использование:
```javascript
class MyApp {
  constructor() {
    this.initPolygonSelection();
  }
  
  initPolygonSelection() {
    this.polygonSelection = new PolygonSelectionManager({
      canvas: this.canvas,
      camera: this.camera,
      sceneManager: this.sceneManager,
      rendererManager: this.rendererManager,
      onSelection: (objects) => this.handleSelection(objects)
    });
    
    // Добавить кнопку в UI
    this.addPolygonButton();
  }
  
  addPolygonButton() {
    const button = document.createElement('button');
    button.textContent = 'Polygon Select';
    button.onclick = () => this.polygonSelection.toggle();
    document.body.appendChild(button);
  }
  
  handleSelection(objects) {
    console.log(`Выбрано: ${objects.length} объектов`);
    // Ваша логика
  }
}
```

### 2. С расширенными функциями:
```javascript
class AdvancedApp extends MyApp {
  initPolygonSelection() {
    super.initPolygonSelection();
    
    this.advancedFeatures = new AdvancedPolygonFeatures(this.polygonSelection);
    this.setupAdvancedUI();
  }
  
  setupAdvancedUI() {
    // Toolbar для операций с выбором
    const toolbar = document.createElement('div');
    toolbar.innerHTML = `
      <button onclick="app.advancedFeatures.groupSelected()">Group</button>
      <button onclick="app.advancedFeatures.isolateSelected()">Isolate</button>
      <button onclick="app.advancedFeatures.duplicateSelected()">Duplicate</button>
    `;
    document.body.appendChild(toolbar);
  }
}
```

### 3. Кастомные операции:
```javascript
class CustomApp extends AdvancedApp {
  handleSelection(objects) {
    super.handleSelection(objects);
    
    // Кастомная логика для выбранных объектов
    this.highlightObjects(objects);
    this.updatePropertiesPanel(objects);
    this.sendSelectionToServer(objects);
  }
  
  highlightObjects(objects) {
    objects.forEach(obj => {
      if (obj.material) {
        obj.material.emissive.setHex(0x0066ff);
      }
    });
  }
  
  updatePropertiesPanel(objects) {
    const panel = document.getElementById('properties');
    panel.innerHTML = `Selected: ${objects.length} objects`;
  }
  
  sendSelectionToServer(objects) {
    const data = objects.map(obj => ({
      id: obj.uuid,
      name: obj.name,
      type: obj.type
    }));
    
    fetch('/api/selection', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## Производительность

### Оптимизация для больших сцен:
1. **Фрустум culling** - проверять только видимые объекты
2. **LOD** - использовать упрощенную геометрию для далеких объектов
3. **Spatial indexing** - разделить сцену на секторы
4. **Batch processing** - обрабатывать объекты группами

### Рекомендации:
```javascript
// Ограничить количество проверяемых объектов
const maxObjects = 1000;
const visibleObjects = allObjects.slice(0, maxObjects);

// Использовать Web Workers для тяжелых вычислений
const worker = new Worker('selection-worker.js');
worker.postMessage({ polygonPoints, objects });
```

## Расширение функциональности

### Добавление новых режимов выбора:
```javascript
class CustomPolygonSelection extends PolygonSelectionManager {
  performSelection() {
    // Переопределить логику выбора
    const mode = this.getSelectionMode();
    
    switch (mode) {
      case 'distance':
        this.selectByDistance();
        break;
      case 'material':
        this.selectByMaterial();
        break;
      default:
        super.performSelection();
    }
  }
  
  selectByDistance() {
    // Выбор по расстоянию от центра полигона
  }
  
  selectByMaterial() {
    // Выбор объектов с одинаковым материалом
  }
}
```

### Интеграция с внешними системами:
```javascript
// Плагин для экспорта выбора
class SelectionExporter {
  constructor(polygonSelection) {
    this.polygonSelection = polygonSelection;
  }
  
  exportToJSON() {
    const selected = this.polygonSelection.getSelectedObjects();
    return JSON.stringify(selected.map(obj => obj.toJSON()));
  }
  
  exportToCSV() {
    const selected = this.polygonSelection.getSelectedObjects();
    const csv = selected.map(obj => 
      `${obj.name},${obj.type},${obj.position.x},${obj.position.y},${obj.position.z}`
    ).join('\n');
    return 'name,type,x,y,z\n' + csv;
  }
}
```

## Отладка и диагностика

### Включение debug режима:
```javascript
const polygonSelection = new PolygonSelectionManager({
  // ... другие параметры
  debug: true
});

// Логирование событий выбора
polygonSelection.onSelection = (objects) => {
  console.group('Polygon Selection');
  console.log('Selected objects:', objects);
  console.log('Selection time:', performance.now());
  console.log('Polygon points:', polygonSelection.polygonPoints);
  console.groupEnd();
};
```

### Визуализация для отладки:
```javascript
// Показать bounding boxes выбранных объектов
function debugShowBoundingBoxes(objects) {
  objects.forEach(obj => {
    const box = new THREE.Box3().setFromObject(obj);
    const helper = new THREE.Box3Helper(box, 0xff0000);
    scene.add(helper);
  });
}
```

## Совместимость

### Поддерживаемые версии Three.js:
- r128 и выше
- Совместимо с модульной системой ES6

### Браузеры:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Зависимости:
- Three.js (обязательно)
- Font Awesome (для иконок UI, опционально)
- Модули вашей архитектуры (SceneManager, RendererManager, Inspector)

## Заключение

Система Polygon Selection предоставляет мощный и гибкий инструмент для выбора объектов в 3D-сценах. Благодаря модульной архитектуре, она легко интегрируется с существующими проектами и может быть расширена под специфические нужды.

Основные преимущества:
- ✅ Интуитивный интерфейс
- ✅ Высокая производительность
- ✅ Гибкая настройка
- ✅ Богатый API
- ✅ Расширяемость
- ✅ Совместимость с существующей архитектурой