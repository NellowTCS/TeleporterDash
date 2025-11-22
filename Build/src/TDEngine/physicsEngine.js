import { GameState } from "../Utilities/gameState";

/**
 * Clear obstacle elements and empty the passed-in obstacles array in-place.
 * This avoids reassigning the outer reference.
 */
function clearObstacles(obstacles) {
  // Remove DOM elements
  for (let i = 0; i < obstacles.length; i++) {
    const obstacle = obstacles[i];
    if (obstacle.element && obstacle.element.parentNode) {
      obstacle.element.remove();
    }
  }
  // Clear the array in-place so callers keep the same reference
  obstacles.length = 0;
}

/**
 * Handles collision detection between player element and an obstacle element.
 * Uses style.left/style.bottom as authoritative positions (float-aware).
 * Returns true if there is an overlap between the two boxes.
 *
 * player: HTMLElement (player element)
 * obstacle: HTMLElement (single obstacle block element)
 */
function checkCollision(player, obstacle) {
  if (!player || !obstacle) return false;
  if (obstacle.classList.contains("empty-block")) return false;

  // Use precise floats (parseFloat) to avoid truncation gaps
  const playerBottom = parseFloat(player.style.bottom) || 0;
  const playerLeft = parseFloat(player.style.left) || 0;
  const obstacleBottom = parseFloat(obstacle.style.bottom) || 0;
  const obstacleLeft = parseFloat(obstacle.style.left) || 0;

  const playerSize = 30; // player square size in px
  const obstacleSize = obstacle.classList.contains("platform") ? 45 : 30;

  // Determine rotation (for spikes) from transform string if present
  let rotation = 0;
  const transform = obstacle.style.transform;
  if (transform) {
    const match = transform.match(/rotate\((\d+)deg\)/);
    if (match) rotation = parseInt(match[1], 10);
  }

  // Adjust obstacle collision box for spike orientation
  let adjustedObstacleLeft = obstacleLeft;
  let adjustedObstacleBottom = obstacleBottom;
  if (obstacle.classList.contains("spike")) {
    switch (rotation) {
      case 90: // pointing left
        adjustedObstacleLeft += obstacleSize / 2;
        break;
      case 180: // pointing up
        adjustedObstacleBottom += obstacleSize / 2;
        break;
      case 270: // pointing right
        adjustedObstacleLeft -= obstacleSize / 2;
        break;
      default: // pointing down or no rotation
        adjustedObstacleBottom -= obstacleSize / 2;
        break;
    }
  }

  // Small tolerance to avoid jittering through edges; keep small (0 - 2)
  const tolerance = 0.5;

  const collision =
    !(
      playerLeft + playerSize - tolerance < adjustedObstacleLeft ||
      playerLeft + tolerance > adjustedObstacleLeft + obstacleSize ||
      playerBottom + playerSize - tolerance < adjustedObstacleBottom ||
      playerBottom + tolerance > adjustedObstacleBottom + obstacleSize
    );

  return collision;
}

/**
 * Platform collision logic.
 * Params:
 *  - playerElement: the player HTMLElement (not a client rect)
 *  - platform: the platform HTMLElement
 *
 * Returns:
 *  - "death" if player hit the side and should die (lol)
 *  - "safe" if player landed safely (snaps to top)
 *  - "none" otherwise
 *
 */
function handlePlatformCollision(playerElement, platform) {
  if (!playerElement || !platform) return "none";

  // Get positions using styles (floats)
  const playerBottom = parseFloat(playerElement.style.bottom) || 0;
  const playerLeft = parseFloat(playerElement.style.left) || 0;
  const platformBottom = parseFloat(platform.style.bottom) || 0;
  const platformLeft = parseFloat(platform.style.left) || 0;

  const playerWidth = 30;
  const platformWidth = 40; // overlap math uses 40, snap uses 45 below for visual offset
  const platformRenderHeight = 45; // value used when setting player bottom to sit on top

  // Overlap calculations
  const horizontalOverlap =
    Math.min(playerLeft + playerWidth, platformLeft + platformWidth) -
    Math.max(playerLeft, platformLeft);
  const verticalOverlap =
    Math.min(playerBottom + playerWidth, platformBottom + platformRenderHeight) -
    Math.max(playerBottom, platformBottom);

  const horizontalCollision = horizontalOverlap / playerWidth;

  const state = GameState.getState();

  // Prioritize side collision: if we have a significant horizontal overlap while not near the platform top,
  // and player is not actively jumping, consider it a side collision (death).
  if (
    horizontalCollision > 0.2 &&
    verticalOverlap > 5 &&
    !state.isJumping &&
    Math.abs(playerBottom - (platformBottom + platformRenderHeight)) > 15
  ) {
    return "death";
  }

  // Safe landing: coming down, near top of platform, and enough horizontal overlap
  if (
    state.playerVelocity > 0 && // moving down
    Math.abs(playerBottom - (platformBottom + platformRenderHeight)) < 10 && // near platform top
    horizontalCollision > 0.3
  ) {
    GameState.setState({
      isOnPlatform: true,
      isJumping: false,
      doubleJumpAvailable: true,
      playerVelocity: 0,
    });
    // Snap player visually to platform top
    playerElement.style.bottom = platformBottom + platformRenderHeight + "px";
    return "safe";
  }

  return "none";
}

export { checkCollision, handlePlatformCollision, clearObstacles };