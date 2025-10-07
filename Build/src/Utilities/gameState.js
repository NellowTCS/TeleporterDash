// Game State Manager for Teleporter Dash
export const GameState = {
  // Current State
  current: {
    isLevelStarted: false,
    isPracticeMode: false,
    isGameOver: false,
    isPaused: false,
    isLevelComplete: false,
    isMuted: false,
    isRestarting: false,

    // Level Info
    levelId: null,
    levelTitle: "",
    levelAuthor: "",
    levelDifficulty: "Normal",
    levelMusic: null,
    levelMatrix: [],
    levelColorRow: [],

    // Game Settings
    gameSpeed: 4,
    visualEffects: true,
    autoRestart: false,
    controlMethod: "both",
    volume: 90,

    // Player State
    playerVelocity: 0,
    isJumping: false,
    doubleJumpAvailable: true,
    isOnPlatform: false,
    rotation: 0,

    // Progress
    currentColumn: 0,
    passedBlocks: 0,
    totalBlocks: 0,
    jumpCount: 0,
    deathCount: 0,
    startTime: 0,
    currentTime: 0,

    // Camera
    cameraOffsetY: 0,
    // Editor State
    editor: {
      // Grid
      gridWidth: 100,
      gridHeight: 12,
      levelMatrix: [],

      // Tools
      currentTool: "select",
      currentRotation: 0,
      selectedColor: -1, // Default to blue
      selectedBlockColor: 0,

      // UI State
      hasUnsavedChanges: false,
      hasMatrixChanged: false,
      lastExportedMatrix: null,

      // Draft Management
      currentDraftId: null,

      // Music
      customMusicFile: null,
      musicData: null,

      // Other
      nextLevelId: 0,
      isMouseDown: false,
      lastToolBeforeColor: "1",
    },
  },

  // Event Listeners
  listeners: new Map(),

  // Initialize State
  init() {
    // Initialize editor state
    this.current.editor.levelMatrix = Array(this.current.editor.gridHeight)
      .fill()
      .map(() => Array(this.current.editor.gridWidth).fill(0));

    // Load saved settings
    const savedSettings = localStorage.getItem("gameSettings");
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      this.current.gameSpeed = settings.gameSpeed || 4;
      this.current.visualEffects = settings.visualEffects ?? true;
      this.current.autoRestart = settings.autoRestart || false;
      this.current.controlMethod = settings.controlMethod || "both";
      this.current.volume = settings.volume || 90;
      this.current.isMuted = settings.isMuted || false;
    }
  },

  // Update State
  setState(updates) {
    const oldState = { ...this.current };
    Object.assign(this.current, updates);

    // Notify listeners of state changes
    for (const [key, value] of Object.entries(updates)) {
      if (value !== oldState[key]) {
        this.notifyListeners(key, value, oldState[key]);
      }
    }

    // Save settings if they change
    if (this.hasSettingsChanged(oldState)) {
      this.saveSettings();
    }
  },

  // Get State
  getState() {
    return { ...this.current };
  },

  // Reset State
  reset() {
    this.setState({
      isLevelStarted: false,
      isGameOver: false,
      isPaused: false,
      isLevelComplete: false,
      isRestarting: false,
      playerVelocity: 0,
      isJumping: false,
      doubleJumpAvailable: true,
      isOnPlatform: false,
      rotation: 0,
      currentColumn: 0,
      passedBlocks: 0,
      jumpCount: 0,
      deathCount: 0,
      startTime: 0,
      currentTime: 0,
      cameraOffsetY: 0,
    });
  },

  // Subscribe to state changes
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  },

  // Notify listeners of state changes
  notifyListeners(key, newValue, oldValue) {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach((callback) => callback(newValue, oldValue));
    }
  },

  // Check if settings have changed
  hasSettingsChanged(oldState) {
    const settingsKeys = [
      "gameSpeed",
      "visualEffects",
      "autoRestart",
      "controlMethod",
      "volume",
      "isMuted",
    ];
    return settingsKeys.some((key) => oldState[key] !== this.current[key]);
  },

  // Save settings to localStorage
  saveSettings() {
    const settings = {
      gameSpeed: this.current.gameSpeed,
      visualEffects: this.current.visualEffects,
      autoRestart: this.current.autoRestart,
      controlMethod: this.current.controlMethod,
      volume: this.current.volume,
      isMuted: this.current.isMuted,
    };
    localStorage.setItem("gameSettings", JSON.stringify(settings));
  },

  // Editor State Methods
  setEditorState(updates) {
    const oldState = { ...this.current.editor };
    Object.assign(this.current.editor, updates);

    // Special handling for grid size changes
    if (updates.gridWidth || updates.gridHeight) {
      this.updateEditorGrid();
    }

    // Notify listeners of editor state changes
    for (const [key, value] of Object.entries(updates)) {
      if (value !== oldState[key]) {
        this.notifyListeners(`editor.${key}`, value, oldState[key]);
      }
    }
  },

  getEditorState() {
    return { ...this.current.editor };
  },

  updateEditorGrid() {
    const { gridWidth, gridHeight, levelMatrix } = this.current.editor;
    const oldColorRow = levelMatrix[0] || Array(gridWidth).fill(0);

    const newMatrix = Array(gridHeight)
      .fill()
      .map((_, row) => {
        if (row < levelMatrix.length) {
          const existingRow = levelMatrix[row] || [];
          return Array(gridWidth)
            .fill(0)
            .map((_, col) => (col < existingRow.length ? existingRow[col] : 0));
        } else {
          return Array(gridWidth).fill(0);
        }
      });

    // Preserve color row
    newMatrix[0] = Array(gridWidth)
      .fill(0)
      .map((_, col) => (col < oldColorRow.length ? oldColorRow[col] : 0));

    this.current.editor.levelMatrix = newMatrix;
  },

  resetEditorState() {
    this.setEditorState({
      currentTool: "select",
      currentRotation: 0,
      selectedColor: -1,
      selectedBlockColor: 0,
      hasUnsavedChanges: false,
      hasMatrixChanged: false,
      lastExportedMatrix: null,
      currentDraftId: null,
      customMusicFile: null,
      musicData: null,
      isMouseDown: false,
    });

    // Reset grid
    this.current.editor.levelMatrix = Array(this.current.editor.gridHeight)
      .fill()
      .map(() => Array(this.current.editor.gridWidth).fill(0));
  },
};

// Initialize the state manager
GameState.init();
