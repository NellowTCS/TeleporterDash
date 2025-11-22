
// Rotation controls
import { updateSelectedColorIndicator } from "./editorColorPicker.js";
import { GameState } from "../Utilities/gameState.js";

// Handle Rotation Display and Controls
let tools, rotationGroup, rotateLeft, rotateRight, rotationDisplay;

function activateTool(button) {
  if (!button) return;

  document
    .querySelectorAll(".tool")
    .forEach((t) => t.classList.remove("active"));
  button.classList.add("active");

  const toolType = button.dataset.type || "select";
  const nextState = { currentTool: toolType };
  if (toolType !== "c") {
    nextState.lastToolBeforeColor = toolType;
  }
  GameState.setEditorState(nextState);

  const colorPickerGroup = document.getElementById("colorPickerGroup");
  if (colorPickerGroup) {
    colorPickerGroup.style.display = toolType === "c" ? "block" : "none";
  }

  if (toolType === "c") {
    const sectionColorPicker = document.getElementById("colorPicker");
    if (sectionColorPicker instanceof HTMLSelectElement && !sectionColorPicker.value) {
      sectionColorPicker.value = GameState.current.editor.selectedColor.toString();
    }
    updateSelectedColorIndicator();
  }

  const isRotatable = ["2", "3"].includes(toolType);
  if (rotationGroup) {
    rotationGroup.style.display = isRotatable ? "block" : "none";
  }

  if (!isRotatable) {
    GameState.setEditorState({ currentRotation: 0 });
    updateRotationDisplay();
  }
}

// Initialize elements when DOM is ready
function initializeElements() {
  tools = document.querySelectorAll(".tool");
  rotationGroup = document.getElementById("rotationGroup");
  rotateLeft = document.getElementById("rotateLeft");
  rotateRight = document.getElementById("rotateRight");
  rotationDisplay = document.getElementById("rotationDisplay");
}

function updateRotationDisplay() {
  if (rotationDisplay) {
    rotationDisplay.textContent = `${GameState.current.editor.currentRotation}°`;
  }
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

export function initializeEditorTools() {
  initializeElements();
  
  if (rotateLeft) {
    rotateLeft.addEventListener("click", () => rotateBlock(-1));
  }
  if (rotateRight) {
    rotateRight.addEventListener("click", () => rotateBlock(1));
  }

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
  if (tools) {
    tools.forEach((tool) => {
      tool.addEventListener("click", () => activateTool(tool));
    });
  }

  // Keyboard shortcuts for quick tool swapping
  const shortcutMap = {
    "1": "select",
    "2": "0",
    "3": "1",
    "4": "2",
    "5": "3",
    "6": "4",
    "7": "c",
  };

  document.addEventListener("keydown", (e) => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;

    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT" ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable))
    ) {
      return;
    }

    const targetType = shortcutMap[e.key];
    if (!targetType) return;

    const targetButton = Array.from(tools || []).find(
      (btn) => btn.dataset.type === targetType
    );

    if (targetButton) {
      e.preventDefault();
      activateTool(targetButton);
    }
  });

  // Ensure the initial tool state reflects the current GameState
  const initiallyActive = document.querySelector(".tool.active") || tools?.[0];
  if (initiallyActive) {
    activateTool(initiallyActive);
  }

  // Anti Arrow Scroll
  window.addEventListener("keydown", function (e) {
    if ([37, 38, 39, 40].indexOf(e.keyCode) > -1) {
      e.preventDefault();
    }
  });
}


