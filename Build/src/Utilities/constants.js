// Shared constants for Teleporter Dash
export const COLOR_MAP = {
  0: "#000000", // Black
  "-1": "#ff6b6b", // Red
  "-2": "#4ecdc4", // Cyan
  "-3": "#ff9f1c", // Blue
  "-4": "#96ceb4", // Green
  "-5": "#45b7d1", // Orange
  "-6": "#ffbe0b", // Yellow
  "-7": "#ff006e", // Pink
  "-8": "#8338ec", // Purple
  "-9": "#3a86ff", // Light Blue
};

export const COLOR_STEPS = [
  COLOR_MAP["0"],
  COLOR_MAP["-1"],
  COLOR_MAP["-2"],
  COLOR_MAP["-3"],
  COLOR_MAP["-4"],
  COLOR_MAP["-5"],
  COLOR_MAP["-6"],
  COLOR_MAP["-7"],
  COLOR_MAP["-8"],
  COLOR_MAP["-9"],
];

export const CONSTANTS = {
  COLUMN_WIDTH: 45, // Width of each column in the level matrix
  GROUND_HEIGHT: 0, // Height of the ground from bottom of container
  INITIAL_SPACE: 740, // Initial empty space before level starts (IMP)
};
