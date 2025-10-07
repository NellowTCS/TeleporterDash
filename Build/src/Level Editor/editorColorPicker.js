import { COLOR_MAP } from "../Utilities/constants.js";
import { GameState } from "../Utilities/gameState.js";

// ===== Color Picker Functions =====

// // Color Indicator Updates
export function updateSelectedColorIndicator() {
  const colorCells = document.querySelectorAll(".cell.color-row");
  colorCells.forEach((cell) => {
    // @ts-ignore
    if (cell.style.backgroundColor === "") {
      // @ts-ignore
      cell.style.backgroundColor =
        COLOR_MAP[GameState.current.editor.selectedColor];
    }
  });
}

// // Color Selection Handler
export function handleColorSelection(colorNum) {
  GameState.setEditorState({ selectedColor: colorNum });
  const sectionColorPicker = document.getElementById("colorPicker");
  if (sectionColorPicker instanceof HTMLSelectElement) {
    sectionColorPicker.value = colorNum.toString();
  }
  updateSelectedColorIndicator();
  // Switch to color tool
  const colorButton = document.querySelector('button[data-type="c"]');
  if (colorButton && !colorButton.classList.contains("active")) {
    (colorButton instanceof HTMLButtonElement ? colorButton : null)?.click();
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
    // @ts-ignore
    GameState.setEditorState({ selectedColor: parseInt(this.value) });
    // Switch to color tool when selecting a section color
    const colorButton = document.querySelector('button[data-type="c"]');
    if (colorButton && !colorButton.classList.contains("active")) {
      (colorButton instanceof HTMLButtonElement ? colorButton : null)?.click();
    }
    updateSelectedColorIndicator();
  });

  blockColorPicker.addEventListener("change", function () {
    // @ts-ignore
    GameState.setEditorState({ selectedBlockColor: parseInt(this.value) });
    // Always switch to platform tool when selecting a color
    const platformButton = document.querySelector('button[data-type="1"]');
    if (platformButton) {
      (platformButton instanceof HTMLButtonElement ? platformButton : null)?.click();
    }
  });
}

// // Color Picker
const colorPicker = document.getElementById("colorPicker");
colorPicker.addEventListener("change", function () {
  // @ts-ignore
  handleColorSelection(parseInt((this).value));
});
