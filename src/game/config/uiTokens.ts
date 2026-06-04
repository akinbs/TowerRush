// UI design tokens — the code form of docs/ui (UI Step 1).
// Color values are Phaser `0x` numbers for fills/strokes; use toCss() for Text.

export const UI_COLORS = {
  backgroundPrimary: 0x0b1026,
  backgroundSecondary: 0x101a3a,
  panel: 0x16234a,
  panelSoft: 0x20325f,
  textPrimary: 0xf4fbff,
  textSecondary: 0xb9c7e6,
  ice: 0x48d5ff,
  aurora: 0x9a7bff,
  gold: 0xffc24b,
  danger: 0xff5d6c,
  success: 0x5be6a8,
  border: 0x6bdfff,
} as const;

export const UI_ALPHA = {
  panel: 0.86,
  panelSoft: 0.68,
  disabled: 0.42,
  overlay: 0.72,
} as const;

export const UI_DEPTHS = {
  background: 0,
  // In-game HUD sits ABOVE snow flakes (depth 120) so it stays readable through
  // a snowstorm, but below the end-of-run overlays (gameOver 150 / complete 160).
  hud: 130,
  // On-screen touch controls sit above the snow flakes (120) so a snowstorm
  // never hides them, but just below the HUD (130) and all overlays.
  mobileControls: 125,
  menu: 100,
  overlay: 140,
  // User pause overlay: above the HUD (130) so the modal is clear, but below the
  // end-of-run overlays (gameOver 150 / towerComplete 160) so those always win.
  pause: 145,
  tooltip: 160,
} as const;

export const UI_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const UI_RADIUS = {
  chip: 10,
  button: 14,
  panel: 20,
} as const;

export const UI_STROKE = {
  hair: 1,
  base: 1.5,
  bold: 2,
} as const;

export const UI_TOUCH = {
  min: 56,
  mobileButton: 64,
} as const;

// On-screen movement/jump controls (ice-glass circular buttons). Sizes are
// radii in logical px; the hit box is radius + hitPad on each side.
export const UI_CONTROL = {
  buttonRadius: 32, // left / right → 64 px circle
  jumpRadius: 36, // jump → 72 px circle (more dominant, bottom-right)
  pauseRadius: 22, // legacy on-screen pause (disabled; HUD owns pause)
  hitPad: 6, // extra hit area beyond the visual radius
  bottomMargin: 26,
  sideMargin: 24,
  gap: 16, // edge gap between the left and right buttons
  idleAlpha: 0.58, // stays ≥ 0.4 so snow/hail never hides the controls
  jumpIdleAlpha: 0.68,
  pressedFillAlpha: 0.92,
  disabledAlpha: 0.25,
  pressedScale: 0.94,
  glowAlpha: 0.5, // cyan press halo
} as const;

export const UI_MOTION = {
  buttonPressMs: 90,
  modalOpenMs: 220,
  cardEnterMs: 260,
  chipBumpMs: 120,
} as const;

// System font stacks (no external fonts this step — Playables bundle discipline).
export const UI_FONT = {
  display: "Eurostile, 'Arial Narrow', 'Segoe UI', system-ui, sans-serif",
  body: "system-ui, 'Segoe UI', Roboto, sans-serif",
  mono: "'DejaVu Sans Mono', ui-monospace, 'Courier New', monospace",
} as const;

// Converts a 0xRRGGBB number to a CSS hex string for Phaser Text colors.
export function toCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
