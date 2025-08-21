# Logging Guidelines

This document provides a brief guide on how to correctly add logs to the codebase.

## 1. Use the Central Logger Module

Always use the centralized `Logger` module for all logging.

**Import:**
```javascript
import Logger from './core/Logger.js'; // Adjust the relative path as needed
```

## 2. Logging Methods

The `Logger` provides three levels of logging:
- `Logger.log()`: For general information and debugging.
- `Logger.warn()`: For potential issues or non-critical errors.
- `Logger.error()`: For critical errors that disrupt functionality.

## 3. Required Log Format

All log messages **must** be prefixed with the name of the module they are in, enclosed in square brackets. This helps to quickly identify the source of the log message.

**Format:** `[ModuleName] Log message here`

**Example (`src/core/UIBindings.js`):**
```javascript
// Correct
Logger.log('[UIBindings] UIBindings constructor called');
Logger.error('[UIBindings] Failed to bind event:', error);

// Incorrect
Logger.log('UIBindings constructor called');
```

## 4. Where to Add Logs

- **Constructors**: Log the initialization of major classes.
- **Public Methods**: Log the entry into important public methods.
- **Error Catches**: Always log errors in `try...catch` blocks.
- **Event Handlers**: Log significant events or user interactions.