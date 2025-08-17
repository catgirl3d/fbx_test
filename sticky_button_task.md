# Техническое задание: Исправление позиционирования кнопки инспектора

## Описание проблемы

Кнопка открытия инспектора (`☰`) в настоящее время зафиксирована у правого края экрана и не следует за движением панели инспектора. Требуется изменить поведение так, чтобы кнопка "прилипала" к левому краю инспектора и перемещалась вместе с ним.

### Текущее поведение (неправильное):
- Кнопка всегда находится в позиции `right: 0`
- Остается у правого края экрана независимо от состояния инспектора
- Скрывается/показывается через `opacity`

### Требуемое поведение:
- Кнопка должна "прилипать" к левому краю инспектора
- При закрытии инспектора кнопка следует за ним к правому краю экрана
- При открытии инспектора кнопка перемещается к его левому краю
- Плавная синхронная анимация движения

## Технические требования

### Основные требования:
1. Кнопка перемещается синхронно с инспектором
2. Используется одна кнопка как переключатель (toggle)
3. Плавная анимация движения (0.3s)
4. Смена иконки: `☰` (открыть) ↔ `✕` (закрыть)
5. Визуальные индикаторы состояния

### Дополнительные требования:
6. Hover эффекты с микроанимацией
7. Цветовые индикаторы состояния
8. Адаптивность для мобильных устройств
9. Доступность (title атрибуты)

## Пошаговый план реализации

### 1. Обновить CSS стили (style.css)

#### Базовое позиционирование:
```css
:root {
  --panel-w: 400px;
  --inspector-transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.inspector {
  position: fixed; 
  top: 0; 
  right: calc(-1 * var(--panel-w));
  bottom: 0; 
  width: var(--panel-w);
  transition: var(--inspector-transition);
  /* остальные стили без изменений */
}

.open-inspector-tab {
  position: fixed; 
  top: 50%; 
  /* КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: стартовая позиция у закрытого инспектора */
  right: calc(-1 * var(--panel-w) - 1px);
  transform: translateY(-50%);
  z-index: 45;
  transition: var(--inspector-transition), transform 0.2s ease;
  /* остальные стили */
}

/* Позиция когда инспектор открыт */
.inspector.right-0 ~ .open-inspector-tab {
  right: calc(var(--panel-w) - 1px);
}
```

#### Визуальные состояния:
```css
.open-inspector-tab[data-state="closed"] {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-panel));
}

.open-inspector-tab[data-state="open"] {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, var(--bg-panel));
}

.open-inspector-tab:hover {
  transform: translateY(-50%) translateX(-4px);
}
```

#### Адаптивность:
```css
@media (max-width: 768px) {
  :root {
    --panel-w: 90vw;
  }
  
  .open-inspector-tab {
    right: calc(-90vw - 1px);
  }
  
  .inspector.right-0 ~ .open-inspector-tab {
    right: calc(90vw - 1px);
  }
}
```

### 2. Обновить JavaScript логику (Application.js)

#### Метод setInspectorOpen:
```javascript
setInspectorOpen = (open) => {
  const inspectorEl = this.dom?.get('scene-inspector');
  const toggleBtn = this.dom?.get('open-inspector');
  
  if (!inspectorEl) return;
  
  if (open) {
    inspectorEl.classList.add('right-0');
    inspectorEl.style.right = '0';
    
    if (toggleBtn) {
      toggleBtn.setAttribute('data-state', 'open');
      toggleBtn.innerHTML = '<span class="icon">✕</span>';
      toggleBtn.title = 'Close Inspector (I)';
    }
  } else {
    inspectorEl.classList.remove('right-0');
    inspectorEl.style.right = 'calc(-1 * var(--panel-w))';
    
    if (toggleBtn) {
      toggleBtn.setAttribute('data-state', 'closed');
      toggleBtn.innerHTML = '<span class="icon">☰</span>';
      toggleBtn.title = 'Open Inspector (I)';
    }
  }
  
  this.stateManager?.updateUIState({ isInspectorOpen: open });
};
```

#### Инициализация состояния:
```javascript
initUIState() {
  // ... существующий код ...

  // Инспектор открыт при загрузке
  this.setInspectorOpen(true);
  
  // Инициализация кнопки
  const toggleBtn = this.dom?.get('open-inspector');
  if (toggleBtn) {
    toggleBtn.setAttribute('data-state', 'open');
    toggleBtn.innerHTML = '<span class="icon">✕</span>';
    toggleBtn.title = 'Close Inspector (I)';
  }
}
```

### 3. Обновить UIBindings.js

#### Универсальная кнопка-переключатель:
```javascript
bindInspectorControls() {
  const toggleInspectorBtn = this.dom?.get('open-inspector');
  this.bind(toggleInspectorBtn, 'click', () => {
    const currentState = toggleInspectorBtn?.getAttribute('data-state') === 'open';
    this.eventSystem?.emit(currentState ? EVENTS.INSPECTOR_CLOSE : EVENTS.INSPECTOR_OPEN);
  });

  // Кнопка "Hide" внутри инспектора (дополнительная)
  const closeInspectorBtn = this.dom?.get('inspector-close');
  this.bind(closeInspectorBtn, 'click', () => {
    this.eventSystem?.emit(EVENTS.INSPECTOR_CLOSE);
  });
}
```

## Детальные требования к визуальному поведению

### Анимации:
- **Движение кнопки:** синхронно с инспектором (0.3s cubic-bezier)
- **Hover эффект:** сдвиг влево на 4px с увеличением тени
- **Клик эффект:** масштабирование до 0.95 на 100ms

### Визуальные индикаторы:
- **Закрытое состояние:** синяя рамка и фон (`var(--accent)`)
- **Открытое состояние:** красная рамка и фон (`var(--danger)`)
- **Иконки:** `☰` для открытия, `✕` для закрытия
- **Полоска-индикатор:** цветная полоска слева от кнопки

### Позиционирование:
```
Закрытый инспектор:  [кнопка]|                    |
Открытый инспектор:            [кнопка]|[инспектор]|
```

## Критерии приемки

### Функциональные тесты:
- ✅ При открытии инспектора кнопка плавно перемещается к его левому краю
- ✅ При закрытии инспектора кнопка следует за ним к правому краю экрана
- ✅ Кнопка работает как переключатель (один клик - открыть, второй - закрыть)
- ✅ Иконка меняется в зависимости от состояния
- ✅ Hover эффекты работают корректно
- ✅ Анимации плавные и синхронные

### Визуальные тесты:
- ✅ Цветовые индикаторы соответствуют состоянию
- ✅ Кнопка всегда "прилипает" к инспектору
- ✅ На мобильных устройствах адаптивное поведение
- ✅ В темной теме корректное отображение

### Технические тесты:
- ✅ Нет ошибок в консоли браузера
- ✅ Состояние синхронизируется с StateManager
- ✅ Горячие клавиши работают (I, ESC)
- ✅ Совместимость с основными браузерами

## Тестирование

### Пошаговое тестирование:
1. **Загрузить страницу** → инспектор открыт, кнопка у его левого края с иконкой `✕`
2. **Нажать кнопку** → инспектор закрывается, кнопка плавно перемещается к правому краю с иконкой `☰`
3. **Нажать кнопку снова** → инспектор открывается, кнопка возвращается к левому краю
4. **Hover на кнопку** → кнопка сдвигается влево, меняется тень
5. **Изменить размер окна** → поведение остается корректным
6. **Протестировать на мобильном** → адаптивное позиционирование

### Консольное тестирование:
```javascript
// Должно работать в консоли браузера:
window.app.setInspectorOpen(false); // Кнопка у правого края
window.app.setInspectorOpen(true);  // Кнопка у левого края инспектора
```

