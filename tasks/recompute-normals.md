# Задача: Опциональный пересчёт нормалей (recompute normals) — спецификация и план действий

## Цель
- Вынести пересчёт вершинных нормалей (`computeVertexNormals()`) из автоматического процесса загрузки модели в опциональную настройку.
- Это предотвратит нежелательное изменение внешнего вида моделей (фацетинг) и предоставит разработчикам/пользователям контроль над этим поведением.

## Обоснование проблемы
Изначально, после рефакторинга, код принудительно вызывал `child.geometry.computeVertexNormals()` для каждой загруженной сетки. Это приводило к тому, что модели, которые уже имели корректные сглаженные нормали (например, экспортированные из 3D-редакторов), теряли их и выглядели "треугольными" или фацетированными. Модели, у которых нормали отсутствовали или были некорректны, могли бы выиграть от этого пересчёта, но для большинства моделей это было деструктивным поведением.

## Что нужно изменить (конкретные задачи для разработчиков)

### 1. Добавить настройку в `Settings`
- **Файл:** [`src/Settings.js`](src/Settings.js:1)
- **Действие:** Добавить новый ключ в объект `this.defaults` в конструкторе класса `Settings`.
- **Предложение:**
  - Ключ: `recomputeNormalsOnLoad`
  - Значение по умолчанию: `false`
- **Пример кода для `src/Settings.js` (добавить в объект `defaults`):**
  ```javascript
  // src/Settings.js
  export class Settings {
    constructor() {
      this.defaults = {
        // Здесь должны быть другие существующие настройки
        recomputeNormalsOnLoad: false, // Новая настройка
      };
    }
  }
  ```

### 2. Добавить UI-переключатель (в секции Dev / Advanced)
- **Файл:** HTML-файл, содержащий UI (например, `index.html` или компонент, если UI динамический), и [`src/UI.js`](src/UI.js:1) / [`src/core/UIBindings.js`](src/core/UIBindings.js:1) для логики связывания.
- **Элемент:** Добавить чекбокс в пользовательский интерфейс, предпочтительно в секцию "Debug" или "Advanced Settings".
- **Предложение:**
  - HTML-разметка: `<label><input id="toggle-recompute-normals" type="checkbox"> Recompute normals after load</label>`
  - **Поведение:** При изменении состояния чекбокса, обновить соответствующую настройку в `Settings` и эмитировать событие `EVENTS.SETTINGS_CHANGED`.
- **Пример кода для связывания (например, в `src/core/UIBindings.js` или `src/core/Application.js`):**
  ```javascript
  // Пример: в src/core/UIBindings.js или src/core/Application.js
  // Предполагается, что this.dom, this.settings, this.eventSystem доступны
  const toggleRecomputeNormalsEl = this.dom?.get('toggle-recompute-normals');
  if (toggleRecomputeNormalsEl) {
    // Инициализировать состояние чекбокса из текущих настроек
    toggleRecomputeNormalsEl.checked = this.settings?.get('recomputeNormalsOnLoad') || false;

    this.dom.on(toggleRecomputeNormalsEl, 'change', () => {
      const value = toggleRecomputeNormalsEl.checked;
      this.settings?.set('recomputeNormalsOnLoad', value);
      this.eventSystem?.emit(EVENTS.SETTINGS_CHANGED, { recomputeNormalsOnLoad: value });
    });
  }
  ```
- **UX:** Добавить поясняющий tooltip к чекбоксу: "Пересчитывать вершинные нормали после загрузки модели — включите, если нормали модели отсутствуют или некорректны."

### 3. Использовать флаг при обработке геометрии
- **Файл:** [`src/core/Application.js`](src/core/Application.js:532)
- **Действие:** Заменить безусловный вызов `child.geometry.computeVertexNormals()` на условный, зависящий от новой настройки.
- **Предложение:**
  - Найти существующий блок обработки геометрии в методе `handleModelLoaded` (внутри `model.traverse`):
    ```javascript
    // src/core/Application.js (внутри handleModelLoaded, в обходе child.isMesh && child.geometry)
    // ...
    // Убедиться, что геометрия триангулирована
    if (child.geometry.index) {
      child.geometry = BufferGeometryUtils.toTrianglesDrawMode(child.geometry, THREE.TriangleStripDrawMode);
    }
    child.geometry.computeVertexNormals(); // Эту строку нужно заменить
    child.geometry.computeBoundingBox();
    child.geometry.computeBoundingSphere();
    // ...
    ```
  - Заменить строку `child.geometry.computeVertexNormals();` на следующий блок кода:
    ```javascript
    // src/core/Application.js (внутри handleModelLoaded, в обходе child.isMesh && child.geometry)
    // Убедиться, что геометрия триангулирована
    if (child.geometry.index) {
      child.geometry = BufferGeometryUtils.toTrianglesDrawMode(child.geometry, THREE.TriangleStripDrawMode);
    }

    // Пересчитывать нормали только если пользователь/разработчик явно включил эту опцию
    const recomputeNormals = this.settings?.get('recomputeNormalsOnLoad') || 
                             Boolean(new URLSearchParams(window.location.search).get('recomputeNormals')); // Дополнительный dev-флаг через URL

    if (recomputeNormals) {
      child.geometry.computeVertexNormals();
      Logger.log(`[Application] Recomputed normals for mesh: ${child.name || child.uuid}`);
    } else {
      Logger.log(`[Application] Using original normals for mesh: ${child.name || child.uuid}`);
    }
    child.geometry.computeBoundingBox();
    child.geometry.computeBoundingSphere();
    ```
- **Примечание:** Чтение флага может быть как напрямую из `this.settings`, так и из `this.stateManager.getAppState().settings`, в зависимости от того, как централизованы настройки. Пример выше использует `this.settings`.

### 4. Дополнительный Developer Flag (опционально, но рекомендуется)
- **Действие:** Реализовать возможность быстрого включения пересчёта нормалей через URL-параметр или `localStorage` для целей разработки/отладки.
- **Предложение:** Как показано в пункте 3, можно добавить проверку `Boolean(new URLSearchParams(window.location.search).get('recomputeNormals'))`. Это позволит включать опцию, добавив `?recomputeNormals=true` к URL.

### 5. Документация для авторов моделей
- **Файл:** Создать или обновить `README.md` или отдельный файл в `docs/` (например, `docs/model-import-guide.md`).
- **Содержание:**
  - Объяснить, что приложение по умолчанию использует нормали, встроенные в модель.
  - Указать, что опция "Recompute normals after load" предназначена для моделей, у которых нормали отсутствуют или повреждены.
  - Предупредить, что включение этой опции может изменить внешний вид моделей, которые уже имеют корректные сглаженные нормали.
  - Привести примеры, когда эту опцию стоит использовать (например, для простых моделей, экспортированных без нормалей) и когда не стоит.

## Тестирование (сценарии для ручной/автоматизированной проверки)

1.  **Тест с моделью, имеющей корректные нормали:**
    *   Загрузить FBX/GLTF модель, которая изначально выглядит гладко.
    *   Убедиться, что при `recomputeNormalsOnLoad = false` (по умолчанию) модель сохраняет свой гладкий вид.
    *   Включить `recomputeNormalsOnLoad = true` (через UI или URL-флаг) и перезагрузить модель. Проверить, что модель теперь выглядит фацетированной (это ожидаемое поведение при пересчёте).

2.  **Тест с моделью, у которой отсутствуют/некорректны нормали:**
    *   Загрузить модель, которая изначально выглядит фацетированной или имеет проблемы с затенением из-за отсутствия нормалей.
    *   Убедиться, что при `recomputeNormalsOnLoad = false` модель сохраняет свой некорректный вид.
    *   Включить `recomputeNormalsOnLoad = true` и перезагрузить модель. Проверить, что модель теперь выглядит более гладко (если топология позволяет корректный пересчёт).

3.  **Проверка URL-параметра:**
    *   Запустить приложение с URL-параметром `?recomputeNormals=true`.
    *   Убедиться, что поведение пересчёта нормалей активировано, как если бы чекбокс был включен.

## Заключение
Внедрение этой опции значительно улучшит гибкость приложения при работе с различными 3D-моделями, предотвращая автоматические деструктивные изменения и предоставляя пользователю контроль.
```