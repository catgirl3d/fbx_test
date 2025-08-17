# Техническое задание: Исправление работы инспектора сцены

## Описание проблемы

В 3D-просмотрщике не работают кнопки управления правым инспектором сцены:
- Кнопка открытия инспектора `☰` (справа от экрана) не реагирует на клики
- Кнопка "Hide" внутри инспектора не закрывает панель
- Отсутствуют обработчики событий для этих кнопок

## Требования

### Основные требования:
1. **Инспектор должен быть ОТКРЫТ по умолчанию** при первичной загрузке страницы
2. Кнопка `☰` (id="open-inspector") должна открывать инспектор
3. Кнопка "Hide" (id="inspector-close") должна закрывать инспектор
4. Плавные анимации при открытии/закрытии
5. Корректное управление видимостью кнопки открытия

### Дополнительные требования:
6. Горячая клавиша `I` для переключения инспектора
7. Закрытие инспектора по клавише `ESC`
8. Адаптивная работа на мобильных устройствах

## Технические детали

### Структура файлов:
- `index.html` - основная разметка
- `src/core/UIBindings.js` - привязка событий UI
- `src/core/Application.js` - основная логика приложения
- `src/style.css` - стили

### Элементы DOM:
- `#scene-inspector` - панель инспектора (класс: `inspector`)
- `#open-inspector` - кнопка открытия (класс: `open-inspector-tab`)
- `#inspector-close` - кнопка закрытия внутри панели

## Пошаговый план исправления

### 1. Исправить UIBindings.js

#### Добавить новый метод `bindInspectorControls()`:
```javascript
bindInspectorControls() {
  // Кнопка открытия инспектора
  const openInspectorBtn = this.dom?.get('open-inspector');
  this.bind(openInspectorBtn, 'click', () => {
    this.eventSystem?.emit(EVENTS.INSPECTOR_OPEN);
  });

  // Кнопка закрытия инспектора
  const closeInspectorBtn = this.dom?.get('inspector-close');
  this.bind(closeInspectorBtn, 'click', () => {
    this.eventSystem?.emit(EVENTS.INSPECTOR_CLOSE);
  });
}
```

#### Вызвать метод в `init()`:
```javascript
init() {
  // ... существующие вызовы ...
  this.bindInspectorControls(); // ДОБАВИТЬ ЭТУ СТРОКУ
}
```

### 2. Исправить Application.js

#### В методе `initEventListeners()` добавить:
```javascript
// Обработчики событий инспектора
this.eventSystem.on(EVENTS.INSPECTOR_OPEN, () => this.setInspectorOpen(true));
this.eventSystem.on(EVENTS.INSPECTOR_CLOSE, () => this.setInspectorOpen(false));
```

#### Исправить метод `setInspectorOpen()`:
```javascript
setInspectorOpen = (open) => {
  const inspectorEl = this.dom?.get('scene-inspector');
  const openBtn = this.dom?.get('open-inspector');
  
  if (!inspectorEl) return;
  
  if (open) {
    inspectorEl.classList.add('right-0');
    inspectorEl.style.right = '0';
    // Скрываем кнопку открытия
    if (openBtn) {
      openBtn.style.opacity = '0';
      openBtn.style.pointerEvents = 'none';
    }
  } else {
    inspectorEl.classList.remove('right-0');
    inspectorEl.style.right = 'calc(-1 * var(--panel-w))';
    // Показываем кнопку открытия
    if (openBtn) {
      openBtn.style.opacity = '1';
      openBtn.style.pointerEvents = 'auto';
    }
  }
  
  this.stateManager?.updateUIState({ isInspectorOpen: open });
};
```

#### В методе `initUIState()` добавить:
```javascript
// ВАЖНО: Инспектор должен быть ОТКРЫТ при загрузке
this.setInspectorOpen(true);
this.stateManager?.updateUIState({ isInspectorOpen: true });
```

#### В методе `handleKeyPress()` добавить обработку клавиш:
```javascript
case 'Escape':
  // Закрывать инспектор по ESC
  const uiState = this.stateManager?.getUIState();
  if (uiState?.isInspectorOpen) {
    this.setInspectorOpen(false);
  } else {
    this.clearSelection();
  }
  break;
case 'KeyI':
  // Переключение инспектора по клавише I
  const currentInspectorState = this.stateManager?.getUIState()?.isInspectorOpen;
  this.setInspectorOpen(!currentInspectorState);
  break;
```

### 3. Исправить index.html

#### Изменить начальный класс инспектора:
```html
<!-- БЫЛО -->
<aside id="scene-inspector" class="inspector right-0" aria-label="Scene Inspector">

<!-- СТАЛО (ВАЖНО: оставить right-0 для открытого состояния по умолчанию) -->
<aside id="scene-inspector" class="inspector right-0" aria-label="Scene Inspector">
```

### 4. Обновить style.css

#### Добавить правильные стили:
```css
.inspector {
  position: fixed; 
  top: 0; 
  right: calc(-1 * var(--panel-w)); /* Скрыт по умолчанию */
  bottom: 0; 
  width: var(--panel-w);
  background: var(--bg-panel);
  border-left: 1px solid var(--border);
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 40; 
  display: flex; 
  flex-direction: column; 
  box-shadow: 0 0 30px rgba(0,0,0,.06);
}

.inspector.right-0 { 
  right: 0 !important;
}

.open-inspector-tab {
  position: fixed; 
  top: 50%; 
  right: 0; 
  transform: translateY(-50%);
  z-index: 35; 
  padding: 8px 10px; 
  border-radius: 10px 0 0 10px;
  background: var(--bg-panel); 
  border: 1px solid var(--border); 
  border-right: none; 
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,.08);
  transition: all 0.3s ease;
}

.open-inspector-tab:hover {
  transform: translateY(-50%) translateX(-3px);
  box-shadow: 0 6px 20px rgba(0,0,0,.15);
}
```

## Критерии приемки

### Функциональные требования:
- ✅ Инспектор открыт при первой загрузке страницы
- ✅ Кнопка `☰` открывает инспектор при клике
- ✅ Кнопка "Hide" закрывает инспектор при клике
- ✅ Плавная анимация открытия/закрытия (0.3s)
- ✅ Кнопка `☰` скрывается когда инспектор открыт
- ✅ Горячая клавиша `I` переключает инспектор
- ✅ Клавиша `ESC` закрывает инспектор

### Технические требования:
- ✅ Отсутствие ошибок в консоли браузера
- ✅ Корректная работа в Chrome, Firefox, Safari
- ✅ Адаптивная работа на мобильных устройствах
- ✅ Состояние инспектора сохраняется в StateManager

## Тестирование

### Ручное тестирование:
1. Загрузить страницу → инспектор должен быть открыт
2. Нажать "Hide" → инспектор должен закрыться, кнопка `☰` появиться
3. Нажать кнопку `☰` → инспектор должен открыться, кнопка `☰` скрыться
4. Нажать `I` → инспектор должен переключиться
5. При открытом инспекторе нажать `ESC` → инспектор должен закрыться
6. Протестировать на мобильном устройстве

### Проверка в браузере:
```javascript
// В консоли браузера должно работать:
window.app.setInspectorOpen(true);  // Открыть
window.app.setInspectorOpen(false); // Закрыть
```

## Дополнительные замечания

- При изменении состояния инспектора логировать в консоль для отладки
- Использовать существующую систему событий (`EventSystem`)
- Не нарушать существующую архитектуру приложения
- Код должен быть совместим с существующим `StateManager`

## Приоритет: Высокий

Эта задача критически важна для UX приложения, так как инспектор сцены - основной инструмент для работы с 3D-объектами.