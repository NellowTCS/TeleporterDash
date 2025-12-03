import { LevelLoader } from "./TDEngine/levelLoader.js";
import { SettingsManager } from "./TDEngine/settingsManager.js";
import { ScoreManager } from "./TDEngine/scoreManager.js";
import { DatabaseManager } from "./Utilities/databaseManager.js";
import { DOMManager } from "./Utilities/domManager.js";
import { showLoadingError } from "./Utilities/notificationManager.js";
import { GameController } from "./TDEngine/gameController.js";
import { setupControls, registerPauseHandler } from "./TDEngine/inputManager.js";
import { AudioManager } from "./Utilities/audioManager.js";
import { GameState } from "./Utilities/gameState.js";

let controller = null;
let muteButton = null;

function gatherUIRefs() {
  return {
    gameContainer: DOMManager.getElement("#gameContainer"),
    cameraContainer: DOMManager.getElement("#cameraContainer"),
    playerElement: DOMManager.getElement("#player"),
    progressText: DOMManager.getElement("#progressText"),
    progressFill: DOMManager.getElement("#progressFill"),
    pauseMenu: DOMManager.getElement("#pauseMenu"),
    levelCompleteElement: DOMManager.getElement("#levelComplete"),
    gameOverElement: DOMManager.getElement("#gameOver"),
  };
}

function updateMuteButtonLabel() {
  if (muteButton) {
    muteButton.textContent = AudioManager.isMuted ? "🔇" : "🔊";
  }
}

function initializeMuteControl() {
  const existingButton = DOMManager.getElement("#muteButton");
  if (!existingButton) {
    return;
  }

  const replacement = existingButton.cloneNode(true);
  existingButton.parentNode?.replaceChild(replacement, existingButton);
  muteButton = replacement;
  muteButton.addEventListener("click", () => {
    if (!controller) return;
    controller.toggleMute();
    updateMuteButtonLabel();
  });

  updateMuteButtonLabel();
}

function attachGlobalHandlers() {
  const restartBtn = DOMManager.getElement("#restartBtn");
  if (restartBtn) {
    restartBtn.addEventListener("click", () => controller?.restartLevel());
  }

  const resumeBtn = document.getElementById("resumeBtn");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => controller?.togglePause());
  }

  const restartFromPauseBtn = document.getElementById("restartFromPauseBtn");
  if (restartFromPauseBtn) {
    restartFromPauseBtn.addEventListener("click", () => window.location.reload());
  }

  const pauseButton = document.getElementById("pauseButton");
  if (pauseButton) {
    pauseButton.addEventListener("click", () => controller?.togglePause());
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      controller?.togglePause();
    }
  });
}

async function initializeLevelUI() {
  const settingsMenu = DOMManager.getElement("#settingsMenu");
  const volumeSlider = DOMManager.getElement("#volumeSlider");
  const volumeValue = DOMManager.getElement("#volumeValue");
  const controlMethodSelect = document.getElementById("controlMethod");
  const autoRestartCheckbox = document.getElementById("autoRestart");
  const practiceModeCheckbox = document.getElementById("practiceMode");
  const startLevelBtn = document.getElementById("startLevelBtn");
  const gameSpeedSelect = document.getElementById("gameSpeed");

  SettingsManager.load();
  setupControls(SettingsManager.current.controlMethod);
  controller?.setAutoRestart(SettingsManager.current.autoRestartEnabled);

  if (volumeSlider) {
    volumeSlider.value = SettingsManager.current.volume;
    if (volumeValue) {
      volumeValue.textContent = `${SettingsManager.current.volume}%`;
    }
  }

  if (controlMethodSelect) {
    // @ts-ignore
    controlMethodSelect.value = SettingsManager.current.controlMethod || "keyboard";
  }

  if (practiceModeCheckbox) {
    // @ts-ignore
    practiceModeCheckbox.checked = SettingsManager.current.practiceMode;
    GameState.setState({ isPracticeMode: SettingsManager.current.practiceMode });
  }

  if (autoRestartCheckbox) {
    // @ts-ignore
    autoRestartCheckbox.checked = SettingsManager.current.autoRestartEnabled;
    autoRestartCheckbox.addEventListener("change", function handleAutoRestartChange() {
      // @ts-ignore
      const enabled = this.checked;
      SettingsManager.current.autoRestartEnabled = enabled;
      SettingsManager.save();
      controller?.setAutoRestart(enabled);
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener("input", function handleVolumeInput() {
      const volume = this.value;
      if (volumeValue) {
        volumeValue.textContent = `${volume}%`;
      }
      SettingsManager.current.volume = volume;
      SettingsManager.save();
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

  if (practiceModeCheckbox) {
    practiceModeCheckbox.addEventListener("change", async function handlePracticeToggle() {
      // @ts-ignore
      const practiceMode = this.checked;
      GameState.setState({ isPracticeMode: practiceMode });
      SettingsManager.current.practiceMode = practiceMode;
      SettingsManager.save();

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
          const newSpeed = SettingsManager.current.gameSpeed || 4;
          GameState.setState({ gameSpeed: newSpeed });
          // @ts-ignore
          gameSpeedSelect.value = (newSpeed / 4).toString();
        }
      }

      const state = GameState.getState();
      if (
        state.isLevelStarted &&
        !state.isPaused &&
        !state.isGameOver &&
        !state.isLevelComplete
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

  if (gameSpeedSelect) {
    const currentState = GameState.getState();
    // @ts-ignore
    gameSpeedSelect.disabled = !currentState.isPracticeMode;
    if (SettingsManager.current.gameSpeed) {
      GameState.setState({ gameSpeed: SettingsManager.current.gameSpeed });
      // @ts-ignore
      gameSpeedSelect.value = SettingsManager.current.gameSpeed.toString();
    }

    gameSpeedSelect.addEventListener("change", function handleSpeedChange() {
      const state = GameState.getState();
      if (state.isPracticeMode) {
        // @ts-ignore
        const multiplier = parseFloat(this.value);
        const newSpeed = 4 * multiplier;
        GameState.setState({ gameSpeed: newSpeed });
        SettingsManager.current.gameSpeed = newSpeed;
        SettingsManager.save();
      }
    });
  }

  if (controlMethodSelect) {
    controlMethodSelect.addEventListener("change", function handleControlChange() {
      // @ts-ignore
      const method = this.value;
      SettingsManager.current.controlMethod = method;
      SettingsManager.save();
      setupControls(method);
    });
  }

  if (startLevelBtn) {
    startLevelBtn.addEventListener("click", async () => {
      if (!controller) return;
      const started = await controller.startLevel();
      if (started && settingsMenu) {
        settingsMenu.style.display = "none";
      }
    });
  }
}

async function bootstrap() {
  try {
    const uiRefs = gatherUIRefs();
    controller = new GameController(uiRefs);
    registerPauseHandler(() => controller?.togglePause());

    initializeMuteControl();
    attachGlobalHandlers();

    console.log("Starting ScoreManager initialization...");
    await ScoreManager.initialize();
    console.log("ScoreManager initialized successfully");

    console.log("Starting level initialization...");
    await DatabaseManager.initDB();
    await LevelLoader.initializeLevelData();
    await initializeLevelUI();
    console.log("Level initialization complete");
  } catch (error) {
    console.error("Error during initialization:", error);
    showLoadingError(`Failed to initialize: ${error.message}`);
  }
}

document.addEventListener("DOMContentLoaded", bootstrap);
window.addEventListener("beforeunload", () => controller?.cleanup());
