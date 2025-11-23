import { GameState } from "../Utilities/gameState.js";

/* --- Utilities --- */

/**
 * Remove obstacle DOM nodes and clear the array in-place.
 * Keep the same array reference to avoid callers needing to rebind.
 */
function clearObstacles(obstacles) {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (o && o.element && o.element.parentNode) {
      o.element.remove();
    }
  }
  obstacles.length = 0;
}

/**
 * Return a rect for 'element' relative to the provided 'container'.
 * Using getBoundingClientRect ensures we account for camera transforms.
 */
function getRelativeRect(element, container) {
  const elRect = element.getBoundingClientRect();
  const contRect = container.getBoundingClientRect();
  return {
    left: elRect.left - contRect.left,
    top: elRect.top - contRect.top,
    right: elRect.right - contRect.left,
    bottom: elRect.bottom - contRect.top,
    width: elRect.width,
    height: elRect.height,
  };
}

/**
 * Axis-aligned rectangle intersection test.
 * Tolerance expands/shrinks the boxes (positive tolerance = more permissive).
 */
function rectsIntersect(a, b, tolerance = 0) {
  return !(
    a.left + a.width - tolerance <= b.left ||
    a.left + tolerance >= b.left + b.width ||
    a.top + a.height - tolerance <= b.top ||
    a.top + tolerance >= b.top + b.height
  );
}

function checkCollision(playerElem, obstacleElem, containerElem, tolerance = 0) {
  if (!playerElem || !obstacleElem || !containerElem) return false;
  if (obstacleElem.classList.contains("empty-block")) return false;

  const p = getRelativeRect(playerElem, containerElem);
  const o = getRelativeRect(obstacleElem, containerElem);

  // Adjust obstacle rect for spike orientation (shrinking toward tip so collisions feel accurate)
  let obstacleRect = { ...o };

  if (obstacleElem.classList.contains("spike")) {
    const transform = obstacleElem.style.transform || "";
    const match = transform.match(/rotate\((\d+)\s*deg\)/);
    if (match) {
      const rot = parseInt(match[1], 10);
      // Conservative shrink amount proportional to obstacle size
      const shrink = Math.max(0, Math.min(6, Math.round(obstacleRect.width * 0.12)));
      switch (rot) {
        case 90:
          obstacleRect.left += shrink;
          obstacleRect.width = Math.max(1, obstacleRect.width - shrink);
          break;
        case 270:
          obstacleRect.width = Math.max(1, obstacleRect.width - shrink);
          break;
        case 180:
          obstacleRect.top += shrink;
          obstacleRect.height = Math.max(1, obstacleRect.height - shrink);
          break;
        default:
          obstacleRect.height = Math.max(1, obstacleRect.height - shrink);
      }
    }
  }

  return rectsIntersect(p, obstacleRect, tolerance);
}

/**
 * handlePlatformCollision(playerElem, platformElem, containerElem)
 * Returns: "death" | "safe" | "none"
 */
function handlePlatformCollision(playerElem, platformElem, containerElem) {
  if (!playerElem || !platformElem || !containerElem) return "none";

  const pRect = getRelativeRect(playerElem, containerElem);
  const platRect = getRelativeRect(platformElem, containerElem);

  const playerWidth = pRect.width;
  const platformWidth = platRect.width;
  const platformHeight = platRect.height;

  const horizontalOverlap =
    Math.min(pRect.left + playerWidth, platRect.left + platformWidth) -
    Math.max(pRect.left, platRect.left);

  const verticalOverlap =
    Math.min(pRect.top + pRect.height, platRect.top + platformHeight) -
    Math.max(pRect.top, platRect.top);

  const horizontalCollision = horizontalOverlap / Math.max(1, playerWidth);

  const state = GameState.getState();

  // Distance between player's bottom (y from top of container) and platform top
  const playerBottomY = pRect.top + pRect.height;
  const platTopY = platRect.top;
  const nearTopDelta = Math.abs(playerBottomY - platTopY);

  // Side collision detection (prioritise death) — similar to C++ logic:
  // If there's a large horizontal overlap while not close to the top and player isn't jumping => side hit
  if (
    horizontalCollision > 0.2 &&
    verticalOverlap > 5 &&
    !state.isJumping &&
    nearTopDelta > 15
  ) {
    return "death";
  }

  // Safe landing detection: player moving down (positive playerVelocity in our GameState),
  // near the top of the platform, and with sufficient horizontal overlap.
  if (
    state.playerVelocity > 0 &&
    nearTopDelta < 10 &&
    horizontalCollision > 0.3
  ) {
    // We need to set player.style.bottom in the same coordinate system used by the renderer:
    // Many game UIs use style.bottom (pixels from bottom of container). Compute that:
    const containerHeight = containerElem.getBoundingClientRect().height;

    // If platformElem has a style.bottom set, prefer it (consistent with existing level parsing),
    // otherwise compute bottom from the platform's rect.
    let platBottomStyle = parseFloat(platformElem.style.bottom);
    if (!Number.isFinite(platBottomStyle)) {
      // bottom = containerHeight - (platRect.top + platformHeight)
      platBottomStyle = Math.round(containerHeight - (platRect.top + platformHeight));
    }

    // Snap player's bottom to sit on top of platform:
    // playerBottomStyle = platformBottomStyle + platformHeight
    let snapBottom = platBottomStyle + platformHeight;
    snapBottom = Math.round(snapBottom); // round to integer pixels to avoid tiny gaps

    playerElem.style.bottom = `${snapBottom}px`;

    GameState.setState({
      isOnPlatform: true,
      isJumping: false,
      doubleJumpAvailable: true,
      playerVelocity: 0,
    });

    return "safe";
  }

  return "none";
}

/**
 * Computes an object with the player's style-based box relative to the container.
 */
function getStyleBoxRelativeToContainer(elem, container) {
  const contRect = container.getBoundingClientRect();
  const contH = contRect.height;
  const styleLeft = parseFloat(elem.style.left) || 0;
  const styleBottom = parseFloat(elem.style.bottom) || 0;
  const width = elem.getBoundingClientRect().width || 30;
  const height = elem.getBoundingClientRect().height || 30;
  // Convert bottom to top-based coordinates like getBoundingClientRect provides
  const top = contH - styleBottom - height;
  return {
    left: styleLeft,
    top,
    width,
    height,
  };
}

export {
  clearObstacles,
  getRelativeRect,
  checkCollision,
  handlePlatformCollision,
  getStyleBoxRelativeToContainer,
};