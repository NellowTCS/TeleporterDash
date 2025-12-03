import { GameState } from "../Utilities/gameState";
import { AudioManager } from "../Utilities/audioManager";

const jumpForce = -800; // Initial upward velocity when jumping (pixels/second)
let jumpBufferTime = 0; // milliseconds
let lastJumpPressTime = 0;
let touchJumpDelay = 400; // milliseconds
let pauseHandler = null;

/**
 * Configures control scheme based on user selection
 * @param {string} method - 'space', 'click', or 'both'
 */
function setupControls(method) {
  // Remove all existing event listeners first
  document.removeEventListener("keydown", handleSpaceJump);
  document.removeEventListener("mousedown", handleMouseJump);

  // Apply new control scheme
  if (method === "space") {
    document.addEventListener("keydown", handleSpaceJump);
  } else if (method === "click") {
    document.addEventListener("mousedown", handleMouseJump);
  } else if (method === "both") {
    document.addEventListener("keydown", handleSpaceJump);
    document.addEventListener("mousedown", handleMouseJump);
  }
}
// @ts-ignore
window.setupControls = setupControls;

/**
 * Handles player jumping mechanics
 * Includes double jump and jump buffering
 */
function jump(e) {
  const currentTime = Date.now();
  const state = GameState.getState();

  // Prevent double jump based on global jump buffer
  if (currentTime - lastJumpPressTime < jumpBufferTime) {
    return;
  }

  if (
    !state.isGameOver &&
    ((!state.isJumping && !state.isOnPlatform) ||
      (state.doubleJumpAvailable &&
        currentTime - lastJumpPressTime > jumpBufferTime))
  ) {
    GameState.setState({
      isJumping: true,
      isOnPlatform: false,
      doubleJumpAvailable: state.isJumping ? false : state.doubleJumpAvailable,
      jumpCount: state.jumpCount + 1,
      playerVelocity: jumpForce,
    });

    lastJumpPressTime = currentTime;

    if (!AudioManager.isMuted && AudioManager.jumpSound?.readyState === 4) {
      AudioManager.jumpSound.currentTime = 0;
      AudioManager.jumpSound
        .play()
        .catch((error) => console.log("Jump sound failed:", error));
    }
  }
}

/**
 * Handles spacebar input for jumping
 * Prevents page scrolling on space press
 */
function handleSpaceJump(e) {
  if (e.code === "Space") {
    e.preventDefault();
    jump();
  }
}

/**
 * Handles mouse input for jumping
 */
function handleMouseJump(e) {
  if (e.button === 0) {
    // Left click only
    jump();
  }
}

/**
 * Touch controls setup
 */
function initializeTouchControls() {
  const touchThreshold = 20; // pixels
  let touchStartY = 0;
  let isSwiping = false;

  document.addEventListener(
    "touchstart",
    function (e) {
      e.preventDefault();
      touchStartY = e.touches[0].clientY;
      isSwiping = false;
    },
    { passive: false },
  );

  document.addEventListener(
    "touchmove",
    function (e) {
      if (Math.abs(e.touches[0].clientY - touchStartY) > touchThreshold) {
        isSwiping = true;
      }
    },
    { passive: false },
  );

  document.addEventListener(
    "touchend",
    function (e) {
      e.preventDefault();
      const state = GameState.getState();
      if (
        !state.isPaused &&
        !state.isGameOver &&
        !state.isLevelComplete &&
        !isSwiping
      ) {
        jump();
      }
    },
    { passive: false },
  );
}

// ===== Event listeners for player input =====
document.addEventListener("keydown", handleSpaceJump);
document.addEventListener("mousedown", handleMouseJump);

// Toggle pause with P key
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyP") {
    if (typeof pauseHandler === "function") {
      pauseHandler();
    }
  }
});

function registerPauseHandler(handler) {
  pauseHandler = typeof handler === "function" ? handler : null;
}

document.addEventListener(
  "touchstart",
  (e) => {
    // @ts-ignore
    if (!e.targetTouches[0].target.__touchHandled) {
      // @ts-ignore
      e.targetTouches[0].target.__touchHandled = true;
      jump(e);
      setTimeout(() => {
        // @ts-ignore
        e.targetTouches[0].target.__touchHandled = false;
      }, touchJumpDelay);
    }
  },
  { passive: false },
);

export {
  setupControls,
  jump,
  initializeTouchControls,
  handleMouseJump,
  handleSpaceJump,
  registerPauseHandler,
};
