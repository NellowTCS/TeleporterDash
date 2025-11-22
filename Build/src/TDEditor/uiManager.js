// Level Editor: UI Manager
// Handles UI state, navigation, zoom controls, and general interface management

import { GameState } from "../Utilities/gameState.js";
import { DOMManager } from "../Utilities/domManager.js";
import { createGrid } from "./editorGrid.js";

export class UIManager {
  constructor() {
    this.currentGridZoom = 1.0;
    this.gridZoomMin = 0.25;
    this.gridZoomMax = 3.0;
    this.gridZoomStep = 0.25;

    this.currentPageZoom = 0.8; // Default to 80% for better overview
    this.pageZoomMin = 0.5;
    this.pageZoomMax = 1.5;
    this.pageZoomStep = 0.1;

    this.setupEventListeners();
    this.initializeZoom();
  }

  // ===== Zoom Controls =====
  initializeZoom() {
    this.updateGridZoomDisplay();
    this.updatePageZoom();
  }

  updateGridZoomDisplay() {
    const percentage = Math.round(this.currentGridZoom * 100);
    const gridZoomLevelDisplay = DOMManager.getElement("#gridZoomLevel");
    if (gridZoomLevelDisplay) {
      gridZoomLevelDisplay.textContent = `${percentage}%`;
    }
    document.documentElement.style.setProperty(
      "--grid-scale",
      this.currentGridZoom.toString(),
    );
  }

  updatePageZoom() {
    document.documentElement.style.setProperty(
      "--page-zoom",
      this.currentPageZoom.toString(),
    );
  }

  gridZoomIn() {
    if (this.currentGridZoom < this.gridZoomMax) {
      this.currentGridZoom = Math.min(
        this.currentGridZoom + this.gridZoomStep,
        this.gridZoomMax,
      );
      this.updateGridZoomDisplay();
    }
  }

  gridZoomOut() {
    if (this.currentGridZoom > this.gridZoomMin) {
      this.currentGridZoom = Math.max(
        this.currentGridZoom - this.gridZoomStep,
        this.gridZoomMin,
      );
      this.updateGridZoomDisplay();
    }
  }

  resetGridZoom() {
    this.currentGridZoom = 1.0;
    this.updateGridZoomDisplay();
  }

  pageZoomIn() {
    if (this.currentPageZoom < this.pageZoomMax) {
      this.currentPageZoom = Math.min(
        this.currentPageZoom + this.pageZoomStep,
        this.pageZoomMax,
      );
      this.updatePageZoom();
    }
  }

  pageZoomOut() {
    if (this.currentPageZoom > this.pageZoomMin) {
      this.currentPageZoom = Math.max(
        this.currentPageZoom - this.pageZoomStep,
        this.pageZoomMin,
      );
      this.updatePageZoom();
    }
  }

  resetPageZoom() {
    this.currentPageZoom = 1.0;
    this.updatePageZoom();
  }

  // ===== Navigation =====
  handleBackToMenu() {
    if (GameState.current.editor.hasUnsavedChanges) {
      if (
        confirm("You have unsaved changes. Are you sure you want to leave?")
      ) {
        window.location.href = "./index.html";
      }
    } else {
      window.location.href = "./index.html";
    }
  }

  // ===== Grid Management =====
  clearGrid() {
    if (confirm("Are you sure you want to clear the grid?")) {
      GameState.resetEditorState();
      const grid = DOMManager.getElement("#grid");
      createGrid(grid); // This will properly reset all cells
    }
  }

  // ===== Keyboard Shortcuts =====
  handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        this.gridZoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        this.gridZoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        this.resetGridZoom();
      }
    } else if (e.shiftKey) {
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        this.pageZoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        this.pageZoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        this.resetPageZoom();
      }
    }
  }

  // ===== Unsaved Changes Warning =====
  handleBeforeUnload(e) {
    if (GameState.current.editor.hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue =
        "You have unsaved changes. Are you sure you want to leave?";
    }
  }

  // ===== Event Listeners =====
  setupEventListeners() {
    // Grid zoom controls
    DOMManager.addEvent("#gridZoomIn", "click", () => this.gridZoomIn());
    DOMManager.addEvent("#gridZoomOut", "click", () => this.gridZoomOut());
    DOMManager.addEvent("#gridZoomReset", "click", () => this.resetGridZoom());

    // Clear grid
    DOMManager.addEvent("#clearBtn", "click", () => this.clearGrid());

    // Back to menu
    DOMManager.addEvent("#backToMenuBtn", "click", () =>
      this.handleBackToMenu(),
    );

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) =>
      this.handleKeyboardShortcuts(e),
    );

    // Stop drawing when mouse is released globally
    document.addEventListener("mouseup", () => {
      GameState.setEditorState({ isMouseDown: false });
    });

    // Unsaved changes warning
    window.addEventListener("beforeunload", (e) => this.handleBeforeUnload(e));
  }
}
