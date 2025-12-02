import { GameState } from "../Utilities/gameState";
import { DOMManager } from "../Utilities/domManager";

let totalColumns = 0;
let lastProgressUpdate = 0;
const progressUpdateInterval = 100; // Reduced frequency - 10fps is plenty for progress bar
let passedBlocks = 0;

// Cache DOM elements
let progressText = null;
let progressFill = null;
let heightIndicator = null;
let playerIndicator = null;
let cachedIndicatorHeight = 0;

function initProgressElements() {
  if (! progressText) {
    progressText = DOMManager.getElement("#progressText");
    progressFill = DOMManager.getElement("#progressFill");
    heightIndicator = DOMManager.getElement("#heightIndicator");
    playerIndicator = DOMManager.getElement("#playerIndicator");
    if (heightIndicator) {
      cachedIndicatorHeight = heightIndicator.offsetHeight;
    }
  }
}

/**
 * Updates the progress bar and level completion percentage
 * Called from updateGame when new obstacles are created
 * Throttled to avoid performance issues
 */
function updateProgress() {
  const state = GameState.getState();
  if (! state.levelMatrix || state.levelMatrix.length === 0) return;

  const currentTime = Date.now();
  if (currentTime - lastProgressUpdate < progressUpdateInterval) return;

  initProgressElements();
  if (! progressText || !progressFill) return;

  if (totalColumns === 0) {
    totalColumns = state.levelMatrix[0].length;
  }

  const delayColumns = 3;
  const adjustedColumn = Math.max(0, state.currentColumn - delayColumns);
  const progress = (adjustedColumn / totalColumns) * 100;
  const clampedProgress = Math.min(Math.round(progress), 99);

  const finalProgress = state.isLevelComplete
    ? 100
    : progress >= 98
      ? 99
      : clampedProgress;

  progressText.textContent = `${finalProgress}%`;
  progressFill.style. width = `${finalProgress}%`;

  if (finalProgress > 75) {
    progressFill.style.background = "linear-gradient(90deg, #00ff00, #4287f5)";
  } else if (finalProgress > 50) {
    progressFill.style. background = "linear-gradient(90deg, #ffff00, #00ff00)";
  } else if (finalProgress > 25) {
    progressFill.style.background = "linear-gradient(90deg, #ffa500, #ffff00)";
  }

  if (playerIndicator && cachedIndicatorHeight > 0) {
    const position = (finalProgress / 100) * cachedIndicatorHeight;
    playerIndicator.style.top = `${position}px`;
  }

  lastProgressUpdate = currentTime;
}

function resetProgress() {
  totalColumns = 0;
  lastProgressUpdate = 0;
  progressText = null;
  progressFill = null;
  heightIndicator = null;
  playerIndicator = null;
  cachedIndicatorHeight = 0;
}

export { updateProgress, resetProgress };
