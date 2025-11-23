let _gameContainer = null;
let _cameraContainer = null;

function init(gameContainerElement, cameraContainerElement) {
  _gameContainer = gameContainerElement;
  _cameraContainer = cameraContainerElement || document.querySelector("#cameraContainer");
  if (!_camera_container()) {
    console.warn("renderEngine: no camera container found, defaulting to document.body");
  }
}

function _camera_container() {
  if (!_cameraContainer) {
    const found = document.querySelector("#cameraContainer");
    if (found) {
      _cameraContainer = found;
    } else {
      _cameraContainer = document.body;
    }
  }
  return _cameraContainer;
}

/**
 * Ensure element is appended to camera container and has consistent base styles
 */
function ensureElementBase(el) {
  const cam = _camera_container();
  if (!el.parentNode || el.parentNode !== cam) {
    cam.appendChild(el);
  }
  el.style.position = "absolute";
  el.style.willChange = "transform, left, bottom";
  el.style.boxSizing = "border-box";
  el.style.margin = "0";
  el.style.padding = "0";
  el.style.transition = "none";
  el.style.backfaceVisibility = "hidden";
  el.style.transformOrigin = "center center";
}

function createPlayerElement(existingElement) {
  const cam = _camera_container();
  if (existingElement) {
    if (!existingElement.parentNode || existingElement.parentNode !== cam) {
      cam.appendChild(existingElement);
    }
    existingElement.style.position = "absolute";
    existingElement.style.willChange = "transform, left, bottom";
    existingElement.style.boxSizing = "border-box";
    existingElement.style.margin = "0";
    return existingElement;
  }

  const el = document.createElement("div");
  el.id = "player";
  el.style.position = "absolute";
  el.style.width = "30px";
  el.style.height = "30px";
  el.style.left = "100px";
  el.style.bottom = "50px";
  el.style.boxSizing = "border-box";
  el.style.margin = "0";
  cam.appendChild(el);
  return el;
}

/**
 * Create or ensure DOM element for an obstacleObj.
 * obstacleObj must contain: type, width, height, color?, rotation?
 * createObstacleElement will attach the created element to camera container and set .element
 */
function createObstacleElement(obstacleObj) {
  const cam = _camera_container();

  // If element already provided, ensure base styles and return
  if (obstacleObj.element) {
    const el = obstacleObj.element;
    if (!el.parentNode || el.parentNode !== cam) {
      cam.appendChild(el);
    }
    el.style.position = "absolute";
    el.style.willChange = "left, bottom, transform";
    el.style.boxSizing = "border-box";
    el.style.margin = "0";
    return el;
  }

  const type = obstacleObj.type || "empty";
  const w = Math.round(obstacleObj.width || (type === "platform" ? 45 : 30));
  const h = Math.round(obstacleObj.height || (type === "teleporter" ? 60 : (type === "finish" ? 350 : 30)));
  const color = obstacleObj.color || null;
  const rotation = typeof obstacleObj.rotation === "number" ? obstacleObj.rotation : 0;

  let el = document.createElement("div");
  el.style.position = "absolute";
  el.style.willChange = "left, bottom, transform";
  el.style.boxSizing = "border-box";
  el.style.margin = "0";
  el.style.padding = "0";
  el.style.backgroundClip = "padding-box";

  switch (type) {
    case "finish":
      el.className = "finishLine";
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.background = color || "#00ff00";
      break;

    case "spike": {
      el.className = "spike";
      // Create a CSS triangle using borders. We'll set element width/height = 0 and use borders.
      const half = Math.round(w / 2);
      el.style.width = `0px`;
      el.style.height = `0px`;
      el.style.borderLeft = `${half}px solid transparent`;
      el.style.borderRight = `${half}px solid transparent`;
      el.style.borderBottom = `${h}px solid ${color || "red"}`;
      el.style.transformOrigin = "center bottom";
      break;
    }

    case "teleporter":
      el.className = "teleporter";
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.background = obstacleObj.background || "linear-gradient(to right, #ff00ff, #8c00ff)";
      el.style.borderRadius = "15px";
      el.style.animation = "glow 1s infinite alternate";
      break;

    case "platform":
      el.className = "platform";
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      if (color) el.style.background = color;
      break;

    case "empty":
    default:
      el.className = "empty-block";
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.background = "transparent";
      break;
  }

  if (rotation) {
    el.style.transform = `rotate(${rotation}deg)`;
  }

  cam.appendChild(el);
  obstacleObj.element = el;
  return el;
}

function renderPlayer(playerObj) {
  if (!playerObj || !playerObj.element) return;
  const el = playerObj.element;
  el.style.left = `${Math.round(playerObj.x)}px`;
  el.style.bottom = `${Math.round(playerObj.y)}px`;
  if (playerObj.rotation) {
    el.style.transform = `rotate(${playerObj.rotation}deg)`;
  } else {
    el.style.transform = `rotate(0deg)`;
  }
}

function renderObstacles(obstaclesArray) {
  if (!Array.isArray(obstaclesArray)) return;
  for (const o of obstaclesArray) {
    if (!o || !o.element) continue;
    // Spike: center the zero-size triangle so the base spans [o.x, o.x + o.width]
    if (o.type === "spike") {
      const el = o.element;
      const w = Math.round(o.width || 30);
      const half = Math.round(w / 2);
      // Place the zero-size element at : left = o.x + half so its borders span the cell
      el.style.left = `${Math.round(o.x + half)}px`;
      el.style.bottom = `${Math.round(o.y)}px`;
      if (typeof o.rotation === "number") {
        el.style.transform = `rotate(${o.rotation}deg)`;
      }
      continue;
    }

    // Normal rectangular elements:
    o.element.style.left = `${Math.round(o.x)}px`;
    o.element.style.bottom = `${Math.round(o.y)}px`;
    if (typeof o.rotation === "number") {
      o.element.style.transform = `rotate(${o.rotation}deg)`;
    }
  }
}

function setCamera(offsetY) {
  if (!_camera_container()) return;
  _cameraContainer.style.transform = `translateY(${Math.round(offsetY)}px)`;
}

function removeElement(elem) {
  if (elem && elem.parentNode) elem.remove();
}

export {
  init,
  createPlayerElement,
  createObstacleElement,
  renderPlayer,
  renderObstacles,
  setCamera,
  removeElement,
};