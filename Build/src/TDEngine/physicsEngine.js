import { GameState } from "../Utilities/gameState.js";

function clearObstacles(obstacles) {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (o && o.element) {
      // @ts-ignore
      if (window.TDObstaclePool && typeof window.TDObstaclePool. release === "function") {
        try {
          // @ts-ignore
          window.TDObstaclePool.release(o);
        } catch (e) {
          if (o.element && o.element.parentNode) {
            o.element.remove();
          }
        }
      } else {
        if (o.element && o.element.parentNode) {
          o.element.remove();
        }
      }
    }
  }
  obstacles.length = 0;
}

// Reusable rect objects to avoid allocations
const _rectA = { x: 0, y: 0, width: 0, height: 0 };
const _rectB = { x: 0, y: 0, width: 0, height: 0 };

function rectsIntersectWorld(a, b, tolerance) {
  return !(
    a.x + a.width - tolerance <= b.x ||
    a.x + tolerance >= b.x + b.width ||
    a.y + a. height - tolerance <= b.y ||
    a.y + tolerance >= b.y + b.height
  );
}

/**
 * checkCollisionWorld(playerObj, obstacleObj, tolerance = 0)
 * Uses AABB (axis-aligned bounding box) in world coordinates. 
 */
function checkCollisionWorld(playerObj, obstacleObj, tolerance = 0) {
  if (! playerObj || !obstacleObj) return false;
  if (obstacleObj.type === "empty") return false;

  // Reuse rect objects instead of creating new ones
  _rectA.x = playerObj.x;
  _rectA.y = playerObj.y;
  _rectA.width = playerObj.width;
  _rectA.height = playerObj.height;

  _rectB. x = obstacleObj.x;
  _rectB. y = obstacleObj.y;
  _rectB. width = obstacleObj.width || (obstacleObj. type === "platform" ? 45 : 30);
  _rectB.height =
    obstacleObj.height ||
    (obstacleObj.type === "teleporter"
      ? 60
      : obstacleObj.type === "finish"
        ? 350
        : 30);

  // Spike orientation: shrink area conservatively toward tip if rotation specified
  if (
    obstacleObj.type === "spike" &&
    typeof obstacleObj. rotation === "number"
  ) {
    const rot = obstacleObj.rotation;
    const shrink = Math.max(0, Math.min(6, Math.round(_rectB.width * 0.12)));
    if (rot === 90) {
      _rectB. x += shrink;
      _rectB. width = Math.max(1, _rectB. width - shrink);
    } else if (rot === 270) {
      _rectB.width = Math.max(1, _rectB. width - shrink);
    } else if (rot === 180) {
      _rectB.y += shrink;
      _rectB. height = Math.max(1, _rectB.height - shrink);
    } else {
      _rectB.height = Math.max(1, _rectB.height - shrink);
    }
  }

  return rectsIntersectWorld(_rectA, _rectB, tolerance);
}

/**
 * handlePlatformCollisionWorld(playerObj, platformObj, options)
 */
function handlePlatformCollisionWorld(playerObj, platformObj) {
  if (! playerObj || !platformObj) return "none";

  const pW = playerObj.width || 30;
  const pH = playerObj.height || 30;
  const platW = platformObj. width || 45;
  const platH = platformObj.height || 45;

  const horizontalOverlap =
    Math.min(playerObj.x + pW, platformObj.x + platW) -
    Math.max(playerObj.x, platformObj.x);

  const verticalOverlap =
    Math.min(playerObj.y + pH, platformObj.y + platH) -
    Math.max(playerObj.y, platformObj.y);

  const horizontalCollision = horizontalOverlap / Math.max(1, pW);

  const state = GameState.getState();

  const playerBottomY = playerObj.y;
  const platTopY = platformObj.y + platH;
  const nearTopDelta = Math.abs(playerBottomY - platTopY);

  if (
    horizontalCollision > 0.2 &&
    verticalOverlap > 5 &&
    ! state.isJumping &&
    nearTopDelta > 15
  ) {
    return "death";
  }

  const prevBottom = typeof playerObj.prevY === "number" ?  playerObj.prevY : undefined;
  if (
    typeof prevBottom === "number" &&
    prevBottom > platTopY + 0.5 &&
    playerBottomY < platTopY - 0.5 &&
    state.playerVelocity > 0 &&
    horizontalCollision > 0.25
  ) {
    playerObj.y = Math.round(platTopY);
    playerObj.prevY = undefined;
    GameState.setState({
      isOnPlatform: true,
      isJumping: false,
      doubleJumpAvailable: true,
      playerVelocity: 0,
    });
    return "safe";
  }

  if (
    state.playerVelocity > 0 &&
    nearTopDelta < 10 &&
    horizontalCollision > 0.3
  ) {
    const snapY = platformObj.y + platH;
    playerObj.y = Math.round(snapY);
    playerObj.prevY = undefined;

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

function getStyleBoxRelativeToContainer(elem, container) {
  const contRect = container.getBoundingClientRect();
  const contH = contRect.height;
  const styleLeft = parseFloat(elem.style.left) || 0;
  const styleBottom = parseFloat(elem.style.bottom) || 0;
  const width = elem.getBoundingClientRect(). width || 30;
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
