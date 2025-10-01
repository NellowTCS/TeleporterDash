// Store levels array
import { DatabaseManager } from './Utilities/databaseManager.js';
import { DOMManager } from './Utilities/domManager.js';
import './Utilities/levelPreview.js';

const storeLevels = [];
const GITHUB_API_BASE =
  "https://api.github.com/repos/NellowTCS/TeleporterDashLevels";
const RAW_CONTENT_BASE =
  "https://raw.githubusercontent.com/NellowTCS/TeleporterDashLevels/main";

// ===== Database Management =====
async function deleteDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DatabaseManager.DB_NAME);
    request.onsuccess = () => {
      console.log("Database deleted successfully");
      resolve();
    };
    request.onerror = () => {
      console.error("Error deleting database");
      reject();
    };
  });
}

// ===== Level Store Management =====
async function loadStoreLevels() {
  try {
    // Clear existing levels
    storeLevels.length = 0;

    // Show loading state
    DOMManager.getElement("#levelGrid").innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center;">
                        Loading levels...
                    </div>`;

    // Fetch the list of files from the GitHub repository
    const response = await fetch(`${GITHUB_API_BASE}/contents`);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const files = await response.json();

    // Filter for .js files
    const levelFiles = files.filter((file) => file.name.endsWith(".js"));
    console.log("Found level files:", levelFiles);

    if (levelFiles.length === 0) {
      throw new Error("No level files found in repository");
    }

    // Load each level file and check downloaded status
    const levelPromises = levelFiles.map(async (file) => {
      try {
        // Fetch the raw content of the level file
        const levelResponse = await fetch(`${RAW_CONTENT_BASE}/${file.name}`);
        if (!levelResponse.ok) {
          throw new Error(`Failed to fetch level ${file.name}`);
        }

        const levelCode = await levelResponse.text();

        // Create a safe environment to evaluate the level code
        const levelData = new Function(`
                            let window = {};
                            ${levelCode}
                            return window.levelData;
                        `)();

        if (!levelData || !levelData.matrix) {
          throw new Error(`Invalid level data in ${file.name}`);
        }

        // Add metadata
        levelData.filename = file.name;
        levelData.dateAdded = levelData.dateAdded || new Date().toISOString();
        levelData.plays = levelData.plays || 0;
        levelData.rating = levelData.rating || 0;
        levelData.difficulty =
          levelData.difficulty || getDifficultyFromMatrix(levelData.matrix);

        // Check if this level is downloaded
        levelData.isDownloaded = await isLevelDownloaded(file.name);

        return levelData;
      } catch (error) {
        console.error(`Error loading level ${file.name}:`, error);
        // Provide more detailed error information
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        return null;
      }
    });

    // Wait for all levels to load
    const loadedLevels = await Promise.all(levelPromises);

    // Filter out any failed loads and add to storeLevels
    const validLevels = loadedLevels.filter((level) => level !== null);

    if (validLevels.length === 0) {
      throw new Error("No valid levels could be loaded");
    }

    storeLevels.push(...validLevels);

    // Display the loaded levels
    displayLevels(storeLevels);
  } catch (error) {
    console.error("Error loading levels from GitHub:", error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    const errorMessage = error.message || error.name || "Error loading levels. Please try again later.";
    DOMManager.getElement("#levelGrid").innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; color: red;">
                        ${errorMessage}
                    </div>`;
  }
}

// // Level Download Management
async function downloadLevel(filename) {
  try {
    const response = await fetch(`${RAW_CONTENT_BASE}/${filename}`);
    const levelCode = await response.text();
    console.log(levelCode);

    // Create a temporary environment to evaluate the level data
    const levelData = new Function(`
                    window = {};
                    ${levelCode}
                    return window.levelData;
                `)();

    // Add download metadata
    levelData.filename = filename;
    levelData.dateDownloaded = new Date().toISOString();
    levelData.originalCode = levelCode;

    // Store in IndexedDB
    await DatabaseManager.putLevel(levelData);
    console.log(`Level ${filename} downloaded successfully`);
    updateLevelCard(filename);
    return true;
  } catch (error) {
    console.error("Error downloading level:", error);
    alert("Failed to download level. Please try again.");
    return false;
  }
}

// // Delete Level
async function deleteLevel(filename) {
  try {
    await DatabaseManager.deleteLevel(filename);
    console.log(`Level ${filename} deleted successfully`);
    updateLevelCard(filename);
    return true;
  } catch (error) {
    console.error("Error deleting level:", error);
    return false;
  }
}

// ===== Checks =====
async function isLevelDownloaded(filename) {
  return await DatabaseManager.hasLevel(filename);
}

function updateLevelCard(filename) {
  const card = document.querySelector(`[data-filename="${filename}"]`);
  if (card) {
    const downloadButton = card.querySelector(".download-button");
    const deleteButton = card.querySelector(".delete-button");

    downloadButton.textContent = "Play Level 🎮";
    // @ts-ignore
    downloadButton.disabled = false;
    // @ts-ignore
    downloadButton.onclick = () => startGame(filename);

    deleteButton.classList.remove("hidden");
  }
}

// ===== Level Display System =====
function displayLevels(levels) {
  const levelGrid = DOMManager.getElement("#levelGrid");

  if (!levels || levels.length === 0) {
    levelGrid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center;">
                        No levels found.
                    </div>`;
    return;
  }

  // Clear existing content
  levelGrid.innerHTML = "";

  // Create and append level cards
  levels.forEach((level) => {
    try {
      const card = createLevelCard(level);
      if (card) {
        levelGrid.appendChild(card);
      }
    } catch (error) {
      console.error(`Error creating card for level ${level.filename}:`, error);
    }
  });

  // If no cards were successfully created
  if (levelGrid.children.length === 0) {
    levelGrid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center;">
                        Error displaying levels. Please try again later.
                    </div>`;
  }
}

function createLevelCard(level) {
  try {
    if (!level || !level.matrix || !level.filename) {
      console.error("Invalid level data:", level);
      return null;
    }

    const card = document.createElement("div");
    card.className = "level-card";
    card.id = `card-${level.filename}`;
    card.setAttribute("data-filename", level.filename);

    // Create preview canvas
    const previewCanvas = document.createElement("canvas");
    previewCanvas.className = "level-preview";
    previewCanvas.width = 500;
    previewCanvas.height = 200;

    // Draw level preview
    drawLevelPreview(previewCanvas, level);

    // Create level info section
    const infoDiv = document.createElement("div");
    infoDiv.className = "level-info";

    const title = document.createElement("h3");
    title.className = "level-title";
    title.textContent = level.title || level.filename.replace(".js", "");

    const author = document.createElement("p");
    author.className = "level-author";
    author.textContent = level.author || "Unknown Author";

    const stats = document.createElement("div");
    stats.className = "level-stats";
    stats.innerHTML = `
                    <span>Difficulty: ${level.difficulty || "Normal"}</span>
                    <span style="text-decoration: line-through;">Plays: ${
                      level.plays || 0
                    }</span>
                `;

    // Create button container for download/delete buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "button-container";

    // Create download button
    const downloadBtn = document.createElement("button");
    downloadBtn.className = "download-button";
    downloadBtn.textContent = level.isDownloaded ? "Play Level 🎮" : "Download";
    downloadBtn.onclick = level.isDownloaded
      ? () => startGame(level.filename)
      : () => downloadLevel(level.filename);

    // Create delete button (only shown for downloaded levels)
    const deleteBtn = document.createElement("button");
    deleteBtn.className =
      "delete-button" + (level.isDownloaded ? "" : " hidden");
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "Delete downloaded level";
    deleteBtn.onclick = async () => {
      if (confirm(`Are you sure you want to delete "${level.title}"?`)) {
        try {
          await deleteLevel(level.filename);
          level.isDownloaded = false;
          downloadBtn.className = "download-button";
          downloadBtn.textContent = "Download";
          downloadBtn.disabled = false;
          downloadBtn.onclick = () => downloadLevel(level.filename);
          deleteBtn.className = "delete-button hidden";
        } catch (error) {
          console.error("Failed to delete level:", error);
          alert("Failed to delete level. Please try again.");
        }
      }
    };

    // Assemble card
    infoDiv.appendChild(title);
    infoDiv.appendChild(author);
    infoDiv.appendChild(stats);

    buttonContainer.appendChild(downloadBtn);
    buttonContainer.appendChild(deleteBtn);

    card.appendChild(previewCanvas);
    card.appendChild(infoDiv);
    card.appendChild(buttonContainer);

    return card;
  } catch (error) {
    console.error(`Error creating card for level ${level?.filename}:`, error);
    return null;
  }
}

function getDifficultyFromMatrix(matrix) {
  if (!matrix) return "Normal";

  // Count special tiles (teleporters, spikes, etc.)
  let specialTiles = 0;
  let length = 0;

  for (let row of matrix) {
    length = Math.max(length, row.length);
    for (let tile of row) {
      if (tile > 1 && tile !== 4) {
        // 4 is the finish line
        specialTiles++;
      }
    }
  }

  // Calculate difficulty based on level length and special tiles
  const density = specialTiles / (length * matrix.length);

  if (density < 0.02) return "Easy";
  if (density < 0.03) return "Normal";
  if (density < 0.05) return "Hard";
  if (density < 0.08) return "Harder";
  if (density < 0.09) return "Expert";
  if (density < 0.1) return "Insane";
  if (density < 0.3) return "Extreme";
  if (density < 0.7) return "Easy Demon";
  if (density < 0.8) return "Medium Demon";
  if (density < 9) return "Super Demon";
  return "Impossible?";
}

// ===== Search and Filter Levels =====
function searchLevels(query) {
  const filtered = storeLevels.filter((level) =>
    level.title.toLowerCase().includes(query.toLowerCase())
  );
  displayLevels(filtered);
}

function filterLevels(criteria) {
  let filtered = [...storeLevels];
  switch (criteria) {
    case "newest":
      filtered.sort((a, b) => {
        const dateA = new Date(a.dateAdded || 0);
        const dateB = new Date(b.dateAdded || 0);
        return dateB.getTime() - dateA.getTime();
      });
      break;
    case "popular":
      filtered.sort((a, b) => b.plays - a.plays);
      break;
    case "difficulty":
      const difficultyOrder = {
        Easy: 1,
        Normal: 2,
        Hard: 3,
        Harder: 4,
        Expert: 4,
        Insane: 5,
        Extreme: 6,
        "Easy Demon": 7,
        "Medium Demon": 8,
        "Super Demon": 9,
        "Impossible?": 10,
      };
      filtered.sort(
        (a, b) =>
          (difficultyOrder[a.difficulty] || 2) -
          (difficultyOrder[b.difficulty] || 2)
      );
      break;
  }
  displayLevels(filtered);
}

// Initialize database when page loads
window.onload = async () => {
  try {
    await DatabaseManager.initDB();
    console.log("Database initialized");
    // Load levels after database is initialized
    await loadStoreLevels();
    console.log("Levels loaded");
  } catch (error) {
    console.error("Failed to initialize:", error);
    DOMManager.getElement("#levelGrid").innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; color: red;">
                        Error initializing level store. Please try again later.
                    </div>`;
  }
};
function startGame(levelFilename) {
  window.location.href = `gameloader.html?online=true&levelFile=${encodeURIComponent(
    levelFilename
  )}`;
}

// Export functions for HTML onclick access
// @ts-ignore
window.searchLevels = searchLevels;
// @ts-ignore
window.filterLevels = filterLevels;
