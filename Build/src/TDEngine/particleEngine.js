import { SettingsManager } from "./settingsManager.js";

function _getContainer(container) {
  if (container) return container;
  const cam = document.querySelector("#cameraContainer");
  return cam || document.body;
}

/**
 * createParticles(color, playerModel, container)
 * - color: CSS color for particles
 * - playerModel: numeric player object { x, y, width, height } (world-space, bottom-origin)
 * - container: optional DOM element to attach particles to (camera container recommended)
 *
 * Returns an array of particle objects. The caller should push those into its particles list and update them each frame.
 */
function createParticles(color, playerModel, container) {
  // Respect settings
  if (!SettingsManager || !SettingsManager.current || !SettingsManager.current.visualEffects) {
    return [];
  }

  const cam = _getContainer(container);

  const out = [];
  // Create 10 particles (same as original)
  for (let i = 0; i < 10; i++) {
    const el = document.createElement("div");
    el.className = "particle";
    el.style.position = "absolute";
    el.style.width = "5px";
    el.style.height = "5px";
    el.style.backgroundColor = color;
    el.style.left = "0px";
    el.style.bottom = "0px";
    el.style.borderRadius = "50%";
    el.style.zIndex = "1000";
    el.style.willChange = "transform, opacity";

    cam.appendChild(el);

    // Compute initial numeric position (world-space, bottom-origin)
    // Place roughly at player's center
    const pX = (playerModel && typeof playerModel.x === "number")
      ? Math.round(playerModel.x + (playerModel.width || 30) / 2 - 2.5)
      : 0;
    const pY = (playerModel && typeof playerModel.y === "number")
      ? Math.round(playerModel.y + (playerModel.height || 30) / 2 - 2.5)
      : 0;

    // Random velocity: keep magnitude similar to previous implementation (pixels/sec)
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 5 + 2) * 60; // px/sec
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 120; // initial upward bias (negative vy moves up in world coords)

    // Initialize transform so it renders in the right spot immediately
    // We follow renderer convention: translate3d(worldX, -worldY, 0)
    el.style.transform = `translate3d(${pX}px, ${-pY}px, 0)`;

    out.push({
      element: el,
      x: pX, // world X in pixels (used by update loop)
      y: pY, // world Y in pixels (bottom-origin)
      vx,
      vy,
      life: 1,
    });
  }

  return out;
}

/**
 * cleanupParticles(particlesArray)
 * - Removes provided particle elements from DOM and does light cleanup.
 * - Caller should clear its own particles array after calling this.
 */
function cleanupParticles(particlesArray) {
  if (!Array.isArray(particlesArray)) return;
  for (let i = 0; i < particlesArray.length; i++) {
    const p = particlesArray[i];
    try {
      if (p && p.element && p.element.parentNode) {
        p.element.remove();
      }
    } catch (e) {
      // ignore
    }
  }
}

export { createParticles, cleanupParticles };
