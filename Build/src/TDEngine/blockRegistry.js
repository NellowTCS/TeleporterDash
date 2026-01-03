import { COLOR_MAP } from "../Utilities/constants.js";

/**
 * BlockRegistry - Single Source of Truth for all block definitions
 *
 * Centralizes: types, matrixValues, sizes, anchors, colors, collision handling,
 * game rendering, editor styling, and preview rendering.
 */

const DEFAULT_ANCHOR = { x: 0.5, y: 0.5 };

export class BlockRegistry {
  constructor() {
    this.definitions = new Map();
    this.matrixLookup = new Map();
  }

  defineBlock(type, definition = {}) {
    if (!type) {
      throw new Error("Block type is required");
    }

    const previous = this.definitions.get(type) || {};
    const next = {
      ...previous,
      ...definition,
      type,
      defaults: {
        ...(previous.defaults || {}),
        ...(definition.defaults || {}),
      },
      anchor: definition.anchor || previous.anchor || DEFAULT_ANCHOR,
      metadata: {
        ...(previous.metadata || {}),
        ...(definition.metadata || {}),
      },
    };

    if (typeof definition.matrixValue === "number") {
      next.matrixValue = definition.matrixValue;
      this.matrixLookup.set(definition.matrixValue, type);
    } else if (typeof previous.matrixValue === "number") {
      this.matrixLookup.set(previous.matrixValue, type);
    }

    if (typeof definition.collisionHandler === "function") {
      next.collisionHandler = definition.collisionHandler;
    }

    if (typeof definition.renderer === "function") {
      next.renderer = definition.renderer;
    }

    if (typeof definition.collisionAdjuster === "function") {
      next.collisionAdjuster = definition.collisionAdjuster;
    }

    if (typeof definition.defaultColor === "string") {
      next.defaultColor = definition.defaultColor;
    }

    if (typeof definition.particleColor === "string") {
      next.particleColor = definition.particleColor;
    }

    if (definition.editor) {
      next.editor = {
        ...(previous.editor || {}),
        ...definition.editor,
      };
    }

    if (typeof definition.previewRenderer === "function") {
      next.previewRenderer = definition.previewRenderer;
    }

    if (definition.preview) {
      next.preview = {
        ...(previous.preview || {}),
        ...definition.preview,
      };
    }

    this.definitions.set(type, next);
    return next;
  }

  getDefinition(type) {
    return this.definitions.get(type);
  }

  getDefinitionByMatrixValue(value) {
    const type = this.matrixLookup.get(value);
    return type ? this.definitions.get(type) : undefined;
  }

  getDefaultSize(type, context = {}) {
    const definition = this.definitions.get(type);
    const defaults = definition?.defaults || {};
    const widthValue =
      typeof defaults.width === "function"
        ? defaults.width(context)
        : defaults.width;
    const heightValue =
      typeof defaults.height === "function"
        ? defaults.height(context)
        : defaults.height;

    const fallbackWidth = context.cellWidth ?? context.rowSpacing ?? 45;
    const fallbackHeight = context.rowSpacing ?? context.cellWidth ?? 45;

    return {
      width: Number.isFinite(widthValue) ? widthValue : fallbackWidth,
      height: Number.isFinite(heightValue) ? heightValue : fallbackHeight,
    };
  }

  getAnchor(type) {
    return this.definitions.get(type)?.anchor || DEFAULT_ANCHOR;
  }

  getDefaultColor(type) {
    return this.definitions.get(type)?.defaultColor || null;
  }

  /**
   * Get the particle effect color for a block type.
   * @param {string} type
   * @returns {string|null}
   */
  getParticleColor(type) {
    return this.definitions.get(type)?.particleColor || null;
  }

  getEditorConfig(type) {
    return this.definitions.get(type)?.editor;
  }

  handleCollision(type, context) {
    const handler = this.definitions.get(type)?.collisionHandler;
    if (typeof handler !== "function") {
      return false;
    }
    return Boolean(handler(context));
  }

  registerRenderer(type, renderer) {
    if (typeof renderer !== "function") {
      throw new Error("Renderer must be a function");
    }
    const definition = this.definitions.get(type) || { type };
    definition.renderer = renderer;
    this.definitions.set(type, definition);
    return this;
  }

  getRenderer(type) {
    return this.definitions.get(type)?.renderer;
  }

  getPreviewRenderer(type) {
    return this.definitions.get(type)?.previewRenderer;
  }

  registerCollisionAdjuster(type, adjuster) {
    if (typeof adjuster !== "function") {
      throw new Error("Collision adjuster must be a function");
    }
    const definition = this.definitions.get(type) || { type };
    definition.collisionAdjuster = adjuster;
    this.definitions.set(type, definition);
    return this;
  }

  applyCollisionAdjuster(type, rect, obstacle) {
    const adjuster = this.definitions.get(type)?.collisionAdjuster;
    if (typeof adjuster === "function") {
      adjuster(rect, obstacle);
    }
  }

  /**
   * Get all registered block types.
   * @returns {string[]}
   */
  getAllTypes() {
    return Array.from(this.definitions.keys());
  }

  /**
   * Get all non-empty block types (for iteration in editors/previews).
   * @returns {string[]}
   */
  getVisibleTypes() {
    return this.getAllTypes().filter((type) => type !== "empty");
  }

  /**
   * Check if a type is registered.
   * @param {string} type
   * @returns {boolean}
   */
  hasType(type) {
    return this.definitions.has(type);
  }

  /**
   * Get type name from matrix value.
   * @param {number} matrixValue
   * @returns {string|undefined}
   */
  getTypeByMatrixValue(matrixValue) {
    return this.matrixLookup.get(matrixValue);
  }

  /**
   * Resolve a color code to actual color string using COLOR_MAP.
   * Falls back to block's default color or provided fallback.
   * @param {number|null} colorCode
   * @param {string} type
   * @param {string} [fallback]
   * @returns {string}
   */
  resolveColor(colorCode, type, fallback = "#ffffff") {
    if (typeof colorCode === "number" && COLOR_MAP[colorCode]) {
      return COLOR_MAP[colorCode];
    }
    return this.getDefaultColor(type) || fallback;
  }
}

export function parseCellValue(cellValue) {
  let matrixValue = 0;
  let rotation = 0;
  let colorCode = null;

  if (typeof cellValue === "string") {
    const [typeToken, ...props] = cellValue.split("/");
    matrixValue = Number.parseInt(typeToken, 10);
    props.forEach((prop) => {
      if (prop.startsWith("@")) {
        rotation = Number.parseInt(prop.substring(1), 10) || 0;
      } else if (prop.startsWith("-")) {
        colorCode = Number.parseInt(prop, 10);
      }
    });
  } else if (typeof cellValue === "number") {
    matrixValue = cellValue;
    if (cellValue < 0) {
      colorCode = cellValue;
    }
  }

  if (!Number.isFinite(matrixValue)) {
    matrixValue = 0;
  }

  return {
    matrixValue,
    rotation,
    colorCode,
    color:
      typeof colorCode === "number" && COLOR_MAP[colorCode]
        ? COLOR_MAP[colorCode]
        : null,
    raw: cellValue,
  };
}

export const blockRegistry = new BlockRegistry();

function createSpikeAdjuster() {
  return (rect, obstacle) => {
    const rotation =
      typeof obstacle?.rotation === "number" ? obstacle.rotation : 0;
    const shrink = Math.max(0, Math.min(6, Math.round(rect.width * 0.12)));

    if (rotation === 90) {
      rect.x += shrink;
      rect.width = Math.max(1, rect.width - shrink);
    } else if (rotation === 270) {
      rect.width = Math.max(1, rect.width - shrink);
    } else if (rotation === 180) {
      rect.y += shrink;
      rect.height = Math.max(1, rect.height - shrink);
    } else {
      rect.height = Math.max(1, rect.height - shrink);
    }
  };
}

// ============================================================================
// Preview Renderers (Canvas 2D context for thumbnails)
// ============================================================================

function previewRect(ctx, { x, y, size, color }) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

function previewSpike(ctx, { x, y, size, color, rotation = 0 }) {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(-size / 2, size / 2);
  ctx.lineTo(0, -size / 2);
  ctx.lineTo(size / 2, size / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function previewTeleporter(ctx, { x, y, size, color }) {
  const radius = size / 3;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function previewFinish(ctx, { x, y, size, color }) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size / 4, size);
}

// ============================================================================
// Default Block Definitions
// ============================================================================

export function registerDefaultBlocks(registry = blockRegistry) {
  registry.defineBlock("empty", {
    matrixValue: 0,
    defaultColor: "#000000",
    defaults: {
      width: ({ cellWidth = 45 }) => cellWidth,
      height: ({ rowSpacing = 45 }) => rowSpacing,
    },
    editor: { className: "empty" },
    previewRenderer: null, // Empty blocks don't render in preview
  });

  registry.defineBlock("platform", {
    matrixValue: 1,
    defaultColor: "#4287f5",
    particleColor: "#4287f5",
    defaults: {
      width: ({ cellWidth = 45 }) => cellWidth + 3,
      height: ({ rowSpacing = 45 }) => rowSpacing,
    },
    editor: { className: "platform" },
    previewRenderer: previewRect,
    collisionHandler: ({ state, utils }) => {
      const collisionResponse = utils.resolvePlatformCollision();
      if (collisionResponse === "death" && !state.isPracticeMode) {
        utils.triggerGameOver();
        return true;
      }
      return false;
    },
  });

  registry.defineBlock("spike", {
    matrixValue: 2,
    defaultColor: "#ff0000",
    particleColor: "#ff0000",
    anchor: { x: 0.5, y: 0 },
    defaults: {
      width: ({ cellWidth = 45 }) => Math.max(8, cellWidth - 12),
      height: () => 30,
    },
    editor: { className: "spike" },
    previewRenderer: previewSpike,
    collisionHandler: ({ state, utils }) => {
      if (state.isPracticeMode) {
        return false;
      }
      utils.triggerGameOver();
      return true;
    },
    collisionAdjuster: createSpikeAdjuster(),
  });

  registry.defineBlock("teleporter", {
    matrixValue: 3,
    defaultColor: "#ff00ff",
    particleColor: "#ff00ff",
    defaults: {
      width: ({ cellWidth = 45 }) => Math.round(cellWidth * 0.66),
      height: () => 60,
    },
    editor: { className: "teleporter" },
    previewRenderer: previewTeleporter,
    collisionHandler: ({ utils }) => {
      utils.handleTeleporterCollision();
      return false;
    },
  });

  registry.defineBlock("finish", {
    matrixValue: 4,
    defaultColor: "#00ff00",
    particleColor: "#00ff00",
    defaults: {
      width: ({ cellWidth = 45 }) => Math.max(10, Math.round(cellWidth * 0.4)),
      height: () => 350,
    },
    editor: { className: "finish" },
    previewRenderer: previewFinish,
    collisionHandler: ({ utils }) => {
      utils.triggerLevelComplete();
      return true;
    },
  });

  return registry;
}

registerDefaultBlocks(blockRegistry);
