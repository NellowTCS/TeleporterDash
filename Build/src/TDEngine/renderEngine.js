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
  // Use transform-only updates for movement and rotation to keep rendering on the compositor
  el.style.willChange = "transform";
  el.style.boxSizing = "border-box";
  el.style.margin = "0";
  el.style.padding = "0";
  el.style.transition = "none";
  el.style.backfaceVisibility = "hidden";
  el.style.transformOrigin = "center center";
}

/**
 * Creates or returns the player DOM element.
 * Important: we set element left/bottom to 0 and use transform for subsequent movement.
 */
function createPlayerElement(existingElement) {
  const cam = _camera_container();
  if (existingElement) {
    if (!existingElement.parentNode || existingElement.parentNode !== cam) {
      cam.appendChild(existingElement);
    }
    existingElement.style.position = "absolute";
    existingElement.style.left = "0px";
    existingElement.style.bottom = "0px";
    existingElement.style.willChange = "transform";
    existingElement.style.boxSizing = "border-box";
    existingElement.style.margin = "0";
    return existingElement;
  }

  const el = document.createElement("div");
  el.id = "player";
  el.style.position = "absolute";
  el.style.width = "30px";
  el.style.height = "30px";
  // anchor to bottom-left origin and use transform to position
  el.style.left = "0px";
  el.style.bottom = "0px";
  el.style.boxSizing = "border-box";
  el.style.margin = "0";
  el.style.willChange = "transform";
  cam.appendChild(el);
  return el;
}

/**
 * Create or ensure DOM element for an obstacleObj.
 * obstacleObj must contain: type, width, height, color?, rotation?
 * createObstacleElement will attach the created element to camera container and set .element
 *
 * Elements are anchored at left:0 bottom:0 and positioned using transform to avoid layout thrash.
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
    el.style.left = "0px";
    el.style.bottom = "0px";
    el.style.willChange = "transform";
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
  el.style.left = "0px";
  el.style.bottom = "0px";
  el.style.willChange = "transform";
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
      // Keep the origin at center bottom so rotation behaves the same
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

  // We do not set transform here. render functions will set transform each frame (translation + rotation).
  cam.appendChild(el);
  obstacleObj.element = el;
  return el;
}

/**
 * Render player using GPU compositing transform only.
 * We use bottom-origin coordinates in the world. To map to CSS transform,
 * elements are anchored at left:0,bottom:0. To move up in world-space we translate by -y in Y.
 *
 * transform = translate3d(x, -y, 0) rotate(deg)
 */
function renderPlayer(playerObj) {
  if (!playerObj || !playerObj.element) return;
  const el = playerObj.element;
  const tx = Math.round(playerObj.x || 0);
  // world y increases upward; CSS translate Y positive moves down, so use -y
  const ty = Math.round(-(playerObj.y || 0));
  const rotation = playerObj.rotation || 0;
  // combine translation and rotation into a single transform to avoid layout thrash
  el.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${rotation}deg)`;
}

/**
 * Render obstacles with GPU transforms. Spike handling preserved but positioned via transform.
 */
function renderObstacles(obstaclesArray) {
  if (!Array.isArray(obstaclesArray)) return;
  for (const o of obstaclesArray) {
    if (!o || !o.element) continue;
    const el = o.element;
    const rot = typeof o.rotation === "number" ? o.rotation : 0;
    if (o.type === "spike") {
      const w = Math.round(o.width || 30);
      const half = Math.round(w / 2);
      // zero-size triangle is created at element origin; place it so the borders span [o.x, o.x + o.width]
      const tx = Math.round(o.x + half);
      const ty = Math.round(-o.y);
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg)`;
      continue;
    }

    const tx = Math.round(o.x || 0);
    const ty = Math.round(-(o.y || 0));
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg)`;
  }
}

function setCamera(offsetY) {
  if (!_camera_container()) return;
  // Camera currently expects offsetY positive to move camera downwards (or as used elsewhere).
  // Keep behavior the same; offsetY is in px.
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