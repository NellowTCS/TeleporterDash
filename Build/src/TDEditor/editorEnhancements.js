// Editor UI Enhancements
// Minimap, status bar updates, and other UI improvements

import { GameState } from "../Utilities/gameState.js";
import { blockRegistry, parseCellValue } from "../TDEngine/blockRegistry.js";

// ===== Minimap System =====
class MinimapManager {
  constructor() {
    /** @type {HTMLCanvasElement|null} */
    this.canvas = null;
    /** @type {CanvasRenderingContext2D|null} */
    this.ctx = null;
    /** @type {HTMLElement|null} */
    this.viewport = null;
    /** @type {HTMLElement|null} */
    this.container = null;
    /** @type {HTMLElement|null} */
    this.gridContainer = null;
    this.scale = 2; // pixels per cell
    this.updateScheduled = false;
  }

  initialize() {
    // @ts-ignore
    this.canvas = document.getElementById("minimapCanvas");
    this.viewport = document.getElementById("minimapViewport");
    this.container = document.getElementById("minimapContainer");
    this.gridContainer = document.getElementById("gridContainer");

    if (!this.canvas || !this.container) return;

    this.ctx = this.canvas.getContext("2d");

    // Set up scroll listener to update viewport indicator
    if (this.gridContainer) {
      this.gridContainer.addEventListener("scroll", () => this.updateViewport());
      // Also handle resize
      new ResizeObserver(() => this.scheduleUpdate()).observe(this.gridContainer);
    }

    // Initial render
    this.scheduleUpdate();
  }

  scheduleUpdate() {
    if (this.updateScheduled) return;
    this.updateScheduled = true;
    requestAnimationFrame(() => {
      this.render();
      this.updateScheduled = false;
    });
  }

  render() {
    if (!this.ctx || !this.canvas) return;

    const matrix = GameState.current.editor.levelMatrix;
    if (!matrix || !matrix.length) return;

    const gridWidth = GameState.current.editor.gridWidth;
    const gridHeight = GameState.current.editor.gridHeight;

    // Calculate optimal scale
    const maxWidth = 200;
    const maxHeight = 80;
    this.scale = Math.min(
      maxWidth / gridWidth,
      maxHeight / gridHeight,
      4 // max scale
    );

    // Update canvas size
    this.canvas.width = Math.ceil(gridWidth * this.scale);
    this.canvas.height = Math.ceil(gridHeight * this.scale);

    // Clear
    this.ctx.fillStyle = "#0d1117";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw cells
    for (let row = 0; row < Math.min(matrix.length, gridHeight); row++) {
      for (let col = 0; col < Math.min(matrix[row]?.length || 0, gridWidth); col++) {
        const cellValue = matrix[row][col];
        const parsed = parseCellValue(cellValue);
        const definition = blockRegistry.getDefinitionByMatrixValue(parsed.matrixValue);

        if (!definition || definition.type === "empty") continue;

        // Get color
        let color = parsed.color || definition.defaultColor || "#888";

        // Draw cell
        const x = col * this.scale;
        const y = row * this.scale;

        this.ctx.fillStyle = color;

        if (definition.type === "spike") {
          // Draw triangle for spike
          this.ctx.beginPath();
          this.ctx.moveTo(x + this.scale / 2, y);
          this.ctx.lineTo(x, y + this.scale);
          this.ctx.lineTo(x + this.scale, y + this.scale);
          this.ctx.closePath();
          this.ctx.fill();
        } else {
          this.ctx.fillRect(x, y, this.scale, this.scale);
        }
      }
    }

    this.updateViewport();
  }

  updateViewport() {
    if (!this.viewport || !this.gridContainer || !this.container) return;

    const gridWidth = GameState.current.editor.gridWidth;
    const gridHeight = GameState.current.editor.gridHeight;
    const gridScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-scale') || '1');
    const cellSize = 40 * gridScale;

    const totalWidth = gridWidth * cellSize;
    const totalHeight = gridHeight * cellSize;

    const viewportWidth = this.gridContainer.clientWidth;
    const viewportHeight = this.gridContainer.clientHeight;
    const scrollLeft = this.gridContainer.scrollLeft;
    const scrollTop = this.gridContainer.scrollTop;

    // Calculate viewport position on minimap
    const scaleX = this.canvas.width / totalWidth;
    const scaleY = this.canvas.height / totalHeight;

    const vpX = scrollLeft * scaleX + 8; // 8 = minimap padding
    const vpY = scrollTop * scaleY + 8;
    const vpW = viewportWidth * scaleX;
    const vpH = viewportHeight * scaleY;

    this.viewport.style.left = `${vpX}px`;
    this.viewport.style.top = `${vpY}px`;
    this.viewport.style.width = `${Math.min(vpW, this.canvas.width)}px`;
    this.viewport.style.height = `${Math.min(vpH, this.canvas.height)}px`;
  }
}

// ===== Status Bar Manager =====
class StatusBarManager {
  constructor() {
    this.statusTool = null;
    this.statusPosition = null;
    this.statusSelection = null;
    this.lastPosition = { row: -1, col: -1 };
  }

  initialize() {
    this.statusTool = document.getElementById("statusTool");
    this.statusPosition = document.getElementById("statusPosition");
    this.statusSelection = document.getElementById("statusSelection");

    // Set up grid hover listener
    const grid = document.getElementById("grid");
    if (grid) {
      grid.addEventListener("mousemove", (e) => this.onGridHover(e));
      grid.addEventListener("mouseleave", () => this.clearPosition());
    }
  }

  onGridHover(e) {
    const cell = e.target;
    if (!cell.classList.contains("cell")) return;

    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);

    if (row === this.lastPosition.row && col === this.lastPosition.col) return;

    this.lastPosition = { row, col };
    this.updatePosition(row, col);
  }

  updatePosition(row, col) {
    if (this.statusPosition) {
      this.statusPosition.innerHTML = `<i class="fas fa-crosshairs"></i> Row: ${row} Col: ${col}`;
    }
  }

  clearPosition() {
    this.lastPosition = { row: -1, col: -1 };
    if (this.statusPosition) {
      this.statusPosition.innerHTML = `<i class="fas fa-crosshairs"></i> Row: - Col: -`;
    }
  }

  updateSelection(width, height) {
    if (this.statusSelection) {
      if (width > 0 && height > 0) {
        this.statusSelection.style.display = "inline";
        this.statusSelection.innerHTML = `<i class="fas fa-vector-square"></i> Selection: ${width}×${height}`;
      } else {
        this.statusSelection.style.display = "none";
      }
    }
  }
}

// ===== Keyboard Shortcuts Display =====
function setupKeyboardShortcutHints() {
  // Add F5 for test
  document.addEventListener("keydown", (e) => {
    if (e.key === "F5") {
      e.preventDefault();
      document.getElementById("testBtn")?.click();
    }
    if (e.key === "Escape") {
      document.getElementById("backToMenuBtn")?.click();
    }
  });
}

// ===== Initialize All Enhancements =====
const minimap = new MinimapManager();
const statusBar = new StatusBarManager();

export function initializeEnhancements() {
  minimap.initialize();
  statusBar.initialize();
  setupKeyboardShortcutHints();
}

export function updateMinimap() {
  minimap.scheduleUpdate();
}

export function updateSelectionStatus(width, height) {
  statusBar.updateSelection(width, height);
}

export { minimap, statusBar };
