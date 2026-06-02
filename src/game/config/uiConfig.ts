export const UI_CONFIG = {
  // Touch / click buttons
  buttonSize: 64,
  pauseButtonSize: 44,
  buttonAlpha: 0.55,
  buttonPadding: 16,

  // HUD text
  hudPadding: 14,
  hudFontSize: "14px",
  hudLineHeight: 20,
  towerNameFontSize: "13px",
  pauseOverlayFontSize: "36px",

  // Rendering depth — above all game objects (platforms depth 0, player depth 0)
  hudDepth: 90,
  buttonDepth: 100,
  gameOverDepth: 150,

  // Game Over overlay
  gameOverBgAlpha: 0.72,

  // Colors
  buttonFillNormal: 0x223355,
  buttonFillPressed: 0x4466aa,
  buttonFillPause: 0x332222,
  buttonFillPausePressed: 0xaa4444,
  hudTextColor: "#e8e8ff",
  hudDimColor: "#9999bb",
  pauseTextColor: "#ffff44",
} as const;
