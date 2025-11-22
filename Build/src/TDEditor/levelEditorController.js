// Level Editor: Main Controller
// Coordinates all level editor modules and manages the overall application flow

import { DatabaseManager } from "../Utilities/databaseManager.js";
import { GameState } from "../Utilities/gameState.js";
import { DOMManager } from "../Utilities/domManager.js";

// Import all manager modules
import { ImportExportManager } from "./importExportManager.js";
import { TestManager } from "./testManager.js";
import { MusicManager } from "./musicManager.js";
import { UIManager } from "./uiManager.js";
import { DraftManager } from "./draftManager.js";
import { EditOperations } from "./editorEditOperations.js";
import { PerformanceMonitor } from "./performanceMonitor.js";
import { ErrorHandler } from "./errorHandler.js";

// Import grid and other utilities
import { createGrid, updateGridVisuals, updateGridSize } from "./editorGrid.js";
import { initializeColorPickers } from "./editorColorPicker.js";

// Import tools initialization function
import { initializeEditorTools } from "./editorTools.js";

export class LevelEditorController {
  constructor() {
    this.managers = {
      importExport: null,
      test: null,
      music: null,
      ui: null,
    };

    this.initialize();
  }

  async initialize() {
    const perfMonitor = new PerformanceMonitor();
    perfMonitor.startTimer("levelEditorInitialization");

    try {
      // Wait for DOM to be ready
      await this.waitForDOM();

      // Check for essential elements before proceeding
      const essentialElements = ["#grid", "#levelName", "#exportBtn"];
      const missingElements = essentialElements.filter(
        (sel) => !document.querySelector(sel),
      );

      if (missingElements.length > 0) {
        throw new Error(
          `Missing essential elements: ${missingElements.join(", ")}`,
        );
      }

      // Initialize color pickers
      initializeColorPickers();

      // Initialize editor tools
      initializeEditorTools();

      // Initialize all manager modules with error handling
      try {
        this.managers.importExport = new ImportExportManager();
        this.managers.test = new TestManager();
        this.managers.music = new MusicManager();
        this.managers.ui = new UIManager();
      } catch (managerError) {
        console.error("Manager initialization failed:", managerError);
        throw new Error(
          `Manager initialization failed: ${managerError.message}`,
        );
      }

      // Initialize the grid with change tracking
      this.initializeGrid();

      // Setup remaining event listeners
      this.setupEventListeners();

      // Initialize database and load drafts
      await this.initializeDatabase();

      // Setup global functions for HTML onclick handlers
      this.setupGlobalFunctions();

      const initTime = perfMonitor.endTimer("levelEditorInitialization", true);
      console.log(
        `✅ Level Editor initialized successfully in ${initTime.toFixed(2)}ms`,
      );

      // Start performance monitoring
      perfMonitor.startMonitoring();
    } catch (error) {
      console.error("Failed to initialize Level Editor:", error);
      const errorHandler = new ErrorHandler();
      errorHandler.showError(
        "Initialization Failed",
        `Could not start Level Editor: ${error.message}`,
        "error",
        0, // Don't auto-dismiss
      );
      this.showInitializationError(error);
    }
  }

  initializeGrid() {
    const grid = DOMManager.getElement("#grid");

    // Hook cell changes to edit operations system
    const onCellChange = () => {
      EditOperations.onCellChange();
    };

    createGrid(grid, () => {
      DraftManager.scheduleAutoSaveWrapper.bind(DraftManager)();
      setTimeout(onCellChange, 0); // Defer to allow state update
    });
  }

  async initializeDatabase() {
    try {
      await DatabaseManager.initDB();
      await DraftManager.loadDraftsListWrapper();
    } catch (error) {
      console.error("Failed to initialize database:", error);
      // Don't fail completely if database fails, just log the error
    }
  }

  setupEventListeners() {
    // Draft management
    DOMManager.addEvent("#saveDraftBtn", "click", async () => {
      try {
        await DraftManager.saveDraftWrapper();
        alert("Draft saved successfully!");
        await DraftManager.loadDraftsListWrapper();
      } catch (error) {
        console.error("Error saving draft:", error);
        alert("Failed to save draft: " + error.message);
      }
    });

    // Grid size update
    DOMManager.addEvent("#updateGridSize", "click", () => {
      const gridWidthInput = DOMManager.getElement("#gridWidth");
      const gridHeightInput = DOMManager.getElement("#gridHeight");
      const grid = DOMManager.getElement("#grid");
      updateGridSize(gridWidthInput, gridHeightInput, grid);
    });

    // Draft-related change tracking for clearing draft indicator
    const clearDraftIndicator =
      DraftManager.clearCurrentDraftIndicatorWrapper.bind(DraftManager);
    DOMManager.addEvent("#gridContainer", "click", clearDraftIndicator);
    DOMManager.addEvent("#levelName", "input", clearDraftIndicator);
    DOMManager.addEvent("#authorName", "input", clearDraftIndicator);
    DOMManager.addEvent("#difficulty", "change", clearDraftIndicator);
    DOMManager.addEvent("#musicSelect", "change", clearDraftIndicator);
    DOMManager.addEvent("#customMusicInput", "change", clearDraftIndicator);
  }

  setupGlobalFunctions() {
    // Make functions globally accessible for HTML onclick handlers
    // @ts-ignore - Adding functions to window for HTML onclick handlers
    window.loadDraft = DraftManager.loadDraftWrapper.bind(DraftManager);
    // @ts-ignore - Adding functions to window for HTML onclick handlers
    window.deleteDraft = DraftManager.deleteDraftWrapper.bind(DraftManager);
  }

  showInitializationError(error) {
    const errorMessage = `
      <div style="color: red; padding: 20px; border: 1px solid red; margin: 20px; background: #ffe6e6;">
        <h3>Level Editor Initialization Error</h3>
        <p>The level editor failed to initialize properly:</p>
        <p><strong>${error.message}</strong></p>
        <p>Please refresh the page and try again. If the problem persists, check the browser console for more details.</p>
      </div>
    `;

    document.body.insertAdjacentHTML("afterbegin", errorMessage);
  }

  // ===== Public API =====
  getManager(type) {
    return this.managers[type];
  }

  // ===== DOM Utilities =====
  async waitForDOM() {
    if (document.readyState === "loading") {
      return new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve, { once: true });
      });
    }
    return Promise.resolve();
  }

  // ===== Cleanup =====
  destroy() {
    // Clean up any resources, event listeners, etc.
    Object.values(this.managers).forEach((manager) => {
      if (manager && typeof manager.destroy === "function") {
        manager.destroy();
      }
    });
  }
}
