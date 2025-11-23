import { TDEditorController } from "./TDEditor/TDEditorController.js";

// Initialize the level editor when the DOM is loaded
let editorController = null;

// Initialize the application
async function initializeTDEditor() {
  try {
    editorController = new TDEditorController();
  } catch (error) {
    console.error("Failed to initialize Level Editor:", error);
  }
}

// Start the application
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeTDEditor);
} else {
  initializeTDEditor();
}

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  if (editorController) {
    editorController.destroy();
  }
});
