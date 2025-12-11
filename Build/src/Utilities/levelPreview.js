import { blockRegistry, parseCellValue } from "../TDEngine/blockRegistry.js";

// ===== Level Preview System =====
const TILE_COLORS = {
  0: "#000000",
  1: "#4287f5",
  2: "#ff0000",
  3: "#8c00ff",
  4: "#00ff00",
  "-1": "#ff6b6b",
  "-2": "#4ecdc4",
  "-3": "#45b7d1",
  "-4": "#96ceb4",
  "-5": "#ff9f1c",
  "-6": "#ffbe0b",
  "-7": "#ff006e",
  "-8": "#8338ec",
  "-9": "#3a86ff",
};

const DEFAULT_PREVIEW_COLOR = "#ffffff";

function getPreviewTarget(blockValue) {
  const parsed = parseCellValue(blockValue);
  const definition =
    blockRegistry.getDefinitionByMatrixValue(parsed.matrixValue) ||
    blockRegistry.getDefinition("empty");
  return { parsed, definition };
}

function renderBlockPreview(ctx, blockValue, { x, y, size }) {
  const { parsed, definition } = getPreviewTarget(blockValue);
  if (!definition || definition.type === "empty") {
    return;
  }

  const renderer =
    blockRegistry.getPreviewRenderer(definition.type) || drawDefaultPreview;
  const color =
    parsed.color ||
    definition.defaultColor ||
    TILE_COLORS[String(parsed.matrixValue)] ||
    DEFAULT_PREVIEW_COLOR;

  renderer(ctx, {
    x,
    y,
    size,
    color,
    rotation: parsed.rotation || 0,
  });
}

function drawDefaultPreview(ctx, { x, y, size, color }) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

function drawSpike(ctx, { x, y, size, color = "#ff0000", rotation = 0 }) {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate((rotation * Math.PI) / 180);

  ctx.beginPath();
  ctx.moveTo(-size / 2, size / 2); // Bottom left
  ctx.lineTo(0, -size / 2); // Top middle
  ctx.lineTo(size / 2, size / 2); // Bottom right
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
}

function drawTeleporter(ctx, { x, y, size, color = "#00ff00" }) {
  const radius = size / 3;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawFinishLine(ctx, { x, y, size, color = "#00ff00" }) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size / 4, size);
}

blockRegistry.defineBlock("platform", { previewRenderer: drawDefaultPreview });
blockRegistry.defineBlock("spike", { previewRenderer: drawSpike });
blockRegistry.defineBlock("teleporter", { previewRenderer: drawTeleporter });
blockRegistry.defineBlock("finish", { previewRenderer: drawFinishLine });

function generateLevelPreview(matrix) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const tileSize = 10;

  // Set canvas size based on matrix dimensions
  canvas.width = matrix[0].length * tileSize;
  canvas.height = matrix.length * tileSize;

  // Draw background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw level elements
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      const block = matrix[row][col];
      const x = col * tileSize;
      const y = row * tileSize;
      renderBlockPreview(ctx, block, { x, y, size: tileSize });
    }
  }

  return canvas;
}

function drawLevelPreview(canvas, level) {
  const ctx = canvas.getContext("2d");
  const matrix = level.matrix;

  if (!matrix) return;

  const tileSize = canvas.width / 40;
  const previewWidth = 40;
  const previewHeight = 20;

  // Draw background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw floor below tiles
  ctx.fillStyle = "#333";
  ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

  // Find the bottom-most row with tiles
  let maxRow = -1;
  for (let row = 0; row < Math.min(matrix.length, previewHeight); row++) {
    for (let col = 0; col < Math.min(matrix[row].length, previewWidth); col++) {
      if (matrix[row][col] != 0) {
        maxRow = Math.max(maxRow, row);
      }
    }
  }

  // Calculate offset to place level above floor
  const floorY = canvas.height - 20;
  const offsetY = maxRow >= 0 ? floorY - (maxRow + 1) * tileSize : 0;

  // Draw level tiles
  for (let row = 0; row < Math.min(matrix.length, previewHeight); row++) {
    for (let col = 0; col < Math.min(matrix[row].length, previewWidth); col++) {
      const block = matrix[row][col];
      const x = col * tileSize;
      const y = row * tileSize + offsetY;
      renderBlockPreview(ctx, block, { x, y, size: tileSize });
    }
  }
}

// Make function global
//@ts-ignore
window.drawLevelPreview = drawLevelPreview;
