// Menu Navigation System
import { DatabaseManager } from './databaseManager.js';
import './levelPreview.js';

async function transitionMenu(fromMenu, toMenu) {
  return new Promise((resolve) => {
    if (fromMenu) {
      fromMenu.classList.add("fade-out");
      setTimeout(() => {
        fromMenu.style.display = "none";
        if (toMenu) {
          toMenu.style.display = "block";
          setTimeout(() => {
            toMenu.classList.remove("fade-out");
            resolve();
          }, 50);
        } else {
          resolve();
        }
      }, 500);
    } else if (toMenu) {
      toMenu.style.display = "block";
      setTimeout(() => {
        toMenu.classList.remove("fade-out");
        resolve();
      }, 50);
    }
  });
}

async function handleMenuTransition(from, to) {
  const fromMenu = document.querySelector("." + from);
  const toMenu = document.querySelector("." + to);

  if (to === "built-in-levels") {
    await loadBuiltInLevelRegistry();
  } else if (to === "online-levels") {
    await loadOnlineLevelRegistry();
  }

  await transitionMenu(fromMenu, toMenu);
}

// Audio Setup
const menuMusic = document.getElementById("menu-music");
menuMusic.loop = true;
menuMusic.volume = 0.9;
menuMusic.preload = "auto";

window.addEventListener("click", () => menuMusic.play(), { once: true });

let levelsLoaded = false;
let cssLoaded = false;

document.fonts.ready.then(() => {
  cssLoaded = true;
});

// Navigation Functions
function startGame() {
  console.log(currentLevelType);
  if (currentLevelType === "built-in" && window.builtInLevels) {
    const level = window.builtInLevels[currentLevelIndex];
    window.location.href = `gameloader.html?level=${level.number}`;
  } else if (currentLevelType === "online" && window.downloadedLevels) {
    const level = window.downloadedLevels[currentLevelIndex];
    window.location.href = `gameloader.html?online=true&levelFile=${encodeURIComponent(
      level.filename
    )}`;
  }
  transitionMenu(
    document.querySelector(".menu"),
    document.querySelector(".level-selector")
  );
}

function openLevelEditor() {
  window.location.href = "leveleditor.html";
}

function showCredits() {
  alert(
    "Credits to Etheblix for the Menu Music, Tranquill Teleportation!\nCredits to RobTopGames for the original game and music! \nCredits to ForeverBound, DJVI, and Step for the amazing original Geometry Dash music!"
  );
}

function levelStore() {
  window.location.href = "levelstore.html";
}

// Settings Functions
function updateVolumeLabel() {
  const volume = document.getElementById("volume-slider").value;
  document.getElementById("volume-label").innerText = volume;
  menuMusic.volume = volume / 100;
}

// Level System
let currentLevelIndex = 0;
let maxLevelIndex = 0;
let loadingStarted = false;
let currentLevelType = "built-in";

async function getDownloadedLevels() {
  return await DatabaseManager.getDownloadedLevels();
}

const BUILT_IN_LEVELS = [
  { filename: "level1.js", number: 1 },
  { filename: "level2.js", number: 2 },
  { filename: "level3.js", number: 3 },
];

async function scanForLevels() {
  return BUILT_IN_LEVELS;
}

async function loadBuiltInLevelRegistry() {
  loadingStarted = true;
  currentLevelType = "built-in";
  const levelSelector = document.querySelector(
    ".built-in-levels .level-selector"
  );
  
  // Clone template and populate
  const template = document.getElementById('built-in-level-template');
  const content = template.content.cloneNode(true);
  levelSelector.innerHTML = '';
  levelSelector.appendChild(content);

  const levels = await scanForLevels();
  window.builtInLevels = levels;
  currentLevelIndex = 0;
  maxLevelIndex = levels.length - 1;
  await updateLevelDisplay();
}

async function loadOnlineLevelRegistry() {
  loadingStarted = true;
  currentLevelType = "online";
  const levelSelector = document.querySelector(
    ".online-levels .level-selector"
  );
  
  // Clone template and populate
  const template = document.getElementById('online-level-template');
  const content = template.content.cloneNode(true);
  levelSelector.innerHTML = '';
  levelSelector.appendChild(content);

  try {
    const levels = await DatabaseManager.getDownloadedLevels();
    if (levels.length === 0) {
      const levelDisplay = document.querySelector(
        ".online-levels .level-display"
      );
      levelDisplay.innerHTML =
        '<p class="no-levels">No downloaded levels found.<br>Visit the Level Store to download levels!</p>';
      return;
    }
    window.onlineLevels = levels;
    currentLevelIndex = 0;
    maxLevelIndex = levels.length - 1;
    await updateLevelDisplay();
  } catch (error) {
    console.error("Error loading downloaded levels:", error);
    const levelDisplay = document.querySelector(
      ".online-levels .level-display"
    );
    levelDisplay.innerHTML =
      '<p class="error-message">Error loading levels.<br>Please try again later.</p>';
  }
}

async function handleLevelNavigation(direction) {
  const newIndex = currentLevelIndex + direction;

  if (newIndex >= 0 && newIndex <= maxLevelIndex) {
    currentLevelIndex = newIndex;
    await updateLevelDisplay();
  }
}

async function updateLevelDisplay() {
  const container = document.querySelector(
    currentLevelType === "built-in"
      ? ".built-in-levels .level-selector"
      : ".online-levels .level-selector"
  );
  if (!container) return;

  const levelDisplay = container.querySelector(".level-display");
  if (!levelDisplay) {
    // Clone the level-display template
    const template = document.getElementById('level-display-template');
    const content = template.content.cloneNode(true);
    container.innerHTML = '';
    container.appendChild(content);
    
    // Update the title based on level type
    const title = container.querySelector('h1');
    if (title) {
      title.textContent = currentLevelType === "built-in" ? "Select Level" : "Downloaded Levels";
    }
    
    // Update back button onclick
    const backButton = container.querySelector('.back-button');
    if (backButton) {
      backButton.onclick = () => handleMenuTransition(
        currentLevelType === "built-in" ? "built-in-levels" : "online-levels", 
        'menu'
      );
    }
  }

  try {
    let levelData;
    if (currentLevelType === "built-in") {
      const script = document.createElement("script");
      script.src = `Levels/${BUILT_IN_LEVELS[currentLevelIndex].filename}`;

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      levelData = window.levelData;
      document.head.removeChild(script);
      window.levelData = null;
    } else {
      levelData = window.downloadedLevels[currentLevelIndex];
    }

    if (!levelData) throw new Error("No level data found");

    const preview = container.querySelector(".level-preview");
    preview.innerHTML = "";
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = 500;
    previewCanvas.height = 200;
    drawLevelPreview(previewCanvas, levelData);
    preview.appendChild(previewCanvas);

    const info = container.querySelector(".level-info");
    info.innerHTML = "";

    const title = document.createElement("h3");
    title.className = "level-title";
    title.textContent =
      levelData.title ||
      (currentLevelType === "built-in"
        ? `Level ${BUILT_IN_LEVELS[currentLevelIndex].number}`
        : levelData.filename.replace(".js", ""));

    const stats = document.createElement("div");
    stats.className = "level-stats";
    stats.innerHTML = `
            <span>Difficulty: ${levelData.difficulty || "Normal"}</span>
            <span>Author: ${levelData.author || "Unknown"}</span>
        `;

    info.appendChild(title);
    info.appendChild(stats);

    const prevButton = container.querySelector(".nav-button.prev");
    const nextButton = container.querySelector(".nav-button.next");

    if (prevButton) prevButton.disabled = currentLevelIndex === 0;
    if (nextButton) nextButton.disabled = currentLevelIndex === maxLevelIndex;
  } catch (error) {
    console.error("Error updating level display:", error);
    showLoadingError(
      "Failed to load level data",
      currentLevelType === "built-in"
    );
  }
}

// Error Handling
function showError(message, container) {
  const errorElement = document.createElement("div");
  errorElement.className = "error-message";
  errorElement.innerHTML = `
        <p>${message}</p>
        <button onclick="this.parentElement.remove()">OK</button>
    `;
  container.appendChild(errorElement);
}

function showLoadingError(message, isBuiltIn = false) {
  const container = document.querySelector(
    isBuiltIn
      ? ".built-in-levels #current-level"
      : ".online-levels #current-level"
  );
  if (container) {
    container.innerHTML = `<p>${message}</p>`;
  }
}

// Resizing Function
function updateMenuScale() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const zoomLevel = window.devicePixelRatio || 1;

  // Menu scaling (unchanged)
  const menuElement = document.querySelector(".menu");
  if (menuElement) {
    const baseMenuWidth = 450;
    const baseMenuHeight = 300;
    const menuWidthScale = ((width / zoomLevel) * 0.7) / baseMenuWidth;
    const menuHeightScale = ((height / zoomLevel) * 0.7) / baseMenuHeight;
    let menuScale = Math.min(menuWidthScale, menuHeightScale);
    menuScale = Math.max(0.6, Math.min(menuScale, 1.2));
    document.documentElement.style.setProperty("--menu-scale", menuScale);
  }

  // Level selector scaling
  const levelSelectorElement = document.querySelector(".level-selector");
  if (levelSelectorElement) {
    const baseLevelWidth = 1200;
    const baseLevelHeight = 1000; // Increased for taller mobile
    const levelWidthScale = ((width / zoomLevel) * 1.0) / baseLevelWidth;
    const levelHeightScale = ((height / zoomLevel) * 1.0) / baseLevelHeight;
    let levelScale;
    if (width < 768) {
      // Mobile
      const levelHeightScale = ((height / zoomLevel) * 1.0) / baseLevelHeight; // 100% height ratio
      levelScale = Math.min(levelWidthScale, levelHeightScale);
      levelScale = Math.max(1.8, Math.min(levelScale, 2.5)); // Large mobile size
      levelSelectorElement.style.maxHeight = "100vh"; // Full height on mobile
    } else {
      // Desktop
      const levelHeightScale = ((height / zoomLevel) * 0.9) / baseLevelHeight; // Reduced to 40% height ratio
      levelScale = Math.min(levelWidthScale, levelHeightScale);
      levelScale = Math.max(1.0, Math.min(levelScale, 1.6)); // Desktop range
      levelSelectorElement.style.maxHeight = `${Math.min(
        baseLevelHeight * levelScale,
        height * 0.9
      )}px`; // Smaller desktop height
    }

    // Adjust for overflow
    const scaledWidth = baseLevelWidth * levelScale;
    const scaledHeight = baseLevelHeight * levelScale;
    if (scaledWidth > width || scaledHeight > height) {
      const overflowScale = Math.min(
        width / scaledWidth,
        height / scaledHeight
      );
      levelScale *= overflowScale;
    }

    document.documentElement.style.setProperty(
      "--level-selector-scale",
      levelScale
    );

    // Adjust content scale: smaller on desktop, normal on mobile
    const contentScale = width >= 768 ? 0.6 : 1.0; // Reduce content size on desktop
    document.documentElement.style.setProperty("--content-scale", contentScale);
  }
}

// Initial scale setup
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(updateMenuScale, 100);
});

// Update scale on resize with debounce
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(updateMenuScale, 100);
});

// Clear Data Function
function clearData() {
  if (
    confirm(
      "Are you sure you want to clear all data? This action cannot be undone."
    )
  ) {
    localStorage.clear();
    indexedDB
      .databases()
      .then((databases) => {
        databases.forEach((db) => {
          indexedDB.deleteDatabase(db.name);
        });
      })
      .catch((error) => {
        console.error("Error deleting databases:", error);
      });
    if (
      confirm(
        "Do you want to leave the page? (Clicking No/Cancel will reload the page)"
      )
    ) {
      window.location.href = "https://github.com/NellowTCS/TeleporterDash/";
    } else {
      location.reload();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => DatabaseManager.initDB());

// Make functions global for HTML onclick
window.handleMenuTransition = handleMenuTransition;
window.startGame = startGame;
window.openLevelEditor = openLevelEditor;
window.showCredits = showCredits;
window.levelStore = levelStore;
window.updateVolumeLabel = updateVolumeLabel;
window.handleLevelNavigation = handleLevelNavigation;
window.clearData = clearData;
