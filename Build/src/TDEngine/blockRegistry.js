import { COLOR_MAP } from "../Utilities/constants.js";

// Central registry for all block metadata (collision, rendering, defaults, etc.)

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

export function registerDefaultBlocks(registry = blockRegistry) {
  registry.defineBlock("empty", {
    matrixValue: 0,
    defaults: {
      width: ({ cellWidth = 45 }) => cellWidth,
      height: ({ rowSpacing = 45 }) => rowSpacing,
    },
    editor: { className: "empty" },
  });

  registry.defineBlock("platform", {
    matrixValue: 1,
    defaultColor: "#4287f5",
    defaults: {
      width: ({ cellWidth = 45 }) => cellWidth + 3,
      height: ({ rowSpacing = 45 }) => rowSpacing,
    },
    editor: { className: "platform" },
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
    anchor: { x: 0.5, y: 0 },
    defaults: {
      width: ({ cellWidth = 45 }) => Math.max(8, cellWidth - 12),
      height: () => 30,
    },
    editor: { className: "spike" },
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
    defaults: {
      width: ({ cellWidth = 45 }) => Math.round(cellWidth * 0.66),
      height: () => 60,
    },
    editor: { className: "teleporter" },
    collisionHandler: ({ utils }) => {
      utils.handleTeleporterCollision();
      return false;
    },
  });

  registry.defineBlock("finish", {
    matrixValue: 4,
    defaultColor: "#00ff00",
    defaults: {
      width: ({ cellWidth = 45 }) => Math.max(10, Math.round(cellWidth * 0.4)),
      height: () => 350,
    },
    editor: { className: "finish" },
    collisionHandler: ({ utils }) => {
      utils.triggerLevelComplete();
      return true;
    },
  });

  return registry;
}

registerDefaultBlocks(blockRegistry);
