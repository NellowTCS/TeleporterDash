import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import { blockRegistry } from "./blockRegistry.js";

const DEG_TO_RAD = Math.PI / 180;
const DEFAULT_PLAYER_COLOR = 0x1ce92d;
const DEFAULT_PLATFORM_COLOR = 0x4287f5;
const DEFAULT_FINISH_COLOR = 0x00ff00;
const DEFAULT_SPIKE_COLOR = 0xff0000;
const DEFAULT_TELEPORTER_GRADIENT = ["#ff00ff", "#8c00ff"];

let _app = null;
// @ts-ignore
let _appInitPromise = null;
let _rendererReady = false;
let _gameContainer = null;
let _cameraContainer = null;
let _worldLayer = null;
let _obstacleLayer = null;
let _playerLayer = null;
let _effectsLayer = null;
let _playerGraphic = null;
let _viewportWidth = 800;
let _viewportHeight = 600;
let _resizeObserver = null;

const _playerCache = { x: null, y: null, rotation: null, viewportHeight: null };
const _cameraCache = { offsetY: null };
const _teleporterTextures = new Map();
const _radialTextures = new Map();

function init(gameContainerElement, cameraContainerElement) {
  _gameContainer =
    gameContainerElement || _query("#gameContainer") || document.body;
  _cameraContainer =
    cameraContainerElement ||
    _query("#cameraContainer") ||
    _gameContainer ||
    document.body;

  if (_app || typeof window === "undefined") {
    return;
  }

  _ensurePixiApplication();
}

function _ensurePixiApplication() {
  if (_app) {
    return;
  }

  _updateViewportMetrics();

  _app = new Application();
  _worldLayer = new Container();
  _worldLayer.sortableChildren = false;

  _obstacleLayer = new Container();
  _playerLayer = new Container();
  _effectsLayer = new Container();

  _worldLayer.addChild(_obstacleLayer);
  _worldLayer.addChild(_playerLayer);
  _worldLayer.addChild(_effectsLayer);

  _app.stage.addChild(_worldLayer);

  _appInitPromise = _app
    .init({
      width: _viewportWidth,
      height: _viewportHeight,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      autoStart: false,
      resizeTo: _cameraContainer || _gameContainer || window,
    })
    .then(() => {
      _rendererReady = true;
      _attachCanvas();
    })
    .catch((error) => {
      console.error("Pixi initialization failed:", error);
    });

  _setupResizeHandling();
}

function _attachCanvas() {
  if (!_app || !_cameraContainer) return;
  const canvas = _app.canvas;
  if (canvas.parentElement === _cameraContainer) {
    return;
  }

  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "1";

  _cameraContainer.style.position =
    _cameraContainer.style.position || "relative";
  _cameraContainer.appendChild(canvas);
}

function _setupResizeHandling() {
  const target = _cameraContainer || _gameContainer;
  if (typeof ResizeObserver !== "undefined" && target) {
    if (_resizeObserver) return;
    _resizeObserver = new ResizeObserver(() => {
      _handleViewportChange();
    });
    _resizeObserver.observe(target);
  } else if (typeof window !== "undefined") {
    window.addEventListener("resize", _handleViewportChange);
  }
}

function _handleViewportChange() {
  _updateViewportMetrics();
  if (_app && _rendererReady) {
    _app.renderer.resize(_viewportWidth, _viewportHeight);
  }
  _playerCache.viewportHeight = null;
}

function _updateViewportMetrics() {
  const reference = _cameraContainer || _gameContainer;
  if (reference) {
    const bounds = reference.getBoundingClientRect();
    if (bounds.width > 0 && bounds.height > 0) {
      _viewportWidth = bounds.width;
      _viewportHeight = bounds.height;
      return;
    }
  }
  if (typeof window !== "undefined") {
    _viewportWidth = window.innerWidth;
    _viewportHeight = window.innerHeight;
  }
}

function _query(selector) {
  if (typeof document === "undefined") return null;
  return document.querySelector(selector);
}

function createPlayerElement(existingElement) {
  if (existingElement) {
    existingElement.style.display = "none";
  }

  if (!_playerLayer) {
    _ensurePixiApplication();
  }

  if (_playerGraphic) {
    if (!_playerGraphic.parent) {
      _playerLayer.addChild(_playerGraphic);
    }
    return _playerGraphic;
  }

  _playerGraphic = new Graphics();
  // @ts-ignore
  _playerGraphic.__tdAnchor = { x: 0.5, y: 0.5 };
  // @ts-ignore
  _playerGraphic.__tdSize = { width: 30, height: 30 };
  _playerGraphic.eventMode = "none";
  _playerLayer.addChild(_playerGraphic);
  _drawPlayerGraphic(30, 30);
  return _playerGraphic;
}

function _drawPlayerGraphic(width, height) {
  if (!_playerGraphic) return;
  _playerGraphic.clear();
  _playerGraphic.roundRect(-width / 2, -height / 2, width, height, 3);
  _playerGraphic.fill({ color: DEFAULT_PLAYER_COLOR });
  _playerGraphic.__tdSize = { width, height };
}

function createObstacleElement(obstacleObj) {
  if (!obstacleObj) return null;
  if (obstacleObj.type === "empty") {
    return null;
  }
  if (!_obstacleLayer) {
    _ensurePixiApplication();
  }

  const display =
    obstacleObj.element instanceof Container
      ? obstacleObj.element
      : new Container();
  display.removeChildren();
  display.eventMode = "none";

  const defaultSize = blockRegistry.getDefaultSize(obstacleObj.type, {
    cellWidth: obstacleObj.meta?.cellWidth,
    rowSpacing: obstacleObj.meta?.rowSpacing,
  });
  const width = Math.round(obstacleObj.width || defaultSize.width);
  const height = Math.round(obstacleObj.height || defaultSize.height);

  _drawObstacleGraphic(display, obstacleObj, width, height);

  if (!display.parent) {
    _obstacleLayer.addChild(display);
  }

  obstacleObj.element = display;
  return display;
}

function _drawObstacleGraphic(container, obstacle, width, height) {
  const type = obstacle.type || "empty";
  container.pivot.set(0, 0);
  const anchor = blockRegistry.getAnchor(type);
  container.__tdAnchor = anchor;
  container.__tdSize = { width, height };

  const renderer =
    blockRegistry.getRenderer(type) ||
    blockRegistry.getRenderer("empty") ||
    _drawEmpty;

  renderer(container, obstacle, width, height);
}

function _drawPlatform(container, obstacle, width, height) {
  const color = obstacle?.color || blockRegistry.getDefaultColor(obstacle.type);
  const g = new Graphics();
  g.rect(-width / 2, -height / 2, width, height);
  g.fill({ color: _colorToNumber(color, DEFAULT_PLATFORM_COLOR) });
  container.addChild(g);
}

function _drawEmpty(container, obstacle, width, height) {
  const g = new Graphics();
  g.rect(-width / 2, -height / 2, width, height);
  g.stroke({ width: 1, color: 0xffffff, alpha: 0.05 });
  container.addChild(g);
}

function _drawFinish(container, obstacle, width, height) {
  const color = obstacle?.color || blockRegistry.getDefaultColor(obstacle.type);
  const g = new Graphics();
  g.rect(-width / 2, -height / 2, width, height);
  g.fill({ color: _colorToNumber(color, DEFAULT_FINISH_COLOR) });
  container.addChild(g);
}

function _drawSpike(container, obstacle, width, height) {
  const color = obstacle?.color || blockRegistry.getDefaultColor(obstacle.type);
  const g = new Graphics();
  g.moveTo(-width / 2, 0);
  g.lineTo(width / 2, 0);
  g.lineTo(0, -height);
  g.closePath();
  g.fill({ color: _colorToNumber(color, DEFAULT_SPIKE_COLOR) });
  container.addChild(g);
}

function _drawTeleporter(container, obstacle, width, height) {
  const [fromColor, toColor] =
    _extractGradientStops(obstacle.background) || DEFAULT_TELEPORTER_GRADIENT;
  const glowColor = obstacle.color || fromColor;

  const glow = new Sprite(_getRadialTexture(width, height, glowColor));
  glow.anchor.set(0.5);
  glow.position.set(0, 0);
  glow.width = width * 1.4;
  glow.height = height * 1.4;
  glow.alpha = 0.75;
  container.addChild(glow);

  const bodyTexture = _getTeleporterBodyTexture(
    width,
    height,
    fromColor,
    toColor,
  );
  const body = new Sprite(bodyTexture);
  body.anchor.set(0.5);
  body.position.set(0, 0);
  body.width = width;
  body.height = height;
  container.addChild(body);

  const border = new Graphics();
  border.roundRect(-width / 2, -height / 2, width, height, 15);
  border.stroke({ width: 3, color: 0xffffff, alpha: 0.35 });
  container.addChild(border);

  const arrow = new Graphics();
  const arrowHeight = height * 0.25;
  const arrowWidth = width * 0.4;
  const arrowHalfHeight = arrowHeight / 2;
  arrow.moveTo(0, -arrowHalfHeight);
  arrow.lineTo(arrowWidth / 2, arrowHalfHeight);
  arrow.lineTo(-arrowWidth / 2, arrowHalfHeight);
  arrow.closePath();
  arrow.fill({ color: 0xffffff, alpha: 0.85 });
  container.addChild(arrow);
}

blockRegistry.registerRenderer("empty", _drawEmpty);
blockRegistry.registerRenderer("platform", _drawPlatform);
blockRegistry.registerRenderer("spike", _drawSpike);
blockRegistry.registerRenderer("teleporter", _drawTeleporter);
blockRegistry.registerRenderer("finish", _drawFinish);

function renderPlayer(playerObj) {
  if (!playerObj) return;
  const graphic = playerObj.element || createPlayerElement();
  if (!graphic) return;

  const width = playerObj.width || graphic.__tdSize?.width || 30;
  const height = playerObj.height || graphic.__tdSize?.height || 30;

  if (
    !graphic.__tdSize ||
    graphic.__tdSize.width !== width ||
    graphic.__tdSize.height !== height
  ) {
    _drawPlayerGraphic(width, height);
  }

  const modelOffset =
    typeof playerObj.renderOffset === "number" ? playerObj.renderOffset : 0;
  const globalOffset =
    typeof window !== "undefined" &&
    // @ts-ignore
    typeof window.TD_RENDER_PLAYER_OFFSET === "number"
      ? // @ts-ignore
        window.TD_RENDER_PLAYER_OFFSET
      : 0;
  const yVal = (playerObj.y || 0) + modelOffset - globalOffset;
    const stageX = (playerObj.x || 0) + width / 2;
    const stageY = _viewportHeight - (yVal + height / 2); // Removed STAGE_TOP_PADDING
  const rotation = playerObj.rotation || 0;

  if (
    _playerCache.x === stageX &&
    _playerCache.y === stageY &&
    _playerCache.rotation === rotation &&
    _playerCache.viewportHeight === _viewportHeight
  ) {
    return;
  }

  _playerCache.x = stageX;
  _playerCache.y = stageY;
  _playerCache.rotation = rotation;
  _playerCache.viewportHeight = _viewportHeight;

  graphic.position.set(stageX, stageY);
  graphic.rotation = rotation * DEG_TO_RAD;
}

function renderObstacles(obstaclesArray) {
  if (!Array.isArray(obstaclesArray)) return;

  for (let i = 0; i < obstaclesArray.length; i++) {
    const obstacle = obstaclesArray[i];
    if (!obstacle) continue;
    if (obstacle.type === "empty") continue;

    if (!obstacle.element) {
      createObstacleElement(obstacle);
    }

    const display = obstacle.element;
    if (!display) continue;

    const defaultSize = blockRegistry.getDefaultSize(obstacle.type, {
      cellWidth: obstacle.meta?.cellWidth,
      rowSpacing: obstacle.meta?.rowSpacing,
    });
    const width = Math.round(
      obstacle.width || display.__tdSize?.width || defaultSize.width,
    );
    const height = Math.round(
      obstacle.height || display.__tdSize?.height || defaultSize.height,
    );
    const anchor = display.__tdAnchor || blockRegistry.getAnchor(obstacle.type);
    const worldX = obstacle.x || 0;
    const worldY = obstacle.y || 0;
    const stageX = worldX + width * anchor.x;
    const stageY = _viewportHeight - (worldY + height * anchor.y);
    const rotation =
      typeof obstacle.rotation === "number" ? obstacle.rotation : 0;

    if (
      display.__tdLastX === stageX &&
      display.__tdLastY === stageY &&
      display.__tdLastRot === rotation &&
      display.__tdViewportHeight === _viewportHeight
    ) {
      continue;
    }

    display.__tdLastX = stageX;
    display.__tdLastY = stageY;
    display.__tdLastRot = rotation;
    display.__tdViewportHeight = _viewportHeight;

    display.position.set(stageX, stageY);
    display.rotation = rotation * DEG_TO_RAD;
  }
}

function setCamera(offsetY) {
  if (!_cameraContainer) return;
  const rounded = Math.round(offsetY || 0);
  if (_cameraCache.offsetY === rounded) return;
  _cameraCache.offsetY = rounded;
  _cameraContainer.style.transform = `translateY(${rounded}px)`;
}

function removeElement(elem) {
  if (!elem) return;
  if (typeof HTMLElement !== "undefined" && elem instanceof HTMLElement) {
    elem.remove();
    return;
  }

  if (elem.parent) {
    elem.parent.removeChild(elem);
  }

  if (typeof elem.destroy === "function") {
    elem.destroy({ children: true });
  }
}

function resetRenderCache() {
  _playerCache.x = null;
  _playerCache.y = null;
  _playerCache.rotation = null;
  _playerCache.viewportHeight = null;
  _cameraCache.offsetY = null;
}

function presentFrame() {
  if (_rendererReady && _app) {
    _app.render();
  }
}

function _colorToNumber(color, fallback) {
  if (typeof color === "number") return color;
  if (typeof color === "string") {
    const hex = color.trim();
    if (hex.startsWith("#")) {
      return Number.parseInt(hex.slice(1), 16);
    }
  }
  return fallback;
}

function _extractGradientStops(background) {
  if (typeof background !== "string") return null;
  const matches = background.match(/#([0-9a-f]{3,8})/gi);
  if (matches && matches.length >= 2) {
    return [matches[0], matches[1]];
  }
  return null;
}

function _getRadialTexture(width, height, color) {
  const key = `${width}|${height}|${color}`;
  if (_radialTextures.has(key)) {
    return _radialTextures.get(key);
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Texture.WHITE;
  }
  const gradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    0,
    canvas.width / 2,
    canvas.height / 2,
    Math.max(canvas.width, canvas.height) / 2,
  );
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = Texture.from(canvas);
  _radialTextures.set(key, texture);
  return texture;
}

function _getTeleporterBodyTexture(width, height, fromColor, toColor) {
  const key = `${width}|${height}|${fromColor}|${toColor}`;
  if (_teleporterTextures.has(key)) {
    return _teleporterTextures.get(key);
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Texture.WHITE;
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, fromColor);
  gradient.addColorStop(1, toColor);
  ctx.fillStyle = gradient;
  _drawCanvasRoundedRect(ctx, 0, 0, canvas.width, canvas.height, 15);
  ctx.fill();

  const texture = Texture.from(canvas);
  _teleporterTextures.set(key, texture);
  return texture;
}

function _drawCanvasRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export {
  init,
  createPlayerElement,
  createObstacleElement,
  renderPlayer,
  renderObstacles,
  setCamera,
  removeElement,
  resetRenderCache,
  presentFrame,
};
