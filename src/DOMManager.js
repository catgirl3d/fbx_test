// src/DOMManager.js
// Provides a centralized DOM lookup/cache layer with comprehensive DOM manipulation utilities.

/**
 * DOM Manager - A comprehensive DOM manipulation and caching utility
 * @module DOMManager
 */

// Debug logging configuration
let debugEnabled = false;

/**
 * Internal logging method
 * @private
 */
function _log(level, ...args) {
  if (debugEnabled && console[level]) {
    console[level]('[DOMManager]', ...args);
  }
}

/**
 * Simple HTML sanitizer to remove script tags and event handlers
 * @private
 */
function _sanitizeHTML(html) {
  if (typeof html !== 'string') return html;
  
  // Remove script tags
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (on* attributes)
  sanitized = sanitized.replace(/\s+on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/\s+on\w+='[^']*'/gi, '');
  
  return sanitized;
}

/**
 * DOM Manager class
 */
class DOMManager {
  constructor() {
    // Cache storage
    this._cache = new Map();
    
    // Event storage for cleanup
    this._events = new Map();
    
    // Window resize handler
    this._resizeHandler = null;
    this._resizeTimeout = null;
    
    // Initialize with common elements
    this._initCommonElements();
  }

  /**
   * Initialize common DOM elements
   * @private
   */
  _initCommonElements() {
    const commonElements = {
      'canvas': '#viewport',
      'viewport': '#viewport',
      'polyCount': '#poly-count',
      'objCount': '#obj-count',
      'toggleTransform': '#toggle-transform',
      'transformMode': '#transform-mode',
      'toggleSnap': '#toggle-snap',
      'snapPos': '#snap-pos',
      'snapRot': '#snap-rot',
      'snapScale': '#snap-scale',
      'toggleShadows': '#toggle-shadows',
      'toggleFXAA': '#toggle-fxaa',
      'toggleLightOnly': '#toggle-lightonly',
      'toggleGrid': '#toggle-grid',
      'bgSelect': '#bg-select',
      'bgColor': '#bg-color',
      'matOverride': '#mat-override',
      'toggleWireframe': '#toggle-wireframe',
      'animSelect': '#anim-select',
      'animPlayPause': '#anim-playpause',
      'animStop': '#anim-stop',
      'animLoop': '#anim-loop',
      'animSpeed': '#anim-speed',
      'animProgress': '#anim-progress',
      'animTime': '#anim-time',
      'dirIntensity': '#dir-intensity',
      'dirAngle': '#dir-angle',
      'dirSoftness': '#dir-softness',
      'envIntensity': '#env-intensity',
      'exposure': '#exposure',
      'toneMapping': '#tone-mapping',
      'fxaa': '#toggle-fxaa',
      'camPresets': '#cam-presets',
      'lang': '#lang',
      'dirIntensityVal': '#dir-intensity-val',
      'dirAngleVal': '#dir-angle-val',
      'dirSoftnessVal': '#dir-softness-val',
      'envIntensityVal': '#env-intensity-val',
      'exposureVal': '#exposure-val',
      'fps': '#fps',
      'overlay': '#overlay',
      'meter': '#meter',
      'progressTitle': '#progress-title',
      'progressSub': '#progress-sub',
      'toast': '#toast',
      'tree': '#tree',
      'sceneInspector': '#scene-inspector',
      'openInspector': '#open-inspector',
      'inspectorClose': '#inspector-close',
      'leftCol': '.left-col',
      'resetRender': '#reset-render',
      'resetDir': '#reset-dir',
      'resetEnv': '#reset-env',
      'resetGizmos': '#reset-gizmos',
      'filenameDisplay': '#filename-display'
    };

    // Cache common elements
    Object.entries(commonElements).forEach(([key, selector]) => {
      this._cache.set(key, document.querySelector(selector));
    });
  }

  /**
   * Get element by selector or ID
   * @param {string} selectorOrId - CSS selector or element ID
   * @returns {HTMLElement | null} The found element or null
   */
  get(selectorOrId) {
    if (typeof selectorOrId !== 'string') {
      _log('error', 'get() requires a string selector or ID');
      return null;
    }

    // Check cache first
    if (this._cache.has(selectorOrId)) {
      return this._cache.get(selectorOrId);
    }

    // Try to find element
    const element = document.querySelector(selectorOrId) || document.getElementById(selectorOrId);
    
    // Cache the result
    this._cache.set(selectorOrId, element);
    
    return element;
  }

  /**
   * Get element by selector or ID, throw error if not found
   * @param {string} selectorOrId - CSS selector or element ID
   * @param {string} [errMsg] - Custom error message
   * @returns {HTMLElement} The found element
   * @throws {Error} If element is not found
   */
  getOrThrow(selectorOrId, errMsg) {
    const element = this.get(selectorOrId);
    if (!element) {
      throw new Error(errMsg || `Element not found: ${selectorOrId}`);
    }
    return element;
  }

  /**
   * Query element using CSS selector
   * @param {string} selector - CSS selector
   * @returns {Element | null} The found element or null
   */
  query(selector) {
    if (typeof selector !== 'string') {
      _log('error', 'query() requires a string selector');
      return null;
    }
    return document.querySelector(selector);
  }

  /**
   * Query all elements using CSS selector
   * @param {string} selector - CSS selector
   * @returns {NodeListOf<Element>} List of found elements
   */
  queryAll(selector) {
    if (typeof selector !== 'string') {
      _log('error', 'queryAll() requires a string selector');
      return [];
    }
    return document.querySelectorAll(selector);
  }

  /**
   * Create HTML element
   * @param {string} tagName - HTML tag name
   * @param {Object} [options] - Creation options
   * @param {string} [options.class] - CSS class name
   * @param {Record<string,string>} [options.attrs] - Attributes to set
   * @param {string} [options.html] - HTML content
   * @returns {HTMLElement} Created element
   */
  create(tagName, options = {}) {
    const element = document.createElement(tagName);
    
    if (options.class) {
      element.className = options.class;
    }
    
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
    
    if (options.html) {
      element.innerHTML = _sanitizeHTML(options.html);
    }
    
    return element;
  }

  /**
   * Append child to parent
   * @param {HTMLElement | string} parent - Parent element or selector
   * @param {HTMLElement | string} child - Child element or selector
   * @returns {HTMLElement} The appended child element
   */
  append(parent, child) {
    const parentEl = this._resolveElement(parent);
    const childEl = this._resolveElement(child);
    
    if (!parentEl || !childEl) {
      _log('error', 'append() requires valid parent and child elements');
      return null;
    }
    
    parentEl.appendChild(childEl);
    return childEl;
  }

  /**
   * Remove element from DOM
   * @param {HTMLElement | string} element - Element or selector to remove
   */
  remove(element) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'remove() requires a valid element');
      return;
    }
    
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
    
    // Remove from cache
    this._invalidateCacheForElement(el);
  }

  /**
   * Set HTML content with optional sanitization
   * @param {HTMLElement | string} element - Element or selector
   * @param {string} html - HTML content to set
   * @param {Object} [opts] - Options
   * @param {boolean} [opts.sanitize=true] - Whether to sanitize HTML
   */
  setHTML(element, html, opts = { sanitize: true }) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'setHTML() requires a valid element');
      return;
    }
    
    const sanitizedHTML = opts.sanitize !== false ? _sanitizeHTML(html) : html;
    el.innerHTML = sanitizedHTML;
  }

  /**
   * Get HTML content
   * @param {HTMLElement | string} element - Element or selector
   * @returns {string} HTML content
   */
  getHTML(element) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'getHTML() requires a valid element');
      return '';
    }
    return el.innerHTML;
  }

  /**
   * Set text content
   * @param {HTMLElement | string} element - Element or selector
   * @param {string} text - Text content to set
   */
  setText(element, text) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'setText() requires a valid element');
      return;
    }
    el.textContent = text;
  }

  /**
   * Get text content
   * @param {HTMLElement | string} element - Element or selector
   * @returns {string} Text content
   */
  getText(element) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'getText() requires a valid element');
      return '';
    }
    return el.textContent;
  }

  /**
   * Add CSS class to element
   * @param {HTMLElement | string} element - Element or selector
   * @param {string} className - Class name to add
   */
  addClass(element, className) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'addClass() requires a valid element');
      return;
    }
    el.classList.add(className);
  }

  /**
   * Remove CSS class from element
   * @param {HTMLElement | string} element - Element or selector
   * @param {string} className - Class name to remove
   */
  removeClass(element, className) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'removeClass() requires a valid element');
      return;
    }
    el.classList.remove(className);
  }

  /**
   * Toggle CSS class on element
   * @param {HTMLElement | string} element - Element or selector
   * @param {string} className - Class name to toggle
   * @returns {boolean} True if class was added, false if removed
   */
  toggleClass(element, className) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'toggleClass() requires a valid element');
      return false;
    }
    return el.classList.toggle(className);
  }

  /**
   * Check if element has CSS class
   * @param {HTMLElement | string} element - Element or selector
   * @param {string} className - Class name to check
   * @returns {boolean} True if element has class
   */
  hasClass(element, className) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'hasClass() requires a valid element');
      return false;
    }
    return el.classList.contains(className);
  }

  /**
   * Set CSS style property
   * @param {HTMLElement | string} element - Element or selector
   * @param {string} prop - CSS property name
   * @param {string} value - CSS value
   */
  setStyle(element, prop, value) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'setStyle() requires a valid element');
      return;
    }
    el.style[prop] = value;
  }

  /**
   * Get CSS style property
   * @param {HTMLElement | string} element - Element or selector
   * @param {string} prop - CSS property name
   * @returns {string} CSS value
   */
  getStyle(element, prop) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'getStyle() requires a valid element');
      return '';
    }
    return el.style[prop];
  }

  /**
   * Set data attribute
   * @param {HTMLElement | string} element - Element or selector
   * @param {string} key - Data key
   * @param {string} value - Data value
   */
  setData(element, key, value) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'setData() requires a valid element');
      return;
    }
    el.dataset[key] = value;
  }

  /**
   * Get data attribute
   * @param {HTMLElement | string} element - Element or selector
   * @param {string} key - Data key
   * @returns {string} Data value
   */
  getData(element, key) {
    const el = this._resolveElement(element);
    if (!el) {
      _log('error', 'getData() requires a valid element');
      return '';
    }
    return el.dataset[key];
  }

  /**
   * Add event listener
   * @param {HTMLElement | string | Window} elementOrSelectorOrWindow - Element, selector, or window
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} [opts] - Event options
   * @returns {Function} Function to remove event listener
   */
  on(elementOrSelectorOrWindow, event, handler, opts) {
    const target = this._resolveEventTarget(elementOrSelectorOrWindow);
    if (!target) {
      _log('error', 'on() requires a valid target');
      return () => {};
    }

    // Add event listener
    target.addEventListener(event, handler, opts);

    // Store for cleanup
    const eventKey = this._getEventKey(elementOrSelectorOrWindow, event);
    if (!this._events.has(eventKey)) {
      this._events.set(eventKey, new Set());
    }
    this._events.get(eventKey).add(handler);

    // Return off function
    return () => {
      target.removeEventListener(event, handler, opts);
      this._events.get(eventKey)?.delete(handler);
    };
  }

  /**
   * Remove event listener
   * @param {HTMLElement | string | Window} elementOrSelectorOrWindow - Element, selector, or window
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} [opts] - Event options
   */
  off(elementOrSelectorOrWindow, event, handler, opts) {
    const target = this._resolveEventTarget(elementOrSelectorOrWindow);
    if (!target) {
      _log('error', 'off() requires a valid target');
      return;
    }

    // If handler is not provided, remove all listeners for this event
    if (handler === undefined || handler === null) {
      const eventKey = this._getEventKey(elementOrSelectorOrWindow, event);
      const handlers = this._events.get(eventKey);
      
      if (handlers) {
        // Remove all event listeners for this target+event combination
        handlers.forEach(storedHandler => {
          target.removeEventListener(event, storedHandler, opts);
        });
        
        // Clear all handlers from storage
        this._events.delete(eventKey);
      }
    } else {
      // Remove specific handler
      target.removeEventListener(event, handler, opts);
      
      // Remove from storage
      const eventKey = this._getEventKey(elementOrSelectorOrWindow, event);
      this._events.get(eventKey)?.delete(handler);
    }
  }

  /**
   * Add event listener to window
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} [opts] - Event options
   * @returns {Function} Function to remove event listener
   */
  onWindow(event, handler, opts) {
    return this.on(window, event, handler, opts);
  }

  /**
   * Remove event listener from window
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} [opts] - Event options
   */
  offWindow(event, handler, opts) {
    this.off(window, event, handler, opts);
  }

  /**
   * Cache multiple elements
   * @param {Record<string,string>} map - Object mapping keys to selectors
   */
  cache(map) {
    Object.entries(map).forEach(([key, selector]) => {
      const element = document.querySelector(selector) || document.getElementById(selector);
      this._cache.set(key, element);
    });
  }

  /**
   * Get cached element
   * @param {string} key - Cache key
   * @returns {HTMLElement | null} Cached element or null
   */
  getCached(key) {
    return this._cache.get(key) || null;
  }

  /**
   * Check if cache has key
   * @param {string} key - Cache key
   * @returns {boolean} True if cache has key
   */
  hasCached(key) {
    return this._cache.has(key);
  }

  /**
   * Invalidate cache entry or all cache
   * @param {string} [key] - Specific key to invalidate, or all if undefined
   */
  invalidateCache(key) {
    if (key) {
      this._cache.delete(key);
    } else {
      this._cache.clear();
      this._initCommonElements();
    }
  }

  /**
   * Get native HTMLElement
   * @param {HTMLElement | string} elementOrId - Element or selector
   * @returns {HTMLElement | null} Native element or null
   */
  getNative(elementOrId) {
    if (elementOrId instanceof HTMLElement) {
      return elementOrId;
    }
    return this.get(elementOrId);
  }

  /**
   * Wait for element to be ready
   * @param {string} selectorOrId - CSS selector or element ID
   * @param {number} [timeoutMs=10000] - Timeout in milliseconds
   * @returns {Promise<HTMLElement | null>} Promise resolving to element or null
   */
  ready(selectorOrId, timeoutMs = 10000) {
    return new Promise((resolve) => {
      // Check if element already exists
      const existingElement = this.get(selectorOrId);
      if (existingElement) {
        resolve(existingElement);
        return;
      }

      // Create observer
      const observer = new MutationObserver(() => {
        const element = this.get(selectorOrId);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Set timeout
      const timeout = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeoutMs);

      // Cleanup on unmount
      return () => {
        clearTimeout(timeout);
        observer.disconnect();
      };
    });
  }

  /**
   * Get window size information
   * @returns {Object} Window size object
   */
  getWindowSize() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      ratio: window.devicePixelRatio
    };
  }

  /**
   * Add window resize handler
   * @param {Function} handler - Resize handler function
   * @returns {Function} Function to remove resize handler
   */
  onWindowResize(handler) {
    if (this._resizeHandler) {
      // Remove existing handler
      window.removeEventListener('resize', this._resizeHandler);
    }

    const debouncedHandler = () => {
      if (this._resizeTimeout) {
        cancelAnimationFrame(this._resizeTimeout);
      }
      
      this._resizeTimeout = requestAnimationFrame(() => {
        const size = this.getWindowSize();
        handler(size);
      });
    };

    this._resizeHandler = debouncedHandler;
    window.addEventListener('resize', this._resizeHandler);

    // Return off function
    return () => {
      window.removeEventListener('resize', this._resizeHandler);
      if (this._resizeTimeout) {
        cancelAnimationFrame(this._resizeTimeout);
      }
    };
  }

  /**
   * Add window resize handler (alias for onWindowResize)
   * @param {Function} handler - Resize handler function
   * @returns {Function} Function to remove resize handler
   */
  onResize(handler) {
    return this.onWindowResize(handler);
  }

  /**
   * Remove window resize handler
   * @param {Function|Function} handlerOrOffFn - Handler function or off function returned by onResize/onWindowResize
   */
  offResize(handlerOrOffFn) {
    if (typeof handlerOrOffFn === 'function') {
      // If handler is provided, try to remove it
      if (this._resizeHandler === handlerOrOffFn) {
        window.removeEventListener('resize', this._resizeHandler);
        this._resizeHandler = null;
      }
      
      // Also try to remove from general event storage
      const eventKey = 'window:resize';
      const handlers = this._events.get(eventKey);
      if (handlers) {
        handlers.delete(handlerOrOffFn);
        if (handlers.size === 0) {
          this._events.delete(eventKey);
        }
      }
    } else if (typeof handlerOrOffFn === 'function') {
      // If off function is provided, call it
      handlerOrOffFn();
    }
  }

  /**
   * Add window error event handler
   * @param {Function} handler - Error handler function
   * @returns {Function} Function to remove error handler
   */
  onError(handler) {
    return this.onWindow('error', handler);
  }

  /**
   * Remove window error event handler
   * @param {Function|Function} handlerOrOffFn - Handler function or off function returned by onError
   */
  offError(handlerOrOffFn) {
    if (typeof handlerOrOffFn === 'function') {
      this.offWindow('error', handlerOrOffFn);
    } else if (typeof handlerOrOffFn === 'function') {
      handlerOrOffFn();
    }
  }

  /**
   * Add window unhandledrejection event handler
   * @param {Function} handler - Handler function
   * @returns {Function} Function to remove unhandledrejection handler
   */
  onUnhandledRejection(handler) {
    return this.onWindow('unhandledrejection', handler);
  }

  /**
   * Remove window unhandledrejection event handler
   * @param {Function|Function} handlerOrOffFn - Handler function or off function returned by onUnhandledRejection
   */
  offUnhandledRejection(handlerOrOffFn) {
    if (typeof handlerOrOffFn === 'function') {
      this.offWindow('unhandledrejection', handlerOrOffFn);
    } else if (typeof handlerOrOffFn === 'function') {
      handlerOrOffFn();
    }
  }

  /**
   * Get value from element
   * @param {HTMLElement|string} elementOrId - Element or selector
   * @returns {string} Element value or empty string
   */
  getValue(elementOrId) {
    const element = this._resolveElement(elementOrId);
    if (!element) {
      _log('warn', 'getValue() element not found:', elementOrId);
      return '';
    }
    
    // Return element.value if it exists, otherwise fallback to attribute 'value'
    return element.value !== undefined ? element.value : (element.getAttribute('value') || '');
  }

  /**
   * Get checked state from element
   * @param {HTMLElement|string} elementOrId - Element or selector
   * @returns {boolean} Checked state
   */
  isChecked(elementOrId) {
    const element = this._resolveElement(elementOrId);
    if (!element) {
      _log('warn', 'isChecked() element not found:', elementOrId);
      return false;
    }
    
    return element.checked || false;
  }

  /**
   * Set global window property
   * @param {string} name - Property name
   * @param {*} value - Property value
   */
  setGlobal(name, value) {
    if (typeof name !== 'string' || name.trim() === '') {
      _log('error', 'setGlobal() requires a non-empty string name');
      return;
    }
    
    // Guard against server environments
    if (typeof window !== 'undefined') {
      window[name] = value;
    }
  }

  /**
   * Show toast message
   * @param {string} message - Message to display
   * @param {Object} [opts] - Options
   * @param {number} [opts.duration=3000] - Display duration in milliseconds
   * @param {string} [opts.type='info'] - Toast type
   */
  showToast(message, opts = { duration: 3000, type: 'info' }) {
    const toast = this.get('toast') || this.get('#toast');
    if (!toast) {
      _log('warn', 'Toast element not found');
      return;
    }

    this.setText(toast, message);
    this.addClass(toast, 'visible');
    
    if (opts.type) {
      // Remove existing type classes
      toast.className = toast.className.replace(/toast-\w+/g, '');
      this.addClass(toast, `toast-${opts.type}`);
    }

    // Auto-hide
    if (opts.duration > 0) {
      setTimeout(() => {
        this.removeClass(toast, 'visible');
      }, opts.duration);
    }
  }

  /**
   * Show overlay
   * @param {string} title - Overlay title
   * @param {string} [subtitle] - Overlay subtitle
   */
  showOverlay(title, subtitle) {
    const overlay = this.get('overlay') || this.get('#overlay');
    if (!overlay) {
      _log('warn', 'Overlay element not found');
      return;
    }

    const titleEl = this.get('.overlay-title') || overlay.querySelector('.overlay-title');
    const subtitleEl = this.get('.overlay-subtitle') || overlay.querySelector('.overlay-subtitle');

    if (titleEl) this.setText(titleEl, title);
    if (subtitleEl && subtitle) this.setText(subtitleEl, subtitle);

    this.addClass(overlay, 'visible');
  }

  /**
   * Hide overlay
   */
  hideOverlay() {
    const overlay = this.get('overlay') || this.get('#overlay');
    if (!overlay) {
      _log('warn', 'Overlay element not found');
      return;
    }

    this.removeClass(overlay, 'visible');
  }

  /**
   * Resolve element from string or HTMLElement
   * @private
   */
  _resolveElement(element) {
    if (element instanceof HTMLElement) {
      return element;
    }
    if (typeof element === 'string') {
      return this.get(element);
    }
    return null;
  }

  /**
   * Resolve event target
   * @private
   */
  _resolveEventTarget(elementOrSelectorOrWindow) {
    if (elementOrSelectorOrWindow === window) {
      return window;
    }
    if (elementOrSelectorOrWindow instanceof HTMLElement) {
      return elementOrSelectorOrWindow;
    }
    if (typeof elementOrSelectorOrWindow === 'string') {
      return this.get(elementOrSelectorOrWindow);
    }
    return null;
  }

  /**
   * Get event key for storage
   * @private
   */
  _getEventKey(elementOrSelectorOrWindow, event) {
    if (elementOrSelectorOrWindow === window) {
      return `window:${event}`;
    }
    if (typeof elementOrSelectorOrWindow === 'string') {
      return `${elementOrSelectorOrWindow}:${event}`;
    }
    return `${elementOrSelectorOrWindow?.id || 'unknown'}:${event}`;
  }

  /**
   * Invalidate cache for element
   * @private
   */
  _invalidateCacheForElement(element) {
    // Find and remove all cache entries that reference this element
    for (const [key, cachedElement] of this._cache.entries()) {
      if (cachedElement === element) {
        this._cache.delete(key);
      }
    }
  }

  /**
   * Enable debug logging
   */
  enableDebug() {
    debugEnabled = true;
  }

  /**
   * Disable debug logging
   */
  disableDebug() {
    debugEnabled = false;
  }

  /**
   * Get document body element
   * @returns {HTMLElement} The body element
   */
  body() {
    return document.body;
  }

  /**
   * Get document head element
   * @returns {HTMLElement} The head element
   */
  head() {
    return document.head;
  }
}

// Create factory function
function createDOMManager() {
  return new DOMManager();
}

// Create default instance
const dom = createDOMManager();

// Export
export default dom;
export { createDOMManager, DOMManager };

// Internal test checks (no side effects)
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  // Test-only validation
  const requiredMethods = [
    'get', 'getOrThrow', 'query', 'queryAll', 'create', 'append', 'remove',
    'setHTML', 'getHTML', 'setText', 'getText', 'addClass', 'removeClass',
    'toggleClass', 'hasClass', 'setStyle', 'getStyle', 'setData', 'getData',
    'on', 'off', 'onWindow', 'offWindow', 'cache', 'getCached', 'hasCached',
    'invalidateCache', 'getNative', 'ready', 'getWindowSize', 'onWindowResize',
    'showToast', 'showOverlay', 'hideOverlay', 'body'
  ];

  requiredMethods.forEach(method => {
    if (typeof dom[method] !== 'function') {
      console.error(`DOMManager missing method: ${method}`);
    }
  });
}