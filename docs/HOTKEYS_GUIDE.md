# Hotkeys Implementation Guide

This guide explains how to add keyboard shortcuts and hotkeys to the 3D model viewer application.

## Quick Start

### Adding a Simple Hotkey

```javascript
// In your component's initialization
const keyboardManager = app.inputHandler.keyboardManager;

// Register a hotkey to toggle wireframe mode
keyboardManager.registerKeyHandler('KeyW', (event) => {
  event.preventDefault();
  this.toggleWireframe();
  Logger.log('[MyComponent] Wireframe toggled via hotkey');
});
```

### Adding Hotkey with Modifier

```javascript
// Register Ctrl+S to save project
keyboardManager.registerKeyHandler('KeyS', (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
    this.saveProject();
  }
});
```

### Cleanup When Component is Destroyed

```javascript
// Store reference to unregister later
this.wireframeHandler = (event) => {
  this.toggleWireframe();
};

// Register
keyboardManager.registerKeyHandler('KeyW', this.wireframeHandler);

// Later, when component is destroyed:
keyboardManager.unregisterKeyHandler('KeyW', this.wireframeHandler);
```

## Currently Registered Hotkeys

These keys are already in use by the application:

### Application Hotkeys (Application.js)
- **F** - Frame selected object or fit all objects to view
- **R** - Reset camera to default position
- **Delete** / **Backspace** - Clear current selection
- **Escape** - Close inspector (if open) or clear selection
- **I** - Toggle inspector panel
- **G** - Enable translate (grab) transform mode
- **S** - Enable scale transform mode
- **E** - Enable rotate transform mode
- **Tab** - Toggle transform controls on/off
- **P** - Toggle polygon selection mode

### Polygon Selection Hotkeys (PolygonSelectionManager.js)
- **Escape** - Deactivate polygon selection tool (when active)

## Available Key Codes

### Letters
- `KeyA`, `KeyB`, `KeyC`, ... `KeyZ`

### Numbers
- `Digit0`, `Digit1`, `Digit2`, ... `Digit9`

### Function Keys
- `F1`, `F2`, `F3`, ... `F12`

### Navigation
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- `Home`, `End`, `PageUp`, `PageDown`

### Special Keys
- `Escape`, `Enter`, `Space`, `Tab`
- `Backspace`, `Delete`, `Insert`
- `ShiftLeft`, `ShiftRight`
- `CtrlLeft`, `CtrlRight`
- `AltLeft`, `AltRight`
- `MetaLeft`, `MetaRight` (Cmd on Mac)

### Numpad
- `Numpad0`, `Numpad1`, ... `Numpad9`
- `NumpadAdd`, `NumpadSubtract`, `NumpadMultiply`, `NumpadDivide`
- `NumpadEnter`, `NumpadDecimal`

## Best Practices

### 1. Use event.code, not event.key
```javascript
// ✅ Good - works regardless of keyboard layout
keyboardManager.registerKeyHandler('KeyF', handler);

// ❌ Bad - depends on keyboard layout
keyboardManager.registerKeyHandler('f', handler);
```

### 2. Always Check Modifiers if Needed
```javascript
keyboardManager.registerKeyHandler('KeyS', (event) => {
  if (event.ctrlKey) {
    // Ctrl+S logic
  } else {
    // Just S logic
  }
});
```

### 3. Prevent Default Behavior When Appropriate
```javascript
keyboardManager.registerKeyHandler('Space', (event) => {
  event.preventDefault(); // Prevent page scroll
  this.togglePlayPause();
});
```

### 4. Handle Input Field Conflicts
The system automatically suppresses hotkeys when user is typing in input fields, but test your hotkeys to ensure they work correctly.

### 5. Use Descriptive Handler Names
```javascript
// ✅ Good
const frameObjectHandler = (event) => {
  this.frameSelectedObject();
};
keyboardManager.registerKeyHandler('KeyF', frameObjectHandler);

// ❌ Avoid
keyboardManager.registerKeyHandler('KeyF', () => this.frameSelectedObject());
```

### 6. Group Related Hotkeys
```javascript
// Camera controls
keyboardManager.registerKeyHandler('KeyF', () => this.frameObject());
keyboardManager.registerKeyHandler('KeyR', () => this.resetCamera());

// Transform controls
keyboardManager.registerKeyHandler('KeyG', () => this.enableTranslate());
keyboardManager.registerKeyHandler('KeyS', () => this.enableScale());
keyboardManager.registerKeyHandler('KeyE', () => this.enableRotate());
```

## Common Patterns

### Toggle Functionality
```javascript
keyboardManager.registerKeyHandler('KeyI', (event) => {
  const newState = !this.inspectorOpen;
  this.setInspectorOpen(newState);
});
```

### Modal/Dialog Controls
```javascript
keyboardManager.registerKeyHandler('Escape', (event) => {
  if (this.modalOpen) {
    this.closeModal();
  } else {
    this.clearSelection();
  }
});
```

### Incremental Controls
```javascript
keyboardManager.registerKeyHandler('Equal', (event) => {  // + key
  this.increaseZoom();
});

keyboardManager.registerKeyHandler('Minus', (event) => {  // - key
  this.decreaseZoom();
});
```

## Debugging

The keyboard manager provides detailed logging:

```javascript
// Check what keys are registered
console.log('Registered keys:', keyboardManager.getRegisteredKeys());

// Check browser console for logs like:
// [KeyboardManager] Registered handler for key: KeyF
// [KeyboardManager] Skipping KEY_PRESS for KeyF (input field detected)
// [KeyboardManager] Emitting KEY_PRESS for code: KeyF
```

## Integration with Existing Components

### Adding Hotkeys to New Components

```javascript
class MyNewComponent {
  constructor(app) {
    this.app = app;
    this.keyboardManager = app.inputHandler.keyboardManager;
    this.registerHotkeys();
  }

  registerHotkeys() {
    // Register your component's hotkeys
    this.keyboardManager.registerKeyHandler('KeyX', () => this.doSomething());
  }

  dispose() {
    // Clean up hotkeys when component is destroyed
    this.keyboardManager.unregisterKeyHandler('KeyX', this.doSomethingHandler);
  }
}
```

### Checking for Conflicts

Before adding a new hotkey, check what keys are already registered:

```javascript
const existingKeys = keyboardManager.getRegisteredKeys();
console.log('Existing hotkeys:', existingKeys);

// Also check the Application.js registerHotkeys() method
// and other components to avoid conflicts
```

## Complete Example

```javascript
// Example: Adding a custom measurement tool hotkey
class MeasurementTool {
  constructor(app) {
    this.app = app;
    this.keyboardManager = app.inputHandler.keyboardManager;
    this.isActive = false;
    this.registerHotkeys();
  }

  registerHotkeys() {
    // M key to toggle measurement tool
    this.keyboardManager.registerKeyHandler('KeyM', (event) => {
      event.preventDefault();
      this.toggleMeasurement();
    });

    // Escape to cancel current measurement
    this.keyboardManager.registerKeyHandler('Escape', (event) => {
      if (this.isActive) {
        this.cancelMeasurement();
      }
    });
  }

  toggleMeasurement() {
    this.isActive = !this.isActive;
    if (this.isActive) {
      this.startMeasurement();
      this.app.showToast('Measurement tool activated. Click to measure.');
    } else {
      this.stopMeasurement();
      this.app.showToast('Measurement tool deactivated.');
    }
  }

  dispose() {
    // Clean up when component is destroyed
    this.keyboardManager.unregisterKeyHandler('KeyM', this.toggleHandler);
    this.keyboardManager.unregisterKeyHandler('Escape', this.escapeHandler);
  }
}
```

## Testing Your Hotkeys

1. Test that hotkeys work when no input field is focused
2. Test that hotkeys are suppressed when typing in input fields
3. Test on different keyboard layouts
4. Test with modifier keys (Ctrl, Alt, Shift)
5. Test that hotkeys don't interfere with browser shortcuts

## Migration from Old System

If you're migrating from the old keyboard event system:

```javascript
// Old way (deprecated)
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyF') {
    // handle F key
  }
});

// New way (recommended)
keyboardManager.registerKeyHandler('KeyF', (event) => {
  // handle F key
});
```

The new system automatically handles input field detection, cleanup, and provides better debugging capabilities.




```
When adding new hotkeys, developers should:

Read the guide in docs/HOTKEYS_GUIDE.md
Check existing hotkeys to avoid conflicts
Use the centralized system instead of direct event listeners
Follow the patterns shown in examples```