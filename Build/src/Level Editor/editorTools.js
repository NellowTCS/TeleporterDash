
// Rotation controls
import { updateSelectedColorIndicator } from "./editorColorPicker.js";
import { GameState } from "../Utilities/gameState.js";

// Handle Rotation Display and Controls
const tools = document.querySelectorAll(".tool");
const rotationGroup = document.getElementById("rotationGroup");
const rotateLeft = document.getElementById("rotateLeft");
const rotateRight = document.getElementById("rotateRight");
const rotationDisplay = document.getElementById("rotationDisplay");

function updateRotationDisplay() {
  rotationDisplay.textContent = `${GameState.current.editor.currentRotation}°`;
}

function rotateBlock(direction) {
  if (!["2", "3"].includes(GameState.current.editor.currentTool)) return; // Only rotate spikes and teleporters
  const newRotation =
    (GameState.current.editor.currentRotation + direction * 90) % 360;
  GameState.setEditorState({
    currentRotation: newRotation < 0 ? newRotation + 360 : newRotation,
  });
  updateRotationDisplay();
}

rotateLeft.addEventListener("click", () => rotateBlock(-1));
rotateRight.addEventListener("click", () => rotateBlock(1));

// Keyboard controls for rotation
document.addEventListener("keydown", (e) => {
  if (!["2", "3"].includes(GameState.current.editor.currentTool)) return; // Only rotate spikes and teleporters

  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    rotateBlock(-1);
  } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    rotateBlock(1);
  }
});

// Handle Tool Selection
document.querySelectorAll(".tool").forEach((tool) => {
  tool.addEventListener("click", function () {
    document
      .querySelectorAll(".tool")
      .forEach((t) => t.classList.remove("active"));
    this.classList.add("active");
    GameState.setEditorState({ currentTool: this.dataset.type });

    // Show/hide color picker based on tool selection
    const colorPickerGroup = document.getElementById("colorPickerGroup");
    if (GameState.current.editor.currentTool === "c") {
      colorPickerGroup.style.display = "block";
      // Set initial color if not already set
      const sectionColorPicker = document.getElementById("colorPicker");
      // @ts-ignore
      if (!sectionColorPicker.value) {
        // @ts-ignore
        sectionColorPicker.value =
          GameState.current.editor.selectedColor.toString();
      }
      updateSelectedColorIndicator();
    } else {
      colorPickerGroup.style.display = "none";
    }

    // Show/hide rotation controls based on tool
    const isRotatable = ["2", "3"].includes(
      GameState.current.editor.currentTool
    ); // Spikes and teleporters
    rotationGroup.style.display = isRotatable ? "block" : "none";

    // Reset rotation when switching tools
    if (!isRotatable) {
      GameState.setEditorState({ currentRotation: 0 });
      updateRotationDisplay();
    }
  });
});

// // Anti Arrow Scroll
window.addEventListener("keydown", function (e) {
  if ([37, 38, 39, 40].indexOf(e.keyCode) > -1) {
    e.preventDefault();
  }
});

// Add event listener for rotation buttons
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") {
    const newRotation = (GameState.current.editor.currentRotation + 90) % 360;
    GameState.setEditorState({ currentRotation: newRotation });
  } else if (e.key === "ArrowDown") {
    const newRotation = (GameState.current.editor.currentRotation - 90) % 360;
    GameState.setEditorState({
      currentRotation: newRotation < 0 ? newRotation + 360 : newRotation,
    });
  }
});
