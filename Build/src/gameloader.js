import { GameState } from "./Utilities/gameState.js";
import { AudioManager } from "./Utilities/audioManager.js";
import { LevelLoader } from "./TDEngine/levelLoader.js";
import { SettingsManager } from "./TDEngine/settingsManager.js";
import { ScoreManager } from "./TDEngine/scoreManager.js";
import { DatabaseManager } from "./Utilities/databaseManager.js";
// @ts-ignore
import { COLOR_STEPS, CONSTANTS } from "./Utilities/constants.js";
import { DOMManager } from "./Utilities/domManager.js";
import { showLoadingError } from "./Utilities/notificationManager.js";
import { updateBackgroundColor } from "./Utilities/colorManager.js";
import {
  checkCollisionWorld,
  handlePlatformCollisionWorld,
  clearObstacles as clearObstaclesPhysics,
} from "./TDEngine/physicsEngine.js";
import {
  createParticles,
  cleanupParticles,
} from "./TDEngine/particleEngine.js";
import { setupControls } from "./TDEngine/inputManager.js";
import { createObstacleFromMatrix } from "./TDEngine/levelParser.js";
import { updateProgress } from "./TDEngine/progressManager.js";
import {
  init as renderInit,
  createPlayerElement,
  createObstacleElement,
  renderPlayer,
  renderObstacles,
  setCamera,
  removeElement,
} from "./TDEngine/renderEngine.js";

// ===== Variables =====

// DOM references (exported 'player' will be the player DOM element for compatibility)
let gameContainer = null;
let cameraContainer = null;
let playerElement = null; // DOM element exposed as exported 'player'

// World model objects (used internally by physics + renderer)
let player = null; // numeric model: { x, y, width, height, rotation, element }
let obstacles = []; // Array of world obstacle objects (each has .element)
let particles = []; // Array of active particle effects (DOM-backed)

// UI / controls
let restartBtn = null;
let muteButton = null;
let levelCompleteElement = null;
let gameOverElement = null;
let animationFrameId = null; // ID of the current animation frame

// Constants
const PLAYER_X = 100;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 30;

// Physics
const gravity = 2000; // Rate at which player falls (pixels/second²)

// Timing
let levelTimer = null;
let levelTime = 0;
let lastFrameTime = performance.now(); // Timestamp of the last frame
let deltaTime = 0; // Time elapsed since last frame (in seconds)
const MAX_DELTA_TIME = 1 / 30; // Cap deltaTime to prevent large jumps

// Progress
let progressText = null;
let progressFill = null;

// Settings
let autoRestartEnabled = false; // Whether to automatically restart on death
// @ts-ignore
let isRestarting = false; // Whether the game is currently restarting

// Pause
// @ts-ignore
let isPaused = false;
let pauseMenu = null;

// Camera
let cameraOffsetY = 0;
const CAMERA_FOLLOW_THRESHOLD = 50;
const MAX_CAMERA_SPEED = 20;
// @ts-ignore
window.cameraOffsetY = cameraOffsetY;

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

// Helper to create numeric player object and ensure element exists
function createPlayerModel(existingElement) {
  const el = createPlayerElement(existingElement);
  const initialY = CONSTANTS.GROUND_HEIGHT || 50;
  const p = {
    x: PLAYER_X,
    y: initialY,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    rotation: 0,
    element: el,
  };
  return p;
}

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
    if (pauseMenu) pauseMenu.style.display = newPauseState ? "block" : "none";

    const currentMusic = state.isPracticeMode
      ? AudioManager.practiceMusic
      : AudioManager.backgroundMusic;
    if (newPauseState) {
      AudioManager.pause(currentMusic);
    } else {
      if (!AudioManager.isMuted) {
        AudioManager.play(currentMusic, currentMusic.currentTime).catch((e) =>
          console.error("Error resuming music:", e),
        );
      }
    }
  }
}

/**
 * Initializes level settings and UI controls
 */
async function initializeLevel() {
  // @ts-ignore
  const settingsMenu = DOMManager.getElement("#settingsMenu");
  const volumeSlider = DOMManager.getElement("#volumeSlider");
  const volumeValue = DOMManager.getElement("#volumeValue");
  const controlMethodSelect = document.getElementById("controlMethod");
  const autoRestartCheckbox = document.getElementById("autoRestart");
  const practiceModeCheckbox = document.getElementById("practiceMode");
  const startLevelBtn = document.getElementById("startLevelBtn");

  SettingsManager.load();
  setupControls(SettingsManager.current.controlMethod);

  if (volumeSlider) {
    volumeSlider.value = SettingsManager.current.volume;
    volumeValue.textContent = SettingsManager.current.volume + "%";
  }

  if (controlMethodSelect)
  // @ts-ignore
  controlMethodSelect.value =
      SettingsManager.current.controlMethod || "keyboard";

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
    // @ts-ignore
    autoRestartEnabled = SettingsManager.current.autoRestartEnabled;
    autoRestartCheckbox.addEventListener("change", function () {
      // @ts-ignore
      autoRestartEnabled = this.checked;
      SettingsManager.current.autoRestartEnabled = autoRestartEnabled;
      SettingsManager.save();
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener("input", function () {
      const volume = this.value;
      volumeValue.textContent = volume + "%";
      SettingsManager.current.volume = volume;
      SettingsManager.save();
      [
        AudioManager.backgroundMusic,
        AudioManager.practiceMusic,
        AudioManager.jumpSound,
        AudioManager.deathSound,
        AudioManager.completionSound,
      ].forEach((audio) => {
        if (audio) audio.volume = SettingsManager.current.volume / 100;
      });
    });
  }

  if (practiceModeCheckbox) {
    practiceModeCheckbox.addEventListener("change", async function () {
      // @ts-ignore
      const practiceMode = this.checked;
      GameState.setState({ isPracticeMode: practiceMode });
      SettingsManager.current.practiceMode = practiceMode;
      SettingsManager.save();

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
          const newGameSpeed = SettingsManager.current.gameSpeed || 4;
          GameState.setState({ gameSpeed: newGameSpeed });
          // @ts-ignore
          gameSpeedSelect.value = (newGameSpeed / 4).toString();
        }
      }

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
        await Promise.all([
          AudioManager.pause(AudioManager.backgroundMusic),
          AudioManager.pause(AudioManager.practiceMusic),
        ]);
      }
    });
  }

  const gameSpeedSelect = document.getElementById("gameSpeed");
  if (gameSpeedSelect) {
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

  const settingsMenu = DOMManager.getElement("#settingsMenu");
  if (settingsMenu) settingsMenu.style.display = "none";

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

  // Start level time updater (ticks every 100ms)
  levelTimer = setInterval(() => {
    levelTime = +(levelTime + 0.1).toFixed(1);
    GameState.setState({ currentTime: levelTime });
  }, 100);

  const currentState = GameState.getState();
  const musicToPlay = currentState.isPracticeMode
    ? AudioManager.practiceMusic
    : AudioManager.backgroundMusic;
  try {
    if (!AudioManager.isMuted && musicToPlay) {
      const startTime = AudioManager.lastMusicTime || 0;
      await AudioManager.play(musicToPlay, startTime);
    }
  } catch (err) {
    console.error("Error starting music:", err);
  }

  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(updateGame);
}

/**
 * Main game loop that updates world and renders
 */
function updateGame() {
  const currentFrameTime = performance.now();
  deltaTime = Math.min(
    (currentFrameTime - lastFrameTime) / 1000,
    MAX_DELTA_TIME,
  );
  lastFrameTime = currentFrameTime;

  const state = GameState.getState();

  if (!state.isLevelStarted || state.isGameOver || state.isLevelComplete) {
    animationFrameId = requestAnimationFrame(updateGame);
    return;
  }
  if (state.isPaused) {
    animationFrameId = requestAnimationFrame(updateGame);
    return;
  }

  updateBackgroundColor();

  // Movement speed (pixels/sec) applied to obstacles (world)
  const baseSpeed = 240;
  const currentSpeed = state.isPracticeMode
    ? baseSpeed * (state.gameSpeed / 4)
    : baseSpeed;
  const frameSpeed = currentSpeed * deltaTime;

  // Create new obstacles when needed (use world spawnX = gameContainer.offsetWidth)
  const spawnX = gameContainer.offsetWidth;
  if (
    state.levelMatrix &&
    state.levelMatrix.length > 0 &&
    state.currentColumn < state.levelMatrix[0].length &&
    (obstacles.length === 0 ||
      gameContainer.offsetWidth - obstacles[obstacles.length - 1]?.x >
        CONSTANTS.COLUMN_WIDTH)
  ) {
    for (let row = 0; row < state.levelMatrix.length; row++) {
      const ob = createObstacleFromMatrix(
        state.levelMatrix[row][state.currentColumn],
        row,
        spawnX,
      );
      obstacles.push(ob);
    }
    GameState.setState({ currentColumn: state.currentColumn + 1 });
    updateProgress();
  }

  // Player physics (world)
  const newVelocity = state.playerVelocity + gravity * deltaTime;
  const currentBottom = player.y;
  let newBottom = currentBottom - newVelocity * deltaTime;

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

  player.y = newBottom;
  player.x = PLAYER_X; // keep fixed

  // Rotate player
  const rotationSpeed = 360;
  if (state.isJumping) {
    player.rotation = state.rotation + rotationSpeed * deltaTime;
    GameState.setState({ rotation: player.rotation });
  } else if (player.rotation !== 0) {
    player.rotation = 0;
    GameState.setState({ rotation: 0 });
  }

  // Move obstacles (world)
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= frameSpeed;

    // Remove off-screen obstacles
    if (obs.x < -100) {
      if (obs.element) removeElement(obs.element);
      obstacles.splice(i, 1);
      continue;
    }

    // Narrow proximity check before collision for perf
    if (Math.abs(obs.x - player.x) < 200) {
      const collision = checkCollisionWorld(player, obs);
      if (collision) {
        if (obs.type === "finish") {
          levelComplete();
        } else if (obs.type === "spike" && !state.isPracticeMode) {
          gameOver();
        } else if (obs.type === "teleporter") {
          const rotation =
            typeof obs.rotation === "number"
              ? obs.rotation
              : parseInt(obs.element?.getAttribute("data-rotation") || "0", 10);

          if (rotation === 90) {
            const dx = -120;
            obstacles.forEach((o) => {
              o.x += dx;
            });
            player.x = PLAYER_X;
          } else if (rotation === 270) {
            const dx = 120;
            obstacles.forEach((o) => {
              o.x += dx;
            });
            player.x = PLAYER_X;
          } else {
            const dy = rotation === 180 ? -120 : 180;
            player.y = player.y + dy;
          }

          GameState.setState({ playerVelocity: 0 });
          createParticles("#ff00ff");
          setTimeout(() => createParticles("#ff00ff"), 100);
        } else if (obs.type === "platform") {
          const platformCollision = handlePlatformCollisionWorld(player, obs);
          if (platformCollision === "death" && !state.isPracticeMode) {
            gameOver();
          }
        }
      }
    }
  }

  // Particles update
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.vy += 300 * deltaTime;
    particle.life -= 1.2 * deltaTime;
    if (particle.life <= 0) {
      if (particle.element) removeElement(particle.element);
      particles.splice(i, 1);
      continue;
    }
    particle.element.style.left = `${Math.round(parseFloat(particle.element.style.left || 0) + particle.vx * deltaTime)}px`;
    particle.element.style.top = `${Math.round(parseFloat(particle.element.style.top || 0) + particle.vy * deltaTime)}px`;
    particle.element.style.opacity = particle.life;
  }

  // Render pass
  renderPlayer(player);
  renderObstacles(obstacles);

  // Camera follow (based on player.y)
  const containerHeight = gameContainer.offsetHeight;
  const targetCameraY = Math.max(0, player.y - containerHeight / 2);
  const cameraDistance = targetCameraY - cameraOffsetY;
  if (Math.abs(cameraDistance) > CAMERA_FOLLOW_THRESHOLD) {
    const baseCameraSpeed = Math.min(
      Math.abs(cameraDistance) * 6,
      MAX_CAMERA_SPEED * 60,
    );
    const cameraSpeed = baseCameraSpeed * deltaTime;
    cameraOffsetY += Math.sign(cameraDistance) * cameraSpeed;
  }
  setCamera(cameraOffsetY);
  // @ts-ignore
  window.cameraOffsetY = cameraOffsetY;

  if (!state.isGameOver && !state.isLevelComplete) {
    animationFrameId = requestAnimationFrame(updateGame);
  }
}

/**
 * Handles game over state and UI
 */
async function gameOver() {
  const state = GameState.getState();
  if (!state.isPracticeMode) {
    GameState.setState({
      isGameOver: true,
      deathCount: state.deathCount + 1,
    });

    await Promise.all([
      AudioManager.pause(AudioManager.backgroundMusic),
      AudioManager.pause(AudioManager.practiceMusic),
    ]);

    if (!AudioManager.isMuted) {
      AudioManager.deathSound.currentTime = 0;
      AudioManager.deathSound.play();
    }

    // Create particles at player position (relative to cameraContainer)
    createParticles("#ff0000");

    if (autoRestartEnabled) {
      setTimeout(() => {
        restartGame();
      }, 1000);
      return;
    }

    if (gameOverElement) gameOverElement.style.display = "block";

    if (!AudioManager.isMuted) {
      AudioManager.fadeOut(
        state.isPracticeMode
          ? AudioManager.practiceMusic
          : AudioManager.backgroundMusic,
      );
    }

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  } else {
    player.y = 50;
    GameState.setState({ playerVelocity: 0, rotation: 0 });
    createParticles("#ff00ff");
  }
}

/**
 * Restarts the game, resetting all necessary variables and states
 */
async function restartGame() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  GameState.setState({ isPaused: false });
  if (pauseMenu) pauseMenu.style.display = "none";

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

  if (levelCompleteElement) levelCompleteElement.style.display = "none";
  if (gameOverElement) gameOverElement.style.display = "none";

  // Reset player world model
  player.x = PLAYER_X;
  player.y = CONSTANTS.GROUND_HEIGHT || 50;
  player.rotation = 0;
  renderPlayer(player);

  // Reset camera
  cameraOffsetY = 0;
  setCamera(0);

  // Clear obstacles and particles
  clearObstaclesPhysics(obstacles);
  obstacles.length = 0;

  cleanupParticles();

  if (progressFill) progressFill.style.width = "0%";
  if (progressText) progressText.textContent = "0%";

  await Promise.all([
    AudioManager.pause(AudioManager.backgroundMusic),
    AudioManager.pause(AudioManager.practiceMusic),
  ]);

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

  await AudioManager.restart();

  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(updateGame);
}

/**
 * Handles level completion state and UI
 */
function levelComplete() {
  GameState.setState({ isLevelComplete: true, currentTime: levelTime });
  clearInterval(levelTimer);

  const state = GameState.getState();
  const urlParams = new URLSearchParams(window.location.search);
  const onlineparam = urlParams.get("online");
  if (onlineparam) {
    const filename = urlParams.get("levelFile");
    ScoreManager.addRun(
      filename,
      state.currentTime,
      state.jumpCount,
      state.deathCount,
    );
  } else {
    const filename = urlParams.get("level");
    ScoreManager.addRun(
      "Level " + filename,
      state.currentTime,
      state.jumpCount,
      state.deathCount,
    );
  }

  if (levelCompleteElement) levelCompleteElement.style.display = "block";

  if (!AudioManager.isMuted) {
    AudioManager.completionSound.currentTime = 0;
    AudioManager.completionSound.play();
    AudioManager.fadeOut(
      state.isPracticeMode
        ? AudioManager.practiceMusic
        : AudioManager.backgroundMusic,
    );
  }

  if (progressFill) progressFill.style.width = "100%";
  if (progressText) progressText.textContent = "100% (Level Complete!)";

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
  cameraContainer = DOMManager.getElement("#cameraContainer");
  playerElement = DOMManager.getElement("#player");
  restartBtn = DOMManager.getElement("#restartBtn");
  progressText = DOMManager.getElement("#progressText");
  progressFill = DOMManager.getElement("#progressFill");
  pauseMenu = DOMManager.getElement("#pauseMenu");
  levelCompleteElement = DOMManager.getElement("#levelComplete");
  gameOverElement = DOMManager.getElement("#gameOver");
  muteButton = DOMManager.getElement("#muteButton");

  // Initialize render engine
  renderInit(gameContainer, cameraContainer);

  // Create player model (numeric) and ensure element is attached & styled
  player = createPlayerModel(playerElement);
  // Keep playerElement in sync with player.element and expose DOM player for compatibility
  playerElement = player.element;

  // Legacy global references:
  // window.player should continue to be a DOM element for external modules (particleEngine etc.)
  // @ts-ignore
  window.player = playerElement;
  // expose numeric model too in case it's useful for debug/legacy
  // @ts-ignore
  window.playerModel = player;

  // Make progress elements globally accessible for compatibility
  // @ts-ignore
  window.progressText = progressText;
  // @ts-ignore
  window.progressFill = progressFill;

  // Setup mute button
  if (muteButton) {
    const newMuteButton = muteButton.cloneNode(true);
    muteButton.parentNode.replaceChild(newMuteButton, muteButton);
    newMuteButton.addEventListener("click", function () {
      toggleGameState("mute");
      this.textContent = AudioManager.isMuted ? "🔇" : "🔊";
    });
    newMuteButton.textContent = AudioManager.isMuted ? "🔇" : "🔊";
  }

  try {
    console.log("Starting ScoreManager initialization...");
    await ScoreManager.initialize().catch((error) => {
      console.error("ScoreManager initialization failed:", error);
      throw error;
    });
    console.log("ScoreManager initialized successfully");

    console.log("Starting level initialization...");
    await DatabaseManager.initDB();
    await LevelLoader.initializeLevelData();
    await initializeLevel();
    console.log("Level initialization complete");
  } catch (error) {
    console.error("Error during initialization:", error);
    showLoadingError(`Failed to initialize: ${error.message}`);
  }

  // Event listeners
  if (restartBtn) restartBtn.addEventListener("click", restartGame);
  const resumeBtn = document.getElementById("resumeBtn");
  if (resumeBtn)
    resumeBtn.addEventListener("click", () => toggleGameState("pause"));
  const restartFromPauseBtn = document.getElementById("restartFromPauseBtn");
  if (restartFromPauseBtn)
    restartFromPauseBtn.addEventListener("click", () => location.reload());
  const pauseButton = document.getElementById("pauseButton");
  if (pauseButton)
    pauseButton.addEventListener("click", () => toggleGameState("pause"));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") toggleGameState("pause");
  });

  console.log("All functions defined and listeners added");
});

export { gameContainer, playerElement as player, obstacles, particles };
