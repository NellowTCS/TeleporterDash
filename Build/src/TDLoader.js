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
import { updateBackgroundColor, resetColorCache } from "./Utilities/colorManager.js";
import {
  checkCollisionWorld,
  handlePlatformCollisionWorld,
  clearObstacles as clearObstaclesPhysics,
} from "./TDEngine/physicsEngine.js";
import {
  createParticles,
  cleanupParticles,
  resetParticleCache,
} from "./TDEngine/particleEngine.js";
import { setupControls } from "./TDEngine/inputManager.js";
import { createObstacleFromMatrix } from "./TDEngine/levelParser.js";
import { updateProgress, resetProgress } from "./TDEngine/progressManager.js";
import {
  init as renderInit,
  createPlayerElement,
  createObstacleElement,
  renderPlayer,
  renderObstacles,
  setCamera,
  removeElement,
  resetRenderCache,
} from "./TDEngine/renderEngine.js";

// ===== Variables =====

let gameContainer = null;
let cameraContainer = null;
let playerElement = null;

let player = null;
let obstacles = [];
let particles = [];

let restartBtn = null;
let muteButton = null;
let levelCompleteElement = null;
let gameOverElement = null;
let animationFrameId = null;

const PLAYER_X = 100;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 30;

const gravity = 2000;

let levelTimer = null;
let levelTime = 0;
let lastFrameTime = performance.now();
let deltaTime = 0;
const MAX_DELTA_TIME = 1 / 30;

let progressText = null;
let progressFill = null;

let autoRestartEnabled = false;
// @ts-ignore
let isRestarting = false;

// @ts-ignore
let isPaused = false;
let pauseMenu = null;

let cameraOffsetY = 0;
const CAMERA_FOLLOW_THRESHOLD = 50;
const MAX_CAMERA_SPEED = 20;
// @ts-ignore
window.cameraOffsetY = cameraOffsetY;

// Cache for container dimensions (updated once per frame max)
let cachedContainerWidth = 800;
let cachedContainerHeight = 600;
let lastDimensionUpdate = 0;
const DIMENSION_UPDATE_INTERVAL = 500; // Update dimensions every 500ms

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

function createPlayerModel(existingElement) {
  const el = createPlayerElement(existingElement);
  const initialY = 50;
  const p = {
    x: PLAYER_X,
    y: initialY,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    rotation: 0,
    element: el,
    prevY: undefined,
  };
  return p;
}

function updateCachedDimensions() {
  const now = performance.now();
  if (now - lastDimensionUpdate > DIMENSION_UPDATE_INTERVAL) {
    if (gameContainer) {
      cachedContainerWidth = gameContainer.offsetWidth;
      cachedContainerHeight = gameContainer.offsetHeight;
    }
    lastDimensionUpdate = now;
  }
}

export function toggleGameState(action) {
  if (action === "mute") {
    AudioManager.toggleMute();
  } else if (action === "pause") {
    const state = GameState.getState();
    if (state. isGameOver || state.isLevelComplete || ! state.isLevelStarted)
      return;

    const newPauseState = !state.isPaused;
    GameState.setState({ isPaused: newPauseState });
    if (pauseMenu) pauseMenu.style. display = newPauseState ? "block" : "none";

    const currentMusic = state.isPracticeMode
      ? AudioManager.practiceMusic
      : AudioManager. backgroundMusic;
    if (newPauseState) {
      AudioManager.pause(currentMusic);
    } else {
      if (! AudioManager.isMuted) {
        AudioManager.play(currentMusic, currentMusic.currentTime). catch((e) =>
          console.error("Error resuming music:", e),
        );
      }
    }
  }
}

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
  setupControls(SettingsManager.current. controlMethod);

  if (volumeSlider) {
    volumeSlider.value = SettingsManager.current.volume;
    volumeValue.textContent = SettingsManager.current.volume + "%";
  }

  if (controlMethodSelect)
    // @ts-ignore
    controlMethodSelect. value =
      SettingsManager.current.controlMethod || "keyboard";

  if (practiceModeCheckbox) {
    // @ts-ignore
    practiceModeCheckbox.checked = SettingsManager. current.practiceMode;
    GameState.setState({
      isPracticeMode: SettingsManager.current.practiceMode,
    });
  }

  if (autoRestartCheckbox) {
    // @ts-ignore
    autoRestartCheckbox. checked = SettingsManager.current.autoRestartEnabled;
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
      GameState. setState({ isPracticeMode: practiceMode });
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
          SettingsManager. current.gameSpeed = 4;
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
        ! currentState.isPaused &&
        !currentState.isGameOver &&
        !currentState.isLevelComplete
      ) {
        try {
          const musicToPlay = practiceMode
            ? AudioManager. practiceMusic
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
      gameSpeedSelect.value = SettingsManager.current. gameSpeed. toString();
    }

    gameSpeedSelect.addEventListener("change", function () {
      const currentState = GameState. getState();
      if (currentState.isPracticeMode) {
        // @ts-ignore
        const speedMultiplier = parseFloat(this.value);
        GameState.setState({ gameSpeed: 4 * speedMultiplier });
        SettingsManager. current.gameSpeed = 4 * speedMultiplier;
        SettingsManager. save();
      }
    });
  }

  if (controlMethodSelect) {
    controlMethodSelect. addEventListener("change", function () {
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

async function startLevel() {
  const prevState = GameState.getState();
  if (prevState.isLevelStarted) return;

  const settingsMenu = DOMManager.getElement("#settingsMenu");
  if (settingsMenu) settingsMenu.style. display = "none";

  levelTime = 0;
  if (levelTimer) {
    clearInterval(levelTimer);
    levelTimer = null;
  }

  // Update cached dimensions at level start
  if (gameContainer) {
    cachedContainerWidth = gameContainer.offsetWidth;
    cachedContainerHeight = gameContainer. offsetHeight;
    lastDimensionUpdate = performance.now();
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

  levelTimer = setInterval(() => {
    levelTime = +(levelTime + 0.1).toFixed(1);
    GameState.setState({ currentTime: levelTime });
  }, 100);

  const currentState = GameState. getState();
  const musicToPlay = currentState.isPracticeMode
    ? AudioManager.practiceMusic
    : AudioManager. backgroundMusic;
  try {
    if (! AudioManager.isMuted && musicToPlay) {
      const startTime = AudioManager.lastMusicTime || 0;
      await AudioManager.play(musicToPlay, startTime);
    }
  } catch (err) {
    console.error("Error starting music:", err);
  }

  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(updateGame);
}

function updateGame() {
  const currentFrameTime = performance. now();
  deltaTime = Math.min(
    (currentFrameTime - lastFrameTime) / 1000,
    MAX_DELTA_TIME,
  );
  lastFrameTime = currentFrameTime;

  const state = GameState. getState();

  if (! state.isLevelStarted || state.isGameOver || state.isLevelComplete) {
    animationFrameId = requestAnimationFrame(updateGame);
    return;
  }
  if (state.isPaused) {
    animationFrameId = requestAnimationFrame(updateGame);
    return;
  }

  // Update cached dimensions periodically
  updateCachedDimensions();

  updateBackgroundColor();

  const baseSpeed = 240;
  const currentSpeed = state.isPracticeMode
    ? baseSpeed * (state.gameSpeed / 4)
    : baseSpeed;
  const frameSpeed = currentSpeed * deltaTime;

  // Use cached container width instead of reading offsetWidth every frame
  const spawnX = cachedContainerWidth;

  // Create new obstacles when needed
  if (
    state.levelMatrix &&
    state.levelMatrix.length > 0 &&
    state.currentColumn < state.levelMatrix[0].length
  ) {
    const lastObstacle = obstacles[obstacles.length - 1];
    const shouldSpawn = obstacles.length === 0 || 
      (lastObstacle && spawnX - lastObstacle. x > CONSTANTS.COLUMN_WIDTH);
    
    if (shouldSpawn) {
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
  }

  // Player physics
  const newVelocity = state.playerVelocity + gravity * deltaTime;
  const currentBottom = player.y;
  const prevBottom = currentBottom;
  let newBottom = currentBottom - newVelocity * deltaTime;

  if (newBottom <= 50) {
    newBottom = 50;
    GameState.setState({
      isJumping: false,
      doubleJumpAvailable: true,
      playerVelocity: 0,
    });
  } else {
    GameState. setState({
      playerVelocity: newVelocity,
    });
  }

  player.prevY = prevBottom;
  player.y = newBottom;
  player.x = PLAYER_X;

  const rotationSpeed = 360;
  if (state.isJumping) {
    player.rotation = state.rotation + rotationSpeed * deltaTime;
    GameState.setState({ rotation: player.rotation });
  } else if (player.rotation !== 0) {
    player.rotation = 0;
    GameState.setState({ rotation: 0 });
  }

  // Move obstacles and check collisions
  const playerLeft = player.x - 100;
  const playerRight = player.x + 100;
  
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= frameSpeed;

    // Remove off-screen obstacles
    if (obs.x < -100) {
      if (obs.element) removeElement(obs.element);
      obstacles. splice(i, 1);
      continue;
    }

    // Only check collisions for nearby obstacles
    if (obs.x > playerLeft && obs. x < playerRight) {
      const collision = checkCollisionWorld(player, obs);
      if (collision) {
        if (obs.type === "finish") {
          levelComplete();
          return;
        } else if (obs. type === "spike" && ! state.isPracticeMode) {
          gameOver();
          return;
        } else if (obs. type === "teleporter") {
          const rotation =
            typeof obs.rotation === "number"
              ? obs. rotation
              : parseInt(obs.element?. getAttribute("data-rotation") || "0", 10);

          if (rotation === 90) {
            const dx = -120;
            for (let j = 0; j < obstacles.length; j++) {
              obstacles[j].x += dx;
            }
            player.x = PLAYER_X;
          } else if (rotation === 270) {
            const dx = 120;
            for (let j = 0; j < obstacles.length; j++) {
              obstacles[j].x += dx;
            }
            player.x = PLAYER_X;
          } else {
            const dy = rotation === 180 ? -120 : 180;
            player.y = player.y + dy;
          }

          GameState.setState({ playerVelocity: 0 });
          particles.push(... createParticles("#ff00ff", player, cameraContainer || gameContainer));
          setTimeout(() => particles.push(...createParticles("#ff00ff", player, cameraContainer || gameContainer)), 100);
        } else if (obs.type === "platform") {
          const platformCollision = handlePlatformCollisionWorld(player, obs);
          if (platformCollision === "death" && !state.isPracticeMode) {
            gameOver();
            return;
          }
        }
      }
    }
  }

  // Particles update
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];

    particle. vy += 300 * deltaTime;
    particle.life -= 1.2 * deltaTime;
    if (particle. life <= 0) {
      if (particle.element) removeElement(particle. element);
      particles.splice(i, 1);
      continue;
    }

    particle.x += particle.vx * deltaTime;
    particle.y += particle.vy * deltaTime;

    if (particle. element) {
      particle.element.style. transform = `translate3d(${Math.round(particle. x)}px, ${Math.round(-particle.y)}px, 0)`;
      particle.element.style.opacity = particle.life;
    }
  }

  // Render pass
  renderPlayer(player);
  renderObstacles(obstacles);

  // Camera follow using cached height
  const containerHeight = cachedContainerHeight;
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

  animationFrameId = requestAnimationFrame(updateGame);
}

async function gameOver() {
  const state = GameState. getState();
  if (! state.isPracticeMode) {
    GameState.setState({
      isGameOver: true,
      deathCount: state. deathCount + 1,
    });

    await Promise.all([
      AudioManager.pause(AudioManager.backgroundMusic),
      AudioManager.pause(AudioManager.practiceMusic),
    ]);

    if (! AudioManager.isMuted) {
      AudioManager.deathSound.currentTime = 0;
      AudioManager. deathSound.play();
    }

    particles.push(...createParticles("#ff0000", player, cameraContainer || gameContainer));

    if (autoRestartEnabled) {
      setTimeout(() => {
        restartGame();
      }, 1000);
      return;
    }

    if (gameOverElement) gameOverElement.style. display = "block";

    if (! AudioManager.isMuted) {
      AudioManager.fadeOut(
        state.isPracticeMode
          ? AudioManager.practiceMusic
          : AudioManager.backgroundMusic,
      );
    }

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  } else {
    player.y = 50;
    player. prevY = undefined;
    GameState.setState({ playerVelocity: 0, rotation: 0 });
    particles. push(...createParticles("#ff00ff", player, cameraContainer || gameContainer));
  }
}

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

  if (levelCompleteElement) levelCompleteElement.style. display = "none";
  if (gameOverElement) gameOverElement.style.display = "none";

  player.x = PLAYER_X;
  player.y = 50;
  player.prevY = undefined;
  player.rotation = 0;

  // Reset caches
  resetRenderCache();
  resetColorCache();
  resetParticleCache();
  resetProgress();

  renderPlayer(player);

  cameraOffsetY = 0;
  setCamera(0);

  clearObstaclesPhysics(obstacles);
  obstacles.length = 0;

  cleanupParticles(particles);
  particles.length = 0;

  if (progressFill) progressFill.style.width = "0%";
  if (progressText) progressText.textContent = "0%";

  await Promise.all([
    AudioManager.pause(AudioManager.backgroundMusic),
    AudioManager.pause(AudioManager.practiceMusic),
  ]);

  const currentState = GameState. getState();
  if (! AudioManager.isMuted && ! currentState.isPaused) {
    try {
      const musicToPlay = currentState.isPracticeMode
        ? AudioManager.practiceMusic
        : AudioManager.backgroundMusic;
      const musicToPause = currentState. isPracticeMode
        ? AudioManager. backgroundMusic
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

function levelComplete() {
  GameState.setState({ isLevelComplete: true, currentTime: levelTime });
  clearInterval(levelTimer);

  const state = GameState. getState();
  const urlParams = new URLSearchParams(window.location.search);
  const onlineparam = urlParams.get("online");
  if (onlineparam) {
    const filename = urlParams.get("levelFile");
    ScoreManager.addRun(
      filename,
      state.currentTime,
      state. jumpCount,
      state.deathCount,
    );
  } else {
    const filename = urlParams. get("level");
    ScoreManager.addRun(
      "Level " + filename,
      state.currentTime,
      state. jumpCount,
      state.deathCount,
    );
  }

  if (levelCompleteElement) levelCompleteElement.style.display = "block";

  if (! AudioManager.isMuted) {
    AudioManager.completionSound.currentTime = 0;
    AudioManager.completionSound.play();
    AudioManager.fadeOut(
      state. isPracticeMode
        ? AudioManager. practiceMusic
        : AudioManager.backgroundMusic,
    );
  }

  if (progressFill) progressFill.style.width = "100%";
  if (progressText) progressText.textContent = "100% (Level Complete!)";

  cancelAnimationFrame(animationFrameId);
}

window.addEventListener("beforeunload", () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  gameContainer = DOMManager.getElement("#gameContainer");
  cameraContainer = DOMManager.getElement("#cameraContainer");
  playerElement = DOMManager. getElement("#player");
  restartBtn = DOMManager.getElement("#restartBtn");
  progressText = DOMManager. getElement("#progressText");
  progressFill = DOMManager.getElement("#progressFill");
  pauseMenu = DOMManager.getElement("#pauseMenu");
  levelCompleteElement = DOMManager.getElement("#levelComplete");
  gameOverElement = DOMManager.getElement("#gameOver");
  muteButton = DOMManager. getElement("#muteButton");

  // Cache initial dimensions
  if (gameContainer) {
    cachedContainerWidth = gameContainer.offsetWidth;
    cachedContainerHeight = gameContainer. offsetHeight;
  }

  renderInit(gameContainer, cameraContainer);

  player = createPlayerModel(playerElement);
  playerElement = player.element;

  // @ts-ignore
  window.player = playerElement;
  // @ts-ignore
  window.playerModel = player;

  // @ts-ignore
  window.progressText = progressText;
  // @ts-ignore
  window. progressFill = progressFill;

  if (muteButton) {
    const newMuteButton = muteButton.cloneNode(true);
    muteButton.parentNode.replaceChild(newMuteButton, muteButton);
    newMuteButton. addEventListener("click", function () {
      toggleGameState("mute");
      this.textContent = AudioManager.isMuted ? "🔇" : "🔊";
    });
    newMuteButton. textContent = AudioManager.isMuted ? "🔇" : "🔊";
  }

  try {
    console.log("Starting ScoreManager initialization...");
    await ScoreManager.initialize(). catch((error) => {
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

  if (restartBtn) restartBtn.addEventListener("click", restartGame);
  const resumeBtn = document.getElementById("resumeBtn");
  if (resumeBtn)
    resumeBtn.addEventListener("click", () => toggleGameState("pause"));
  const restartFromPauseBtn = document. getElementById("restartFromPauseBtn");
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
