import { blockRegistry, parseCellValue } from "../TDEngine/blockRegistry.js";

/**
 * Level Preview System
 * Renders level thumbnails using Canvas 2D.
 * All block colors and renderers come from BlockRegistry (SSOT).
 */

const PREVIEW_BACKGROUND = "#1a1a2e";
const PREVIEW_FLOOR_COLOR = "#333333";
const DEFAULT_TILE_SIZE = 10;

/**
 * Get block definition and parsed cell data for preview rendering.
 * @param {string|number} blockValue - The raw cell value
 * @returns {{ parsed: object, definition: object|undefined }}
 */
function getPreviewTarget(blockValue) {
  const parsed = parseCellValue(blockValue);
  const definition = blockRegistry.getDefinitionByMatrixValue(parsed.matrixValue);
  return { parsed, definition };
}

/**
 * Render a single block to the preview canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string|number} blockValue
 * @param {{ x: number, y: number, size: number }} options
 */
function renderBlockPreview(ctx, blockValue, { x, y, size }) {
  const { parsed, definition } = getPreviewTarget(blockValue);
  
  // Skip empty blocks or undefined types
  if (!definition || definition.type === "empty") {
    return;
  }

  const renderer = definition.previewRenderer;
  if (!renderer) {
    return;
  }

  // Resolve color: custom color code → block default → fallback
  const color = blockRegistry.resolveColor(
    parsed.colorCode,
    definition.type,
    "#ffffff"
  );

  renderer(ctx, {
    x,
    y,
    size,
    color,
    rotation: parsed.rotation || 0,
  });
}

/**
 * Generate a level preview canvas from a matrix.
 * @param {Array<Array<string|number>>} matrix
 * @returns {HTMLCanvasElement}
 */
function generateLevelPreview(matrix) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = matrix[0].length * DEFAULT_TILE_SIZE;
  canvas.height = matrix.length * DEFAULT_TILE_SIZE;

  ctx.fillStyle = PREVIEW_BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      const block = matrix[row][col];
      const x = col * DEFAULT_TILE_SIZE;
      const y = row * DEFAULT_TILE_SIZE;
      renderBlockPreview(ctx, block, { x, y, size: DEFAULT_TILE_SIZE });
    }
  }

  return canvas;
}

/**
 * Draw a level preview onto an existing canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{ matrix: Array<Array<string|number>> }} level
 */
function drawLevelPreview(canvas, level) {
  const ctx = canvas.getContext("2d");
  const matrix = level.matrix;

  if (!matrix) return;

  const tileSize = canvas.width / 40;
  const previewWidth = 40;
  const previewHeight = 20;

  ctx.fillStyle = PREVIEW_BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = PREVIEW_FLOOR_COLOR;
  ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

  // Find the bottom-most row with tiles
  let maxRow = -1;
  for (let row = 0; row < Math.min(matrix.length, previewHeight); row++) {
    for (let col = 0; col < Math.min(matrix[row].length, previewWidth); col++) {
      if (matrix[row][col] !== 0 && matrix[row][col] !== "0") {
        maxRow = Math.max(maxRow, row);
      }
    }
  }

  const floorY = canvas.height - 20;
  const offsetY = maxRow >= 0 ? floorY - (maxRow + 1) * tileSize : 0;

  for (let row = 0; row < Math.min(matrix.length, previewHeight); row++) {
    for (let col = 0; col < Math.min(matrix[row].length, previewWidth); col++) {
      const block = matrix[row][col];
      const x = col * tileSize;
      const y = row * tileSize + offsetY;
      renderBlockPreview(ctx, block, { x, y, size: tileSize });
    }
  }
}

// @ts-ignore - Global export for legacy support
window.drawLevelPreview = drawLevelPreview;

export { generateLevelPreview, drawLevelPreview, renderBlockPreview };
