import { GameState } from "../Utilities/gameState";
import { player } from "../gameloader.js";

function clearObstacles(obstacles) {
  // Clear obstacles and particles
  obstacles.forEach((obstacle) => {
    if (obstacle.element && obstacle.element.parentNode) {
      obstacle.element.remove();
    }
  });
  obstacles = [];
}

/**
 * Handles collision detection between player and obstacles
 * @param {HTMLElement} player - The player element
 * @param {HTMLElement} obstacle - The obstacle element to check collision with
 * @returns {boolean} - True if collision detected, false otherwise
 */
function checkCollision(player, obstacle) {
  if (obstacle.classList.contains("empty-block")) return false;

  // Get raw positions without camera influence
  const playerBottom = parseInt(player.style.bottom);
  const playerLeft = parseInt(player.style.left);
  const obstacleBottom = parseInt(obstacle.style.bottom);
  const obstacleLeft = parseInt(obstacle.style.left);
  const tolerance = 5; // Small overlap allowance for smoother collision
  const playerSize = 30; // Player width/height
  // @ts-ignore
  const obstacleSize = obstacle.type === "platform" ? 45 : 30;

  // Get obstacle rotation
  let rotation = 0;
  const transform = obstacle.style.transform;
  if (transform) {
    const match = transform.match(/rotate\((\d+)deg\)/);
    if (match) {
      rotation = parseInt(match[1]);
    }
  }

  // Adjust collision box based on rotation for spikes
  let adjustedObstacleBottom = obstacleBottom;
  let adjustedObstacleLeft = obstacleLeft;
  // @ts-ignore
  if (obstacle.type === "spike") {
    switch (rotation) {
      case 90: // Pointing left
        adjustedObstacleLeft += obstacleSize / 2;
        break;
      case 180: // Pointing up
        adjustedObstacleBottom += obstacleSize / 2;
        break;
      case 270: // Pointing right
        adjustedObstacleLeft -= obstacleSize / 2;
        break;
      default: // Pointing down or no rotation
        adjustedObstacleBottom -= obstacleSize / 2;
    }
  }

  // Check for overlap in both x and y directions
  return !(
    playerLeft + playerSize - tolerance < adjustedObstacleLeft ||
    playerLeft + tolerance > adjustedObstacleLeft + obstacleSize ||
    playerBottom + playerSize - tolerance < adjustedObstacleBottom ||
    playerBottom + tolerance > adjustedObstacleBottom + obstacleSize
  );
}

/**
 * Handles specific collision logic for platforms
 * Includes landing detection and side collision
 */
// @ts-ignore
function handlePlatformCollision(playerRect, platform) {
  // Get raw positions without camera influence
  const playerBottom = parseInt(player.style.bottom);
  const platformBottom = parseInt(platform.style.bottom);
  const playerLeft = parseInt(player.style.left);
  const platformLeft = parseInt(platform.style.left);

  // Calculate overlaps
  const horizontalOverlap =
    Math.min(playerLeft + 30, platformLeft + 40) -
    Math.max(playerLeft, platformLeft);
  const verticalOverlap =
    Math.min(playerBottom + 30, platformBottom + 40) -
    Math.max(playerBottom, platformBottom);

  const playerWidth = 30;
  const horizontalCollision = horizontalOverlap / playerWidth;

  // First, check for side collision - this takes priority
  // If we have any meaningful horizontal collision and we're not jumping, it's death
  const state = GameState.getState();
  if (
    horizontalCollision > 0.2 && // Significant horizontal collision
    verticalOverlap > 5 && // Some vertical overlap
    !state.isJumping && // Not in a jump
    Math.abs(playerBottom - (platformBottom + 40)) > 15
  ) {
    // Not very close to top
    return "death";
  }

  // Only then check for safe landing
  if (
    state.playerVelocity > 0 && // Moving down
    Math.abs(playerBottom - (platformBottom + 40)) < 10 && // Very close to top
    horizontalCollision > 0.3
  ) {
    // Enough horizontal overlap for landing

    // Safe landing
    GameState.setState({
      isOnPlatform: true,
      isJumping: false,
      doubleJumpAvailable: true,
      playerVelocity: 0,
    });
    player.style.bottom = platformBottom + 45 + "px";
    return "safe";
  }

  return "none";
}

export { checkCollision, handlePlatformCollision, clearObstacles };
