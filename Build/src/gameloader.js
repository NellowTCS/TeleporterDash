// Game Loader for Teleporter Dash
import { GameState } from "./Utilities/gameState.js";
import { AudioManager } from "./Utilities/audioManager.js";
import { LevelLoader } from "./TDEngine/levelLoader.js";
import { SettingsManager } from "./TDEngine/settingsManager.js";
import { ScoreManager } from "./TDEngine/scoreManager.js";
import { DatabaseManager } from "./Utilities/databaseManager.js";
import { COLOR_STEPS, CONSTANTS } from "./Utilities/constants.js";
import { DOMManager } from "./Utilities/domManager.js";
import { showLoadingError } from "./Utilities/notificationManager.js";
import { updateBackgroundColor } from "./Utilities/colorManager.js";
import { checkCollision, handlePlatformCollision, clearObstacles } from "./TDEngine/physicsEngine.js";
import { createParticles, cleanupParticles } from "./TDEngine/particleEngine.js";
import { setupControls, jump, handleMouseJump, handleSpaceJump } from "./TDEngine/inputManager.js";
import { createObstacleFromMatrix } from "./TDEngine/levelParser.js";
import { updateProgress } from "./TDEngine/progressManager.js";

// ===== Variables =====

// Game Container
let gameContainer = null;
let player = null;
let obstacles = [];             // Array of all active obstacles
let particles = [];             // Array of active particle effects
let restartBtn = null;
let muteButton = null;
let levelCompleteElement = null;
let gameOverElement = null;
let animationFrameId = null;           // ID of the current animation frame

// @ts-ignore
window.player = player;


// Extract levelId from URL parameters
const urlParams = new URLSearchParams(window.location.search);
let levelId = null;
if (urlParams.has("level")) {
  levelId = urlParams.get("level");
} else if (urlParams.has("levelFile")) {
  levelId = urlParams.get("levelFile");
}

// Physics
const gravity = 2000;                  // Rate at which player falls (pixels/second²)

// Timing
let levelTimer = null;
let levelTime = 0;
let lastFrameTime = performance.now(); // Timestamp of the last frame
let deltaTime = 0;                     // Time elapsed since last frame (in seconds)
const TARGET_FPS = 60;                 // Target frame rate for physics calculations
const MAX_DELTA_TIME = 1 / 30;         // Cap deltaTime to prevent large jumps

// Progress
let progressText = null;
let progressFill = null;

// Settings 
let autoRestartEnabled = false;        // Whether to automatically restart on death
let isRestarting = false;              // Whether the game is currently restarting

// Pause
let isPaused = false;
let pauseMenu = null;

// Camera
let cameraOffsetY = 0;
const CAMERA_FOLLOW_THRESHOLD = 50;    // Reduced from 100 to make camera more responsive
const MAX_CAMERA_SPEED = 20;           // Increased from 15 to make camera movement smoother
// @ts-ignore
window.cameraOffsetY = cameraOffsetY;

// Transitions
let transitionFactor = 0;
const totalTransitionTime = 10;        // Total time for all transitions
const numberOfTransitions = COLOR_STEPS.length - 1;
const transitionDuration = totalTransitionTime / numberOfTransitions;
const transitionSpeed = 1 / (transitionDuration * 60);

// Initialize GameState with default values
GameState.setState({
  isJumping: false,
  isPracticeMode: false,
  isGameOver: false,
  isLevelComplete: false,
  currentColumn: 0,
  playerVelocity: 0,
  rotation: 0,
  doubleJumpAvailable: true,
  isOnPlatform: false,
  jumpCount: 0,
  deathCount: 0,
  currentTime: 0,
});

/**
 * Toggles game state (mute or pause)
 * @param {string} action - Either 'mute' or 'pause'
 */
export function toggleGameState(action) {
  if (action === "mute") {
    AudioManager.toggleMute();
  } else if (action === "pause") {
    const state = GameState.getState();
    if (state.isGameOver || state.isLevelComplete || !state.isLevelStarted)
      return;

    const newPauseState = !state.isPaused;
    GameState.setState({ isPaused: newPauseState });
    pauseMenu.style.display = newPauseState ? "block" : "none";

    const currentMusic = state.isPracticeMode
      ? AudioManager.practiceMusic
      : AudioManager.backgroundMusic;
    if (newPauseState) {
      AudioManager.pause(currentMusic);
    } else {
      // Resume from current position if not muted
      if (!AudioManager.isMuted) {
        AudioManager.play(currentMusic, currentMusic.currentTime).catch((e) =>
          console.error("Error resuming music:", e)
        );
      }
    }
  }
}


/**
 * Initializes level settings and UI controls
 * Sets up event listeners for all game settings
 */
async function initializeLevel() {
  // Get references to all UI elements
  // @ts-ignore
  const settingsMenu = DOMManager.getElement("#settingsMenu");
  const volumeSlider = DOMManager.getElement("#volumeSlider");
  const volumeValue = DOMManager.getElement("#volumeValue");
  const controlMethodSelect = document.getElementById("controlMethod");
  const autoRestartCheckbox = document.getElementById("autoRestart");
  const practiceModeCheckbox = document.getElementById("practiceMode");
  // @ts-ignore
  const startLevelBtn = document.getElementById("startLevelBtn");
  // @ts-ignore
  const loadingAnimation = document.getElementById("loadingAnimation");

  // Load saved settings first
  SettingsManager.load();

  // Apply control method
  setupControls(SettingsManager.current.controlMethod);

  // Apply loaded settings to UI elements
  if (volumeSlider) {
    volumeSlider.value = SettingsManager.current.volume;
    volumeValue.textContent = SettingsManager.current.volume + "%";
  }

  if (controlMethodSelect) {
    // @ts-ignore
    controlMethodSelect.value = SettingsManager.current.controlMethod;
  }

  if (practiceModeCheckbox) {
    // @ts-ignore
    practiceModeCheckbox.checked = SettingsManager.current.practiceMode;
    GameState.setState({
      isPracticeMode: SettingsManager.current.practiceMode,
    });
  }

  if (autoRestartCheckbox) {
    // @ts-ignore
    autoRestartCheckbox.checked = SettingsManager.current.autoRestartEnabled;
    autoRestartEnabled = SettingsManager.current.autoRestartEnabled;

    // Add change event listener for auto restart
    autoRestartCheckbox.addEventListener("change", function () {
      // @ts-ignore
      autoRestartEnabled = this.checked;
      SettingsManager.current.autoRestartEnabled = autoRestartEnabled;
      SettingsManager.save();
    });
  }

  // Visual effects setup
  const visualEffectsCheckbox = document.getElementById("visualEffects");
  if (visualEffectsCheckbox) {
    // @ts-ignore
    visualEffectsCheckbox.checked = SettingsManager.current.visualEffects;
    visualEffectsCheckbox.addEventListener("change", function () {
      // @ts-ignore
      SettingsManager.current.visualEffects = this.checked;
      SettingsManager.save();
    });
  }

  // Set up volume control with real-time updates
  if (volumeSlider) {
    volumeSlider.addEventListener("input", function () {
      const volume = this.value;
      volumeValue.textContent = volume + "%";

      // Update settings
      SettingsManager.current.volume = volume;
      SettingsManager.save();

      // Apply volume to all audio elements
      [
        AudioManager.backgroundMusic,
        AudioManager.practiceMusic,
        AudioManager.jumpSound,
        AudioManager.deathSound,
        AudioManager.completionSound,
      ].forEach((audio) => {
        if (audio) {
          audio.volume = SettingsManager.current.volume / 100;
        }
      });
    });
  }

  // Practice mode setup
  if (practiceModeCheckbox) {
    practiceModeCheckbox.addEventListener("change", async function () {
      // @ts-ignore
      const practiceMode = this.checked;
      GameState.setState({ isPracticeMode: practiceMode });
      SettingsManager.current.practiceMode = practiceMode;
      SettingsManager.save();

      // Enable/disable game speed control
      const gameSpeedSelect = document.getElementById("gameSpeed");
      if (gameSpeedSelect) {
        // @ts-ignore
        gameSpeedSelect.disabled = !practiceMode;
        if (!practiceMode) {
          GameState.setState({ gameSpeed: 4 });
          // @ts-ignore
          gameSpeedSelect.value = "1";
          SettingsManager.current.gameSpeed = 4;
          SettingsManager.save();
        } else {
          // Initialize game speed when practice mode is enabled
          const newGameSpeed = SettingsManager.current.gameSpeed || 4;
          GameState.setState({ gameSpeed: newGameSpeed });
          // @ts-ignore
          gameSpeedSelect.value = (newGameSpeed / 4).toString();
        }
      }

      // Only switch music if the level is actually running
      const currentState = GameState.getState();
      if (
        currentState.isLevelStarted &&
        !currentState.isPaused &&
        !currentState.isGameOver &&
        !currentState.isLevelComplete
      ) {
        try {
          const musicToPlay = practiceMode
            ? AudioManager.practiceMusic
            : AudioManager.backgroundMusic;
          const musicToPause = practiceMode
            ? AudioManager.backgroundMusic
            : AudioManager.practiceMusic;
          await AudioManager.switchTracks(musicToPlay, musicToPause);
        } catch (error) {
          console.error("Error switching music tracks:", error);
        }
      } else {
        // If level isn't running, make sure both music tracks are paused
        await Promise.all([
          AudioManager.pause(AudioManager.backgroundMusic),
          AudioManager.pause(AudioManager.practiceMusic),
        ]);
      }
    });
  }

  // Game speed setup
  const gameSpeedSelect = document.getElementById("gameSpeed");
  if (gameSpeedSelect) {
    // Initialize game speed select state
    const state = GameState.getState();
    // @ts-ignore
    gameSpeedSelect.disabled = !state.isPracticeMode;
    if (SettingsManager.current.gameSpeed) {
      GameState.setState({ gameSpeed: SettingsManager.current.gameSpeed });
      // @ts-ignore
      gameSpeedSelect.value = SettingsManager.current.gameSpeed.toString();
    }

    gameSpeedSelect.addEventListener("change", function () {
      const currentState = GameState.getState();
      if (currentState.isPracticeMode) {
        // @ts-ignore
        const speedMultiplier = parseFloat(this.value);
        GameState.setState({ gameSpeed: 4 * speedMultiplier });
        SettingsManager.current.gameSpeed = 4 * speedMultiplier;
        SettingsManager.save();
      }
    });
  }

  // Control method setup
  if (controlMethodSelect) {
    controlMethodSelect.addEventListener("change", function () {
      // @ts-ignore
      const method = this.value;
      SettingsManager.current.controlMethod = method;
      SettingsManager.save();
      setupControls(method);
      console.log("Control Method: ", method, " set");
    });
  }

  // Attach Start Level button handler (this was missing)
  if (startLevelBtn) {
    startLevelBtn.addEventListener("click", startLevel);
  }
}

/**
 * Starts the level: sets GameState, starts music, level timer, and game loop
 */
async function startLevel() {
  const prevState = GameState.getState();
  if (prevState.isLevelStarted) return;

  // Hide settings menu if present
  const settingsMenu = DOMManager.getElement("#settingsMenu");
  if (settingsMenu) settingsMenu.style.display = "none";

  // Reset time tracking
  levelTime = 0;
  if (levelTimer) {
    clearInterval(levelTimer);
    levelTimer = null;
  }

  GameState.setState({
    isLevelStarted: true,
    isGameOver: false,
    isLevelComplete: false,
    currentColumn: 0,
    playerVelocity: 0,
    rotation: 0,
    passedBlocks: 0,
    startTime: Date.now(),
    currentTime: 0,
  });

  // Start level time updater (ticks every 100ms for 0.1s resolution)
  levelTimer = setInterval(() => {
    levelTime = +(levelTime + 0.1).toFixed(1);
    GameState.setState({ currentTime: levelTime });
  }, 100);

  // Play appropriate music if available and not muted
  const currentState = GameState.getState();
  const musicToPlay = currentState.isPracticeMode
    ? AudioManager.practiceMusic
    : AudioManager.backgroundMusic;

  try {
    if (!AudioManager.isMuted && musicToPlay) {
      // Use any tracked lastMusicTime if available
      const startTime = AudioManager.lastMusicTime || 0;
      await AudioManager.play(musicToPlay, startTime);
    }
  } catch (err) {
    console.error("Error starting music:", err);
  }

  // Prepare frame timing and start the loop
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(updateGame);
}

/**
 * Main game loop that updates all game elements
 * Called every animation frame when game is running
 */
function updateGame() {
  // Calculate deltaTime for frame-rate independence
  const currentFrameTime = performance.now();
  deltaTime = Math.min(
    (currentFrameTime - lastFrameTime) / 1000,
    MAX_DELTA_TIME
  );
  lastFrameTime = currentFrameTime;

  // Get current state
  const state = GameState.getState();

  // Don't update if game isn't in active state
  if (!state.isLevelStarted || state.isGameOver || state.isLevelComplete) {
    // Still schedule frames to allow unpausing or UI updates, but avoid heavy updates
    animationFrameId = requestAnimationFrame(updateGame);
    return;
  }

  if (state.isPaused) {
    animationFrameId = requestAnimationFrame(updateGame);
    return;
  }

  // Update background color as part of the game loop
  updateBackgroundColor();

  // Apply game speed to obstacle movement (frame-rate independent)
  const baseSpeed = 240; // pixels per second (DO NOT ADJUST FOR DELTATIME, THIS IS WHAT CAUSED IT TO NOT WORK WHEN I DID IT)
  const currentSpeed = state.isPracticeMode
    ? baseSpeed * (state.gameSpeed / 4)
    : baseSpeed;
  const frameSpeed = currentSpeed * deltaTime; // Convert to pixels per frame

  // Create new obstacles when needed
  // Only creates obstacles when there's enough space from the last one
  if (
    state.levelMatrix &&
    state.levelMatrix.length > 0 &&
    state.currentColumn < state.levelMatrix[0].length &&
    (obstacles.length === 0 ||
      gameContainer.offsetWidth -
      obstacles[obstacles.length - 1]?.element.offsetLeft >
      CONSTANTS.COLUMN_WIDTH)
  ) {
    for (let row = 0; row < state.levelMatrix.length; row++) {
      createObstacleFromMatrix(
        state.levelMatrix[row][state.currentColumn],
        row
      );
    }
    GameState.setState({
      currentColumn: state.currentColumn + 1,
    });

    // Only update progress when new obstacles are created
    updateProgress();
  }

  // Player physics calculations (frame-rate independent)
  const newVelocity = state.playerVelocity + gravity * deltaTime;
  const currentBottom = parseInt(window.getComputedStyle(player).bottom);
  let newBottom = currentBottom - newVelocity * deltaTime;

  // Check ground collision with proper constants
  if (newBottom <= CONSTANTS.GROUND_HEIGHT) {
    newBottom = CONSTANTS.GROUND_HEIGHT;
    GameState.setState({
      isJumping: false,
      doubleJumpAvailable: true,
      playerVelocity: 0,
    });
  } else {
    GameState.setState({
      playerVelocity: newVelocity,
    });
  }

  // Update player position
  player.style.bottom = `${newBottom}px`;
  player.style.left = "100px"; // Keep player's horizontal position fixed

  // Rotate player during jump (frame-rate independent)
  const rotationSpeed = 360; // degrees per second
  if (state.isJumping) {
    GameState.setState({
      rotation: state.rotation + rotationSpeed * deltaTime,
    });
  } else if (state.rotation !== 0) {
    GameState.setState({
      rotation: 0,
    });
  }
  player.style.transform = `rotate(${state.rotation}deg)`;

  // Update obstacles with optimization
  const playerRect = player ? player.getBoundingClientRect() : null;
  const containerLeft = gameContainer
    ? gameContainer.getBoundingClientRect().left
    : 0;

  // Process each obstacle
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];
    let obstacleLeft = parseInt(obstacle.element.style.left);
    obstacle.element.style.left = obstacleLeft - frameSpeed + "px"; // Use frame-rate independent speed

    // Remove off-screen obstacles to improve performance
    if (obstacleLeft < -50) {
      obstacle.element.remove();
      obstacles.splice(i, 1);
      continue;
    }

    // Only check collisions for nearby obstacles
    if (
      playerRect &&
      Math.abs(obstacleLeft - (playerRect.left - containerLeft)) < 100
    ) {
      const collision = checkCollision(player, obstacle.element);
      if (collision) {
        if (obstacle.type === "finish") {
          levelComplete();
        } else if (obstacle.type === "spike" && !state.isPracticeMode) {
          gameOver();
        } else if (obstacle.type === "teleporter") {
          const rotation = parseInt(
            obstacle.element.getAttribute("data-rotation") || "0"
          );

          if (rotation === 90) {
            // Horizontal teleport - move obstacles forward/back
            const dx = -120; // Move obstacles forward

            // Update all obstacle positions
            obstacles.forEach((obs) => {
              const obsLeft = parseInt(obs.element.style.left || "0");
              obs.element.style.left = obsLeft + dx + "px";
            });

            // Keep player at fixed position
            player.style.left = "100px";
          } else if (rotation === 270) {
            // Horizontal teleport - move obstacles back
            const dx = 120; // Move obstacles back

            // Update all obstacle positions
            obstacles.forEach((obs) => {
              const obsLeft = parseInt(obs.element.style.left || "0");
              obs.element.style.left = obsLeft + dx + "px";
            });

            // Keep player at fixed position
            player.style.left = "100px";
          } else {
            // Vertical teleport
            const dy = rotation === 180 ? -120 : 180;
            player.style.bottom = parseInt(player.style.bottom) + dy + "px";
          }

          GameState.setState({
            playerVelocity: 0,
          });
          createParticles("#ff00ff");
          setTimeout(() => createParticles("#ff00ff"), 100);
        } else if (obstacle.type === "platform") {
          const platformCollision = handlePlatformCollision(
            playerRect,
            obstacle.element
          );
          if (platformCollision === "death" && !state.isPracticeMode) {
            gameOver();
          }
        }
      }
    }
  }

  // Update particle effects (frame-rate independent)
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.vy += 300 * deltaTime; // Gravity effect on particles (pixels/second²)
    particle.life -= 1.2 * deltaTime; // Particle fade out (per second)

    // Remove dead particles
    if (particle.life <= 0) {
      particle.element.remove();
      particles.splice(i, 1);
      continue;
    }

    // Update particle position
    const currentLeft = parseFloat(particle.element.style.left);
    const currentTop = parseFloat(particle.element.style.top);

    particle.element.style.left = currentLeft + particle.vx * deltaTime + "px";
    particle.element.style.top = currentTop + particle.vy * deltaTime + "px";
    particle.element.style.opacity = particle.life;
  }

  // Continue game loop if game is still active
  if (!state.isGameOver && !state.isLevelComplete) {
    animationFrameId = requestAnimationFrame(updateGame);
  }

  // Update camera position to follow player (frame-rate independent)
  const containerHeight = gameContainer.offsetHeight;
  const targetCameraY = Math.max(0, newBottom - containerHeight / 2);

  // Smooth camera movement
  const cameraDistance = targetCameraY - cameraOffsetY;
  if (Math.abs(cameraDistance) > CAMERA_FOLLOW_THRESHOLD) {
    const baseCameraSpeed = Math.min(
      Math.abs(cameraDistance) * 6,
      MAX_CAMERA_SPEED * 60
    ); // Convert to pixels/second
    const cameraSpeed = baseCameraSpeed * deltaTime; // Apply deltaTime
    cameraOffsetY += Math.sign(cameraDistance) * cameraSpeed;
  }

  // Apply camera transform
  const cameraContainer = DOMManager.getElement("#cameraContainer");
  cameraContainer.style.transform = `translateY(${cameraOffsetY}px)`;
}

/**
 * Handles game over state and UI
 * Called when player hits spikes or collides with obstacles
 */
async function gameOver() {
  const state = GameState.getState();
  if (!state.isPracticeMode) {
    // Only trigger game over if NOT in practice mode
    GameState.setState({
      isGameOver: true,
      deathCount: state.deathCount + 1,
    });

    // Stop all music immediately
    await Promise.all([
      AudioManager.pause(AudioManager.backgroundMusic),
      AudioManager.pause(AudioManager.practiceMusic),
    ]);

    if (!AudioManager.isMuted) {
      AudioManager.deathSound.currentTime = 0;
      AudioManager.deathSound.play();
    }

    // Create particles at player position
    const playerRect = player ? player.getBoundingClientRect() : null;
    const cameraContainer = DOMManager.getElement("#cameraContainer");
    const cameraRect = cameraContainer
      ? cameraContainer.getBoundingClientRect()
      : null;

    // Calculate relative position for particles (with fallback if elements not available)
    let relativeX = 0;
    let relativeY = 0;
    if (playerRect && cameraRect) {
      // @ts-ignore
      relativeX = playerRect.left - cameraRect.left;
      // @ts-ignore
      relativeY = cameraRect.bottom - playerRect.bottom;
    }

    // Get color of the obstacle that caused death
    let particleColor = "#ff0000"; // Default red
    const nearbyObstacles = obstacles.filter(
      (o) =>
        checkCollision(player, o.element) &&
        (o.element.style.backgroundColor || o.element.style.borderBottomColor)
    );

    if (nearbyObstacles.length > 0) {
      const obstacle = nearbyObstacles[0].element;
      particleColor =
        obstacle.style.backgroundColor || obstacle.style.borderBottomColor;
    }

    createParticles(particleColor);

    // Handle auto restart
    if (autoRestartEnabled) {
      setTimeout(() => {
        restartGame();
      }, 1000);
      return;
    }

    // Show game over screen
    if (gameOverElement) {
      gameOverElement.style.display = "block";
    }

    // Fade out music
    if (!AudioManager.isMuted) {
      AudioManager.fadeOut(
        state.isPracticeMode
          ? AudioManager.practiceMusic
          : AudioManager.backgroundMusic
      );
    }

    cancelAnimationFrame(animationFrameId);
  } else {
    // In practice mode, just reset position but keep playing
    player.style.bottom = "50px";
    GameState.setState({
      playerVelocity: 0,
      rotation: 0,
    });
    createParticles("#ff00ff"); // Different color particles for practice mode respawn
  }
}

/**
 * Restarts the game, resetting all necessary variables and states
 * Called after game over or when manually restarting
 */
async function restartGame() {
  // Cancel any pending animation frames
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Reset pause state
  GameState.setState({ isPaused: false });
  pauseMenu.style.display = "none";

  // Reset game state
  GameState.setState({
    isGameOver: false,
    isLevelComplete: false,
    currentColumn: 0,
    gameSpeed: 4,
    playerVelocity: 0,
    rotation: 0,
    isOnPlatform: false,
    isJumping: false,
    doubleJumpAvailable: true,
    passedBlocks: 0,
  });

  // Reset UI elements
  if (levelCompleteElement) {
    // Add null check
    levelCompleteElement.style.display = "none";
  }
  if (gameOverElement) {
    // Add null check
    gameOverElement.style.display = "none";
  }
  player.style.bottom = "50px";
  player.style.transform = "rotate(0deg)";

  // Reset camera position
  cameraOffsetY = 0;
  DOMManager.getElement("#cameraContainer").style.transform = "translateY(0)";

  // Clear obstacles and particles
  clearObstacles(obstacles);

  cleanupParticles();

  // Reset progress bar
  progressFill.style.width = "0%";
  progressText.textContent = "0%";

  // Stop all music first
  await Promise.all([
    AudioManager.pause(AudioManager.backgroundMusic),
    AudioManager.pause(AudioManager.practiceMusic),
  ]);

  // Start the correct music if not muted
  const currentState = GameState.getState();
  if (!AudioManager.isMuted && !currentState.isPaused) {
    try {
      const musicToPlay = currentState.isPracticeMode
        ? AudioManager.practiceMusic
        : AudioManager.backgroundMusic;
      const musicToPause = currentState.isPracticeMode
        ? AudioManager.backgroundMusic
        : AudioManager.practiceMusic;
      await AudioManager.switchTracks(musicToPlay, musicToPause);
    } catch (error) {
      console.error("Audio reset failed:", error);
    }
  }

  // Restart music
  await AudioManager.restart();

  // Reset player position
  player.style.bottom = `${CONSTANTS.GROUND_HEIGHT}px`;
  player.style.transform = "rotate(0deg)";

  // Start game loop (assign id)
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(updateGame);
}

/**
 * Handles level completion state and UI
 * Called when player reaches the finish line
 */
function levelComplete() {
  // Sync GameState.currentTime with levelTime for accurate score submission
  GameState.setState({
    isLevelComplete: true,
    currentTime: levelTime,
  });
  clearInterval(levelTimer);

  const state = GameState.getState();
  // Save score using the filename instead of levelId
  const urlParams = new URLSearchParams(window.location.search);
  const onlineparam = urlParams.get("online");
  if (onlineparam) {
    const filename = urlParams.get("levelFile");
    ScoreManager.addRun(
      filename,
      state.currentTime,
      state.jumpCount,
      state.deathCount
    );
  } else {
    const filename = urlParams.get("level");
    ScoreManager.addRun(
      "Level " + filename,
      state.currentTime,
      state.jumpCount,
      state.deathCount
    );
  }

  if (levelCompleteElement) {
    // Add null check
    levelCompleteElement.style.display = "block";
  }

  // Play completion sound and fade music
  if (!AudioManager.isMuted) {
    AudioManager.completionSound.currentTime = 0;
    AudioManager.completionSound.play();
    AudioManager.fadeOut(
      state.isPracticeMode
        ? AudioManager.practiceMusic
        : AudioManager.backgroundMusic
    );
  }

  // Update progress indicators
  progressFill.style.width = "100%";
  progressText.textContent = "100% (Level Complete!)";

  // Setup next level button
  const nextLevelBtn = DOMManager.getElement("#nextLevelBtn");

  // Handle next level button visibility
  if (window.location.search.includes("test=true")) {
    nextLevelBtn.style.display = "none";
  } else {
    const nextLevelNumber = parseInt(levelId) + 1;

    nextLevelBtn.onclick = () => {
      window.location.href = `gameloader.html?level=${nextLevelNumber}`;
    };

    // Check if next level exists
    const checkScript = document.createElement("script");
    checkScript.src = `./Levels/level${nextLevelNumber}.js`;

    checkScript.onload = () => {
      nextLevelBtn.style.display = "inline-block";
    };
    checkScript.onerror = () => {
      nextLevelBtn.style.display = "none";
    };
    document.body.appendChild(checkScript);
  }

  cleanupParticles();
  cancelAnimationFrame(animationFrameId);
}

// Add cleanup function for when leaving the page
window.addEventListener("beforeunload", () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});

// Initialize database when page loads
document.addEventListener("DOMContentLoaded", async () => {
  // Get DOM elements now that DOM is ready
  gameContainer = DOMManager.getElement("#gameContainer");
  player = DOMManager.getElement("#player");
  restartBtn = DOMManager.getElement("#restartBtn");
  progressText = DOMManager.getElement("#progressText");
  progressFill = DOMManager.getElement("#progressFill");
  pauseMenu = DOMManager.getElement("#pauseMenu");
  levelCompleteElement = DOMManager.getElement("#levelComplete");
  gameOverElement = DOMManager.getElement("#gameOver");
  muteButton = DOMManager.getElement("#muteButton");

  // Make player globally accessible for other modules
  // @ts-ignore
  window.player = player;

  // Make progress elements globally accessible
  // @ts-ignore
  window.progressText = progressText;
  // @ts-ignore
  window.progressFill = progressFill;

  // Single mute button setup
  if (muteButton) {
    // Remove any existing listeners by cloning
    const newMuteButton = muteButton.cloneNode(true);
    muteButton.parentNode.replaceChild(newMuteButton, muteButton);

    // Add single event listener
    newMuteButton.addEventListener("click", function () {
      toggleGameState("mute");
      this.textContent = AudioManager.isMuted ? "🔇" : "🔊";
    });

    // Set initial icon
    newMuteButton.textContent = AudioManager.isMuted ? "🔇" : "🔊";
  }

  try {
    console.log("Starting ScoreManager initialization...");
    await ScoreManager.initialize().catch((error) => {
      console.error("ScoreManager initialization failed:", error);
      throw error;
    });
    console.log("ScoreManager initialized successfully");

    // Don't automatically show scoreboard on page load
    // Only show when specifically requested (e.g., level complete)

    // Then proceed with level loading
    console.log("Starting level initialization...");
    await DatabaseManager.initDB();
    await LevelLoader.initializeLevelData();
    await initializeLevel();
    console.log("Level initialization complete");
  } catch (error) {
    console.error("Error during initialization:", error);
    showLoadingError(`Failed to initialize: ${error.message}`);
  }

  // Set up event listeners now that elements are ready
  if (restartBtn) {
    restartBtn.addEventListener("click", restartGame);
  }

  // Resume game from pause menu
  const resumeBtn = document.getElementById("resumeBtn");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => toggleGameState("pause"));
  }

  // Restart game from pause menu
  const restartFromPauseBtn = document.getElementById("restartFromPauseBtn");
  if (restartFromPauseBtn) {
    restartFromPauseBtn.addEventListener("click", () => {
      pauseMenu.style.display = "none";
      GameState.setState({ isPaused: false });
      location.reload();
    });
  }

  // Toggle pause with pause button
  const pauseButton = document.getElementById("pauseButton");
  if (pauseButton) {
    pauseButton.addEventListener("click", () => toggleGameState("pause"));
  }

  // Escape key handler
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      toggleGameState("pause");
    }
  });
});

console.log("All functions defined and listeners added");

export { gameContainer, player, obstacles, particles };