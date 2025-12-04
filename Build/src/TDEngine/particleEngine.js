import { SettingsManager } from "./settingsManager.js";

let _cachedContainer = null;

function _getContainer(container) {
  if (container) return container;
  if (_cachedContainer) return _cachedContainer;
  const cam = document.querySelector("#cameraContainer");
  _cachedContainer = cam || document.body;
  return _cachedContainer;
}

// Particle element pool to avoid creating new DOM elements
const particleElementPool = [];

function acquireParticleElement() {
  if (particleElementPool.length > 0) {
    const el = particleElementPool.pop();
    el.style.display = "";
    el.style.opacity = "1";
    return el;
  }

  const el = document.createElement("div");
  el.className = "particle";
  el.style.position = "absolute";
  el.style.width = "5px";
  el.style.height = "5px";
  el.style.left = "0px";
  el.style.bottom = "0px";
  el.style.borderRadius = "50%";
  el.style.zIndex = "1000";
  el.style.willChange = "transform, opacity";
  el.style.pointerEvents = "none";
  return el;
}

function releaseParticleElement(el) {
  if (!el) return;
  el.style.display = "none";
  if (particleElementPool.length < 100) {
    particleElementPool.push(el);
  } else if (el.parentNode) {
    el.remove();
  }
}

/**
 * createParticles(color, playerModel, container)
 */
function createParticles(color, playerModel, container) {
  if (
    !SettingsManager ||
    !SettingsManager.current ||
    !SettingsManager.current.visualEffects
  ) {
    return [];
  }

  const cam = _getContainer(container);
  const out = [];

  const pX =
    playerModel && typeof playerModel.x === "number"
      ? Math.round(playerModel.x + (playerModel.width || 30) / 2 - 2.5)
      : 0;
  const pY =
    playerModel && typeof playerModel.y === "number"
      ? Math.round(playerModel.y + (playerModel.height || 30) / 2 - 2.5)
      : 0;

  for (let i = 0; i < 10; i++) {
    const el = acquireParticleElement();
    el.style.backgroundColor = color;

    if (!el.parentNode || el.parentNode !== cam) {
      cam.appendChild(el);
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 5 + 2) * 60;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 120;

    el.style.transform = `translate3d(${pX}px, ${-pY}px, 0)`;

    out.push({
      element: el,
      x: pX,
      y: pY,
      vx,
      vy,
      life: 1,
    });
  }

  return out;
}

/**
 * cleanupParticles(particlesArray)
 */
function cleanupParticles(particlesArray) {
  if (!Array.isArray(particlesArray)) return;
  for (let i = 0; i < particlesArray.length; i++) {
    const p = particlesArray[i];
    if (p && p.element) {
      releaseParticleElement(p.element);
    }
  }
}

function resetParticleCache() {
  _cachedContainer = null;
}

export { createParticles, cleanupParticles, resetParticleCache };
