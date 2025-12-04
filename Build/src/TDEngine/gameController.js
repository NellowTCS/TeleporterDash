import { GameState } from "../Utilities/gameState.js";
import { AudioManager } from "../Utilities/audioManager.js";
import { ScoreManager } from "./scoreManager.js";
import {
  updateBackgroundColor,
  resetColorCache,
} from "../Utilities/colorManager.js";
import {
  checkCollisionWorld,
  handlePlatformCollisionWorld,
  clearObstacles as clearObstaclesPhysics,
} from "./physicsEngine.js";
import {
  createParticles,
  cleanupParticles,
  resetParticleCache,
} from "./particleEngine.js";
import { createObstacleFromMatrix } from "./levelParser.js";
import { updateProgress, resetProgress } from "./progressManager.js";
import {
  init as renderInit,
  createPlayerElement,
  renderPlayer,
  renderObstacles,
  setCamera,
  removeElement,
  resetRenderCache,
  presentFrame,
} from "./renderEngine.js";
import { CONSTANTS } from "../Utilities/constants.js";

const PLAYER_X = 100;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 30;
const BASE_GRAVITY = 2000;
const MAX_DELTA_TIME = 1 / 30;
const CAMERA_FOLLOW_THRESHOLD = 50;
const MAX_CAMERA_SPEED = 20;
const DIMENSION_UPDATE_INTERVAL = 500;
const CAMERA_TOP_PADDING = 90;

export class GameController {
  constructor({
    gameContainer,
    cameraContainer,
    playerElement,
    progressFill,
    progressText,
    pauseMenu,
    levelCompleteElement,
    gameOverElement,
  }) {
    this.gameContainer = gameContainer;
    this.cameraContainer = cameraContainer;
    this.progressFill = progressFill;
    this.progressText = progressText;
    this.pauseMenu = pauseMenu;
    this.levelCompleteElement = levelCompleteElement;
    this.gameOverElement = gameOverElement;

    this.obstacles = [];
    this.particles = [];
    this.autoRestartEnabled = false;

    this.animationFrameId = null;
    this.levelTimer = null;
    this.levelTime = 0;
    this.lastFrameTime = performance.now();
    this.deltaTime = 0;

    this.cameraOffsetY = 0;
    this.cachedContainerWidth = gameContainer?.offsetWidth ?? 800;
    this.cachedContainerHeight = gameContainer?.offsetHeight ?? 600;
    this.lastDimensionUpdate = 0;

    renderInit(gameContainer, cameraContainer);
    this.player = this.#createPlayerModel(playerElement);
    this.#initializeGameState();
  }

  setAutoRestart(enabled) {
    this.autoRestartEnabled = !!enabled;
  }

  async startLevel() {
    const state = GameState.getState();
    if (state.isLevelStarted) {
      return false;
    }

    this.levelTime = 0;
    if (this.levelTimer) {
      clearInterval(this.levelTimer);
      this.levelTimer = null;
    }

    this.#updateCachedDimensions(true);

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

    this.levelTimer = setInterval(() => {
      this.levelTime = +(this.levelTime + 0.1).toFixed(1);
      GameState.setState({ currentTime: this.levelTime });
    }, 100);

    await this.#startMusic();

    this.lastFrameTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.#updateGame);
    return true;
  }

  async restartLevel() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    GameState.setState({ isPaused: false });
    if (this.pauseMenu) {
      this.pauseMenu.style.display = "none";
    }

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

    if (this.levelCompleteElement) {
      this.levelCompleteElement.style.display = "none";
    }
    if (this.gameOverElement) {
      this.gameOverElement.style.display = "none";
    }

    this.player.x = PLAYER_X;
    this.player.y = 50;
    this.player.prevY = undefined;
    this.player.rotation = 0;

    this.#resetCaches();
    renderPlayer(this.player);

    this.cameraOffsetY = 0;
    setCamera(0);

    clearObstaclesPhysics(this.obstacles);
    this.obstacles.length = 0;

    cleanupParticles(this.particles);
    this.particles.length = 0;

    if (this.progressFill) {
      this.progressFill.style.width = "0%";
    }
    if (this.progressText) {
      this.progressText.textContent = "0%";
    }

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

    this.lastFrameTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.#updateGame);
  }

  togglePause() {
    const state = GameState.getState();
    if (state.isGameOver || state.isLevelComplete || !state.isLevelStarted) {
      return state.isPaused;
    }

    const newPauseState = !state.isPaused;
    GameState.setState({ isPaused: newPauseState });

    if (this.pauseMenu) {
      this.pauseMenu.style.display = newPauseState ? "block" : "none";
    }

    const currentMusic = state.isPracticeMode
      ? AudioManager.practiceMusic
      : AudioManager.backgroundMusic;

    if (newPauseState) {
      AudioManager.pause(currentMusic);
    } else if (!AudioManager.isMuted && currentMusic) {
      AudioManager.play(currentMusic, currentMusic.currentTime).catch((error) =>
        console.error("Error resuming music:", error),
      );
    }

    return newPauseState;
  }

  toggleMute() {
    AudioManager.toggleMute();
    return AudioManager.isMuted;
  }

  cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.levelTimer) {
      clearInterval(this.levelTimer);
      this.levelTimer = null;
    }
  }

  #createPlayerModel(existingElement) {
    const element = createPlayerElement(existingElement);
    return {
      x: PLAYER_X,
      y: 50,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      rotation: 0,
      element,
      prevY: undefined,
    };
  }

  #initializeGameState() {
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
      isLevelStarted: false,
    });
  }

  #updateCachedDimensions(force = false) {
    const now = performance.now();
    if (!force && now - this.lastDimensionUpdate <= DIMENSION_UPDATE_INTERVAL) {
      return;
    }

    if (this.gameContainer) {
      this.cachedContainerWidth = this.gameContainer.offsetWidth;
      this.cachedContainerHeight = this.gameContainer.offsetHeight;
    }
    this.lastDimensionUpdate = now;
  }

  async #startMusic() {
    const currentState = GameState.getState();
    const musicToPlay = currentState.isPracticeMode
      ? AudioManager.practiceMusic
      : AudioManager.backgroundMusic;

    try {
      if (!AudioManager.isMuted && musicToPlay) {
        const startTime = AudioManager.lastMusicTime || 0;
        await AudioManager.play(musicToPlay, startTime);
      }
    } catch (error) {
      console.error("Error starting music:", error);
    }
  }

  #updatePlayerPhysics(state) {
    const newVelocity = state.playerVelocity + BASE_GRAVITY * this.deltaTime;
    const currentBottom = this.player.y;
    const prevBottom = currentBottom;
    let newBottom = currentBottom - newVelocity * this.deltaTime;

    if (newBottom <= 50) {
      newBottom = 50;
      GameState.setState({
        isJumping: false,
        doubleJumpAvailable: true,
        playerVelocity: 0,
      });
    } else {
      GameState.setState({ playerVelocity: newVelocity });
    }

    this.player.prevY = prevBottom;
    this.player.y = newBottom;
    this.player.x = PLAYER_X;

    const rotationSpeed = 360;
    if (state.isJumping) {
      this.player.rotation = state.rotation + rotationSpeed * this.deltaTime;
      GameState.setState({ rotation: this.player.rotation });
    } else if (this.player.rotation !== 0) {
      this.player.rotation = 0;
      GameState.setState({ rotation: 0 });
    }
  }

  #spawnObstacles(state, spawnX) {
    if (
      !state.levelMatrix ||
      state.levelMatrix.length === 0 ||
      state.currentColumn >= state.levelMatrix[0].length
    ) {
      return;
    }

    const lastObstacle = this.obstacles[this.obstacles.length - 1];
    const shouldSpawn =
      this.obstacles.length === 0 ||
      (lastObstacle && spawnX - lastObstacle.x > CONSTANTS.COLUMN_WIDTH);

    if (!shouldSpawn) {
      return;
    }

    for (let row = 0; row < state.levelMatrix.length; row++) {
      const obstacle = createObstacleFromMatrix(
        state.levelMatrix[row][state.currentColumn],
        row,
        spawnX,
      );
      this.obstacles.push(obstacle);
    }

    GameState.setState({ currentColumn: state.currentColumn + 1 });
    updateProgress();
  }

  #handleTeleporterCollision(obstacle) {
    const rotation =
      typeof obstacle.rotation === "number" ? obstacle.rotation : 0;

    if (rotation === 90) {
      const dx = -120;
      for (let i = 0; i < this.obstacles.length; i++) {
        this.obstacles[i].x += dx;
      }
      this.player.x = PLAYER_X;
    } else if (rotation === 270) {
      const dx = 120;
      for (let i = 0; i < this.obstacles.length; i++) {
        this.obstacles[i].x += dx;
      }
      this.player.x = PLAYER_X;
    } else {
      const dy = rotation === 180 ? -120 : 180;
      this.player.y += dy;
    }

    GameState.setState({ playerVelocity: 0 });
    const container = this.cameraContainer || this.gameContainer;
    this.particles.push(...createParticles("#ff00ff", this.player, container));
    setTimeout(() => {
      this.particles.push(
        ...createParticles("#ff00ff", this.player, container),
      );
    }, 100);
  }

  async #handleGameOver() {
    const state = GameState.getState();
    if (state.isPracticeMode) {
      this.player.y = 50;
      this.player.prevY = undefined;
      GameState.setState({ playerVelocity: 0, rotation: 0 });
      this.particles.push(
        ...createParticles(
          "#ff00ff",
          this.player,
          this.cameraContainer || this.gameContainer,
        ),
      );
      return;
    }

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

    this.particles.push(
      ...createParticles(
        "#ff0000",
        this.player,
        this.cameraContainer || this.gameContainer,
      ),
    );

    if (this.autoRestartEnabled) {
      setTimeout(() => {
        this.restartLevel();
      }, 1000);
      return;
    }

    if (this.gameOverElement) {
      this.gameOverElement.style.display = "block";
    }

    if (!AudioManager.isMuted) {
      AudioManager.fadeOut(
        state.isPracticeMode
          ? AudioManager.practiceMusic
          : AudioManager.backgroundMusic,
      );
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  #handleParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.vy += 300 * this.deltaTime;
      particle.life -= 1.2 * this.deltaTime;
      if (particle.life <= 0) {
        if (particle.element) {
          removeElement(particle.element);
        }
        this.particles.splice(i, 1);
        continue;
      }

      particle.x += particle.vx * this.deltaTime;
      particle.y += particle.vy * this.deltaTime;

      if (particle.element) {
        particle.element.style.transform = `translate3d(${Math.round(
          particle.x,
        )}px, ${Math.round(-particle.y)}px, 0)`;
        particle.element.style.opacity = particle.life;
      }
    }
  }

  #handleLevelComplete() {
    GameState.setState({ isLevelComplete: true, currentTime: this.levelTime });
    if (this.levelTimer) {
      clearInterval(this.levelTimer);
      this.levelTimer = null;
    }

    const state = GameState.getState();
    const urlParams = new URLSearchParams(window.location.search);
    const isOnline = urlParams.get("online");
    if (isOnline) {
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
        `Level ${filename}`,
        state.currentTime,
        state.jumpCount,
        state.deathCount,
      );
    }

    if (this.levelCompleteElement) {
      this.levelCompleteElement.style.display = "block";
    }

    if (!AudioManager.isMuted) {
      AudioManager.completionSound.currentTime = 0;
      AudioManager.completionSound.play();
      AudioManager.fadeOut(
        state.isPracticeMode
          ? AudioManager.practiceMusic
          : AudioManager.backgroundMusic,
      );
    }

    if (this.progressFill) {
      this.progressFill.style.width = "100%";
    }
    if (this.progressText) {
      this.progressText.textContent = "100% (Level Complete!)";
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  #handleObstacleCollisions(state, frameSpeed) {
    const playerLeft = this.player.x - 100;
    const playerRight = this.player.x + 100;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.obstacles[i];
      obstacle.x -= frameSpeed;

      if (obstacle.x < -100) {
        if (obstacle.element) {
          removeElement(obstacle.element);
        }
        this.obstacles.splice(i, 1);
        continue;
      }

      if (obstacle.x <= playerLeft || obstacle.x >= playerRight) {
        continue;
      }

      const collision = checkCollisionWorld(this.player, obstacle);
      if (!collision) {
        continue;
      }

      if (obstacle.type === "finish") {
        this.#handleLevelComplete();
        return true;
      }

      if (obstacle.type === "spike" && !state.isPracticeMode) {
        this.#handleGameOver();
        return true;
      }

      if (obstacle.type === "teleporter") {
        this.#handleTeleporterCollision(obstacle);
        continue;
      }

      if (obstacle.type === "platform") {
        const platformCollision = handlePlatformCollisionWorld(
          this.player,
          obstacle,
        );
        if (platformCollision === "death" && !state.isPracticeMode) {
          this.#handleGameOver();
          return true;
        }
      }
    }

    return false;
  }

  #updateCamera() {
    const containerHeight = this.cachedContainerHeight;
    const effectiveHalfHeight = Math.max(
      1,
      containerHeight / 2 - CAMERA_TOP_PADDING,
    );
    const targetCameraY = Math.max(0, this.player.y - effectiveHalfHeight);
    const cameraDistance = targetCameraY - this.cameraOffsetY;

    if (Math.abs(cameraDistance) > CAMERA_FOLLOW_THRESHOLD) {
      const baseCameraSpeed = Math.min(
        Math.abs(cameraDistance) * 6,
        MAX_CAMERA_SPEED * 60,
      );
      const cameraSpeed = baseCameraSpeed * this.deltaTime;
      this.cameraOffsetY += Math.sign(cameraDistance) * cameraSpeed;
    }

    setCamera(this.cameraOffsetY);
    // @ts-ignore
    window.cameraOffsetY = this.cameraOffsetY;
  }

  #resetCaches() {
    resetRenderCache();
    resetColorCache();
    resetParticleCache();
    resetProgress();
  }

  #updateGame = () => {
    const currentFrameTime = performance.now();
    this.deltaTime = Math.min(
      (currentFrameTime - this.lastFrameTime) / 1000,
      MAX_DELTA_TIME,
    );
    this.lastFrameTime = currentFrameTime;

    const state = GameState.getState();
    if (
      !state.isLevelStarted ||
      state.isGameOver ||
      state.isLevelComplete ||
      state.isPaused
    ) {
      this.animationFrameId = requestAnimationFrame(this.#updateGame);
      return;
    }

    this.#updateCachedDimensions();
    updateBackgroundColor();

    const baseSpeed = 240;
    const currentSpeed = state.isPracticeMode
      ? baseSpeed * (state.gameSpeed / 4)
      : baseSpeed;
    const frameSpeed = currentSpeed * this.deltaTime;
    const spawnX = this.cachedContainerWidth;

    this.#spawnObstacles(state, spawnX);
    this.#updatePlayerPhysics(state);

    const hasTerminated = this.#handleObstacleCollisions(state, frameSpeed);
    if (hasTerminated) {
      return;
    }

    this.#handleParticles();
    renderPlayer(this.player);
    renderObstacles(this.obstacles);
    this.#updateCamera();
    presentFrame();

    this.animationFrameId = requestAnimationFrame(this.#updateGame);
  };
}
