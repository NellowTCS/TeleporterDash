import { GameState } from "../Utilities/gameState";
import { DOMManager } from "../Utilities/domManager";

let totalColumns = 0; // Will be set when levelMatrix is loaded
let lastProgressUpdate = 0;
const progressUpdateInterval = 16; // ~60fps update frequency for progress bar
let passedBlocks = 0; // Number of blocks the player has passed

/**
 * Updates the progress bar and level completion percentage
 * Called from updateGame when new obstacles are created
 * Throttled to avoid performance issues
 */
function updateProgress() {
  const state = GameState.getState();
  if (!state.levelMatrix || state.levelMatrix.length === 0) return;

  const currentTime = Date.now();
  if (currentTime - lastProgressUpdate < progressUpdateInterval) return;

  // Set totalColumns if not already set
  if (totalColumns === 0) {
    totalColumns = state.levelMatrix[0].length;
  }

  // Calculate progress based on current column position
  const delayColumns = 3; // Creates a 2-second delay for smoother progress
  const adjustedColumn = Math.max(0, state.currentColumn - delayColumns);

  // Calculate progress with finer granularity
  const progress = (adjustedColumn / totalColumns) * 100;
  const clampedProgress = Math.min(Math.round(progress), 99); // Cap at 99% until complete

  // Only show 100% when level is actually complete
  const finalProgress = state.isLevelComplete
    ? 100
    : progress >= 98
      ? 99 // Force 99% when near the end
      : clampedProgress;

  // Update UI elements
  const progressText = DOMManager.getElement("#progressText");
  const progressFill = DOMManager.getElement("#progressFill");

  progressText.textContent = `${finalProgress}%`;
  progressFill.style.width = `${finalProgress}%`;

  // Update progress bar colors based on completion
  if (finalProgress > 75) {
    progressFill.style.background = "linear-gradient(90deg, #00ff00, #4287f5)";
  } else if (finalProgress > 50) {
    progressFill.style.background = "linear-gradient(90deg, #ffff00, #00ff00)";
  } else if (finalProgress > 25) {
    progressFill.style.background = "linear-gradient(90deg, #ffa500, #ffff00)";
  }

  // Update player indicator position on height bar
  const heightIndicator = DOMManager.getElement("#heightIndicator");
  if (heightIndicator) {
    const indicatorHeight = heightIndicator.offsetHeight;
    const playerIndicator = DOMManager.getElement("#playerIndicator");
    const position = (finalProgress / 100) * indicatorHeight;
    playerIndicator.style.top = `${position}px`;
  }

  lastProgressUpdate = currentTime;
}

export { updateProgress };
