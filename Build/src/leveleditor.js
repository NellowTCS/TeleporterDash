// Level Editor: Main Entry Point
// Simplified main file that initializes the level editor controller

import { LevelEditorController } from "./Level Editor/levelEditorController.js";

// Initialize the level editor when the DOM is loaded
let editorController = null;

// Initialize the application
async function initializeLevelEditor() {
  try {
    editorController = new LevelEditorController();
    
    // The controller handles all initialization internally
    // No need for additional setup here
    
  } catch (error) {
    console.error("Failed to initialize Level Editor:", error);
    
    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
      <div style="color: red; padding: 20px; border: 2px solid red; margin: 20px; background: #ffebee; border-radius: 8px;">
        <h2>Level Editor Error</h2>
        <p><strong>The level editor failed to start properly.</strong></p>
        <p>Error: ${error.message}</p>
        <p>Please:</p>
        <ul>
          <li>Refresh the page and try again</li>
          <li>Check your browser's developer console for more details</li>
          <li>Ensure JavaScript is enabled</li>
        </ul>
      </div>
    `;
    document.body.insertBefore(errorDiv, document.body.firstChild);
  }
}

// Start the application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLevelEditor);
} else {
  initializeLevelEditor();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (editorController) {
    editorController.destroy();
  }
});