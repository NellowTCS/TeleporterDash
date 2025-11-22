// Level Editor: Music Manager
// Handles all music-related operations including custom music, preview, and selection

import { GameState } from "../Utilities/gameState.js";
import { DOMManager } from "../Utilities/domManager.js";

// Lazy import to avoid circular dependencies
let AudioManager = null;

export class MusicManager {
  constructor() {
    this.setupEventListeners();
  }

  // ===== Custom Music Handling =====
  async handleCustomMusicSelection(file) {
    if (!file) return;

    const reader = new FileReader();
    const musicSelect = DOMManager.getElement("#musicSelect");
    const musicPreview = DOMManager.getElement("#musicPreview");
    const previewMusicBtn = DOMManager.getElement("#previewMusic");

    reader.onload = async (e) => {
      // Clean up previous blob URL
      if (musicPreview.src.startsWith("blob:")) {
        URL.revokeObjectURL(musicPreview.src);
      }

      // Store the file data and metadata
      GameState.setEditorState({
        customMusicFile: {
          name: file.name,
          type: file.type,
          data: /** @type {ArrayBuffer} */ (e.target.result), // ArrayBuffer
        },
      });

      this.updateCustomMusicOption(musicSelect, file.name);

      // Create blob URL for preview
      if (!AudioManager) {
        AudioManager = (await import("../Utilities/audioManager.js"))
          .AudioManager;
      }
      const audioUrl = AudioManager.createCustomMusicBlob(
        GameState.current.editor.customMusicFile,
      );
      if (audioUrl) {
        musicPreview.src = audioUrl;
      }

      // Reset preview button
      previewMusicBtn.textContent = "Preview Music";
      musicPreview.pause();
      musicPreview.currentTime = 0;
    };

    // Read the file as ArrayBuffer
    reader.readAsArrayBuffer(file);
  }

  updateCustomMusicOption(musicSelect, filename) {
    // Remove any existing custom option
    Array.from(musicSelect.options).forEach((opt) => {
      if (opt.value === "custom") musicSelect.removeChild(opt);
    });

    // Create new custom option
    const option = document.createElement("option");
    option.value = "custom";
    option.text = "Custom: " + filename;
    musicSelect.add(option);
    musicSelect.value = "custom";
  }

  // ===== Music Preview =====
  async toggleMusicPreview() {
    const musicSelect = DOMManager.getElement("#musicSelect");
    const musicPreview = DOMManager.getElement("#musicPreview");
    const previewMusicBtn = DOMManager.getElement("#previewMusic");

    if (musicPreview.paused) {
      try {
        if (!AudioManager) {
          AudioManager = (await import("../Utilities/audioManager.js"))
            .AudioManager;
        }
        const musicPath = AudioManager.getMusicPath(musicSelect.value);
        await AudioManager.playPreview(musicPreview, musicPath);
        previewMusicBtn.textContent = "Stop Preview";
      } catch (error) {
        console.error("Failed to play music:", error);
        alert(
          "Failed to play music preview. Please ensure you have selected a valid audio file.",
        );
        previewMusicBtn.textContent = "Preview Music";
      }
    } else {
      if (!AudioManager) {
        AudioManager = (await import("../Utilities/audioManager.js"))
          .AudioManager;
      }
      AudioManager.stopPreview(musicPreview);
      previewMusicBtn.textContent = "Preview Music";
    }
  }

  // ===== Music Selection Handler =====
  handleMusicSelection() {
    const musicSelect = DOMManager.getElement("#musicSelect");
    const customMusicInput = DOMManager.getElement("#customMusicInput");

    if (musicSelect.value === "custom") {
      customMusicInput.click();
    }
  }

  // ===== Event Listeners =====
  setupEventListeners() {
    // Custom music file selection
    DOMManager.addEvent("#customMusicInput", "change", async (e) => {
      const file = /** @type {HTMLInputElement} */ (e.target).files[0];
      if (file) {
        await this.handleCustomMusicSelection(file);
      }
    });

    // Music selection dropdown
    DOMManager.addEvent("#musicSelect", "change", () => {
      this.handleMusicSelection();
    });

    // Music preview button
    DOMManager.addEvent("#previewMusic", "click", async () => {
      await this.toggleMusicPreview();
    });

    // Clean up object URLs when leaving the page
    window.addEventListener("beforeunload", async () => {
      const musicPreview = DOMManager.getElement("#musicPreview");
      if (!AudioManager) {
        AudioManager = (await import("../Utilities/audioManager.js"))
          .AudioManager;
      }
      AudioManager.stopPreview(musicPreview);
    });
  }
}
