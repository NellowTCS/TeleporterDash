import { LevelEditorController } from "./TDEditor/levelEditorController.js";

// Initialize the level editor when the DOM is loaded
let editorController = null;

// Initialize the application
async function initializeLevelEditor() {
  try {
    editorController = new LevelEditorController();
  } catch (error) {
    console.error("Failed to initialize Level Editor:", error);
  }
}

// Start the application
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeLevelEditor);
} else {
  initializeLevelEditor();
}

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  if (editorController) {
    editorController.destroy();
  }
});
