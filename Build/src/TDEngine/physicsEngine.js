import { GameState } from "../Utilities/gameState.js";

/**
 * Clear obstacle elements and empty the passed-in obstacles array in-place.
 */
function clearObstacles(obstacles) {
  for (let i = 0; i < obstacles.length; i++) {
    const obstacle = obstacles[i];
    if (obstacle.element && obstacle.element.parentNode) {
      obstacle.element.remove();
    }
  }
  obstacles.length = 0;
}

/**
 * Return rectangle for element relative to the container element.
 * Coordinates are floats (no truncation).
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
 * Axis-aligned rectangle intersection.
 */
function rectsIntersect(a, b, tolerance = 0) {
  return !(
    a.left + a.width - tolerance <= b.left ||
    a.left + tolerance >= b.left + b.width ||
    a.top + a.height - tolerance <= b.top ||
    a.top + tolerance >= b.top + b.height
  );
}

/**
 * checkCollision(playerElem, obstacleElem, containerElem, tolerance = 0)
 * Uses container-relative rects for consistent collision detection.
 */
function checkCollision(playerElem, obstacleElem, containerElem, tolerance = 0) {
  if (!playerElem || !obstacleElem || !containerElem) return false;
  if (obstacleElem.classList.contains("empty-block")) return false;

  const pRect = getRelativeRect(playerElem, containerElem);
  const oRect = getRelativeRect(obstacleElem, containerElem);

  // Optionally adjust obstacle rect for spikes pointing orientation.
  let obstacleRect = { ...oRect };
  if (obstacleElem.classList.contains("spike")) {
    const transform = obstacleElem.style.transform || "";
    const match = transform.match(/rotate\((\d+)\s*deg\)/);
    if (match) {
      const rot = parseInt(match[1], 10);
      // Small shrink towards tip to be less generous on spike collisions
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

  return rectsIntersect(pRect, obstacleRect, tolerance);
}

/**
 * handlePlatformCollision(playerElem, platformElem, containerElem)
 * Returns: "death" | "safe" | "none"
 *
 * Uses container-relative rects for detection. When snapping the player to the platform top,
 * computes the appropriate style.bottom value using the container height and platform rect so
 * snapping is in the same coordinate system the renderer uses.
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

  // How far player's bottom is from platform top (in container coordinates)
  const playerBottomY = pRect.top + pRect.height; // Y coordinate of player's bottom (from top of container)
  const platTopY = platRect.top; // Y coordinate of platform top (from top of container)
  const nearTopDelta = Math.abs(playerBottomY - platTopY);

  // Side collision (priority => death)
  if (
    horizontalCollision > 0.2 &&
    verticalOverlap > 5 &&
    !state.isJumping &&
    nearTopDelta > 15
  ) {
    return "death";
  }

  // Safe landing detection: moving down, close to top, enough horizontal overlap
  if (
    state.playerVelocity > 0 &&
    nearTopDelta < 10 &&
    horizontalCollision > 0.3
  ) {
    // Compute platform bottom-style value if present, otherwise compute from rect:
    // style.bottom for an element is: bottom = containerHeight - (elem.top + elem.height)
    const containerHeight = containerElem.getBoundingClientRect().height;
    let platBottomStyle = parseFloat(platformElem.style.bottom);
    if (!Number.isFinite(platBottomStyle)) {
      platBottomStyle = Math.round(containerHeight - (platRect.top + platformHeight));
    }

    // Player's bottom style should be platformBottomStyle + platformHeight
    let snapBottom = platBottomStyle + platformHeight;
    // Round to integer pixels to avoid subpixel mismatch with renderer
    snapBottom = Math.round(snapBottom);

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

export { clearObstacles, checkCollision, handlePlatformCollision, getRelativeRect };