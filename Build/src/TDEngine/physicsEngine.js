import { COLOR_MAP } from "../Utilities/constants";
import { DOMManager } from "../Utilities/domManager";
import { GameState } from "../Utilities/gameState";
import { gameContainer, obstacles, player } from "../gameloader.js";

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
 * Creates an obstacle based on the type specified in the level matrix
 * @param {number} type - The type of obstacle (0: empty, 1: platform, 2: spike, 3: teleporter, 4: finish)
 * @param {number} row - The row position in the level matrix
 */
function createObstacleFromMatrix(type, row) {
    // Parse block properties if type is a string (contains properties)
    let blockType = type;
    let blockColor = null;
    let blockRotation = 0;
    if (typeof type === "string") {
        // @ts-ignore
        const properties = type.split("/");
        // First property is always the type
        blockType = parseInt(properties[0]);
        // First property is always the type
        blockType = parseInt(properties[0]);

        // Process other properties
        for (let i = 1; i < properties.length; i++) {
            const prop = properties[i];
            if (prop.startsWith("-")) {
                // Color property (negative number)
                blockColor = COLOR_MAP[parseInt(prop)];
            } else if (prop.startsWith("@")) {
                // Rotation property
                blockRotation = parseInt(prop.substring(1));
            }
        }
    }
    // Handle empty blocks (type 0)
    if (blockType === 0) {
        const emptyBlock = document.createElement("div");
        emptyBlock.className = "empty-block";
        // @ts-ignore
        emptyBlock.type = "empty";
        emptyBlock.style.position = "absolute";
        emptyBlock.style.width = "30px";
        emptyBlock.style.height = "30px";
        emptyBlock.style.left = gameContainer.offsetWidth + "px";

        // Invert the row calculation to start from bottom
        const baseHeight = 50;
        const rowSpacing = 45; // Match platform block height
        const state = GameState.getState();
        const levelHeight = state.levelMatrix ? state.levelMatrix.length : 10; // fallback
        const invertedRow = levelHeight - 1 - row;
        emptyBlock.style.bottom = baseHeight + invertedRow * rowSpacing + "px";

        DOMManager.getElement("#cameraContainer").appendChild(emptyBlock);
        obstacles.push({ element: emptyBlock, type: "empty" });
        return;
    }

    // Create obstacle element based on type
    const obstacle = document.createElement("div");

    if (blockType === 4) {
        // Finish line
        obstacle.className = "finishLine";
        obstacle.style.width = "10px";
        obstacle.style.height = "350px";
        obstacle.style.background = "#00ff00";
        // @ts-ignore
        obstacle.type = "finish";
        obstacle.style.position = "absolute";
        obstacle.style.bottom = "50px"; // Align with ground
    } else if (blockType === 2) {
        // Spike
        obstacle.className = "spike";
        // @ts-ignore
        obstacle.type = "spike";
    } else if (blockType === 3) {
        // Teleporter
        obstacle.className = "teleporter";
        // @ts-ignore
        obstacle.type = "teleporter";
        obstacle.style.width = "30px";
        obstacle.style.height = "60px";
        obstacle.style.background = "linear-gradient(to right, #ff00ff, #8c00ff)";
        obstacle.style.borderRadius = "15px";
        obstacle.style.animation = "glow 1s infinite alternate";

        // Extract rotation if it exists
        // @ts-ignore
        if (typeof type === "string" && type.includes("@")) {
            // @ts-ignore
            const rotation = type.split("@")[1];
            obstacle.setAttribute("data-rotation", rotation);
        }
    } else if (blockType === 1) {
        // Platform
        obstacle.className = "platform";
        // @ts-ignore
        obstacle.type = "platform";
        obstacle.style.width = "45px";
        obstacle.style.height = "45px";
    }

    // Apply color if specified
    if (blockColor) {
        if (blockType === 2) {
            // For spikes
            obstacle.style.borderBottomColor = blockColor;
        } else {
            obstacle.style.backgroundColor = blockColor;
        }
    }

    // Apply rotation if specified
    if (blockRotation !== 0) {
        obstacle.style.transform = `rotate(${blockRotation}deg)`;
    }

    // Position the obstacle
    obstacle.style.left = gameContainer.offsetWidth + "px";

    // Calculate vertical position (inverted row calculation)
    const baseHeight = 50;
    const rowSpacing = 45; // Match platform block height
    const state = GameState.getState();
    const levelHeight = state.levelMatrix ? state.levelMatrix.length : 10; // fallback
    const invertedRow = levelHeight - 1 - row;
    obstacle.style.bottom = baseHeight + invertedRow * rowSpacing + "px";

    DOMManager.getElement("#cameraContainer").appendChild(obstacle);
    // @ts-ignore
    obstacles.push({ element: obstacle, type: obstacle.type });
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

export { createObstacleFromMatrix, checkCollision, handlePlatformCollision, clearObstacles };