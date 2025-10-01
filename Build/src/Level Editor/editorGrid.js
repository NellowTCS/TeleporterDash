import { COLOR_MAP } from "../Utilities/constants";
import { GameState } from "../Utilities/gameState";
import { DOMManager } from "../Utilities/domManager.js";

// Note: EditOperations import is lazy-loaded to avoid circular dependency
let EditOperations = null;

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
    import("./editorEditOperations.js").then(module => {
      EditOperations = module.EditOperations;
      EditOperations.onGridSizeChanged();
    });
  } else {
    EditOperations.onGridSizeChanged();
  }
}

// // Create Initial Grid and Update Dimensions
export function createGrid(grid, onCellChangeCallback = null) {
  grid.innerHTML = "";

  // Set grid dimensions using current GRID_WIDTH and GRID_HEIGHT
  grid.style.setProperty("--grid-width", GameState.current.editor.gridWidth.toString());
  grid.style.setProperty("--grid-height", GameState.current.editor.gridHeight.toString());

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

        if (value) {
          const properties =
            typeof value === "string" ? value.split("/") : [value.toString()];
          const blockType = parseInt(properties[0]);

          // Add base class based on block type
          switch (blockType) {
            case 1:
              cell.classList.add("platform");
              break;
            case 2:
              cell.classList.add("spike");
              break;
            case 3:
              cell.classList.add("teleporter");
              break;
            case 4:
              cell.classList.add("finish");
              break;
          }

          // Process additional properties
          properties.forEach((prop) => {
            if (prop.startsWith("@")) {
              const rotation = parseInt(prop.substring(1));
              cell.style.transform = `rotate(${rotation}deg)`;
            } else if (prop.startsWith("-")) {
              const colorCode = parseInt(prop);
              cell.style.backgroundColor = COLOR_MAP[colorCode] || COLOR_MAP[0];
            }
          });
        }
      }

      cell.addEventListener("mousedown", (e) => {
        GameState.setEditorState({ isMouseDown: true });
        handleCellClick(e, onCellChangeCallback);
      });

      cell.addEventListener("mouseover", (e) => {
        if (GameState.current.editor.isMouseDown) handleCellClick(e, onCellChangeCallback);
      });

      grid.appendChild(cell);
    }
  }

  // Prevent default drag behavior on cells
  grid.addEventListener("dragstart", (e) => e.preventDefault());
  
  GameState.setEditorState({ hasUnsavedChanges: true });
  
  // Notify EditOperations about grid recreation
  if (!EditOperations) {
    import("./editorEditOperations.js").then(module => {
      EditOperations = module.EditOperations;
      EditOperations.onGridRecreated();
    });
  } else {
    EditOperations.onGridRecreated();
  }
}

// // Handle Clicks in Grid
export function handleCellClick(e, onChangeCallback = null) {
  const cell = e.target;
  if (!cell.dataset.row || !cell.dataset.col) return;

  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);

  if (GameState.current.editor.currentTool === "c") {
    if (row === 0) {
      // Only allow color placement in row 0
      updateCell(row, col, GameState.current.editor.selectedColor, onChangeCallback);
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
    if (GameState.current.editor.currentTool === "c") {
      blockValue = "2"; // Platform type
    } else {
      blockValue = GameState.current.editor.currentTool;
    }

    // Add rotation if applicable
    if (GameState.current.editor.currentRotation !== 0) {
      blockValue += `/@${GameState.current.editor.currentRotation}`;
    }

    // Add color if using color tool or if block color is selected
    if (
      (GameState.current.editor.currentTool === "c" ||
        GameState.current.editor.selectedBlockColor !== 0) &&
      GameState.current.editor.currentTool !== "0"
    ) {
      blockValue += `/${
        GameState.current.editor.currentTool === "c"
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
    if (!cell.dataset.row || !cell.dataset.col) return;

    // @ts-ignore
    const row = parseInt(cell.dataset.row);
    // @ts-ignore
    const col = parseInt(cell.dataset.col);

    if (row === 0) {
      // Handle color row
      const colorValue = GameState.current.editor.levelMatrix[0][col] || 0; // Default to 0 if empty
      cell.className = "cell color-row";
      // @ts-ignore
      cell.style.backgroundColor = COLOR_MAP[colorValue];
    } else {
      // Handle game cells
      const value = GameState.current.editor.levelMatrix[row][col];
      cell.className = "cell";

      if (value) {
        const properties =
          typeof value === "string" ? value.split("/") : [value.toString()];
        const blockType = parseInt(properties[0]);

        // Reset styles
        // @ts-ignore
        cell.style.transform = "none";
        // @ts-ignore
        cell.style.backgroundColor = "";

        // Add base class based on block type
        switch (blockType) {
          case 0:
            cell.classList.add("empty");
            break;
          case 1:
            cell.classList.add("platform");
            break;
          case 2:
            cell.classList.add("spike");
            break;
          case 3:
            cell.classList.add("teleporter");
            break;
          case 4:
            cell.classList.add("finish");
            break;
        }

        // Process additional properties
        properties.forEach((prop) => {
          if (prop.startsWith("@")) {
            const rotation = parseInt(prop.substring(1));
            // @ts-ignore
            cell.style.transform = `rotate(${rotation}deg)`;
          } else if (prop.startsWith("-")) {
            const colorCode = parseInt(prop);
            // @ts-ignore
            cell.style.backgroundColor = COLOR_MAP[colorCode] || COLOR_MAP[0];
          }
        });
      } else {
        cell.classList.add("empty");
      }
    }
  });
}

// // Sanitize Matrix
export function sanitizeMatrix(matrix) {
  return matrix.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? 0 : cell))
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
