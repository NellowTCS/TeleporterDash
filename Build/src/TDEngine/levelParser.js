import { COLOR_MAP, CONSTANTS } from "../Utilities/constants.js";
import { DOMManager } from "../Utilities/domManager.js";
import { GameState } from "../Utilities/gameState.js";
import { createObstacleElement } from "./renderEngine.js";

const obstaclePool = [];
//@ts-ignore
window.TDObstaclePool = window.TDObstaclePool || {
  acquire(proto) {
    if (!obstaclePool.length) return null;
    const ob = obstaclePool.pop();

    // Update basic properties
    ob.x = typeof proto.x === "number" ? proto.x : ob.x;
    ob.y = typeof proto.y === "number" ? proto.y : ob.y;
    ob.width = typeof proto.width === "number" ? proto.width : ob.width;
    ob.height = typeof proto.height === "number" ? proto.height : ob.height;
    ob.type = proto.type || ob.type;
    ob.rotation = typeof proto.rotation === "number" ? proto.rotation : ob.rotation;
    ob.color = proto.color || ob.color;
    ob.meta = proto.meta || ob.meta;

    // Ensure element is visible and updated to match type/size/color
    const el = ob.element;
    if (!el) return null;

    el.style.display = "";
    const w = Math.round(ob.width || 30);
    const h = Math.round(ob.height || 30);

    // Update geometry and class depending on type
    if (ob.type === "spike") {
      const half = Math.round(w / 2);
      el.style.width = `0px`;
      el.style.height = `0px`;
      el.style.borderLeft = `${half}px solid transparent`;
      el.style.borderRight = `${half}px solid transparent`;
      el.style.borderBottom = `${h}px solid ${ob.color || "red"}`;
      el.style.transformOrigin = "center bottom";
      el.className = "spike";
    } else {
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.borderLeft = "";
      el.style.borderRight = "";
      el.style.borderBottom = "";
      el.className = ob.type === "finish" ? "finishLine" : ob.type === "teleporter" ? "teleporter" : ob.type === "platform" ? "platform" : "empty-block";
      if (ob.type === "finish") el.style.background = ob.color || "#00ff00";
      else if (ob.type === "teleporter") {
        // teleporter: keep background but ensure radial glow child exists & updated
        el.style.background = ob.background || "linear-gradient(to right, #ff00ff, #8c00ff)";
        // ensure glow child exists, create if missing (renderEngine helper is not available here, so safe-create)
        let glow = el.querySelector(".teleporter-glow");
        if (!glow) {
          glow = document.createElement("div");
          glow.className = "teleporter-glow";
          glow.style.position = "absolute";
          glow.style.left = "0";
          glow.style.bottom = "0";
          glow.style.width = "100%";
          glow.style.height = "100%";
          glow.style.pointerEvents = "none";
          glow.style.zIndex = "0";
          glow.style.borderRadius = "inherit";
          glow.style.willChange = "transform, opacity";
          el.appendChild(glow);
        }
        const c = ob.color || "#ff00ff";
        glow.style.background = `radial-gradient(circle at 50% 50%, ${c} 0%, rgba(0,0,0,0) 60%)`;
        el.style.borderRadius = "15px";
      } else if (ob.type === "platform") {
        if (ob.color) el.style.background = ob.color;
        else el.style.background = "";
      } else if (ob.type === "empty") {
        el.style.background = "transparent";
      }
    }

    // Ensure rotation is applied (render pass will override transform with translate+rotate)
    if (typeof ob.rotation === "number") {
      // set rotation as a base so initial render doesn't show wrong; render loop will combine translation+rotation.
      el.style.transform = `rotate(${ob.rotation}deg)`;
    } else {
      el.style.transform = "";
    }

    return ob;
  },

  release(ob) {
    if (!ob || !ob.element) return;
    try {
      ob.element.style.display = "none";
    } catch (e) {
      // ignore
    }
    obstaclePool.push(ob);
  },

  poolSize() {
    return obstaclePool.length;
  }
};

/*
 Helper to parse matrix properties encoded as strings (e.g. "1/-2/@90")
*/
function parseBlockType(type) {
  let blockType = type;
  let blockColor = null;
  let blockRotation = 0;

  if (typeof type === "string") {
    const properties = type.split("/");
    blockType = parseInt(properties[0], 10);
    for (let i = 1; i < properties.length; i++) {
      const prop = properties[i];
      if (prop.startsWith("-")) {
        blockColor = COLOR_MAP[parseInt(prop, 10)];
      } else if (prop.startsWith("@")) {
        blockRotation = parseInt(prop.substring(1), 10);
      }
    }
  }

  return {
    type: Number.isFinite(blockType) ? blockType : 0,
    color: blockColor,
    rotation: blockRotation,
  };
}

function createObstacleFromMatrix(type, row, spawnX) {
  const parsed = parseBlockType(type);
  const blockType = parsed.type;
  const blockColor = parsed.color;
  const blockRotation = parsed.rotation;

  const baseHeight = 50;
  const rowSpacing = 45;
  const state = GameState.getState();
  const levelHeight = state.levelMatrix ? state.levelMatrix.length : 10;
  const invertedRow = levelHeight - 1 - row;

  const worldX = Number.isFinite(spawnX)
    ? spawnX
    : DOMManager.getElement("#gameContainer")
    ? DOMManager.getElement("#gameContainer").offsetWidth
    : 800;
  const worldY = baseHeight + invertedRow * rowSpacing;

  // Horizontal cell size is authoritative — get it from CONSTANTS
  const cellWidth = (CONSTANTS && Number.isFinite(CONSTANTS.COLUMN_WIDTH))
    ? CONSTANTS.COLUMN_WIDTH
    : 45;

  // Build the obstacle prototype (used for pooling or new object)
  const proto = {
    x: worldX,
    y: worldY,
    width: cellWidth,
    height: rowSpacing,
    type: "empty",
    rotation: 0,
    color: null,
  };

  if (blockType === 4) {
    proto.type = "finish";
    proto.width = Math.max(10, Math.round(cellWidth * 0.4));
    proto.height = 350;
    proto.color = blockColor || "#00ff00";
  } else if (blockType === 2) {
    proto.type = "spike";
    proto.width = cellWidth - 12;
    proto.height = 30;
  } else if (blockType === 3) {
    proto.type = "teleporter";
    proto.width = Math.round(cellWidth * 0.66);
    proto.height = 60;
    proto.color = blockColor || null;
  } else if (blockType === 1) {
    proto.type = "platform";
    proto.width = cellWidth + 3;
    proto.height = rowSpacing;
  } else {
    proto.type = "empty";
    proto.width = cellWidth;
    proto.height = rowSpacing;
  }

  // Try to reuse an object from the pool
  //@ts-ignore
  if (window.TDObstaclePool && typeof window.TDObstaclePool.acquire === "function") {
  //@ts-ignore
    const reused = window.TDObstaclePool.acquire(proto);
    if (reused) {
      reused.rotation = proto.rotation || 0;
      reused.meta = { originalType: blockType };
      reused.x = proto.x;
      reused.y = proto.y;
      // ensure teleporter glow updated if teleporter
      if (reused.type === "teleporter") {
        const glow = reused.element.querySelector(".teleporter-glow");
        if (glow) {
          const c = reused.color || "#ff00ff";
          glow.style.background = `radial-gradient(circle at 50% 50%, ${c} 0%, rgba(0,0,0,0) 60%)`;
        }
      }
      return reused;
    }
  }

  // No pooled object available — create a fresh one
  const obstacleObj = {
    x: worldX,
    y: worldY,
    width: proto.width,
    height: proto.height,
    type: proto.type,
    rotation: proto.rotation || 0,
    color: proto.color || null,
    element: null,
    meta: { originalType: blockType },
  };

  obstacleObj.element = createObstacleElement(obstacleObj);
  return obstacleObj;
}

function validateLevelData(matrix) {
  if (!matrix || !Array.isArray(matrix)) throw new Error("Invalid level data: matrix must be an array");
  if (matrix.length < 2) throw new Error("Invalid level data: matrix must have at least 2 rows");

  const width = matrix[0].length;
  if (width === 0) throw new Error("Invalid level data: matrix rows cannot be empty");

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

let finishLinePosition = 0;
let totalBlocks = 0;
function calculateTotalBlocks() {
  const state = GameState.getState();
  if (!state.levelMatrix || state.levelMatrix.length === 0) return;
  finishLinePosition = 0;
  for (let col = 0; col < state.levelMatrix[0].length; col++) {
    for (let row = 0; row < state.levelMatrix.length; row++) {
      if (state.levelMatrix[row][col] === 4) {
        finishLinePosition = col;
        break;
      }
    }
    if (finishLinePosition > 0) break;
  }
  totalBlocks = finishLinePosition * state.levelMatrix.length;
  if (totalBlocks === 0) {
    console.error("No finish line found in level matrix!");
    totalBlocks = state.levelMatrix[0].length * state.levelMatrix.length;
  }
}

export { createObstacleFromMatrix, validateLevelData, calculateTotalBlocks };