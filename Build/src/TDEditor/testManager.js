// Level Editor: Test Manager
// Handles level testing functionality

import { GameState } from "../Utilities/gameState.js";
import { DOMManager } from "../Utilities/domManager.js";
import { DatabaseManager } from "../Utilities/databaseManager.js";
import { sanitizeMatrix } from "./editorGrid.js";
import { ErrorHandler } from "./errorHandler.js";

export class TestManager {
  constructor() {
    this.setupEventListeners();
  }

  async testLevel() {
    try {
      const testData = this.prepareTestData();
      await DatabaseManager.saveTestLevel(testData);
      this.openTestWindow();
    } catch (error) {
      console.error("Error saving test level:", error);
      const errorHandler = new ErrorHandler();
      errorHandler.showError(
        'Test Failed', 
        `Could not prepare level for testing: ${error.message}`,
        'error'
      );
    }
  }

  prepareTestData() {
    // Sanitize the matrix first
    const cleanMatrix = sanitizeMatrix(GameState.current.editor.levelMatrix);
    const musicSelect = DOMManager.getElement("#musicSelect");

    let musicValue = musicSelect.value || "level1.ogg";
    let musicData = null;

    if (musicValue === "custom" && GameState.current.editor.customMusicFile) {
      // Use the stored custom music file data
      musicData = {
        name: GameState.current.editor.customMusicFile.name,
        type: GameState.current.editor.customMusicFile.type,
        data: GameState.current.editor.customMusicFile.data,
      };
    } else if (musicValue !== "custom") {
      musicValue = `../Sound/Level Soundtracks/${musicValue}`;
    }

    return {
      id: "currentTest", // Use a fixed ID to always update the same record
      matrix: cleanMatrix,
      author: DOMManager.getValue("#authorName") || "Unknown Author",
      difficulty: DOMManager.getValue("#difficulty") || "Normal",
      musicValue: musicValue,
      musicData: musicData,
    };
  }

  openTestWindow() {
    // Open the test page in a new window
    window.open("./gameloader.html?test=true&levelId=currentTest", "_blank");
  }

  setupEventListeners() {
    DOMManager.addEvent("#testBtn", "click", () => this.testLevel());
  }
}