import { GameState } from "../Utilities/gameState.js";

/*
 Physics engine operating on numeric world-space objects.

 World convention:
  - Positions are numeric: x (px from left of world), y (px from bottom of game container)
  - Sizes: width, height in px
  - Player object: { x, y, width, height, velocityY, rotation, element? }
  - Obstacle object: { x, y, width, height, type, rotation?, color?, element? }

 Exposed functions:
  - clearObstacles(obstaclesArray)                       // clears DOM and empties array
  - checkCollisionWorld(playerObj, obstacleObj)          // AABB intersection in world coords (returns boolean)
  - handlePlatformCollisionWorld(playerObj, platformObj) // platform logic using world coords; mutates playerObj.y and GameState; returns "death"|"safe"|"none"
  - getStyleBoxRelativeToContainer(elem, container)      // helper kept for diagnostics
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

function rectsIntersectWorld(a, b, tolerance = 0) {
  return !(
    a.x + a.width - tolerance <= b.x ||
    a.x + tolerance >= b.x + b.width ||
    a.y + a.height - tolerance <= b.y ||
    a.y + tolerance >= b.y + b.height
  );
}

/**
 * checkCollisionWorld(playerObj, obstacleObj, tolerance = 0)
 * Uses AABB (axis-aligned bounding box) in world coordinates.
 */
function checkCollisionWorld(playerObj, obstacleObj, tolerance = 0) {
  if (!playerObj || !obstacleObj) return false;
  if (obstacleObj.type === "empty") return false;

  // Build rects
  const p = {
    x: playerObj.x,
    y: playerObj.y,
    width: playerObj.width,
    height: playerObj.height,
  };

  // For obstacles, if width/height missing, assume defaults
  const o = {
    x: obstacleObj.x,
    y: obstacleObj.y,
    width: obstacleObj.width || (obstacleObj.type === "platform" ? 45 : 30),
    height:
      obstacleObj.height ||
      (obstacleObj.type === "teleporter"
        ? 60
        : obstacleObj.type === "finish"
          ? 350
          : 30),
  };

  // Spike orientation: shrink area conservatively toward tip if rotation specified
  if (
    obstacleObj.type === "spike" &&
    typeof obstacleObj.rotation === "number"
  ) {
    const rot = obstacleObj.rotation;
    const shrink = Math.max(0, Math.min(6, Math.round(o.width * 0.12)));
    if (rot === 90) {
      o.x += shrink;
      o.width = Math.max(1, o.width - shrink);
    } else if (rot === 270) {
      o.width = Math.max(1, o.width - shrink);
    } else if (rot === 180) {
      o.y += shrink;
      o.height = Math.max(1, o.height - shrink);
    } else {
      o.height = Math.max(1, o.height - shrink);
    }
  }

  return rectsIntersectWorld(p, o, tolerance);
}

/**
 * handlePlatformCollisionWorld(playerObj, platformObj, options)
 * - playerObj: numeric player object (must include velocity in GameState)
 * - platformObj: numeric platform object
 *
 * Returns: "death" | "safe" | "none"
 *
 * Behavior:
 *  - Detects side collisions (death) if horizontal overlap while not near top and not jumping
 *  - Detects safe landing if player is descending (playerVelocity > 0), near top, and enough horizontal overlap.
 *  - If landing, snaps playerObj.y to platform top (platformObj.y + platformObj.height)
 *  - Updates GameState accordingly
 */
function handlePlatformCollisionWorld(playerObj, platformObj) {
  if (!playerObj || !platformObj) return "none";

  // Ensure defaults
  const pW = playerObj.width || 30;
  const pH = playerObj.height || 30;
  const platW = platformObj.width || 45;
  const platH = platformObj.height || 45;

  const horizontalOverlap =
    Math.min(playerObj.x + pW, platformObj.x + platW) -
    Math.max(playerObj.x, platformObj.x);

  const verticalOverlap =
    Math.min(playerObj.y + pH, platformObj.y + platH) -
    Math.max(playerObj.y, platformObj.y);

  const horizontalCollision = horizontalOverlap / Math.max(1, pW);

  const state = GameState.getState();

  // Distance between player's bottom (y) + height and platform top (y)
  const playerBottomY = playerObj.y + pH; // player's top in top-origin? careful: using bottom-based world coords
  const platTopY = platformObj.y + platH;
  // nearTopDelta = absolute difference between player's top (playerBottomY) and platform top (platTopY)
  const nearTopDelta = Math.abs(playerBottomY - platTopY);

  if (
    horizontalCollision > 0.2 &&
    verticalOverlap > 5 &&
    !state.isJumping &&
    nearTopDelta > 15
  ) {
    return "death";
  }

  // landing: playerVelocity > 0 means moving down in this project (we kept this convention)
  if (
    state.playerVelocity > 0 &&
    nearTopDelta < 10 &&
    horizontalCollision > 0.3
  ) {
    // Snap player's y so that player's bottom sits at platform top minus player height
    // Our world y is bottom-based; platform top is platformObj.y + platH
    const snapY = platformObj.y + platH - pH;
    playerObj.y = Math.round(snapY);

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
 * Kept for diagnostics; expects element and container.
 */
function getStyleBoxRelativeToContainer(elem, container) {
  const contRect = container.getBoundingClientRect();
  const contH = contRect.height;
  const styleLeft = parseFloat(elem.style.left) || 0;
  const styleBottom = parseFloat(elem.style.bottom) || 0;
  const width = elem.getBoundingClientRect().width || 30;
  const height = elem.getBoundingClientRect().height || 30;
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
  checkCollisionWorld,
  handlePlatformCollisionWorld,
  getStyleBoxRelativeToContainer,
};
