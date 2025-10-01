import { DatabaseManager } from "./Utilities/databaseManager";
import { GameState } from "./Utilities/gameState";
import { AudioManager } from "./Utilities/audioManager";
import {
  createGrid,
  updateGridVisuals,
  updateGridSize,
  sanitizeMatrix,
} from "./Level Editor/editorGrid";
import {
  updateSelectedColorIndicator,
  handleColorSelection,
  initializeColorPickers,
} from "./Level Editor/editorColorPicker";
import "./Level Editor/editorTools";
import { DraftManager } from "./Level Editor/draftManager";
import { EditOperations } from "./Level Editor/editorEditOperations";
import { DOMManager } from "./Utilities/domManager";
import JSZip from "jszip";

// =====  Variables =====
// Initialize DOM elements
DOMManager.initializeElements();

// // Buttons
const grid = DOMManager.getElement("#grid");
const gridWidthInput = DOMManager.getElement("#gridWidth");
const gridHeightInput = DOMManager.getElement("#gridHeight");
const updateGridSizeBtn = DOMManager.getElement("#updateGridSize");
const gridContainer = DOMManager.getElement("#gridContainer");
const exportBtn = DOMManager.getElement("#exportBtn");
const testBtn = DOMManager.getElement("#testBtn");
const clearBtn = DOMManager.getElement("#clearBtn");
const exportArea = DOMManager.getElement("#exportArea");
const musicSelect = DOMManager.getElement("#musicSelect");
const musicPreview = DOMManager.getElement("#musicPreview");
const previewMusicBtn = DOMManager.getElement("#previewMusic");
const levelNameInput = DOMManager.getElement("#levelName");
const bgColorSelect = DOMManager.getElement("#bgColor");
const customMusicInput = DOMManager.getElement("#customMusicInput");

// // Level Registry
const LEVELS_REGISTRY_KEY = "teleporterDash_levels";

// // Draft Management
let currentDraftId = null;
const currentDraftIndicator = DOMManager.getElement("#currentDraftIndicator");

// Initialize color pickers
initializeColorPickers();

// ===== Export =====
// // Initialize the editor - hook cell changes to edit operations system
function onCellChange() {
  EditOperations.onCellChange();
}

createGrid(grid, () => {
  DraftManager.scheduleAutoSaveWrapper.bind(DraftManager)();
  setTimeout(onCellChange, 0); // Defer to allow state update
});

function getNextLevelId() {
  const id = GameState.current.editor.nextLevelId++;
  localStorage.setItem("nextLevelId", GameState.current.editor.nextLevelId.toString());
  return id;
}

// ===== Testing Functionality =====
async function testLevel() {
  // Sanitize the matrix first
  const cleanMatrix = sanitizeMatrix(GameState.current.editor.levelMatrix);

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

  const testData = {
    id: "currentTest", // Use a fixed ID to always update the same record
    matrix: cleanMatrix,
    author: DOMManager.getValue("#authorName") || "Unknown Author",
    difficulty: DOMManager.getValue("#difficulty") || "Normal",
    musicValue: musicValue,
    musicData: musicData,
  };

  try {
    await DatabaseManager.saveTestLevel(testData);
    // Open the test page in a new window
    window.open("./gameloader.html?test=true&levelId=currentTest", "_blank");
  } catch (error) {
    console.error("Error saving test level:", error);
    alert("Failed to save test level");
  }
}

// ===== Importing Functionality =====
function importMatrix() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".js,.txt,application/json,.zip";

  fileInput.onchange = async function (e) {
    const file = /** @type {HTMLInputElement} */ (e.target).files[0];

    if (file.name.endsWith(".zip")) {
      // Handle ZIP file
      const zip = new JSZip();
      try {
        const zipContent = await zip.loadAsync(file);

        // Find the level file (should be in Levels directory)
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
          alert("No level file found in ZIP!");
          return;
        }

        // Read the level file content
        const content = await levelFile.async("text");

        // If there's a music file, read it
        if (musicFile) {
          const musicData = await musicFile.async("arraybuffer");
          const blob = new Blob([musicData], { type: "audio/mpeg" });

          GameState.setEditorState({
            customMusicFile: {
              name: musicFile.name.split("/").pop(),
              type: "audio/mpeg",
              data: musicData,
              isImported: false, // Not imported since we have the actual file
            },
          });

          // Create custom option if it doesn't exist
          if (!musicSelect.querySelector('option[value="custom"]')) {
            const option = document.createElement("option");
            option.value = "custom";
            option.text =
              "Custom: " + GameState.current.editor.customMusicFile.name;
            musicSelect.add(option);
          } else {
            // Update existing custom option text
            const customOption = musicSelect.querySelector(
              'option[value="custom"]'
            );
            customOption.text =
              "Custom: " + GameState.current.editor.customMusicFile.name;
          }
          musicSelect.value = "custom";

          // Update music preview with blob URL
          const musicPreview = DOMManager.getElement("#musicPreview");
          if (musicPreview.src.startsWith("blob:")) {
            URL.revokeObjectURL(musicPreview.src);
          }
          musicPreview.src = URL.createObjectURL(blob);
        }

        // Process the level file content
        processImportedContent(content);
      } catch (error) {
        console.error("Error reading ZIP:", error);
        alert("Error reading ZIP file!");
      }
    } else {
      // Handle regular file
      const reader = new FileReader();
      reader.onload = function (e) {
        processImportedContent(e.target.result);
      };
      reader.readAsText(file);
    }
  };
  fileInput.click();
}

// // Process the imported stuff
// Helper function to process imported content
function processImportedContent(content) {
  try {
    let parsed;

    // Try to extract matrix from different formats
    if (content.includes("window.levelData")) {
      // Extract the entire levelData object
      const levelDataMatch = content.match(
        /window\.levelData\s*=\s*({[\s\S]*?});/
      );
      if (levelDataMatch) {
        // Parse the levelData object
        const levelData = Function(`return ${levelDataMatch[1]}`)();
        parsed = levelData.matrix;

        // Update level name if available
        if (levelData.title) {
          DOMManager.setValue("#levelName", levelData.title);
        }

        // Update author name if available
        if (levelData.author) {
          DOMManager.setValue("#authorName", levelData.author);
        }

        // Update difficulty if available
        if (levelData.difficulty) {
          const difficultySelect = DOMManager.getElement("#difficulty");
          Array.from(difficultySelect.options).forEach((option) => {
            if (option.value === levelData.difficulty) {
              option.selected = true;
            }
          });
        }

        // Update music selection if available
        if (levelData.music && !GameState.current.editor.customMusicFile) {
          // Only update if we don't already have a music file from ZIP
          const musicPath = levelData.music;
          if (musicPath.startsWith("../Sound/Level Soundtracks/")) {
            const musicFile = musicPath.split("/").pop();
            // Check if it's a built-in music file
            if (musicSelect.querySelector(`option[value="${musicFile}"]`)) {
              musicSelect.value = musicFile;
            } else {
              // It's a custom music file
              // Create custom option if it doesn't exist
              if (!musicSelect.querySelector('option[value="custom"]')) {
                const option = document.createElement("option");
                option.value = "custom";
                option.text = "Custom: " + musicFile;
                musicSelect.add(option);
              } else {
                // Update existing custom option text
                const customOption = musicSelect.querySelector(
                  'option[value="custom"]'
                );
                customOption.text = "Custom: " + musicFile;
              }
              musicSelect.value = "custom";

              // Only create customMusicFile if we don't already have it from ZIP
              if (!GameState.current.editor.customMusicFile) {
                GameState.setEditorState({
                  customMusicFile: {
                    name: musicFile,
                    type: "audio/mpeg",
                    isImported: true, // Flag to indicate this was imported
                  },
                });
              }
            }
          }
          // Update music preview
          const musicPreview = DOMManager.getElement("#musicPreview");
          musicPreview.src = AudioManager.getMusicPath(musicSelect.value);
        }
      }
    } else if (content.includes("matrix:")) {
      // Handle matrix: [...] format
      const matrixMatch = content.match(/matrix:\s*(\[[\s\S]*?\])/);
      if (matrixMatch) {
        parsed = JSON.parse(matrixMatch[1].replace(/\s+/g, ""));
      }
    } else {
      // Try direct JSON array
      parsed = JSON.parse(content);
    }

    if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
      // Update grid dimensions to match imported matrix
      GameState.setEditorState({
        gridHeight: parsed.length,
        gridWidth: parsed[0].length,
        levelMatrix: parsed,
        hasUnsavedChanges: true,
        lastExportedMatrix: null,
      });

      gridWidthInput.value = GameState.current.editor.gridWidth.toString();
      gridHeightInput.value = GameState.current.editor.gridHeight.toString();

      // Recreate grid with new dimensions and data
      createGrid(grid);
      updateGridVisuals();
    } else {
      throw new Error("Invalid matrix format");
    }
  } catch (e) {
    alert("Invalid matrix format! " + e.message);
    console.error(e);
  }
}

// ===== Event Listeners =====

// // Draft Event Listeners
// // // Add event listener for save draft button
DOMManager.addEvent("#saveDraftBtn", "click", async () => {
  try {
    await DraftManager.saveDraftWrapper();
    alert("Draft saved successfully!");
    await DraftManager.loadDraftsListWrapper(); // Refresh the drafts list
  } catch (error) {
    console.error("Error saving draft:", error);
    console.error(
      "Draft data that caused error:",
      GameState.current.editor.levelMatrix
    );
    alert("Failed to save draft: " + error.message);
  }
});

// // Import Button Event Listener
DOMManager.addEvent("#importBtn", "click", importMatrix);

// // Custom Music File Selection
DOMManager.addEvent("#customMusicInput", "change", function (e) {
  const file = /** @type {HTMLInputElement} */ (e.target).files[0];
  if (file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      if (musicPreview.src.startsWith("blob:")) {
        URL.revokeObjectURL(musicPreview.src);
      }

      // Store the file data and metadata
      GameState.setEditorState({
        customMusicFile: {
          name: file.name,
          type: file.type,
          data: e.target.result, // This will be an ArrayBuffer
        },
      });

      // Update music select to show custom file name
      const option = document.createElement("option");
      option.value = "custom";
      option.text = "Custom: " + file.name;

      // Remove any existing custom option
      Array.from(musicSelect.options).forEach((opt) => {
        if (opt.value === "custom") musicSelect.removeChild(opt);
      });

      musicSelect.add(option);
      musicSelect.value = "custom";

      // Create blob URL for preview
      const audioUrl = AudioManager.createCustomMusicBlob(
        GameState.current.editor.customMusicFile
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
});

// // Test Level Button
DOMManager.addEvent("#testBtn", "click", () => {
  testLevel();
});

// // Clear Grid
DOMManager.addEvent("#clearBtn", "click", () => {
  if (confirm("Are you sure you want to clear the grid?")) {
    GameState.resetEditorState();
    // Force a complete visual refresh
    createGrid(grid); // This will properly reset all cells
  }
});

// // Export Button
DOMManager.addEvent("#exportBtn", "click", () => {
  const levelName = DOMManager.getValue("#levelName") || "Untitled Level";
  const authorName = DOMManager.getValue("#authorName") || "Unknown Author";
  const difficulty = DOMManager.getValue("#difficulty") || "Normal";
  const musicPath = AudioManager.getMusicPath(musicSelect.value, true); // Pass true for export
  const levelId = getNextLevelId();
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
  if (
    musicSelect.value === "custom" &&
    GameState.current.editor.customMusicFile
  ) {
    // Use the stored custom music file data
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

  // Generate and download the zip
  zip.generateAsync({ type: "blob" }).then(function (content) {
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${levelName}_level${levelId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  // After successful export, save the current state
  GameState.setEditorState({
    lastExportedMatrix: JSON.parse(
      JSON.stringify(GameState.current.editor.levelMatrix)
    ),
    hasUnsavedChanges: false,
  });

  alert(
    "Your level will be downloaded for backup and then you will be redirected to a form to submit your level in a few seconds. Note: If you get the error 'Address unavailable:', this is just an GitHub server issue and you can click Upload again. "
  );
  setTimeout(() => {
    window.location.href =
      "https://script.google.com/macros/s/AKfycby1XUV7ovzK6NbLdGLVX36V9_FrkFXDyeZrCpGkNmKBc3TI6rqi0m_6_Jcg46XELyffug/exec";
  }, 3000);
});

// // Preview Music
DOMManager.addEvent("#previewMusic", "click", () => {
  if (musicPreview.paused) {
    const musicPath = AudioManager.getMusicPath(musicSelect.value);

    AudioManager.playPreview(musicPreview, musicPath).catch((error) => {
      console.error("Failed to play music:", error);
      alert(
        "Failed to play music preview. Please ensure you have selected a valid audio file."
      );
      previewMusicBtn.textContent = "Preview Music";
    });

    previewMusicBtn.textContent = "Stop Preview";
  } else {
    AudioManager.stopPreview(musicPreview);
    previewMusicBtn.textContent = "Preview Music";
  }
});

// // Stop drawing when mouse is released
DOMManager.addEvent(document, "mouseup", () => {
  GameState.setEditorState({ isMouseDown: false });
});

// // Update Button
DOMManager.addEvent("#updateGridSize", "click", () =>
  updateGridSize(gridWidthInput, gridHeightInput, grid)
);

// // Music Selection
DOMManager.addEvent("#musicSelect", "change", function () {
  if (this.value === "custom") {
    customMusicInput.click();
  }
});

// // Back to Menu Button
DOMManager.addEvent("#backToMenuBtn", "click", () => {
  if (GameState.current.editor.hasUnsavedChanges) {
    if (confirm("You have unsaved changes. Are you sure you want to leave?")) {
      window.location.href = "./index.html";
    }
  } else {
    window.location.href = "./index.html";
  }
});

DOMManager.addEvent(
  "#gridContainer",
  "click",
  DraftManager.clearCurrentDraftIndicatorWrapper.bind(DraftManager)
);
DOMManager.addEvent(
  "#levelName",
  "input",
  DraftManager.clearCurrentDraftIndicatorWrapper.bind(DraftManager)
);
DOMManager.addEvent(
  "#authorName",
  "input",
  DraftManager.clearCurrentDraftIndicatorWrapper.bind(DraftManager)
);
DOMManager.addEvent(
  "#difficulty",
  "change",
  DraftManager.clearCurrentDraftIndicatorWrapper.bind(DraftManager)
);
DOMManager.addEvent(
  "#musicSelect",
  "change",
  DraftManager.clearCurrentDraftIndicatorWrapper.bind(DraftManager)
);
DOMManager.addEvent(
  "#customMusicInput",
  "change",
  DraftManager.clearCurrentDraftIndicatorWrapper.bind(DraftManager)
);

// // Unsaved Changes Check
DOMManager.addEvent(window, "beforeunload", (e) => {
  if (GameState.current.editor.hasUnsavedChanges) {
    e.preventDefault();
    // Most browsers will show their own message, but a custom one for older browsers
    e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
  }
});

// Clean up object URLs when leaving the page
DOMManager.addEvent(window, "beforeunload", () => {
  AudioManager.stopPreview(musicPreview);
});

// ===== Grid Zoom Functionality =====
let currentGridZoom = 1.0;
const gridZoomMin = 0.25;
const gridZoomMax = 3.0;
const gridZoomStep = 0.25;

// Page zoom via CSS (no controls, just keyboard shortcuts)
let currentPageZoom = 0.8; // Default to 80% for better overview
const pageZoomMin = 0.5;
const pageZoomMax = 1.5;
const pageZoomStep = 0.1;

const gridZoomInBtn = DOMManager.getElement("#gridZoomIn");
const gridZoomOutBtn = DOMManager.getElement("#gridZoomOut");
const gridZoomResetBtn = DOMManager.getElement("#gridZoomReset");
const gridZoomLevelDisplay = DOMManager.getElement("#gridZoomLevel");

function updateGridZoomDisplay() {
  const percentage = Math.round(currentGridZoom * 100);
  gridZoomLevelDisplay.textContent = `${percentage}%`;
  document.documentElement.style.setProperty('--grid-scale', currentGridZoom.toString());
}

function updatePageZoom() {
  document.documentElement.style.setProperty('--page-zoom', currentPageZoom.toString());
}

function gridZoomIn() {
  if (currentGridZoom < gridZoomMax) {
    currentGridZoom = Math.min(currentGridZoom + gridZoomStep, gridZoomMax);
    updateGridZoomDisplay();
  }
}

function gridZoomOut() {
  if (currentGridZoom > gridZoomMin) {
    currentGridZoom = Math.max(currentGridZoom - gridZoomStep, gridZoomMin);
    updateGridZoomDisplay();
  }
}

function resetGridZoom() {
  currentGridZoom = 1.0;
  updateGridZoomDisplay();
}

function pageZoomIn() {
  if (currentPageZoom < pageZoomMax) {
    currentPageZoom = Math.min(currentPageZoom + pageZoomStep, pageZoomMax);
    updatePageZoom();
  }
}

function pageZoomOut() {
  if (currentPageZoom > pageZoomMin) {
    currentPageZoom = Math.max(currentPageZoom - pageZoomStep, pageZoomMin);
    updatePageZoom();
  }
}

function resetPageZoom() {
  currentPageZoom = 1.0;
  updatePageZoom();
}

// Add event listeners for grid zoom controls
DOMManager.addEvent("#gridZoomIn", "click", gridZoomIn);
DOMManager.addEvent("#gridZoomOut", "click", gridZoomOut);
DOMManager.addEvent("#gridZoomReset", "click", resetGridZoom);

// Edit controls are handled by EditOperations module

// Keyboard shortcuts for zooming
DOMManager.addEvent(document, "keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "=" || e.key === "+") {
      e.preventDefault();
      gridZoomIn();
    } else if (e.key === "-") {
      e.preventDefault();
      gridZoomOut();
    } else if (e.key === "0") {
      e.preventDefault();
      resetGridZoom();
    }
  } else if (e.shiftKey) {
    if (e.key === "=" || e.key === "+") {
      e.preventDefault();
      pageZoomIn();
    } else if (e.key === "-") {
      e.preventDefault();
      pageZoomOut();
    } else if (e.key === "0") {
      e.preventDefault();
      resetPageZoom();
    }
  }
});

// Initialize zoom displays
updateGridZoomDisplay();
updatePageZoom();

// ===== Edit Operations =====
// All edit operations (undo/redo, copy/paste, selection) are now handled by EditOperations module

// Initialize DatabaseManager and load drafts on page load
DatabaseManager.initDB()
  .then(() => {
    DraftManager.loadDraftsListWrapper(); // Load existing drafts when DB is ready
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
  });

// Make functions globally accessible for HTML onclick handlers
// @ts-ignore - Global function for HTML onclick handlers
window.loadDraft = DraftManager.loadDraftWrapper.bind(DraftManager);
// @ts-ignore - Global function for HTML onclick handlers
window.deleteDraft = DraftManager.deleteDraftWrapper.bind(DraftManager);
