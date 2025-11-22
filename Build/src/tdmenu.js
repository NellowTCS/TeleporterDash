// Menu Navigation System
import { DatabaseManager } from "./Utilities/databaseManager.js";
import { DOMManager } from "./Utilities/domManager.js";
import "./Utilities/levelPreview.js";
import {
  showError,
  showLoadingError,
} from "./Utilities/notificationManager.js";

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

// Assign to window immediately after definition
// @ts-ignore
window.handleMenuTransition = handleMenuTransition;

// Audio Setup - moved to DOMContentLoaded below
/** @type {HTMLAudioElement | null} */
let menuMusic = null;

let levelsLoaded = false;
let cssLoaded = false;

document.fonts.ready.then(() => {
  cssLoaded = true;
});

// Navigation Functions
function startGame() {
  console.log(currentLevelType);
  // @ts-ignore
  if (currentLevelType === "built-in" && window.builtInLevels) {
    // @ts-ignore
    const level = window.builtInLevels[currentLevelIndex];
    window.location.href = `gameloader.html?level=${level.number}`;
    // @ts-ignore
  } else if (currentLevelType === "online" && window.onlineLevels) {
    // @ts-ignore
    const level = window.onlineLevels[currentLevelIndex];
    window.location.href = `gameloader.html?online=true&levelFile=${encodeURIComponent(
      level.filename,
    )}`;
  }
  transitionMenu(
    document.querySelector(".menu"),
    document.querySelector(".level-selector"),
  );
}

function openLevelEditor() {
  window.location.href = "leveleditor.html";
}

function showCredits() {
  alert(
    "Credits to Etheblix for the Menu Music, Tranquill Teleportation!\nCredits to RobTopGames for the original game and music! \nCredits to ForeverBound, DJVI, and Step for the amazing original Geometry Dash music!",
  );
}

// Assign to window immediately after definition
// @ts-ignore
window.showCredits = showCredits;

function levelStore() {
  window.location.href = "levelstore.html";
}

// Settings Functions
function updateVolumeLabel() {
  const volume = DOMManager.getElement("#volumeSlider").value;
  DOMManager.getElement("#volumeLabel").innerText = volume;
  if (menuMusic) {
    menuMusic.volume = volume / 100;
  }
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
    ".built-in-levels .level-selector",
  );

  // Clone template and populate
  const template = document.querySelector("#built-in-level-template");
  if (!template) {
    console.error("Template not found: #built-in-level-template");
    return;
  }
  // @ts-ignore
  const content = template.content.cloneNode(true);
  levelSelector.innerHTML = "";
  levelSelector.appendChild(content);

  const levels = await scanForLevels();
  // @ts-ignore
  window.builtInLevels = levels;
  currentLevelIndex = 0;
  maxLevelIndex = levels.length - 1;
  await updateLevelDisplay();
}

async function loadOnlineLevelRegistry() {
  loadingStarted = true;
  currentLevelType = "online";
  const levelSelector = document.querySelector(
    ".online-levels .level-selector",
  );

  // Clone template and populate
  const template = document.querySelector("#online-level-template");
  if (!template) {
    console.error("Template not found: #online-level-template");
    return;
  }
  // @ts-ignore
  const content = template.content.cloneNode(true);
  levelSelector.innerHTML = "";
  levelSelector.appendChild(content);

  try {
    const levels = await DatabaseManager.getDownloadedLevels();
    if (levels.length === 0) {
      const levelDisplay = document.querySelector(
        ".online-levels .level-display",
      );
      levelDisplay.innerHTML =
        '<p class="no-levels">No downloaded levels found.<br>Visit the Level Store to download levels!</p>';
      return;
    }
    // @ts-ignore
    window.onlineLevels = levels;
    currentLevelIndex = 0;
    maxLevelIndex = levels.length - 1;
    await updateLevelDisplay();
  } catch (error) {
    console.error("Error loading downloaded levels:", error);
    const levelDisplay = document.querySelector(
      ".online-levels .level-display",
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
      : ".online-levels .level-selector",
  );
  if (!container) return;

  const levelDisplay = container.querySelector(".level-display");
  if (!levelDisplay) {
    // Clone the level-display template
    const template = document.querySelector("#level-display-template");
    if (!template) {
      console.error("Template not found: #level-display-template");
      return;
    }
    // @ts-ignore
    const content = template.content.cloneNode(true);
    container.innerHTML = "";
    container.appendChild(content);

    // Update the title based on level type
    const title = container.querySelector("h1");
    if (title) {
      title.textContent =
        currentLevelType === "built-in" ? "Select Level" : "Downloaded Levels";
    }

    // Update back button onclick
    const backButton = container.querySelector(".back-button");
    if (backButton) {
      // @ts-ignore
      backButton.onclick = () =>
        handleMenuTransition(
          currentLevelType === "built-in" ? "built-in-levels" : "online-levels",
          "menu",
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

      // @ts-ignore
      levelData = window.levelData;
      document.head.removeChild(script);
      // @ts-ignore
      window.levelData = null;
    } else {
      // @ts-ignore
      if (!window.onlineLevels || !Array.isArray(window.onlineLevels)) {
        throw new Error("No online levels data available");
      }
      // @ts-ignore
      if (
        currentLevelIndex < 0 ||
        currentLevelIndex >= window.onlineLevels.length
      ) {
        throw new Error(`Invalid level index: ${currentLevelIndex}`);
      }
      // @ts-ignore
      levelData = window.onlineLevels[currentLevelIndex];
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

    // @ts-ignore
    if (prevButton) prevButton.disabled = currentLevelIndex === 0;
    // @ts-ignore
    if (nextButton) nextButton.disabled = currentLevelIndex === maxLevelIndex;
  } catch (error) {
    console.error("Error updating level display:", error);
    showLoadingError(
      "Failed to load level data",
      currentLevelType === "built-in",
    );
  }
}

// Resizing Function
function updateMenuScale() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const zoomLevel = window.devicePixelRatio || 1;

  // Menu scaling (unchanged)
  const menuElement = DOMManager.getElement("#menu");
  if (menuElement) {
    const baseMenuWidth = 450;
    const baseMenuHeight = 300;
    const menuWidthScale = ((width / zoomLevel) * 0.7) / baseMenuWidth;
    const menuHeightScale = ((height / zoomLevel) * 0.7) / baseMenuHeight;
    let menuScale = Math.min(menuWidthScale, menuHeightScale);
    menuScale = Math.max(0.6, Math.min(menuScale, 1.2));
    document.documentElement.style.setProperty(
      "--menu-scale",
      menuScale.toString(),
    );
  }

  // Simplified - no complex level selector scaling needed
}

// Initial scale setup
window.addEventListener("DOMContentLoaded", () => {
  // Wait for fonts to load before scaling
  document.fonts.ready.then(() => {
    setTimeout(updateMenuScale, 100);
  });

  // Audio Setup
  menuMusic = DOMManager.getElement("#menuMusic");
  if (menuMusic) {
    menuMusic.loop = true;
    menuMusic.volume = 0.9;
    menuMusic.preload = "auto";
    window.addEventListener("click", () => menuMusic.play(), { once: true });
  }
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
      "Are you sure you want to clear all data? This action cannot be undone.",
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
        "Do you want to leave the page? (Clicking No/Cancel will reload the page)",
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
// @ts-ignore
window.startGame = startGame;
// @ts-ignore
window.openLevelEditor = openLevelEditor;
// @ts-ignore
window.levelStore = levelStore;
// @ts-ignore
window.updateVolumeLabel = updateVolumeLabel;
// @ts-ignore
window.handleLevelNavigation = handleLevelNavigation;
// @ts-ignore
window.clearData = clearData;
