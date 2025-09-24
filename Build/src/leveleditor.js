// =====  Variables =====
// // Buttons
const grid = document.getElementById("grid");
const tools = document.querySelectorAll(".tool");
const exportBtn = document.getElementById("exportBtn");
const testBtn = document.getElementById("testBtn");
const clearBtn = document.getElementById("clearBtn");
const exportArea = document.getElementById("exportArea");
const musicSelect = document.getElementById("musicSelect");
const musicPreview = document.getElementById("musicPreview");
const previewMusicBtn = document.getElementById("previewMusic");
const levelNameInput = document.getElementById("levelName");
const bgColorSelect = document.getElementById("bgColor");

// // Changeable Variables
let hasUnsavedChanges = false;
let hasMatrixChanged = false;
let lastExportedMatrix = null;
let currentRotation = 0;
let currentTool = "0";
let lastToolBeforeColor = "1"; // Store last tool before color change
let isMouseDown = false;
let nextLevelId = 0;
let musicData = null;

// // Custom Music
let customMusicFile = null;
const customMusicInput = document.getElementById("customMusicInput");

// // Colors
const COLOR_MAP = {
  "-1": "#ff6b6b", // Red
  "-2": "#4ecdc4", // Cyan
  "-3": "#45b7d1", // Blue
  "-4": "#96ceb4", // Green
  "-5": "#ff9f1c", // Orange
  "-6": "#ffbe0b", // Yellow
  "-7": "#ff006e", // Pink
  "-8": "#8338ec", // Purple
  "-9": "#3a86ff", // Light Blue
  0: "#000000", // Empty/Default
};
let selectedColor = -1; // Default to blue
let selectedBlockColor = 0; // Default block color value

// // Grid
const gridWidthInput = document.getElementById("gridWidth");
const gridHeightInput = document.getElementById("gridHeight");
const updateGridSizeBtn = document.getElementById("updateGridSize");
const gridContainer = document.getElementById("gridContainer"); // Get grid container
let GRID_WIDTH = 100;
let GRID_HEIGHT = 12;
// // // Initialize Level Matrix
let levelMatrix = Array(GRID_HEIGHT)
  .fill()
  .map(() => Array(GRID_WIDTH).fill(0));

// // Level Registry
const LEVELS_REGISTRY_KEY = "teleporterDash_levels";

// // IndexedDB
let db;
const DB_NAME = "LevelEditorDB";
const DB_VERSION = 1;
const DRAFTS_STORE = "levelDrafts";
const TEST_STORE = "testLevel";

// // 1.4 (rotation and color-changing)

// ===== IndexedDB ======
// // Initialize IndexedDB
const dbInit = indexedDB.open(DB_NAME, DB_VERSION);

// // Errors
dbInit.onerror = (event) => {
  console.error("Database error:", event.target.error);
  db = event.target.result;
  if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
    const store = db.createObjectStore(DRAFTS_STORE, {
      keyPath: "id",
      autoIncrement: true,
    });
    store.createIndex("lastModified", "lastModified");
    store.createIndex("title", "title");
  }
  if (!db.objectStoreNames.contains(TEST_STORE)) {
    db.createObjectStore(TEST_STORE, { keyPath: "id" });
  }
};

// // Database Updates
dbInit.onupgradeneeded = (event) => {
  db = event.target.result;
  if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
    const store = db.createObjectStore(DRAFTS_STORE, {
      keyPath: "id",
      autoIncrement: true,
    });
    store.createIndex("lastModified", "lastModified");
    store.createIndex("title", "title");
  }
  if (!db.objectStoreNames.contains(TEST_STORE)) {
    db.createObjectStore(TEST_STORE, { keyPath: "id" });
  }
};

// // Continue
dbInit.onsuccess = (event) => {
  db = event.target.result;
  loadDraftsList(); // Load existing drafts when DB is ready
};

// ===== Grid ====
// // Update Grid Size
function updateGridSize() {
  const width = parseInt(gridWidthInput.value) || 100;
  const height = parseInt(gridHeightInput.value) || 5;
  if (
    height < levelMatrix.length &&
    !confirm("Reducing the height will remove some rows. Continue?")
  ) {
    return;
  }
  const oldColorRow = [...(levelMatrix[0] || Array(width).fill(0))];
  const newMatrix = Array(height)
    .fill()
    .map((_, row) => {
      if (row < levelMatrix.length) {
        const existingRow = levelMatrix[row] || [];
        return Array(width)
          .fill(0)
          .map((_, col) => (col < existingRow.length ? existingRow[col] : 0));
      } else {
        return Array(width).fill(0);
      }
    });
  newMatrix[0] = Array(width)
    .fill(0)
    .map((_, col) => (col < oldColorRow.length ? oldColorRow[col] : 0)); // Preserve color row
  GRID_WIDTH = width;
  GRID_HEIGHT = height;
  levelMatrix = newMatrix;
  createGrid();
  updateGridVisuals();
}

// // Create Initial Grid and Update Dimensions
function createGrid() {
  grid.innerHTML = "";

  // Set grid dimensions using current GRID_WIDTH and GRID_HEIGHT
  grid.style.setProperty("--grid-width", GRID_WIDTH);
  grid.style.setProperty("--grid-height", GRID_HEIGHT);

  // Create the actual grid cells
  for (let row = 0; row < GRID_HEIGHT; row++) {
    for (let col = 0; col < GRID_WIDTH; col++) {
      const cell = document.createElement("div");
      cell.dataset.row = row;
      cell.dataset.col = col;

      // Set initial cell state based on matrix
      const value = levelMatrix[row][col];

      if (row === 0) {
        // Handle color row
        const colorValue = levelMatrix[0][col] || 0; // Default to 0 if empty
        cell.className = "cell color-row";
        cell.style.backgroundColor = COLOR_MAP[colorValue];
      } else {
        // Handle game cells
        cell.className = "cell";

        if (value) {
          const properties =
            typeof value === "string" ? value.split("/") : [value.toString()];
          const blockType = parseInt(properties[0]);

          // Add base class based on block type
          switch (blockType) {
            case 1:
              cell.classList.add("platform");
              break;
            case 2:
              cell.classList.add("spike");
              break;
            case 3:
              cell.classList.add("teleporter");
              break;
            case 4:
              cell.classList.add("finish");
              break;
          }

          // Process additional properties
          properties.forEach((prop) => {
            if (prop.startsWith("@")) {
              const rotation = parseInt(prop.substring(1));
              cell.style.transform = `rotate(${rotation}deg)`;
            } else if (prop.startsWith("-")) {
              const colorCode = parseInt(prop);
              cell.style.backgroundColor = COLOR_MAP[colorCode] || COLOR_MAP[0];
            }
          });
        }
      }

      cell.addEventListener("mousedown", (e) => {
        isMouseDown = true;
        handleCellClick(e);
      });

      cell.addEventListener("mouseover", (e) => {
        if (isMouseDown) handleCellClick(e);
      });

      grid.appendChild(cell);
    }
  }
}

// // Handle Clicks in Grid
function handleCellClick(e) {
  const cell = e.target;
  if (!cell.dataset.row || !cell.dataset.col) return;

  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);

  if (currentTool === "c") {
    if (row === 0) {
      // Only allow color placement in row 0
      levelMatrix[row][col] = selectedColor;
      cell.style.backgroundColor = COLOR_MAP[selectedColor];
      cell.style.opacity = "1";
      hasUnsavedChanges = true;
      lastExportedMatrix = null;
    }
    return; // Don't allow color tool to place anything outside row 0
  } else if (row === 0) {
    return;
  } else {
    // Build block properties string
    let blockValue;

    // If using color tool, treat it as a platform (2) with color
    if (currentTool === "c") {
      blockValue = "2"; // Platform type
    } else {
      blockValue = currentTool;
    }

    // Add rotation if applicable
    if (currentRotation !== 0) {
      blockValue += `/@${currentRotation}`;
    }

    // Add color if using color tool or if block color is selected
    if (
      (currentTool === "c" || selectedBlockColor !== 0) &&
      currentTool !== "0"
    ) {
      blockValue += `/${
        currentTool === "c" ? selectedColor : selectedBlockColor
      }`;
    }

    levelMatrix[row][col] = blockValue;
  }

  updateGridVisuals();
}

// // Update Grid
function updateGridVisuals() {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell) => {
    if (!cell.dataset.row || !cell.dataset.col) return;

    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    if (row === 0) {
      // Handle color row
      const colorValue = levelMatrix[0][col] || 0; // Default to 0 if empty
      cell.className = "cell color-row";
      cell.style.backgroundColor = COLOR_MAP[colorValue];
    } else {
      // Handle game cells
      const value = levelMatrix[row][col];
      cell.className = "cell";

      if (value) {
        const properties =
          typeof value === "string" ? value.split("/") : [value.toString()];
        const blockType = parseInt(properties[0]);

        // Reset styles
        cell.style.transform = "none";
        cell.style.backgroundColor = "";

        // Add base class based on block type
        switch (blockType) {
          case 0:
            cell.classList.add("empty");
            break;
          case 1:
            cell.classList.add("platform");
            break;
          case 2:
            cell.classList.add("spike");
            break;
          case 3:
            cell.classList.add("teleporter");
            break;
          case 4:
            cell.classList.add("finish");
            break;
        }

        // Process additional properties
        properties.forEach((prop) => {
          if (prop.startsWith("@")) {
            const rotation = parseInt(prop.substring(1));
            cell.style.transform = `rotate(${rotation}deg)`;
          } else if (prop.startsWith("-")) {
            const colorCode = parseInt(prop);
            cell.style.backgroundColor = COLOR_MAP[colorCode] || COLOR_MAP[0];
          }
        });
      } else {
        cell.classList.add("empty");
      }
    }
  });
}

// Add event listener for rotation buttons
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") {
    currentRotation = (currentRotation + 90) % 360;
  } else if (e.key === "ArrowDown") {
    currentRotation = (currentRotation - 90) % 360;
  }
});

// Add event listener for block color picker
const blockColorPicker = document.getElementById("blockColorPicker");

blockColorPicker.addEventListener("change", function () {
  selectedBlockColor = parseInt(this.value);
  // Always switch to platform tool when selecting a color
  const platformButton = document.querySelector('button[data-type="1"]');
  if (platformButton) {
    platformButton.click();
  }
});

// Add event listener for section color picker
const sectionColorPicker = document.getElementById("colorPicker");

sectionColorPicker.addEventListener("change", function () {
  selectedColor = parseInt(this.value);
  // Switch to color tool when selecting a section color
  const colorButton = document.querySelector('button[data-type="c"]');
  if (colorButton && !colorButton.classList.contains("active")) {
    colorButton.click();
  }
  updateSelectedColorIndicator();
});

// Initialize color pickers
sectionColorPicker.innerHTML = `
    <option value="0" selected>Black</option>
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

blockColorPicker.innerHTML = `
    <option value="0" selected>Default</option>
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

// Rotation controls
const rotationGroup = document.getElementById("rotationGroup");
const rotateLeft = document.getElementById("rotateLeft");
const rotateRight = document.getElementById("rotateRight");
const rotationDisplay = document.getElementById("rotationDisplay");

function updateRotationDisplay() {
  rotationDisplay.textContent = `${currentRotation}°`;
}

function rotateBlock(direction) {
  if (!["2", "3"].includes(currentTool)) return; // Only rotate spikes and teleporters
  currentRotation = (currentRotation + direction * 90) % 360;
  if (currentRotation < 0) currentRotation += 360;
  updateRotationDisplay();
}

rotateLeft.addEventListener("click", () => rotateBlock(-1));
rotateRight.addEventListener("click", () => rotateBlock(1));

// Keyboard controls for rotation
document.addEventListener("keydown", (e) => {
  if (!["2", "3"].includes(currentTool)) return; // Only rotate spikes and teleporters

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
    currentTool = this.dataset.type;

    // Show/hide color picker based on tool selection
    const colorPickerGroup = document.getElementById("colorPickerGroup");
    if (currentTool === "c") {
      colorPickerGroup.style.display = "block";
      // Set initial color if not already set
      if (!sectionColorPicker.value) {
        sectionColorPicker.value = selectedColor.toString();
      }
      updateSelectedColorIndicator();
    } else {
      colorPickerGroup.style.display = "none";
    }

    // Show/hide rotation controls based on tool
    const isRotatable = ["2", "3"].includes(currentTool); // Spikes and teleporters
    rotationGroup.style.display = isRotatable ? "block" : "none";

    // Reset rotation when switching tools
    if (!isRotatable) {
      currentRotation = 0;
      updateRotationDisplay();
    }
  });
});

// ===== Level Registry =====
function getLevelsRegistry() {
  return JSON.parse(localStorage.getItem(LEVELS_REGISTRY_KEY) || "[]");
}

// ===== Export =====
// // Get Music Path
function getMusicPath(musicValue, forExport = false, isTest = false) {
  if (musicValue === "custom") {
    if (customMusicFile) {
      if (forExport || customMusicFile.isImported) {
        // For export or imported music, use the filename
        return `../Sound/Level Soundtracks/${customMusicFile.name}`;
      } else if (!isTest) {
        // For preview of uploaded music, create a new blob URL
        const blob = new Blob([customMusicFile.data], {
          type: customMusicFile.type,
        });
        return URL.createObjectURL(blob);
      }
    }
  } else {
    return `../Sound/Level Soundtracks/${musicValue}`;
  }
  return "../Sound/Level Soundtracks/level1.ogg";
}

// // Initialize the editor
createGrid();

// // Checks
// // // Next Level ID
function getNextLevelId() {
  const id = nextLevelId++;
  localStorage.setItem("nextLevelId", nextLevelId);
  return id;
}

// // Sanitize Matrix
function sanitizeMatrix(matrix) {
  return matrix.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? 0 : cell))
  );
}

// ===== Testing Functionality =====
async function testLevel() {
  // Sanitize the matrix first
  const cleanMatrix = sanitizeMatrix(levelMatrix);

  let musicValue = musicSelect.value || "level1.ogg";
  let musicData = null;

  if (musicValue === "custom" && customMusicFile) {
    // Use the stored custom music file data
    musicData = {
      name: customMusicFile.name,
      type: customMusicFile.type,
      data: customMusicFile.data,
    };
  } else if (musicValue !== "custom") {
    musicValue = `../Sound/Level Soundtracks/${musicValue}`;
  }

  const testData = {
    id: "currentTest", // Use a fixed ID to always update the same record
    matrix: cleanMatrix,
    author: document.getElementById("authorName").value || "Unknown Author",
    difficulty: document.getElementById("difficulty").value || "Normal",
    musicValue: musicValue,
    musicData: musicData,
  };

  const transaction = db.transaction([TEST_STORE], "readwrite");
  const store = transaction.objectStore(TEST_STORE);

  try {
    await store.put(testData);
    // Open the test page in a new window
    window.open(
      "./gameloader.html?test=true&levelId=currentTest",
      "_blank"
    );
  } catch (error) {
    console.error("Error saving test level:", error);
    alert("Failed to save test level");
  }
}

// ===== Color =====
// // Color Indicator Updates
function updateSelectedColorIndicator() {
  const colorCells = document.querySelectorAll(".cell.color-row");
  colorCells.forEach((cell) => {
    if (cell.style.backgroundColor === "") {
      cell.style.backgroundColor = COLOR_MAP[selectedColor];
    }
  });
}

// // Color Selection Handler
function handleColorSelection(colorNum) {
  selectedColor = colorNum;
  sectionColorPicker.value = colorNum.toString();
  updateSelectedColorIndicator();
  // Switch to color tool
  const colorButton = document.querySelector('button[data-type="c"]');
  if (colorButton && !colorButton.classList.contains("active")) {
    colorButton.click();
  }
}

// // Color Picker
const colorPicker = document.getElementById("colorPicker");
colorPicker.innerHTML = `
    <option value="0">Black</option>
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

// ===== Importing Functionality =====
function importMatrix() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".js,.txt,application/json,.zip";

  fileInput.onchange = async function (e) {
    const file = e.target.files[0];

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

          customMusicFile = {
            name: musicFile.name.split("/").pop(),
            type: "audio/mpeg",
            data: musicData,
            isImported: false, // Not imported since we have the actual file
          };

          // Create custom option if it doesn't exist
          if (!musicSelect.querySelector('option[value="custom"]')) {
            const option = document.createElement("option");
            option.value = "custom";
            option.text = "Custom: " + customMusicFile.name;
            musicSelect.add(option);
          } else {
            // Update existing custom option text
            const customOption = musicSelect.querySelector(
              'option[value="custom"]'
            );
            customOption.text = "Custom: " + customMusicFile.name;
          }
          musicSelect.value = "custom";

          // Update music preview with blob URL
          const musicPreview = document.getElementById("musicPreview");
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
          document.getElementById("levelName").value = levelData.title;
        }

        // Update author name if available
        if (levelData.author) {
          document.getElementById("authorName").value = levelData.author;
        }

        // Update difficulty if available
        if (levelData.difficulty) {
          const difficultySelect = document.getElementById("difficulty");
          Array.from(difficultySelect.options).forEach((option) => {
            if (option.value === levelData.difficulty) {
              option.selected = true;
            }
          });
        }

        // Update music selection if available
        if (levelData.music && !customMusicFile) {
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
              if (!customMusicFile) {
                customMusicFile = {
                  name: musicFile,
                  type: "audio/mpeg",
                  isImported: true, // Flag to indicate this was imported
                };
              }
            }
          }
          // Update music preview
          const musicPreview = document.getElementById("musicPreview");
          musicPreview.src = getMusicPath(musicSelect.value);
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
      GRID_HEIGHT = parsed.length;
      GRID_WIDTH = parsed[0].length;
      gridWidthInput.value = GRID_WIDTH;
      gridHeightInput.value = GRID_HEIGHT;
      hasUnsavedChanges = true;
      lastExportedMatrix = null;

      // Update level matrix
      levelMatrix = parsed;

      // Recreate grid with new dimensions and data
      createGrid();
      updateGridVisuals();
    } else {
      throw new Error("Invalid matrix format");
    }
  } catch (e) {
    alert("Invalid matrix format! " + e.message);
    console.error(e);
  }
}

// ===== Draft Functionality =====
// // Function to save current level as draft
async function saveDraft(title = "Untitled Draft") {
  try {
    const musicValue = document.getElementById("musicSelect").value;
    const draftData = {
      title: levelNameInput.value || "untitled",
      matrix: levelMatrix,
      author: document.getElementById("authorName").value || "Unknown Author",
      difficulty: document.getElementById("difficulty").value || "Normal",
      musicValue: musicValue || "level1.ogg",
      lastModified: new Date().toISOString(),
      customMusicFile: customMusicFile,
    };

    // Debug log
    console.log("Saving draft data:", JSON.stringify(draftData));

    const transaction = db.transaction([DRAFTS_STORE], "readwrite");
    const store = transaction.objectStore(DRAFTS_STORE);
    await store.add(draftData);

    alert("Draft saved successfully!");
    loadDraftsList(); // Refresh the drafts list
  } catch (error) {
    console.error("Error saving draft:", error);
    console.error("Draft data that caused error:", levelMatrix);
    alert("Failed to save draft: " + error.message);
  }
}

// // Load Drafts
async function loadDraft(draftId) {
  const transaction = db.transaction([DRAFTS_STORE], "readonly");
  const store = transaction.objectStore(DRAFTS_STORE);
  const request = store.get(draftId);

  request.onsuccess = () => {
    const draft = request.result;
    if (draft) {
      // Update current draft indicator
      currentDraftId = draftId;
      currentDraftIndicator.style.display = "block";
      currentDraftIndicator.querySelector("span").textContent = draft.title;

      levelMatrix = draft.matrix;
      GRID_HEIGHT = draft.matrix.length;
      GRID_WIDTH = draft.matrix[0].length;

      // Update input values
      gridWidthInput.value = GRID_WIDTH;
      gridHeightInput.value = GRID_HEIGHT;

      // Update grid container height
      const rowHeight = 55;
      const containerHeight = GRID_HEIGHT * rowHeight + 2;
      gridContainer.style.height = containerHeight + "px";

      // Update other fields
      levelNameInput.value = draft.title || "";
      document.getElementById("authorName").value = draft.author || "";
      document.getElementById("difficulty").value =
        draft.difficulty || "Normal";

      // Update music selection and handle custom music
      const musicSelect = document.getElementById("musicSelect");
      const musicPreview = document.getElementById("musicPreview");

      if (
        draft.musicValue === "custom" &&
        draft.customMusicFile &&
        draft.customMusicFile.data
      ) {
        try {
          customMusicFile = draft.customMusicFile;

          // Create blob for playback
          const blob = new Blob([draft.customMusicFile.data], {
            type: draft.customMusicFile.type,
          });
          const audioUrl = URL.createObjectURL(blob);

          // Add custom option to select
          const option = document.createElement("option");
          option.value = "custom";
          option.text = "Custom: " + draft.customMusicFile.name;

          // Remove any existing custom option
          Array.from(musicSelect.options).forEach((opt) => {
            if (opt.value === "custom") musicSelect.removeChild(opt);
          });

          musicSelect.add(option);
          musicSelect.value = "custom";

          // Update audio preview - set the source before revoking old URL
          const oldSrc = musicPreview.src;
          musicPreview.src = audioUrl;

          // Now safe to revoke old URL if it was a blob
          if (oldSrc.startsWith("blob:")) {
            URL.revokeObjectURL(oldSrc);
          }

          console.log("Custom music loaded successfully:", {
            name: draft.customMusicFile.name,
            type: draft.customMusicFile.type,
            dataSize: draft.customMusicFile.data.byteLength,
            url: audioUrl,
          });
        } catch (error) {
          console.error("Error loading custom music:", error);
          customMusicFile = null;
          musicSelect.value = "level1.ogg";
          musicPreview.src = "../Sound/Level Soundtracks/level1.ogg";
        }
      } else {
        customMusicFile = null;
        musicSelect.value = draft.musicValue || "level1.ogg";
        musicPreview.src = `../Sound/Level Soundtracks/${draft.musicValue}`;
      }

      createGrid();
      hasUnsavedChanges = false;
      lastExportedMatrix = null;
    }
  };
}

// Add event listeners to clear current draft indicator when changes are made
function clearCurrentDraftIndicator() {
  currentDraftId = null;
  currentDraftIndicator.style.display = "none";
  hasUnsavedChanges = true;
}

// // Delete Drafts
async function deleteDraft(draftId) {
  if (!confirm("Are you sure you want to delete this draft?")) return;

  const transaction = db.transaction([DRAFTS_STORE], "readwrite");
  const store = transaction.objectStore(DRAFTS_STORE);
  const request = store.delete(draftId);

  request.onsuccess = () => {
    alert("Draft deleted successfully!");
    loadDraftsList();
  };
}

// // Load Draft List
async function loadDraftsList() {
  const transaction = db.transaction([DRAFTS_STORE], "readonly");
  const store = transaction.objectStore(DRAFTS_STORE);
  const request = store.index("lastModified").openCursor(null, "prev");

  const draftsList = document.getElementById("draftsList");
  draftsList.innerHTML = "";

  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const draft = cursor.value;
      const draftElement = document.createElement("div");
      draftElement.className = "draft-item";
      draftElement.innerHTML = `
                <span>${draft.title}</span>
                <span>${new Date(draft.lastModified).toLocaleString()}</span>
                <button onclick="loadDraft(${draft.id})">Load</button>
                <button onclick="deleteDraft(${draft.id})">Delete</button>
            `;
      draftsList.appendChild(draftElement);
      cursor.continue();
    }
  };
}

// // Auto Save Drafts
let autoSaveTimeout;
function scheduleAutoSave() {
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    if (hasMatrixChanged) {
      saveDraft();
    }
  }, 30000); // Auto-save after 30 seconds of inactivity
}

// // Draft Event Listeners
// // // Add event listener for save draft button
document.getElementById("saveDraftBtn").addEventListener("click", saveDraft);

// ===== Event Listeners =====
// // Import Button Event Listener
document.getElementById("importBtn").addEventListener("click", importMatrix);

// // Track Grid Changes
function updateCell(row, col, value) {
  levelMatrix[row][col] = value;
  hasUnsavedChanges = true;
  updateGridVisuals();
  const originalUpdateCell = updateCell;
  originalUpdateCell(row, col, value);
  scheduleAutoSave();
}

// // Unsaved Changes Check
window.addEventListener("beforeunload", (e) => {
  if (hasMatrixChanged) {
    e.preventDefault();
    // Most browsers will show their own message, but a custom one for older browsers
    e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
  }
});

// // Color Picker
colorPicker.addEventListener("change", function () {
  handleColorSelection(parseInt(this.value));
});

// Clean up object URLs when leaving the page
window.addEventListener("beforeunload", () => {
  if (musicPreview.src.startsWith("blob:")) {
    URL.revokeObjectURL(musicPreview.src);
  }
});

// // Prevent default drag behavior
grid.addEventListener("dragstart", (e) => e.preventDefault());

// // Custom Music File Selection
customMusicInput.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      if (musicPreview.src.startsWith("blob:")) {
        URL.revokeObjectURL(musicPreview.src);
      }

      // Store the file data and metadata
      customMusicFile = {
        name: file.name,
        type: file.type,
        data: e.target.result, // This will be an ArrayBuffer
      };

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
      const blob = new Blob([e.target.result], { type: file.type });
      const audioUrl = URL.createObjectURL(blob);
      musicPreview.src = audioUrl;

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
testBtn.addEventListener("click", () => {
  testLevel();
});

// // Clear Grid
clearBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear the grid?")) {
    // Create a new matrix with all cells empty (0)
    const oldColorRow = [...levelMatrix[0]]; // Save the color row
    levelMatrix = Array(GRID_HEIGHT)
      .fill()
      .map((_, rowIndex) => {
        // For row 0 (color row), keep the existing colors
        if (rowIndex === 0) return oldColorRow;

        // For all other rows, ensure we use string '0' to match the format
        // used when setting cell values elsewhere
        return Array(GRID_WIDTH).fill("0");
      });

    // Force a complete visual refresh
    createGrid(); // This will properly reset all cells
    hasUnsavedChanges = false;
    lastExportedMatrix = null;
  }
});

// // Export Button
exportBtn.addEventListener("click", () => {
  const levelName = levelNameInput.value || "Untitled Level";
  const authorName =
    document.getElementById("authorName").value || "Unknown Author";
  const difficulty = document.getElementById("difficulty").value || "Normal";
  const musicPath = getMusicPath(musicSelect.value, true); // Pass true for export
  const levelId = getNextLevelId();
  const zip = new JSZip();

  // Create level file content
  const jsContent = `// Level ${levelId}: ${levelName}
window.levelData = {
id: ${levelId},
title: "${levelName}",
author: "${authorName}",
difficulty: "${difficulty}",
matrix: ${JSON.stringify(levelMatrix, null, 4)},
music: "${musicPath}",
colorTransitionDuration: 0.5, 
colorTransitionDelay: 0.1    
};`;

  // Add files to zip
  zip.file(`Levels/level${levelId}.js`, jsContent);

  // If using custom music, add it to the zip
  if (musicSelect.value === "custom" && customMusicFile) {
    // Use the stored custom music file data
    const blob = new Blob([customMusicFile.data], {
      type: customMusicFile.type,
    });
    zip.file(`Sound/Level Soundtracks/${customMusicFile.name}`, blob);
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
  lastExportedMatrix = JSON.parse(JSON.stringify(levelMatrix));
  hasUnsavedChanges = false;

  alert(
    "Your level will be downloaded for backup and then you will be redirected to a form to submit your level in a few seconds. Note: If you get the error 'Address unavailable:', this is just an GitHub server issue and you can click Upload again. "
  );
  setTimeout(() => {
    window.location.href =
      "https://script.google.com/macros/s/AKfycby1XUV7ovzK6NbLdGLVX36V9_FrkFXDyeZrCpGkNmKBc3TI6rqi0m_6_Jcg46XELyffug/exec";
  }, 3000);
});

// // Preview Music
previewMusicBtn.addEventListener("click", () => {
  if (musicPreview.paused) {
    // // Revoke previous Object URL if it exists
    // if (musicPreview.src.startsWith('blob:')) {
    //     URL.revokeObjectURL(musicPreview.src);
    // }

    const musicPath = getMusicPath(musicSelect.value);
    musicPreview.src = musicPath;
    console.log("Setting music path:", musicPath);

    musicPreview.play().catch((error) => {
      console.error("Failed to play music:", error);
      alert(
        "Failed to play music preview. Please ensure you have selected a valid audio file."
      );
      previewMusicBtn.textContent = "Preview Music";
    });

    previewMusicBtn.textContent = "Stop Preview";
  } else {
    // Cleanup Object URL when stopping
    if (musicPreview.src.startsWith("blob:")) {
      URL.revokeObjectURL(musicPreview.src);
    }
    musicPreview.pause();
    musicPreview.currentTime = 0;
    previewMusicBtn.textContent = "Preview Music";
  }
});

// // Stop drawing when mouse is released
document.addEventListener("mouseup", () => {
  isMouseDown = false;
});

// // Tool Selection
tools.forEach((tool) => {
  tool.addEventListener("click", () => {
    tools.forEach((t) => t.classList.remove("active"));
    tool.classList.add("active");
    currentTool = tool.dataset.type;

    // Show/hide color picker based on tool selection
    const colorPickerGroup = document.getElementById("colorPickerGroup");
    colorPickerGroup.style.display = currentTool === "c" ? "block" : "none";

    // Show/hide rotation controls based on tool
    const isRotatable = ["2", "3"].includes(currentTool); // Spikes and teleporters
    rotationGroup.style.display = isRotatable ? "block" : "none";

    // Reset rotation when switching tools
    if (!isRotatable) {
      currentRotation = 0;
      updateRotationDisplay();
    }
  });
});

// // Update Button
updateGridSizeBtn.addEventListener("click", updateGridSize);

// // Music Selection
musicSelect.addEventListener("change", function () {
  if (this.value === "custom") {
    customMusicInput.click();
  }
});

// // Back to Menu Button
document.getElementById("backToMenuBtn").addEventListener("click", () => {
  if (hasMatrixChanged) {
    if (confirm("You have unsaved changes. Are you sure you want to leave?")) {
      window.location.href = "./index.html";
    }
  } else {
    window.location.href = "./index.html";
  }
});

// // Anti Arrow Scroll
window.addEventListener("keydown", function (e) {
  if ([37, 38, 39, 40].indexOf(e.keyCode) > -1) {
    e.preventDefault();
  }
});

gridContainer.addEventListener("click", clearCurrentDraftIndicator);
levelNameInput.addEventListener("input", clearCurrentDraftIndicator);
document
  .getElementById("authorName")
  .addEventListener("input", clearCurrentDraftIndicator);
document
  .getElementById("difficulty")
  .addEventListener("change", clearCurrentDraftIndicator);
document
  .getElementById("musicSelect")
  .addEventListener("change", clearCurrentDraftIndicator);
customMusicInput.addEventListener("change", clearCurrentDraftIndicator);
