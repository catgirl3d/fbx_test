# CLAUDE.md
## Project Overview

This is a browser-based 3D model viewer written in vanilla JavaScript using Three.js. The application loads and displays FBX, GLTF, OBJ, and other 3D formats with advanced features like polygon selection, animation controls, material overrides, lighting controls, and transform tools.

## Development Commands

This is a client-side web application without a build system. Development is done by:

- **Testing**: Manual testing in browser - no automated test framework is set up
- **Debugging**: Use browser DevTools and the built-in Logger system

The application loads directly in the browser via `index.html`.

## Architecture Overview

### Core Architecture Pattern
The application follows a modular event-driven architecture with several key patterns:

- **Singleton Logger**: Centralized logging with enable/disable toggle (`src/core/Logger.js`)
- **Event System**: Pub/sub pattern for component communication (`src/core/EventSystem.js`)  
- **State Management**: Centralized state with observers (`src/core/StateManager.js`)
- **Manager Pattern**: Specialized managers for different concerns (Scene, Renderer, Animation, etc.)

### Application Initialization Flow
```
Application.create() -> init() -> {
  loadLanguage() -> 
  initThreeJS() -> 
  initManagers() -> 
  initUI() -> 
  initEventListeners() -> 
  loadDefaultModel() -> 
  start()
}
```

### Key Components

**Core System** (`src/core/`):
- `Application.js` - Main application orchestrator and entry point  
- `StateManager.js` - Centralized state management with observer pattern
- `EventSystem.js` - Event bus for component communication
- `Logger.js` - Singleton logging system with module prefixes
- `UIBindings.js` - DOM event bindings and UI state management
- `InputHandler.js` - Mouse/keyboard input processing
- `AssetLoader.js` - File loading and parsing for 3D models/textures

**Rendering & Scene** (`src/`):
- `Renderer.js` - WebGL renderer management with post-processing
- `Scene.js` - 3D scene management and object hierarchy
- `Lighting.js` - Directional lighting and environment controls
- `Materials.js` - Material overrides and UV manipulation
- `RenderSettings.js` - Exposure, tone mapping, FXAA controls

**Interaction & Tools** (`src/`):
- `TransformControls.js` - 3D gizmos for object manipulation
- `polygon_selection.js` - Advanced lasso/click polygon selection system
- `Inspector.js` - Object hierarchy browser and property editor
- `Animation.js` - Animation playback controls

**UI & Localization** (`src/`):
- `UI.js` - Main UI initialization and control bindings
- `DOMManager.js` - DOM manipulation utilities
- `i18n.js` - Internationalization system (English/Russian)

### Key Architectural Patterns

**Event-Driven Communication**: Components communicate via `EventSystem` rather than direct calls:
```javascript
this.eventSystem.emit(EVENTS.OBJECT_SELECTED, { object });
this.eventSystem.on(EVENTS.MODEL_LOADED, this.handleModelLoaded.bind(this));
```

**State Management**: Centralized state with reactive updates:
```javascript
this.stateManager.subscribe('scene', this.handleSceneStateChange.bind(this));
this.stateManager.setSelectedObject(object);
```

**Manager Pattern**: Specialized managers handle specific concerns:
- `SceneManager` - 3D scene operations
- `RendererManager` - Rendering and post-processing  
- `AnimationManager` - Animation timeline control
- `LightingManager` - Lighting setup and controls

## Logging Guidelines

**CRITICAL**: Always use the centralized Logger module for all logging. Never use `console.*` directly.

```javascript
import Logger from './core/Logger.js';

// Required format with module name prefix
Logger.log('[ModuleName] Message here');
Logger.warn('[ModuleName] Warning message');  
Logger.error('[ModuleName] Error message', errorObject);
```

See `LOGGING_GUIDELINES.md` for complete logging standards.

## Development Guidelines

### Adding New Features

1. **Follow the Event System**: Use `EventSystem` for component communication
2. **Use State Management**: Store shared state in `StateManager`
3. **Manager Pattern**: Create dedicated managers for complex functionality
4. **Proper Logging**: Always use Logger with module prefixes
5. **Error Handling**: Implement resilience guards and proper error reporting

### Code Organization

- **Core systems** go in `src/core/`
- **Rendering components** go in `src/` root
- **Utilities** go in `src/utils/`
- **Loaders** for different file formats go in `src/loaders/`
- **Task documentation** goes in `tasks/` directory

### Architecture Patterns to Follow

**Initialization Pattern**: 
- Constructors should be lightweight
- Heavy initialization goes in separate `init()` methods
- Use static factory methods like `Application.create()`

**Error Resilience**:
- Always check for null/undefined before method calls
- Use optional chaining: `this.manager?.method?.()`
- Implement safe getter methods like `_getSafeScene()`

**Resource Management**:
- Implement proper `dispose()` methods
- Clean up event listeners and Three.js objects
- Use memory limits for debug features (see polygon_selection.js)

## Key Technologies

- **Three.js r152** - 3D graphics library loaded via CDN
- **ES6 Modules** - Native browser module system with importmap
- **Web APIs**: FileReader, drag/drop, localStorage, Canvas 2D (for overlays)
- **External Libraries**: zip.js for archive handling, TGA-js for texture loading

## Special Features

### Polygon Selection System
Advanced face-level selection with two modes:
- **Click mode**: Individual face selection via raycasting
- **Lasso mode**: Free-form drawing selection with canvas overlay
- Memory-managed debug markers to prevent memory leaks

### Multi-language Support  
I18n system supporting English and Russian with automatic browser detection and UI updates.

### Model Loading Pipeline
Supports FBX, GLTF/GLB, OBJ formats with automatic texture application from ZIP archives.

### Transform System
3D manipulation gizmos with snapping, multiple transform modes, and proper OrbitControls integration.

## Important Implementation Notes

- **No Build System**: Direct browser execution with ES6 modules
- **CDN Dependencies**: Three.js and utilities loaded from CDN
- **Client-Side Only**: No backend/server components
- **Default Model**: `Y_Bot.fbx` loads automatically on startup
- **State Persistence**: Some UI state saved to localStorage
- **Memory Management**: Implemented safeguards against memory leaks in selection systems

## Recent Development Focus

Based on recent commits, active development areas include:
- Enhanced polygon selection with memory management
- UI state improvements and error handling
- Scene handling resilience and safety checks
- Logger integration throughout the codebase
- Model switching and state management improvements