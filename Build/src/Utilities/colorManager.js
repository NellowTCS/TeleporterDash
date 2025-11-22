import { GameState } from "./gameState";
import { CONSTANTS, COLOR_MAP } from "./constants";

let colorIndex = 0;

const COLOR_TRANSITION = {
  DURATION: 2, // Duration of each color transition in seconds
  SPEED: 0.0052, // Speed of transition (smaller = slower)
};

// Update the updateBackgroundColor function
function updateBackgroundColor() {
  // Get current state
  const state = GameState.getState();

  // Basic validation
  if (
    !state.levelMatrix ||
    !state.levelMatrix.length ||
    !state.levelColorRow ||
    !state.levelColorRow.length
  ) {
    // Early return if level data isn't loaded yet
    return;
  }

  try {
    // Account for initial empty space using CONSTANTS
    const delayColumns = Math.floor(
      CONSTANTS.INITIAL_SPACE / CONSTANTS.COLUMN_WIDTH,
    );
    const adjustedColumn = Math.max(0, state.currentColumn - delayColumns);

    // Get current and next codes from the stored color row
    const currentRawCode = state.levelColorRow[adjustedColumn];
    const nextRawCode =
      state.levelColorRow[
        Math.min(adjustedColumn + 1, state.levelColorRow.length - 1)
      ];

    // Don't force negative numbers, allow 0 for black
    const currentCode = `${extractColorCode(currentRawCode) || 0}`;
    const nextCode = `${extractColorCode(nextRawCode) || 0}`;

    // Get colors from color map
    const currentColor = COLOR_MAP[currentCode] || "#000000"; // Default to black
    const nextColor = COLOR_MAP[nextCode] || "#000000";

    if (!currentColor || !nextColor) {
      console.error("Invalid color codes:", currentCode, nextCode);
      return;
    }

    // Create darker versions
    const currentDarkerColor = makeColorDarker(currentColor);
    const nextDarkerColor = makeColorDarker(nextColor);

    const gameContainer = document.getElementById("gameContainer");
    if (!gameContainer) return;

    // If colors are the same, no need to interpolate
    if (currentCode === nextCode) {
      gameContainer.style.backgroundColor = currentDarkerColor;
      gameContainer.style.transition = "none";
      return;
    }

    // Calculate transition
    const rowSpacing = 45; // Match platform block width
    const playerElement = document.getElementById("player");
    const playerX = playerElement
      ? parseInt(playerElement.style.left) || 100
      : 100;
    const factor = (playerX % rowSpacing) / rowSpacing;
    const newColor = interpolateColor(
      currentDarkerColor,
      nextDarkerColor,
      factor,
    );

    // Apply the new color if valid
    if (newColor && newColor.length === 7) {
      gameContainer.style.backgroundColor = newColor;
      gameContainer.style.transition = "none";
    }
  } catch (error) {
    console.error("[Color Transition] Error:", error);
  }
}

// Update the interpolateColor function for smoother transitions
function interpolateColor(color1, color2, factor) {
  if (
    !color1 ||
    !color2 ||
    typeof color1 !== "string" ||
    typeof color2 !== "string"
  ) {
    return COLOR_MAP["0"];
  }
  // Ensure factor is between 0 and 1
  factor = Math.max(0, Math.min(1, factor));

  // Parse colors
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  // Interpolate using cubic easing for smoother transitions
  const ease = factor * factor * (3 - 2 * factor);

  // Calculate new color values
  const r = Math.round(r1 + (r2 - r1) * ease);
  const g = Math.round(g1 + (g2 - g1) * ease);
  const b = Math.round(b1 + (b2 - b1) * ease);

  // Convert back to hex
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Make colors darker for background
function makeColorDarker(color) {
  if (!color || typeof color !== "string" || !color.startsWith("#")) {
    return COLOR_MAP["0"]; // Return default color if input is invalid
  }

  try {
    // Convert hex to RGB
    const r = parseInt(color.slice(1, 3), 16) || 0;
    const g = parseInt(color.slice(3, 5), 16) || 0;
    const b = parseInt(color.slice(5, 7), 16) || 0;

    // Make each component 40% darker
    const darkerR = Math.max(0, Math.floor(r * 0.6));
    const darkerG = Math.max(0, Math.floor(g * 0.6));
    const darkerB = Math.max(0, Math.floor(b * 0.6));

    // Convert back to hex
    return `#${darkerR.toString(16).padStart(2, "0")}${darkerG
      .toString(16)
      .padStart(2, "0")}${darkerB.toString(16).padStart(2, "0")}`;
  } catch (error) {
    console.error("Error in makeColorDarker:", error);
    return COLOR_MAP["0"]; // Return default color on error
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

export {
  updateBackgroundColor,
  interpolateColor,
  makeColorDarker,
  extractColorCode,
};
