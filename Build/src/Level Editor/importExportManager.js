// Level Editor: Import/Export Manager
// Handles all file import, export, and ZIP operations

import { GameState } from "../Utilities/gameState.js";
import { DOMManager } from "../Utilities/domManager.js";
import { createGrid, updateGridVisuals, sanitizeMatrix } from "./editorGrid.js";
import { ErrorHandler } from "./errorHandler.js";
import JSZip from "jszip";

// Lazy import to avoid circular dependencies
let AudioManager = null;

export class ImportExportManager {
  constructor() {
    this.setupEventListeners();
  }

  // ===== Export Operations =====
  getNextLevelId() {
    const id = GameState.current.editor.nextLevelId++;
    localStorage.setItem("nextLevelId", GameState.current.editor.nextLevelId.toString());
    return id;
  }

  async exportLevel() {
    const levelName = DOMManager.getValue("#levelName") || "Untitled Level";
    const authorName = DOMManager.getValue("#authorName") || "Unknown Author";  
    const difficulty = DOMManager.getValue("#difficulty") || "Normal";
    const musicSelect = DOMManager.getElement("#musicSelect");
    if (!AudioManager) {
      AudioManager = (await import("../Utilities/audioManager.js")).AudioManager;
    }
    const musicPath = AudioManager.getMusicPath(musicSelect.value, true);
    const levelId = this.getNextLevelId();
    const zip = new JSZip();

    // Create level file content
    const jsContent = `// Level ${levelId}: ${levelName}
window.levelData = {
id: ${levelId},
title: "${levelName}",
author: "${authorName}",
difficulty: "${difficulty}",
matrix: ${JSON.stringify(GameState.current.editor.levelMatrix, null, 4)},
music: "${musicPath}",
colorTransitionDuration: 0.5, 
colorTransitionDelay: 0.1    
};`;

    // Add files to zip
    zip.file(`Levels/level${levelId}.js`, jsContent);

    // If using custom music, add it to the zip
    if (musicSelect.value === "custom" && GameState.current.editor.customMusicFile) {
      const blob = new Blob([GameState.current.editor.customMusicFile.data], {
        type: GameState.current.editor.customMusicFile.type,
      });
      zip.file(
        `Sound/Level Soundtracks/${GameState.current.editor.customMusicFile.name}`,
        blob
      );
    }

    // Create README content
    const readmeContent = [
      `Level: ${levelName}`,
      `Author: ${authorName}`,
      `Difficulty: ${difficulty}`,
      `Level ID: ${levelId}`,
      `Music File Required: ${musicPath}`,
      ``,
      `Setup Instructions:`,
      `1. Extract all files from this zip`,
      `2. Copy "level${levelId}.js" to the Levels directory`,
      musicSelect.value === "custom"
        ? `3. Copy the music file to Sound/Level Soundtracks directory`
        : "",
      ``,
      `The level will automatically appear in the menu when you restart the game.`,
    ]
      .filter((line) => line !== "")
      .join("\n");

    zip.file("README.txt", readmeContent);

    try {
      // Generate and download the zip
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${levelName}_level${levelId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // After successful export, save the current state
      GameState.setEditorState({
        lastExportedMatrix: JSON.parse(
          JSON.stringify(GameState.current.editor.levelMatrix)
        ),
        hasUnsavedChanges: false,
      });

      this.showExportSuccess();
    } catch (error) {
      console.error("Export failed:", error);
      const errorHandler = new ErrorHandler();
      errorHandler.showError(
        'Export Failed',
        `Could not export level: ${error.message}`,
        'error'
      );
    }
  }

  showExportSuccess() {
    alert(
      "Your level will be downloaded for backup and then you will be redirected to a form to submit your level in a few seconds. Note: If you get the error 'Address unavailable:', this is just an GitHub server issue and you can click Upload again."
    );
    setTimeout(() => {
      window.location.href =
        "https://script.google.com/macros/s/AKfycby1XUV7ovzK6NbLdGLVX36V9_FrkFXDyeZrCpGkNmKBc3TI6rqi0m_6_Jcg46XELyffug/exec";
    }, 3000);
  }

  // ===== Import Operations =====
  importMatrix() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".js,.txt,application/json,.zip";

    fileInput.onchange = async (e) => {
      const file = /** @type {HTMLInputElement} */ (e.target).files[0];
      if (!file) return;

      try {
        if (file.name.endsWith(".zip")) {
          await this.handleZipImport(file);
        } else {
          await this.handleRegularFileImport(file);
        }
      } catch (error) {
        console.error("Import failed:", error);
        const errorHandler = new ErrorHandler();
        errorHandler.showError(
          'Import Failed',
          `Could not import level: ${error.message}`,
          'error'
        );
      }
    };

    fileInput.click();
  }

  async handleZipImport(file) {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    // Find the level file and music file
    let levelFile = null;
    let musicFile = null;

    for (const path in zipContent.files) {
      if (path.startsWith("Levels/") && path.endsWith(".js")) {
        levelFile = zipContent.files[path];
      } else if (path.startsWith("Sound/Level Soundtracks/")) {
        musicFile = zipContent.files[path];
      }
    }

    if (!levelFile) {
      throw new Error("No level file found in ZIP!");
    }

    // Read the level file content
    const content = await levelFile.async("text");

    // Handle music file if present
    if (musicFile) {
      await this.handleMusicFileFromZip(musicFile);
    }

    // Process the level file content
    this.processImportedContent(content);
  }

  async handleMusicFileFromZip(musicFile) {
    const musicData = await musicFile.async("arraybuffer");
    const musicSelect = DOMManager.getElement("#musicSelect");
    const musicPreview = DOMManager.getElement("#musicPreview");

    GameState.setEditorState({
      customMusicFile: {
        name: musicFile.name.split("/").pop(),
        type: "audio/mpeg",
        data: musicData,
        isImported: false,
      },
    });

    // Update music select dropdown
    this.updateCustomMusicOption(musicSelect, GameState.current.editor.customMusicFile.name);
    musicSelect.value = "custom";

    // Update music preview
    if (musicPreview.src.startsWith("blob:")) {
      URL.revokeObjectURL(musicPreview.src);
    }
    const blob = new Blob([musicData], { type: "audio/mpeg" });
    musicPreview.src = URL.createObjectURL(blob);
  }

  async handleRegularFileImport(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      await this.processImportedContent(/** @type {string} */ (e.target.result));
    };
    reader.readAsText(file);
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
  }

  async processImportedContent(content) {
    try {
      let parsed = await this.parseContentFormat(content);

      if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
        this.applyImportedMatrix(parsed);
      } else {
        throw new Error("Invalid matrix format");
      }
    } catch (error) {
      throw new Error("Invalid matrix format: " + error.message);
    }
  }

  async parseContentFormat(content) {
    if (content.includes("window.levelData")) {
      return await this.parseLevelDataFormat(content);
    } else if (content.includes("matrix:")) {
      return this.parseMatrixPropertyFormat(content);
    } else {
      return JSON.parse(content); // Direct JSON array
    }
  }

  async parseLevelDataFormat(content) {
    const levelDataMatch = content.match(/window\.levelData\s*=\s*({[\s\S]*?});/);
    if (!levelDataMatch) {
      throw new Error("Could not find levelData object");
    }

    const levelData = Function(`return ${levelDataMatch[1]}`)();
    await this.updateFormFromLevelData(levelData);
    return levelData.matrix;
  }

  parseMatrixPropertyFormat(content) {
    const matrixMatch = content.match(/matrix:\s*(\[[\s\S]*?\])/);
    if (!matrixMatch) {
      throw new Error("Could not find matrix property");
    }
    return JSON.parse(matrixMatch[1].replace(/\s+/g, ""));
  }

  async updateFormFromLevelData(levelData) {
    if (levelData.title) {
      DOMManager.setValue("#levelName", levelData.title);
    }
    if (levelData.author) {
      DOMManager.setValue("#authorName", levelData.author);
    }
    if (levelData.difficulty) {
      const difficultySelect = DOMManager.getElement("#difficulty");
      Array.from(difficultySelect.options).forEach((option) => {
        if (option.value === levelData.difficulty) {
          option.selected = true;
        }
      });
    }
    if (levelData.music) {
      await this.updateMusicFromImport(levelData.music);
    }
  }

  async updateMusicFromImport(musicPath) {
    if (!GameState.current.editor.customMusicFile && 
        musicPath.startsWith("../Sound/Level Soundtracks/")) {
      const musicSelect = DOMManager.getElement("#musicSelect");
      const musicFile = musicPath.split("/").pop();
      
      if (musicSelect.querySelector(`option[value="${musicFile}"]`)) {
        musicSelect.value = musicFile;
      } else {
        this.updateCustomMusicOption(musicSelect, musicFile);
        musicSelect.value = "custom";
        GameState.setEditorState({
          customMusicFile: {
            name: musicFile,
            type: "audio/mpeg",
            isImported: true,
          },
        });
      }
      
      if (!AudioManager) {
        AudioManager = (await import("../Utilities/audioManager.js")).AudioManager;
      }
      const musicPreview = DOMManager.getElement("#musicPreview");
      musicPreview.src = AudioManager.getMusicPath(musicSelect.value);
    }
  }

  applyImportedMatrix(matrix) {
    const gridWidthInput = DOMManager.getElement("#gridWidth");
    const gridHeightInput = DOMManager.getElement("#gridHeight");
    const grid = DOMManager.getElement("#grid");

    // Update grid dimensions to match imported matrix
    GameState.setEditorState({
      gridHeight: matrix.length,
      gridWidth: matrix[0].length,
      levelMatrix: matrix,
      hasUnsavedChanges: true,
      lastExportedMatrix: null,
    });

    gridWidthInput.value = GameState.current.editor.gridWidth.toString();
    gridHeightInput.value = GameState.current.editor.gridHeight.toString();

    // Recreate grid with new dimensions and data
    createGrid(grid);
    updateGridVisuals();
  }

  // ===== Event Listeners =====
  setupEventListeners() {
    DOMManager.addEvent("#exportBtn", "click", () => this.exportLevel());
    DOMManager.addEvent("#importBtn", "click", () => this.importMatrix());
  }
}