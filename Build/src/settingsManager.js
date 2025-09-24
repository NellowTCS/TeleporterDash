// Settings for Teleporter Dash
import { GameState } from './gameState.js';
import { AudioManager } from './audioManager.js';

export const SettingsManager = {
  current: {
    volume: 90,
    practiceMode: false,
    controlMethod: "both",
    isMuted: false,
    autoRestartEnabled: false,
    gameSpeed: 4,
    visualEffects: true,
  },
  save() {
    localStorage.setItem("gameSettings", JSON.stringify(this.current));
  },
  load() {
    const savedSettings = localStorage.getItem("gameSettings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      this.current = { ...this.current, ...parsed };

      // Apply loaded settings to GameState
      GameState.setState({
        isMuted: this.current.isMuted,
        isPracticeMode: this.current.practiceMode,
        autoRestartEnabled: this.current.autoRestartEnabled,
        gameSpeed: this.current.gameSpeed
      });

      // Apply volume to all audio elements
      [
        AudioManager.backgroundMusic,
        AudioManager.practiceMusic,
        AudioManager.jumpSound,
        AudioManager.deathSound,
        AudioManager.completionSound,
      ].forEach((audio) => {
        if (audio) {
          audio.volume = this.current.volume / 100;
          audio.muted = this.current.isMuted;
        }
      });

      // Apply control method
      setupControls(this.current.controlMethod);
    }
  },
};