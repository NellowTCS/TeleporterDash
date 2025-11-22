import { SettingsManager } from "./settingsManager";
import { particles, player, gameContainer } from "../gameloader.js";

function clearParticles(particles) {
    // Clear particles array
    particles = [];
};

/**
 * Initializes particles array if it doesn't exist
 * @param {string} color - Color of particles (e.g., '#ff0000' for red)
 */
function createParticles(color) {
    // Check if visual effects are enabled
    if (!SettingsManager.current.visualEffects) return;
  
    if (!particles) clearParticles();
  
    // Create 10 particles
    for (let i = 0; i < 10; i++) {
      const particle = document.createElement("div");
      particle.className = "particle";
      particle.style.position = "absolute";
      particle.style.width = "5px";
      particle.style.height = "5px";
      particle.style.backgroundColor = color;
      particle.style.left = parseInt(player.style.left) + 15 + "px";
      particle.style.bottom = parseInt(player.style.bottom) + 15 + "px";
      particle.style.borderRadius = "50%";
      particle.style.zIndex = "1000";
  
      gameContainer.appendChild(particle);
  
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 5 + 2) * 60; // Convert to pixels/second (multiply by 60 for 60 FPS equivalent)
  
      particles.push({
        element: particle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120, // Convert initial upward velocity to pixels/second
        life: 1,
      });
    }
  }
  
  /**
   * Cleans up all particle effects
   * Called during game restart and level completion
   */
  function cleanupParticles() {
    // Remove all particle elements from DOM
    particles.forEach((particle) => {
      if (particle.element && particle.element.parentNode) {
        particle.element.remove();
      }
    });
    clearParticles();
  }

  export { createParticles, cleanupParticles };