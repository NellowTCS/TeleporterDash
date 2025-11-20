// Game Loader for Teleporter Dash
import { GameState } from "./Utilities/gameState.js";
import { AudioManager } from "./Utilities/audioManager.js";
import { LevelLoader } from "./Game Engine/levelLoader.js";
import { SettingsManager } from "./Game Engine/settingsManager.js";
import { ScoreManager } from "./Game Engine/scoreManager.js";
import { DatabaseManager } from "./Utilities/databaseManager.js";
import { COLOR_MAP, CONSTANTS } from "./Utilities/constants.js";
import { DOMManager } from "./Utilities/domManager.js";
import { showLoadingError } from "./Utilities/notificationManager.js";

// Get reference to game container
let gameContainer = null;
let player = null;
let restartBtn = null;
let muteButton = null;

// Make player globally accessible for other modules
// @ts-ignore
window.player = player;

// Timer variables (needs to be accessible for clearing)
let levelTimer = null;
let levelTime = 0;

// Extract levelId from URL parameters
const urlParams = new URLSearchParams(window.location.search);
let levelId = null;
if (urlParams.has("level")) {
  levelId = urlParams.get("level");
} else if (urlParams.has("levelFile")) {
  levelId = urlParams.get("levelFile");
}

// Color mapping for blocks
// COLOR_MAP is now imported from constants.js

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

// ===== Variables =====

// Physics constants
const gravity = 2000; // Rate at which player falls (pixels/second²)
const jumpForce = -800; // Initial upward velocity when jumping (pixels/second)

// Game elements
let obstacles = []; // Array of all active obstacles
let particles = []; // Array of active particle effects
let animationFrameId = null; // ID of the current animation frame

// DeltaTime variables for frame-rate independence
let lastFrameTime = performance.now(); // Timestamp of the last frame
let deltaTime = 0; // Time elapsed since last frame (in seconds)
// @ts-ignore
const TARGET_FPS = 60; // Target frame rate for physics calculations
const MAX_DELTA_TIME = 1 / 30; // Cap deltaTime to prevent large jumps

// Progress tracking variables
let progressText = null;
let progressFill = null;
let totalColumns = 0; // Will be set when levelMatrix is loaded

// Global jump buffer for keyboard/mouse inputs
let jumpBufferTime = 0; // milliseconds

let lastJumpPressTime = 0;

// New variable for touch-specific sensitivity
let touchJumpDelay = 300; // milliseconds

// Progress update timing to optimize performance
let lastProgressUpdate = 0;
const progressUpdateInterval = 16; // ~60fps update frequency for progress bar
let totalBlocks = 0; // Total number of blocks in the level
// @ts-ignore
let passedBlocks = 0; // Number of blocks the player has passed

// Position of the finish line in the level matrix
let finishLinePosition = 0;

// Auto-restart settings
let autoRestartEnabled = false; // Whether to automatically restart on death
// @ts-ignore
let isRestarting = false; // Whether the game is currently restarting

// Pause state
// @ts-ignore
let isPaused = false;
let pauseMenu = null;

// Check if level complete
let levelCompleteElement = null;
let gameOverElement = null;

// For loading online levels
// @ts-ignore
let db;
// @ts-ignore
const DB_NAME = "TeleporterDashDB";
// @ts-ignore
const STORE_NAME = "downloadedLevels";
// @ts-ignore
const DB_VERSION = 2;

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
function toggleGameState(action) {
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

// Single mute button setup

/**
 * Initializes particles array if it doesn't exist
 * @param {string} color - Color of particles (e.g., '#ff0000' for red)
 */
function createParticles(color) {
  // Check if visual effects are enabled
  if (!SettingsManager.current.visualEffects) return;

  if (!particles) particles = [];

  // Create 10 particles
  for (let i = 0; i < 10; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.position = "absolute";
    particle.style.width = "5px";
    particle.style.height = "5px";
    particle.style.backgroundColor = color;
    particle.style.left = parseInt(player.style.left) + 15 + "px";
    particle.style.bottom = parseInt(player.style.bottom) + 15 + "px";
    particle.style.borderRadius = "50%";
    particle.style.zIndex = "1000";

    gameContainer.appendChild(particle);

    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 5 + 2) * 60; // Convert to pixels/second (multiply by 60 for 60 FPS equivalent)

    particles.push({
      element: particle,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 120, // Convert initial upward velocity to pixels/second
      life: 1,
    });
  }
}

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
 * Handles collision detection between player and obstacles
 * @param {HTMLElement} player - The player element
 * @param {HTMLElement} obstacle - The obstacle element to check collision with
 * @returns {boolean} - True if collision detected, false otherwise
 */
function checkCollision(player, obstacle) {
  if (obstacle.classList.contains("empty-block")) return false;

  // Get raw positions without camera influence
  const playerBottom = parseInt(player.style.bottom);
  const playerLeft = parseInt(player.style.left);
  const obstacleBottom = parseInt(obstacle.style.bottom);
  const obstacleLeft = parseInt(obstacle.style.left);
  const tolerance = 5; // Small overlap allowance for smoother collision
  const playerSize = 30; // Player width/height
  // @ts-ignore
  const obstacleSize = obstacle.type === "platform" ? 45 : 30;

  // Get obstacle rotation
  let rotation = 0;
  const transform = obstacle.style.transform;
  if (transform) {
    const match = transform.match(/rotate\((\d+)deg\)/);
    if (match) {
      rotation = parseInt(match[1]);
    }
  }

  // Adjust collision box based on rotation for spikes
  let adjustedObstacleBottom = obstacleBottom;
  let adjustedObstacleLeft = obstacleLeft;
  // @ts-ignore
  if (obstacle.type === "spike") {
    switch (rotation) {
      case 90: // Pointing left
        adjustedObstacleLeft += obstacleSize / 2;
        break;
      case 180: // Pointing up
        adjustedObstacleBottom += obstacleSize / 2;
        break;
      case 270: // Pointing right
        adjustedObstacleLeft -= obstacleSize / 2;
        break;
      default: // Pointing down or no rotation
        adjustedObstacleBottom -= obstacleSize / 2;
    }
  }

  // Check for overlap in both x and y directions
  return !(
    playerLeft + playerSize - tolerance < adjustedObstacleLeft ||
    playerLeft + tolerance > adjustedObstacleLeft + obstacleSize ||
    playerBottom + playerSize - tolerance < adjustedObstacleBottom ||
    playerBottom + tolerance > adjustedObstacleBottom + obstacleSize
  );
}

/**
 * Handles specific collision logic for platforms
 * Includes landing detection and side collision
 */
// @ts-ignore
function handlePlatformCollision(playerRect, platform) {
  // Get raw positions without camera influence
  const playerBottom = parseInt(player.style.bottom);
  const platformBottom = parseInt(platform.style.bottom);
  const playerLeft = parseInt(player.style.left);
  const platformLeft = parseInt(platform.style.left);

  // Calculate overlaps
  const horizontalOverlap =
    Math.min(playerLeft + 30, platformLeft + 40) -
    Math.max(playerLeft, platformLeft);
  const verticalOverlap =
    Math.min(playerBottom + 30, platformBottom + 40) -
    Math.max(playerBottom, platformBottom);

  const playerWidth = 30;
  const horizontalCollision = horizontalOverlap / playerWidth;

  // First, check for side collision - this takes priority
  // If we have any meaningful horizontal collision and we're not jumping, it's death
  const state = GameState.getState();
  if (
    horizontalCollision > 0.2 && // Significant horizontal collision
    verticalOverlap > 5 && // Some vertical overlap
    !state.isJumping && // Not in a jump
    Math.abs(playerBottom - (platformBottom + 40)) > 15
  ) {
    // Not very close to top
    return "death";
  }

  // Only then check for safe landing
  if (
    state.playerVelocity > 0 && // Moving down
    Math.abs(playerBottom - (platformBottom + 40)) < 10 && // Very close to top
    horizontalCollision > 0.3
  ) {
    // Enough horizontal overlap for landing

    // Safe landing
    GameState.setState({
      isOnPlatform: true,
      isJumping: false,
      doubleJumpAvailable: true,
      playerVelocity: 0,
    });
    player.style.bottom = platformBottom + 45 + "px";
    return "safe";
  }

  return "none";
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

// Add camera-related variables
let cameraOffsetY = 0;
const CAMERA_FOLLOW_THRESHOLD = 50; // Reduced from 100 to make camera more responsive
const MAX_CAMERA_SPEED = 20; // Increased from 15 to make camera movement smoother

// Make cameraOffsetY globally accessible
// @ts-ignore
window.cameraOffsetY = cameraOffsetY;

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
    return;
  }

  if (state.isPaused) {
    requestAnimationFrame(updateGame);
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
    requestAnimationFrame(updateGame);
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
  obstacles.forEach((obstacle) => {
    if (obstacle.element && obstacle.element.parentNode) {
      obstacle.element.remove();
    }
  });
  obstacles = [];

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

  // Start game loop
  updateGame();
}

// ===== Event listeners for player input =====
document.addEventListener("keydown", handleSpaceJump);
document.addEventListener("mousedown", handleMouseJump);

/**
 * Handles player jumping mechanics
 * Includes double jump and jump buffering
 */
// @ts-ignore
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

// Touch event listener using touchJumpDelay for sensitivity control
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
  { passive: false }
);

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

/**
 * Gradually reduces background music volume until silent
 * Used during level completion and game over
 */
// @ts-ignore
async function fadeOutMusic() {
  const state = GameState.getState();
  const currentMusic = state.isPracticeMode
    ? AudioManager.practiceMusic
    : AudioManager.backgroundMusic;
  while (currentMusic.volume > 0.02) {
    currentMusic.volume -= 0.02; // Reduce volume by 2%
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await AudioManager.pause(currentMusic);
  currentMusic.volume = SettingsManager.current.volume / 100; // Reset to user's volume setting
}

/**
 * Configures control scheme based on user selection
 * @param {string} method - 'space', 'click', or 'both'
 */
export function setupControls(method) {
  // Remove all existing event listeners first
  document.removeEventListener("keydown", handleSpaceJump);
  document.removeEventListener("mousedown", handleMouseJump);
  document.removeEventListener("keydown", (e) => {
    if (e.code === "Space") jump();
  });

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

// Make setupControls globally accessible for backwards compatibility
// @ts-ignore
window.setupControls = setupControls;


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
}

/**
 * Toggles game pause state and updates UI accordingly
 * Handles music pause/resume and button icons
 */
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyP") {
    toggleGameState("pause");
  }
});

// Smooth background transition logic using the color codes
const colorSteps = [
  COLOR_MAP["0"],
  COLOR_MAP["-1"],
  COLOR_MAP["-2"],
  COLOR_MAP["-3"],
  COLOR_MAP["-4"],
  COLOR_MAP["-5"],
  COLOR_MAP["-6"],
  COLOR_MAP["-7"],
  COLOR_MAP["-8"],
  COLOR_MAP["-9"],
];
// @ts-ignore
let colorIndex = 0;
// @ts-ignore
let transitionFactor = 0;
const totalTransitionTime = 10; // Total time for all transitions

// Calculate transition speed and duration
const numberOfTransitions = colorSteps.length - 1;
const transitionDuration = totalTransitionTime / numberOfTransitions;
// @ts-ignore
const transitionSpeed = 1 / (transitionDuration * 60); // Assuming 60 frames per second

// ===== Color =====
// @ts-ignore
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
      CONSTANTS.INITIAL_SPACE / CONSTANTS.COLUMN_WIDTH
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
      factor
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

/**
 * Enhanced level data validation
 * @throws {Error} If validation fails
 */
// @ts-ignore
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
      // @ts-ignore
      const blockType = parseInt(props[0]);

      // Process other properties
      for (let i = 1; i < props.length; i++) {
        const prop = props[i];
        if (prop.startsWith("-")) {
          // Color property (negative number)
          // @ts-ignore
          const blockColor = COLOR_MAP[parseInt(prop)];
        } else if (prop.startsWith("@")) {
          // Rotation property
          // @ts-ignore
          const blockRotation = parseInt(prop.substring(1));
        }
      }
    } else if (code < 0 && !COLOR_MAP[code]) {
      throw new Error(
        `Invalid color code ${code} at position ${index} in color row`
      );
    }
  });

  // Validate level rows
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (row.length !== width) {
      throw new Error(
        `Invalid level data: row ${i} has different width than first row`
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
                `Invalid color code ${prop} at position [${i},${j}]`
              );
            }
          } else if (prop.startsWith("@")) {
            // Rotation property
            const rotation = parseInt(prop.substring(1));
            if (![0, 90, 180, 270].includes(rotation)) {
              throw new Error(
                `Invalid rotation ${prop} at position [${i},${j}]`
              );
            }
          } else {
            throw new Error(
              `Invalid block property ${prop} at position [${i},${j}]`
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
 * Enhanced touch controls setup
 */
// @ts-ignore
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
    { passive: false }
  );

  document.addEventListener(
    "touchmove",
    function (e) {
      if (Math.abs(e.touches[0].clientY - touchStartY) > touchThreshold) {
        isSwiping = true;
      }
    },
    { passive: false }
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
    { passive: false }
  );
}

// Add cleanup function for when leaving the page
window.addEventListener("beforeunload", () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});

console.log("All functions defined and listeners added");

/**
 * Cleans up all particle effects
 * Called during game restart and level completion
 */
function cleanupParticles() {
  // Remove all particle elements from DOM
  particles.forEach((particle) => {
    if (particle.element && particle.element.parentNode) {
      particle.element.remove();
    }
  });
  // Clear particles array
  particles = [];
}
