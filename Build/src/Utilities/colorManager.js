import { GameState } from "./gameState";
import { CONSTANTS, COLOR_MAP } from "./constants";

let colorIndex = 0;

// Cache DOM elements
let cachedGameContainer = null;
let cachedPlayerElement = null;
let lastAppliedColor = null;

function getGameContainer() {
  if (!cachedGameContainer) {
    cachedGameContainer = document.getElementById("gameContainer");
  }
  return cachedGameContainer;
}

function getPlayerElement() {
  if (!cachedPlayerElement) {
    cachedPlayerElement = document.getElementById("player");
  }
  return cachedPlayerElement;
}

const COLOR_TRANSITION = {
  DURATION: 2,
  SPEED: 0.0052,
};

function updateBackgroundColor() {
  const state = GameState.getState();

  if (
    !state.levelMatrix ||
    !state.levelMatrix.length ||
    !state.levelColorRow ||
    !state.levelColorRow.length
  ) {
    return;
  }

  try {
    const delayColumns = Math.floor(
      CONSTANTS.INITIAL_SPACE / CONSTANTS.COLUMN_WIDTH,
    );
    const adjustedColumn = Math.max(0, state.currentColumn - delayColumns);

    const currentRawCode = state.levelColorRow[adjustedColumn];
    const nextRawCode =
      state.levelColorRow[
        Math.min(adjustedColumn + 1, state.levelColorRow.length - 1)
      ];

    const currentCode = `${extractColorCode(currentRawCode) || 0}`;
    const nextCode = `${extractColorCode(nextRawCode) || 0}`;

    const currentColor = COLOR_MAP[currentCode] || "#000000";
    const nextColor = COLOR_MAP[nextCode] || "#000000";

    if (!currentColor || !nextColor) {
      console.error("Invalid color codes:", currentCode, nextCode);
      return;
    }

    const currentDarkerColor = makeColorDarker(currentColor);
    const nextDarkerColor = makeColorDarker(nextColor);

    const gameContainer = getGameContainer();
    if (!gameContainer) return;

    if (currentCode === nextCode) {
      if (lastAppliedColor !== currentDarkerColor) {
        gameContainer.style.backgroundColor = currentDarkerColor;
        lastAppliedColor = currentDarkerColor;
      }
      return;
    }

    const rowSpacing = 45;
    const playerElement = getPlayerElement();
    const playerX = playerElement
      ? parseInt(playerElement.style.left) || 100
      : 100;
    const factor = (playerX % rowSpacing) / rowSpacing;
    const newColor = interpolateColor(
      currentDarkerColor,
      nextDarkerColor,
      factor,
    );

    if (newColor && newColor.length === 7 && newColor !== lastAppliedColor) {
      gameContainer.style.backgroundColor = newColor;
      lastAppliedColor = newColor;
    }
  } catch (error) {
    console.error("[Color Transition] Error:", error);
  }
}

function interpolateColor(color1, color2, factor) {
  if (
    !color1 ||
    !color2 ||
    typeof color1 !== "string" ||
    typeof color2 !== "string"
  ) {
    return COLOR_MAP["0"];
  }
  factor = Math.max(0, Math.min(1, factor));

  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const ease = factor * factor * (3 - 2 * factor);

  const r = Math.round(r1 + (r2 - r1) * ease);
  const g = Math.round(g1 + (g2 - g1) * ease);
  const b = Math.round(b1 + (b2 - b1) * ease);

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function makeColorDarker(color) {
  if (!color || typeof color !== "string" || !color.startsWith("#")) {
    return COLOR_MAP["0"];
  }

  try {
    const r = parseInt(color.slice(1, 3), 16) || 0;
    const g = parseInt(color.slice(3, 5), 16) || 0;
    const b = parseInt(color.slice(5, 7), 16) || 0;

    const darkerR = Math.max(0, Math.floor(r * 0.6));
    const darkerG = Math.max(0, Math.floor(g * 0.6));
    const darkerB = Math.max(0, Math.floor(b * 0.6));

    return `#${darkerR.toString(16).padStart(2, "0")}${darkerG
      .toString(16)
      .padStart(2, "0")}${darkerB.toString(16).padStart(2, "0")}`;
  } catch (error) {
    console.error("Error in makeColorDarker:", error);
    return COLOR_MAP["0"];
  }
}

function extractColorCode(code) {
  if (typeof code === "string") {
    const props = code.split("/");
    const colorProp = props.find((p) => p.startsWith("-"));
    return colorProp ? parseInt(colorProp) : -1;
  }
  return code;
}

function resetColorCache() {
  cachedGameContainer = null;
  cachedPlayerElement = null;
  lastAppliedColor = null;
}

export {
  updateBackgroundColor,
  interpolateColor,
  makeColorDarker,
  extractColorCode,
  resetColorCache,
};
