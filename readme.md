# 3D Model Viewer

A powerful browser-based 3D model viewer built with vanilla JavaScript and Three.js. This application loads and displays FBX, GLTF/GLB, and OBJ 3D models with advanced features including polygon selection, animation controls, material overrides, lighting controls, and 3D transform tools.

## Features

- **Model Loading**: Support for FBX, GLTF/GLB, and OBJ formats with automatic texture application from ZIP archives
- **Polygon Selection**: Advanced face-level selection with click mode and lasso mode using canvas overlays
- **Animation Controls**: Playback controls for model animations
- **3D Transform Gizmos**: Grab, scale, and rotate operations with snapping support
- **Material Management**: Override materials and manipulate UV coordinates
- **Lighting Controls**: Directional lighting and environment adjustments
- **Inspector Panel**: Browse object hierarchy and edit properties
- **Multi-Language Support**: English, Russian, and Ukrainian with automatic browser detection
- **Hotkey Integration**: Centralized keyboard shortcuts with input field conflict prevention
- **State Persistence**: UI state saved to localStorage
- **Debugging Tools**: Built-in logging system and memory-managed debug markers

## Technologies

- **Three.js r152** - 3D graphics library loaded via CDN
- **ES6 Modules** - Native browser module system with importmap
- **Web APIs**: FileReader, drag/drop, localStorage, Canvas 2D
- **External Libraries**: zip.js for texture handling, TGA-js for texture loading
- **Architecture**: Event-driven with Singleton Logger, State Management, and Manager Pattern

## Getting Started

### Quick Start

Prerequisites
- Modern browser with WebGL support
- Local web server for loading files (no build steps required)

Running locally
1) Start a simple static server in the project root:
  - Python: python -m http.server 8000
  - Node: npx http-server
  - PHP: php -S localhost:8000

2) Open http://localhost:8000 in your browser

### Development

This is a client-side web application without a build system:
- **Testing**: Manual browser testing
- **Debugging**: Browser DevTools + built-in Logger system
- **No Dependencies**: Loads dependencies directly from CDN

### Default Model

The application automatically loads a default model (`Y_Bot.fbx`) on startup for immediate use.

## Architecture Overview

### Core System

- **Application.js**: Main orchestrator and entry point
- **StateManager.js**: Centralized state with observer pattern
- **EventSystem.js**: Event bus for component communication
- **Logger.js**: Singleton logging with module prefixes
- **UIBindings.js**: DOM event handling and UI state
- **InputHandler.js**: Centralized input with KeyboardEventManager
- **AssetLoader.js**: Model file parsing and loading

### Rendering Components

- **Renderer.js**: WebGL rendering with post-processing
- **Scene.js**: 3D scene management
- **Lighting.js**: Lighting controls
- **Materials.js**: Material overrides
- **RenderSettings.js**: Exposure, tone mapping, FXAA

### Interaction Tools

- **TransformControls.js**: 3D manipulation gizmos
- **polygon_selection.js**: Advanced polygon selection system
- **Inspector.js**: Object property editor
- **Animation.js**: Animation playback

### UI & Utilities

- **UI.js**: Main UI management
- **DOMManager.js**: DOM manipulation helpers
- **i18n.js**: Internationalization system

## Key Hotkeys

- **F** - Frame selected object (or fit all if none selected)
- **R** - Reset camera position
- **I** - Toggle inspector panel
- **G/S/E** - Transform controls (Grab/Scale/Rotate)
- **Tab** - Toggle transform controls
- **P** - Toggle polygon selection mode
- **Delete/Escape** - Clear selection or close dialogs

Hotkeys are automatically disabled when typing in input fields.

## Development Guidelines

### Architecture Patterns

**Event-Driven Communication**:
```javascript
// Use EventSystem for component communication
this.eventSystem.emit(EVENTS.OBJECT_SELECTED, { object });
this.eventSystem.on(EVENTS.MODEL_LOADED, this.handleModelLoaded.bind(this));
```

**State Management**:
```javascript
// Centralized state with reactive updates
this.stateManager.setSelectedObject(object);
this.stateManager.subscribe('scene', this.handleSceneStateChange.bind(this));
```

**Logging (MANDATORY)**:
```javascript
import Logger from './core/Logger.js';

// Always use Logger instead of console.*
Logger.log('[ModuleName] Message here');
Logger.warn('[ModuleName] Warning message');
Logger.error('[ModuleName] Error message', errorObject);
```

### Code Organization

- `src/core/` - Core singleton systems
- `src/loaders/` - File format loaders
- `src/utils/` - Utility functions
- `src/locales/` - Internationalization files
- `src/` - Main rendering and interaction components

### Manager Pattern

Specialized managers handle dedicated concerns:
- SceneManager for 3D scene operations
- RendererManager for rendering controls
- AnimationManager for timeline control
- LightingManager for lighting setup

## Implementation Notes

- **No Build System**: Direct browser execution with ES6 modules
- **Client-Side Only**: No server/back-end components required
- **Memory Management**: Safeguards against memory leaks in selection systems
- **CDN Dependencies**: All external libraries loaded from CDN
- **Factory Pattern**: Use static factory methods like `Application.create(canvas)`

## Project Structure

```
├── index.html                    # Main entry point
├── readme.md                     # This file
├── docs/                         # Documentation
│   ├── project.md               # Detailed project overview
│   ├── HOTKEYS_GUIDE.md         # Hotkey development guide
│   ├── LOGGING_GUIDELINES.md    # Logging standards
│   ├── FBX_METADATA_USAGE.md    # FBX metadata handling
│   └── COMMIT_GUIDE.md          # Commit message guidelines
├── src/
│   ├── core/                    # Core singleton systems
│   │   ├── Application.js       # Main application orchestrator
│   │   ├── EventSystem.js       # Event bus
│   │   ├── Logger.js            # Logging system
│   │   ├── StateManager.js      # Centralized state
│   │   └── ...
│   ├── loaders/                 # File format loaders
│   │   ├── FBX.js
│   │   ├── GLTF.js
│   │   └── ...
│   ├── utils/                   # Utility functions
│   ├── locales/                 # Translation files
│   └── *.js                     # Main components
└── model/                       # Sample models
    ├── Y_Bot.fbx               # Default model
    └── devilgirl.fbx           # Sample model
```