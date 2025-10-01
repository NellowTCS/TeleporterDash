// DOM Manager - Centralized DOM element access and event management
export const DOMManager = {
  // Cache for DOM elements
  elements: {},

  // Element selectors
  selectors: {
    // Grid elements
    grid: "#grid",
    gridWidthInput: "#gridWidth",
    gridHeightInput: "#gridHeight",
    updateGridSizeBtn: "#updateGridSize",
    gridContainer: "#gridContainer",

    // Action buttons
    exportBtn: "#exportBtn",
    testBtn: "#testBtn",
    clearBtn: "#clearBtn",
    saveDraftBtn: "#saveDraftBtn",
    importBtn: "#importBtn",
    backToMenuBtn: "#backToMenuBtn",

    // Form elements
    levelNameInput: "#levelName",
    authorName: "#authorName",
    difficulty: "#difficulty",
    exportArea: "#exportArea",

    // Music elements
    musicSelect: "#musicSelect",
    musicPreview: "#musicPreview",
    previewMusicBtn: "#previewMusic",
    customMusicInput: "#customMusicInput",

    // Color elements
    bgColorSelect: "#bgColor",
    colorPicker: "#colorPicker",
    blockColorPicker: "#blockColorPicker",
    colorPickerGroup: "#colorPickerGroup",

    // Tool elements
    rotationGroup: "#rotationGroup",
    rotateLeft: "#rotateLeft",
    rotateRight: "#rotateRight",
    rotationDisplay: "#rotationDisplay",

    // Draft elements
    currentDraftIndicator: "#currentDraftIndicator",
    draftsList: "#draftsList",
  },

  // Get cached element or query and cache it
  getElement(selector) {
    if (!this.elements[selector]) {
      this.elements[selector] = document.querySelector(selector);
    }
    return this.elements[selector];
  },

  // Get element by ID (legacy support)
  getElementById(id) {
    const selector = `#${id}`;
    return this.getElement(selector);
  },

  // Get multiple elements
  getElements(selector) {
    return document.querySelectorAll(selector);
  },

  // Event management
  events: {},

  // Add event listener with optional cleanup tracking
  addEvent(element, event, handler, options = {}) {
    if (typeof element === 'string') {
      element = this.getElement(element);
    }

    if (element) {
      element.addEventListener(event, handler, options);

      // Track for potential cleanup
      const key = `${element.id || element.className || 'unknown'}_${event}`;
      if (!this.events[key]) {
        this.events[key] = [];
      }
      this.events[key].push({ element, event, handler, options });
    }

    return this;
  },

  // Remove event listener
  removeEvent(element, event, handler) {
    if (typeof element === 'string') {
      element = this.getElement(element);
    }

    if (element) {
      element.removeEventListener(event, handler);
    }

    return this;
  },

  // Initialize common elements (call once on app start)
  initializeElements() {
    // Cache all commonly used elements
    Object.keys(this.selectors).forEach(key => {
      const selector = this.selectors[key];
      this.getElement(selector);
    });

    return this;
  },

  // Utility methods for common operations
  setValue(selector, value) {
    const element = this.getElement(selector);
    if (element) {
      element.value = value;
    }
    return this;
  },

  getValue(selector) {
    const element = this.getElement(selector);
    return element ? element.value : '';
  },

  setText(selector, text) {
    const element = this.getElement(selector);
    if (element) {
      element.textContent = text;
    }
    return this;
  },

  setHTML(selector, html) {
    const element = this.getElement(selector);
    if (element) {
      element.innerHTML = html;
    }
    return this;
  },

  showElement(selector) {
    const element = this.getElement(selector);
    if (element) {
      element.style.display = 'block';
    }
    return this;
  },

  hideElement(selector) {
    const element = this.getElement(selector);
    if (element) {
      element.style.display = 'none';
    }
    return this;
  },

  toggleElement(selector, show = null) {
    const element = this.getElement(selector);
    if (element) {
      if (show === null) {
        element.style.display = element.style.display === 'none' ? 'block' : 'none';
      } else {
        element.style.display = show ? 'block' : 'none';
      }
    }
    return this;
  },

  // Cleanup method (for potential future use)
  cleanup() {
    // Clear element cache
    this.elements = {};
    // Note: Event listeners would need manual cleanup if needed
  }
};