// Game State Manager for Teleporter Dash
const GameState = {
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
        cameraOffsetY: 0
    },

    // Event Listeners
    listeners: new Map(),

    // Initialize State
    init() {
        // Load saved settings
        const savedSettings = localStorage.getItem('gameSettings');
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
            cameraOffsetY: 0
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
            callbacks.forEach(callback => callback(newValue, oldValue));
        }
    },

    // Check if settings have changed
    hasSettingsChanged(oldState) {
        const settingsKeys = ['gameSpeed', 'visualEffects', 'autoRestart', 'controlMethod', 'volume', 'isMuted'];
        return settingsKeys.some(key => oldState[key] !== this.current[key]);
    },

    // Save settings to localStorage
    saveSettings() {
        const settings = {
            gameSpeed: this.current.gameSpeed,
            visualEffects: this.current.visualEffects,
            autoRestart: this.current.autoRestart,
            controlMethod: this.current.controlMethod,
            volume: this.current.volume,
            isMuted: this.current.isMuted
        };
        localStorage.setItem('gameSettings', JSON.stringify(settings));
    }
};

// Initialize the state manager
GameState.init();