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
    // ensure transform-origin set to center so rotation behaves nicely
    existingElement.style.transformOrigin = existingElement.style.transformOrigin || "center center";
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
  el.style.transformOrigin = "center center";
  cam.appendChild(el);
  return el;
}

/**
 * Helper: create a teleporter glow child (radial) that won't visually "mirror" when rotated.
 * Returns the glow element (appended to parent).
 */
function _createTeleporterGlow(parentEl, color) {
  // If already present, update and return it
  const existing = parentEl.querySelector(".teleporter-glow");
  if (existing) {
    if (color) existing.style.setProperty("--teleporter-glow-color", color);
    return existing;
  }

  const glow = document.createElement("div");
  glow.className = "teleporter-glow";
  // fill parent. We use absolute positioning so the glow stays aligned with teleporter bounds.
  glow.style.position = "absolute";
  glow.style.left = "0";
  glow.style.bottom = "0";
  glow.style.width = "100%";
  glow.style.height = "100%";
  glow.style.pointerEvents = "none";
  glow.style.zIndex = "0";
  // Use a radial gradient (centered) so rotation does not produce mirrored-looking streaks.
  const c = color || "#ff00ff";
  glow.style.background = `radial-gradient(circle at 50% 50%, ${c} 0%, rgba(0,0,0,0) 60%)`;
  glow.style.opacity = "0.9";
  glow.style.borderRadius = "inherit";
  glow.style.willChange = "transform, opacity";
  parentEl.appendChild(glow);
  return glow;
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
    // ensure transform-origin to center unless spike needs bottom origin
    el.style.transformOrigin = el.style.transformOrigin || "center center";
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
  el.style.borderRadius = "0";
  el.style.overflow = "visible"; // allow glow to show beyond if needed

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
      // Spike visually should pivot around bottom center for rotation
      el.style.transformOrigin = "center bottom";
      break;
    }

    case "teleporter":
      el.className = "teleporter";
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      // Instead of relying on a linear gradient that flips with rotation we create a radial glow child.
      el.style.background = obstacleObj.background || "linear-gradient(to right, #ff00ff, #8c00ff)";
      el.style.borderRadius = "15px";
      el.style.position = "absolute";
      el.style.overflow = "visible";
      // create an inner glow that is radial and symmetric so rotating the teleporter won't mirror the glow
      _createTeleporterGlow(el, obstacleObj.color || "#ff00ff");
      // teleporter decoration on top can remain via background, glow beneath via child
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
 *
 * Note: a runtime-adjustable render offset is supported via:
 *  - playerObj.renderOffset (per-model)
 *  - global window.TD_RENDER_PLAYER_OFFSET (tweakable from console)
 */
function renderPlayer(playerObj) {
  if (!playerObj || !playerObj.element) return;
  const el = playerObj.element;
  const tx = Math.round(playerObj.x || 0);

  // Resolve offsets safely and unambiguously (fixes operator precedence issues)
  const modelOffset = typeof playerObj.renderOffset === "number" ? playerObj.renderOffset : 0;
  // @ts-ignore
  const globalOffset = typeof window.TD_RENDER_PLAYER_OFFSET === "number" ? window.TD_RENDER_PLAYER_OFFSET : 0;

  // world y increases upward; CSS translate Y positive moves down, so use -y.
  // Apply model/global offsets as a subtraction to allow lowering the rendered player.
  const yVal = (playerObj.y || 0) + modelOffset - globalOffset;
  const ty = Math.round(-yVal);

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

    // For teleporter and other rectangular obstacles we place by bottom-left (world coords)
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