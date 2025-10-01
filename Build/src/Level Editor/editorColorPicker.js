import { COLOR_MAP } from "../constants";
import { GameState } from "../gameState";

// ===== Color Picker Functions =====

// // Color Indicator Updates
export function updateSelectedColorIndicator() {
  const colorCells = document.querySelectorAll(".cell.color-row");
  colorCells.forEach((cell) => {
    if (cell.style.backgroundColor === "") {
      cell.style.backgroundColor =
        COLOR_MAP[GameState.current.editor.selectedColor];
    }
  });
}

// // Color Selection Handler
export function handleColorSelection(colorNum) {
  GameState.setEditorState({ selectedColor: colorNum });
  const sectionColorPicker = document.getElementById("colorPicker");
  sectionColorPicker.value = colorNum.toString();
  updateSelectedColorIndicator();
  // Switch to color tool
  const colorButton = document.querySelector('button[data-type="c"]');
  if (colorButton && !colorButton.classList.contains("active")) {
    colorButton.click();
  }
}

// // Color Picker Options Template
export function createColorOptionsTemplate(includeDefault = false) {
  const defaultOption = includeDefault
    ? '<option value="0" selected>Default</option>'
    : '<option value="0" selected>Black</option>';
  return `
    ${defaultOption}
    <option value="-1">Red</option>
    <option value="-2">Cyan</option>
    <option value="-3">Blue</option>
    <option value="-4">Green</option>
    <option value="-5">Orange</option>
    <option value="-6">Yellow</option>
    <option value="-7">Pink</option>
    <option value="-8">Purple</option>
    <option value="-9">Light Blue</option>
  `;
}

// // Initialize Color Pickers
export function initializeColorPickers() {
  const sectionColorPicker = document.getElementById("colorPicker");
  const blockColorPicker = document.getElementById("blockColorPicker");

  // Initialize section color picker
  sectionColorPicker.innerHTML = createColorOptionsTemplate();

  // Initialize block color picker
  blockColorPicker.innerHTML = createColorOptionsTemplate(true);

  // Add event listeners
  sectionColorPicker.addEventListener("change", function () {
    GameState.setEditorState({ selectedColor: parseInt(this.value) });
    // Switch to color tool when selecting a section color
    const colorButton = document.querySelector('button[data-type="c"]');
    if (colorButton && !colorButton.classList.contains("active")) {
      colorButton.click();
    }
    updateSelectedColorIndicator();
  });

  blockColorPicker.addEventListener("change", function () {
    GameState.setEditorState({ selectedBlockColor: parseInt(this.value) });
    // Always switch to platform tool when selecting a color
    const platformButton = document.querySelector('button[data-type="1"]');
    if (platformButton) {
      platformButton.click();
    }
  });
}

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

// // Color Picker
const colorPicker = document.getElementById("colorPicker");
colorPicker.addEventListener("change", function () {
  handleColorSelection(parseInt(this.value));
});
