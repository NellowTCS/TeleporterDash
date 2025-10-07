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

    // Menu elements
    menuMusic: "#menu-music",
    volumeSlider: "#volumeSlider",
    volumeLabel: "#volume-label",
    builtInLevelTemplate: "#built-in-level-template",
    onlineLevelTemplate: "#online-level-template",
    levelDisplayTemplate: "#level-display-template",
    menu: ".menu",
    levelSelector: ".level-selector",

    // Game elements
    gameContainer: "#gameContainer",
    player: "#player",
    cameraContainer: "#cameraContainer",
    progressText: "#progressText",
    progressFill: "#progressFill",
    pauseMenu: "#pauseMenu",
    levelComplete: "#levelComplete",
    gameOver: "#gameOver",
    muteButton: "#muteButton",
    nextLevelBtn: "#nextLevelBtn",
    heightIndicator: "#heightIndicator",
    playerIndicator: "#playerIndicator",
    settingsMenu: "#settingsMenu",
    volumeValue: "#volumeValue",

    // Level store elements
    levelGrid: "#levelGrid",

    // Game engine elements
    scoreboard: "#scoreboard",
    menuScoreboard: "#menuScoreboard",
    gameSpeed: "#gameSpeed",
  },

  // Get cached element or query and cache it
  getElement(selector) {
    if (this.elements[selector] !== undefined) {
      return this.elements[selector];
    }

    const element = document.querySelector(selector);
    if (element) {
      this.elements[selector] = element;
      return element;
    } else {
      // Don't cache null, so it can be retried later
      return null;
    }
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
  addEvent(selector, event, handler, options = {}) {
    const element = this.getElement(selector);
    if (element) {
      element.addEventListener(event, handler, options);
      return true;
    } else {
      console.warn(`Cannot add event ${event} to missing element: ${selector}`);
    }
    return false;
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

  // Utility methods for common operations
  setValue(selector, value) {
    const element = this.getElement(selector);
    if (element) {
      element.value = value;
    } else {
      console.warn(`Cannot set value on missing element: ${selector}`);
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