import { COLOR_MAP } from "../Utilities/constants";
import { DOMManager } from "../Utilities/domManager";
import { gameContainer, obstacles } from "../gameloader";
import { GameState } from "../Utilities/gameState";

let finishLinePosition = 0;
let totalBlocks = 0; // Total number of blocks in the level

/**
 * Creates an obstacle based on the type specified in the level matrix
 * @param {number} type - The type of obstacle (0: empty, 1: platform, 2: spike, 3: teleporter, 4: finish)
 * @param {number} row - The row position in the level matrix
 */
function createObstacleFromMatrix(type, row) {
  // Parse block properties if type is a string (contains properties)
  let blockType = type;
  let blockColor = null;
  let blockRotation = 0;
  if (typeof type === "string") {
    // @ts-ignore
    const properties = type.split("/");
    // First property is always the type
    blockType = parseInt(properties[0]);
    // First property is always the type
    blockType = parseInt(properties[0]);

    // Process other properties
    for (let i = 1; i < properties.length; i++) {
      const prop = properties[i];
      if (prop.startsWith("-")) {
        // Color property (negative number)
        blockColor = COLOR_MAP[parseInt(prop)];
      } else if (prop.startsWith("@")) {
        // Rotation property
        blockRotation = parseInt(prop.substring(1));
      }
    }
  }
  // Handle empty blocks (type 0)
  if (blockType === 0) {
    const emptyBlock = document.createElement("div");
    emptyBlock.className = "empty-block";
    // @ts-ignore
    emptyBlock.type = "empty";
    emptyBlock.style.position = "absolute";
    emptyBlock.style.width = "30px";
    emptyBlock.style.height = "30px";
    emptyBlock.style.left = gameContainer.offsetWidth + "px";

    // Invert the row calculation to start from bottom
    const baseHeight = 50;
    const rowSpacing = 45; // Match platform block height
    const state = GameState.getState();
    const levelHeight = state.levelMatrix ? state.levelMatrix.length : 10; // fallback
    const invertedRow = levelHeight - 1 - row;
    emptyBlock.style.bottom = baseHeight + invertedRow * rowSpacing + "px";

    DOMManager.getElement("#cameraContainer").appendChild(emptyBlock);
    obstacles.push({ element: emptyBlock, type: "empty" });
    return;
  }

  // Create obstacle element based on type
  const obstacle = document.createElement("div");

  if (blockType === 4) {
    // Finish line
    obstacle.className = "finishLine";
    obstacle.style.width = "10px";
    obstacle.style.height = "350px";
    obstacle.style.background = "#00ff00";
    // @ts-ignore
    obstacle.type = "finish";
    obstacle.style.position = "absolute";
    obstacle.style.bottom = "50px"; // Align with ground
  } else if (blockType === 2) {
    // Spike
    obstacle.className = "spike";
    // @ts-ignore
    obstacle.type = "spike";
  } else if (blockType === 3) {
    // Teleporter
    obstacle.className = "teleporter";
    // @ts-ignore
    obstacle.type = "teleporter";
    obstacle.style.width = "30px";
    obstacle.style.height = "60px";
    obstacle.style.background = "linear-gradient(to right, #ff00ff, #8c00ff)";
    obstacle.style.borderRadius = "15px";
    obstacle.style.animation = "glow 1s infinite alternate";

    // Extract rotation if it exists
    // @ts-ignore
    if (typeof type === "string" && type.includes("@")) {
      // @ts-ignore
      const rotation = type.split("@")[1];
      obstacle.setAttribute("data-rotation", rotation);
    }
  } else if (blockType === 1) {
    // Platform
    obstacle.className = "platform";
    // @ts-ignore
    obstacle.type = "platform";
    obstacle.style.width = "45px";
    obstacle.style.height = "45px";
  }

  // Apply color if specified
  if (blockColor) {
    if (blockType === 2) {
      // For spikes
      obstacle.style.borderBottomColor = blockColor;
    } else {
      obstacle.style.backgroundColor = blockColor;
    }
  }

  // Apply rotation if specified
  if (blockRotation !== 0) {
    obstacle.style.transform = `rotate(${blockRotation}deg)`;
  }

  // Position the obstacle
  obstacle.style.left = gameContainer.offsetWidth + "px";

  // Calculate vertical position (inverted row calculation)
  const baseHeight = 50;
  const rowSpacing = 45; // Match platform block height
  const state = GameState.getState();
  const levelHeight = state.levelMatrix ? state.levelMatrix.length : 10; // fallback
  const invertedRow = levelHeight - 1 - row;
  obstacle.style.bottom = baseHeight + invertedRow * rowSpacing + "px";

  DOMManager.getElement("#cameraContainer").appendChild(obstacle);
  // @ts-ignore
  obstacles.push({ element: obstacle, type: obstacle.type });
}

/**
 * Level data validation
 * @throws {Error} If validation fails
 */
function validateLevelData(matrix) {
  if (!matrix || !Array.isArray(matrix)) {
    throw new Error("Invalid level data: matrix must be an array");
  }

  if (matrix.length < 2) {
    throw new Error("Invalid level data: matrix must have at least 2 rows");
  }

  const width = matrix[0].length;
  if (width === 0) {
    throw new Error("Invalid level data: matrix rows cannot be empty");
  }

  // Validate first row (color codes)
  const colorRow = matrix[0];
  colorRow.forEach((code, index) => {
    if (typeof code === "string") {
      const props = code.split("/");
      // First property is always the type

      const blockType = parseInt(props[0]);

      // Process other properties
      for (let i = 1; i < props.length; i++) {
        const prop = props[i];
        if (prop.startsWith("-")) {
          // Color property (negative number)

          const blockColor = COLOR_MAP[parseInt(prop)];
        } else if (prop.startsWith("@")) {
          // Rotation property

          const blockRotation = parseInt(prop.substring(1));
        }
      }
    } else if (code < 0 && !COLOR_MAP[code]) {
      throw new Error(
        `Invalid color code ${code} at position ${index} in color row`,
      );
    }
  });

  // Validate level rows
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (row.length !== width) {
      throw new Error(
        `Invalid level data: row ${i} has different width than first row`,
      );
    }

    row.forEach((block, j) => {
      if (typeof block === "string") {
        const props = block.split("/");
        // First property is always the type
        block = parseInt(props[0]);

        // Process other properties
        for (let i = 1; i < props.length; i++) {
          const prop = props[i];
          if (prop.startsWith("-")) {
            // Color property (negative number)
            const colorCode = parseInt(prop);
            if (!COLOR_MAP[colorCode]) {
              throw new Error(
                `Invalid color code ${prop} at position [${i},${j}]`,
              );
            }
          } else if (prop.startsWith("@")) {
            // Rotation property
            const rotation = parseInt(prop.substring(1));
            if (![0, 90, 180, 270].includes(rotation)) {
              throw new Error(
                `Invalid rotation ${prop} at position [${i},${j}]`,
              );
            }
          } else {
            throw new Error(
              `Invalid block property ${prop} at position [${i},${j}]`,
            );
          }
        }
      } else if (typeof block !== "number" || block < 0 || block > 4) {
        throw new Error(`Invalid block type ${block} at position [${i},${j}]`);
      }
    });
  }

  return true;
}

/**
 * Calculates the total number of blocks in the level
 * Used for progress tracking and level completion
 */
// @ts-ignore
function calculateTotalBlocks() {
  const state = GameState.getState();
  if (!state.levelMatrix || state.levelMatrix.length === 0) return;

  // Search for finish line in level matrix
  finishLinePosition = 0;
  for (let col = 0; col < state.levelMatrix[0].length; col++) {
    for (let row = 0; row < state.levelMatrix.length; row++) {
      if (state.levelMatrix[row][col] === 4) {
        // 4 represents finish line
        finishLinePosition = col;
        break;
      }
    }
    if (finishLinePosition > 0) break;
  }

  // Calculate total blocks up to finish line
  totalBlocks = finishLinePosition * state.levelMatrix.length;
  if (totalBlocks === 0) {
    console.error("No finish line found in level matrix!");
    totalBlocks = state.levelMatrix[0].length * state.levelMatrix.length; // Fallback calculation
  }
}

export { createObstacleFromMatrix, validateLevelData, calculateTotalBlocks };
