import { COLOR_MAP } from "../Utilities/constants.js";
import { GameState } from "../Utilities/gameState.js";
import { DOMManager } from "../Utilities/domManager.js";
import { PerformanceMonitor } from "./performanceMonitor.js";
import { blockRegistry, parseCellValue } from "../TDEngine/blockRegistry.js";

// Note: EditOperations import is lazy-loaded to avoid circular dependency
let EditOperations = null;

function applyBlockStyling(cell, parsedValue) {
  const definition =
    blockRegistry.getDefinitionByMatrixValue(parsedValue.matrixValue) ||
    blockRegistry.getDefinition("empty");
  const blockType = definition?.type || "empty";
  const editorConfig = blockRegistry.getEditorConfig(blockType) || {};
  const className = editorConfig.className || blockType;

  if (className) {
    cell.classList.add(className);
  }

  if (parsedValue.rotation) {
    cell.style.transform = `rotate(${parsedValue.rotation}deg)`;
  } else {
    cell.style.transform = "none";
  }

  cell.style.backgroundColor = parsedValue.color || "";
}

// ===== Grid ====
// // Update Grid Size
export function updateGridSize(gridWidthInput, gridHeightInput, grid) {
  const width = parseInt(gridWidthInput.value) || 100;
  const height = parseInt(gridHeightInput.value) || 12;
  if (
    height < GameState.current.editor.gridHeight &&
    !confirm("Reducing the height will remove some rows. Continue?")
  ) {
    return;
  }

  GameState.setEditorState({
    gridWidth: width,
    gridHeight: height,
  });

  createGrid(grid);
  updateGridVisuals();

  // Notify EditOperations about grid size change
  if (!EditOperations) {
    import("./editorEditOperations.js").then((module) => {
      EditOperations = module.EditOperations;
      EditOperations.onGridSizeChanged();
    });
  } else {
    EditOperations.onGridSizeChanged();
  }
}

// // Create Initial Grid and Update Dimensions
export function createGrid(grid, onCellChangeCallback = null) {
  const perfMonitor = new PerformanceMonitor();
  perfMonitor.startTimer("gridCreation");

  grid.innerHTML = "";

  // Set grid dimensions using current GRID_WIDTH and GRID_HEIGHT
  grid.style.setProperty(
    "--grid-width",
    GameState.current.editor.gridWidth.toString(),
  );
  grid.style.setProperty(
    "--grid-height",
    GameState.current.editor.gridHeight.toString(),
  );

  // Create the actual grid cells
  for (let row = 0; row < GameState.current.editor.gridHeight; row++) {
    for (let col = 0; col < GameState.current.editor.gridWidth; col++) {
      const cell = document.createElement("div");
      cell.dataset.row = row.toString();
      cell.dataset.col = col.toString();

      // Set initial cell state based on matrix
      const value = GameState.current.editor.levelMatrix[row][col];

      if (row === 0) {
        // Handle color row
        const colorValue = GameState.current.editor.levelMatrix[0][col] || 0; // Default to 0 if empty
        cell.className = "cell color-row";
        cell.style.backgroundColor = COLOR_MAP[colorValue];
      } else {
        // Handle game cells
        cell.className = "cell";
        const parsedBlock = parseCellValue(value);
        applyBlockStyling(cell, parsedBlock);
      }

      cell.addEventListener("mousedown", (e) => {
        GameState.setEditorState({ isMouseDown: true });
        handleCellClick(e, onCellChangeCallback);
      });

      cell.addEventListener("mouseover", (e) => {
        if (GameState.current.editor.isMouseDown)
          handleCellClick(e, onCellChangeCallback);
      });

      grid.appendChild(cell);
    }
  }

  // Prevent default drag behavior on cells
  grid.addEventListener("dragstart", (e) => e.preventDefault());

  GameState.setEditorState({ hasUnsavedChanges: true });

  // Notify EditOperations about grid recreation
  if (!EditOperations) {
    import("./editorEditOperations.js").then((module) => {
      EditOperations = module.EditOperations;
      EditOperations.onGridRecreated();
    });
  } else {
    EditOperations.onGridRecreated();
  }

  const gridTime = perfMonitor.endTimer("gridCreation");
  if (gridTime > 100) {
    // Log if grid creation takes more than 100ms
    console.log(
      `⚠️ Grid creation took ${gridTime.toFixed(2)}ms for ${GameState.current.editor.gridWidth}x${GameState.current.editor.gridHeight} grid`,
    );
  }
}

// // Handle Clicks in Grid
export function handleCellClick(e, onChangeCallback = null) {
  const cell = e.target;
  if (!cell.dataset.row || !cell.dataset.col) return;

  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);
  const currentTool = GameState.current.editor.currentTool;

  // Selection tool never modifies the grid directly
  if (currentTool === "select") {
    return;
  }

  if (currentTool === "c") {
    if (row === 0) {
      // Only allow color placement in row 0
      updateCell(
        row,
        col,
        GameState.current.editor.selectedColor,
        onChangeCallback,
      );
      cell.style.backgroundColor =
        COLOR_MAP[GameState.current.editor.selectedColor];
      cell.style.opacity = "1";
    }
    return; // Don't allow color tool to place anything outside row 0
  } else if (row === 0) {
    return;
  } else {
    // Build block properties string
    let blockValue;

    // If using color tool, treat it as a platform (2) with color
    if (currentTool === "c") {
      blockValue = "2"; // Platform type
    } else {
      blockValue = currentTool;
    }

    // Add rotation if applicable
    if (GameState.current.editor.currentRotation !== 0) {
      blockValue += `/@${GameState.current.editor.currentRotation}`;
    }

    // Add color if using color tool or if block color is selected
    if (
      (GameState.current.editor.currentTool === "c" ||
        GameState.current.editor.selectedBlockColor !== 0) &&
      currentTool !== "0"
    ) {
      blockValue += `/${currentTool === "c"
          ? GameState.current.editor.selectedColor
          : GameState.current.editor.selectedBlockColor
        }`;
    }

    updateCell(row, col, blockValue, onChangeCallback);
  }
}

// // Update Grid
export function updateGridVisuals() {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => {
    // @ts-ignore
    if (!cell.dataset.row || !cell.dataset.col) {
      return;
    }

    // @ts-ignore
    const row = parseInt(cell.dataset.row, 10);
    // @ts-ignore
    const col = parseInt(cell.dataset.col, 10);

    if (row === 0) {
      const colorValue = GameState.current.editor.levelMatrix[0][col] || 0;
      cell.className = "cell color-row";
      // @ts-ignore
      cell.style.backgroundColor = COLOR_MAP[colorValue];
      return;
    }

    const value = GameState.current.editor.levelMatrix[row][col];
    cell.className = "cell";
    const parsedBlock = parseCellValue(value);
    applyBlockStyling(cell, parsedBlock);
  });
}

// // Sanitize Matrix
export function sanitizeMatrix(matrix) {
  return matrix.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? 0 : cell)),
  );
}

// // Update Cell
export function updateCell(row, col, value, onChangeCallback = null) {
  const newMatrix = [...GameState.current.editor.levelMatrix];
  newMatrix[row][col] = value;
  GameState.setEditorState({ levelMatrix: newMatrix, hasUnsavedChanges: true });
  updateGridVisuals();
  if (onChangeCallback) onChangeCallback();
}
