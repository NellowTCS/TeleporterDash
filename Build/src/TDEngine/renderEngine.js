let _gameContainer = null;
let _cameraContainer = null;

function init(gameContainerElement, cameraContainerElement) {
  _gameContainer = gameContainerElement;
  _camera_container_set(cameraContainerElement || document.querySelector("#cameraContainer"));
  if (!_camera_container()) {
    console.warn("renderEngine: no camera container found, defaulting to document.body");
  }
}

function _camera_container_set(el) {
  if (el) _cameraContainer = el;
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

function ensureElementBase(el) {
  const cam = _camera_container();
  if (! el.parentNode || el.parentNode !== cam) {
    cam.appendChild(el);
  }
  el.style.position = "absolute";
  el.style. willChange = "transform";
  el.style.boxSizing = "border-box";
  el.style.margin = "0";
  el.style. padding = "0";
  el.style.transition = "none";
  el. style.backfaceVisibility = "hidden";
  el. style.transformOrigin = "center center";
}

function createPlayerElement(existingElement) {
  const cam = _camera_container();
  if (existingElement) {
    if (! existingElement.parentNode || existingElement.parentNode !== cam) {
      cam.appendChild(existingElement);
    }
    existingElement.style.position = "absolute";
    existingElement.style.left = "0px";
    existingElement.style.bottom = "0px";
    existingElement.style.willChange = "transform";
    existingElement.style.boxSizing = "border-box";
    existingElement.style. margin = "0";
    existingElement.style.transformOrigin = existingElement.style. transformOrigin || "center center";
    return existingElement;
  }

  const el = document.createElement("div");
  el.id = "player";
  el.style.position = "absolute";
  el. style.width = "30px";
  el.style.height = "30px";
  el.style.left = "0px";
  el.style.bottom = "0px";
  el.style.boxSizing = "border-box";
  el.style.margin = "0";
  el.style. willChange = "transform";
  el.style.transformOrigin = "center center";
  cam.appendChild(el);
  return el;
}

function _createTeleporterGlow(parentEl, color) {
  const existing = parentEl.querySelector(".teleporter-glow");
  if (existing) {
    if (color) existing.style.setProperty("--teleporter-glow-color", color);
    return existing;
  }

  const glow = document.createElement("div");
  glow.className = "teleporter-glow";
  glow.style.position = "absolute";
  glow.style.left = "0";
  glow.style.bottom = "0";
  glow.style.width = "100%";
  glow.style.height = "100%";
  glow.style.pointerEvents = "none";
  glow.style.zIndex = "0";
  const c = color || "#ff00ff";
  glow.style.background = `radial-gradient(circle at 50% 50%, ${c} 0%, rgba(0,0,0,0) 60%)`;
  glow.style.opacity = "0. 9";
  glow.style.borderRadius = "inherit";
  glow.style.willChange = "transform, opacity";
  parentEl.appendChild(glow);
  return glow;
}

function createObstacleElement(obstacleObj) {
  const cam = _camera_container();

  if (obstacleObj.element) {
    const el = obstacleObj.element;
    if (!el.parentNode || el.parentNode !== cam) {
      cam.appendChild(el);
    }
    el. style.position = "absolute";
    el.style.left = "0px";
    el. style.bottom = "0px";
    el.style.willChange = "transform";
    el.style.boxSizing = "border-box";
    el.style.margin = "0";
    el. style.transformOrigin = el.style.transformOrigin || "center center";
    return el;
  }

  const type = obstacleObj.type || "empty";
  const w = Math.round(obstacleObj.width || (type === "platform" ?  45 : 30));
  const h = Math.round(obstacleObj.height || (type === "teleporter" ? 60 : (type === "finish" ? 350 : 30)));
  const color = obstacleObj.color || null;
  const rotation = typeof obstacleObj. rotation === "number" ? obstacleObj.rotation : 0;

  let el = document.createElement("div");
  el. style.position = "absolute";
  el. style.left = "0px";
  el.style.bottom = "0px";
  el.style.willChange = "transform";
  el.style.boxSizing = "border-box";
  el.style.margin = "0";
  el. style.padding = "0";
  el.style. backgroundClip = "padding-box";
  el.style.borderRadius = "0";
  el. style.overflow = "visible";
  el. style.contain = "layout style";

  switch (type) {
    case "finish":
      el. className = "finishLine";
      el. style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style. background = color || "#00ff00";
      break;

    case "spike": {
      el. className = "spike";
      const half = Math.round(w / 2);
      el.style.width = `0px`;
      el. style.height = `0px`;
      el.style.borderLeft = `${half}px solid transparent`;
      el. style.borderRight = `${half}px solid transparent`;
      el.style.borderBottom = `${h}px solid ${color || "red"}`;
      el.style.transformOrigin = "center bottom";
      break;
    }

    case "teleporter":
      el.className = "teleporter";
      el.style.width = `${w}px`;
      el. style.height = `${h}px`;
      el.style.background = obstacleObj.background || "linear-gradient(to right, #ff00ff, #8c00ff)";
      el.style.borderRadius = "15px";
      el.style.position = "absolute";
      el. style.overflow = "visible";
      _createTeleporterGlow(el, obstacleObj.color || "#ff00ff");
      break;

    case "platform":
      el.className = "platform";
      el.style. width = `${w}px`;
      el.style.height = `${h}px`;
      if (color) el.style.background = color;
      break;

    case "empty":
    default:
      el.className = "empty-block";
      el. style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style. background = "transparent";
      el.style.pointerEvents = "none";
      break;
  }

  cam.appendChild(el);
  obstacleObj.element = el;
  return el;
}

// Cache last rendered values to avoid unnecessary style updates
const _playerCache = { x: null, y: null, rotation: null };
const _cameraCache = { offsetY: null };

function renderPlayer(playerObj) {
  if (!playerObj || !playerObj.element) return;
  
  const tx = Math.round(playerObj.x || 0);
  const modelOffset = typeof playerObj.renderOffset === "number" ? playerObj. renderOffset : 0;
  // @ts-ignore
  const globalOffset = typeof window. TD_RENDER_PLAYER_OFFSET === "number" ? window. TD_RENDER_PLAYER_OFFSET : 0;
  const yVal = (playerObj.y || 0) + modelOffset - globalOffset;
  const ty = Math.round(-yVal);
  const rotation = playerObj.rotation || 0;

  // Only update if values changed
  if (_playerCache.x === tx && _playerCache.y === ty && _playerCache.rotation === rotation) {
    return;
  }
  
  _playerCache.x = tx;
  _playerCache.y = ty;
  _playerCache.rotation = rotation;

  playerObj.element.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${rotation}deg)`;
}

function renderObstacles(obstaclesArray) {
  if (!Array.isArray(obstaclesArray)) return;
  
  for (let i = 0, len = obstaclesArray.length; i < len; i++) {
    const o = obstaclesArray[i];
    if (! o || !o. element) continue;
    
    const el = o.element;
    const rot = typeof o.rotation === "number" ?  o.rotation : 0;
    
    let tx, ty;
    if (o.type === "spike") {
      const w = Math.round(o.width || 30);
      const half = Math.round(w / 2);
      tx = Math.round(o. x + half);
      ty = Math.round(-o.y);
    } else {
      tx = Math.round(o. x || 0);
      ty = Math.round(-(o.y || 0));
    }

    // Check cache on obstacle object to avoid redundant updates
    if (o._lastTx === tx && o._lastTy === ty && o._lastRot === rot) {
      continue;
    }
    o._lastTx = tx;
    o._lastTy = ty;
    o._lastRot = rot;

    el.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg)`;
  }
}

function setCamera(offsetY) {
  if (! _cameraContainer) return;
  
  const rounded = Math.round(offsetY);
  if (_cameraCache.offsetY === rounded) return;
  
  _cameraCache. offsetY = rounded;
  _cameraContainer.style.transform = `translateY(${rounded}px)`;
}

function removeElement(elem) {
  if (elem && elem.parentNode) elem.remove();
}

function resetRenderCache() {
  _playerCache. x = null;
  _playerCache. y = null;
  _playerCache. rotation = null;
  _cameraCache. offsetY = null;
}

export {
  init,
  createPlayerElement,
  createObstacleElement,
  renderPlayer,
  renderObstacles,
  setCamera,
  removeElement,
  resetRenderCache,
};
