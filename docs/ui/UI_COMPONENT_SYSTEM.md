# IcyTower — UI Component System & Tokens

> Component inventory, design tokens, mobile control rules, HUD direction, and
> responsive rules. Implementation lands in UI Steps 2–5. Sizes are **logical
> units @ 400×700** (FIT‑scaled to device).

---

## 1. Design Tokens (non‑color)

Color tokens live in `UI_ART_DIRECTION.md §3`. These are the rest. When
implemented they belong in an extended `uiConfig.ts` (this step does **not** add
code — example shape only):

```ts
// PROPOSED for UI Step 2 — not added this step.
export const UI_TOKENS = {
  space:  { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { chip: 10, button: 14, panel: 20, pill: 999 },
  stroke: { hair: 1, base: 1.5, bold: 2 },
  touch:  { min: 56 },               // min touch target
  elevation: {                       // soft drop shadow presets
    chip:  { blur: 8,  y: 2, alpha: 0.25 },
    panel: { blur: 24, y: 8, alpha: 0.35 },
  },
  glow: { ice: 0x48d5ff, aurora: 0x9a7bff, soft: 0.35 },
} as const;
```

**Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32. Compose layouts from these only.
**Corner radius:** chips 10, buttons 14, panels 20, toggles/pills full.
**Depth (must match code):** HUD 90, buttons 100, overlays 150/160; FX 50,
hazards 65–70, snow 120.

---

## 2. Buttons

Shared anatomy: ice‑glass fill (`surface.panelSoft` @ ~85%), 1.5px
`neutral.border`, label `text.primary`, optional leading icon. Min height 48,
min touch 56.

| Button | Fill / accent | Use |
|--------|---------------|-----|
| **Primary** | `accent.ice` fill, navy label, soft cyan glow | PLAY, Resume, Restart |
| **Secondary** | glass fill, ice label, thin border | Settings, secondary nav |
| **Danger** | `danger.projectile` fill | destructive only (rare; not Restart) |
| **Small icon** | 44–48 circle, glass | sound, back, settings |
| **Mobile control** | 64 circle, glass, see §5 | left / right / jump |
| **Restart** | Primary variant | end‑of‑run retry |
| **Continue (placeholder)** | disabled style | "Next Tower: Coming Soon" |

**States (all buttons)**

| State | Treatment |
|-------|-----------|
| default | base fill + border |
| hover (desktop) | +6% brightness, border → ice |
| pressed / touched | scale **0.96**, inner shadow, brief cyan ring |
| disabled | 45% alpha, no glow, no press response, `cursor: default` |
| focused (keyboard) | 2px ice focus ring offset 2 |

Animation: press 80–120 ms scale; release springs (backOut small).

---

## 3. HUD Components

| Component | Visual | Notes |
|-----------|--------|-------|
| **Score chip** | gold mono number, "× pts" micro‑label, glass pill | micro‑bounce on increase |
| **Height chip** | ice mono number + "m", glass pill | primary progress read |
| **Best chip** | dim secondary, small | menu + result screens |
| **Phase badge** | tiny uppercase pill: Warmup / Mixed Ice / Summit | color shifts per phase (ice→white→aurora) |
| **Hazard warning chip** | amber/coral, icon + short flash | optional; complements edge telegraph |
| **Snow active indicator** | small snow icon, slow pulse | only while Snow Time active |
| **Pause button** | 56 icon button, top‑right | always reachable |
| **Summit progress bar** (optional) | thin vertical sliver on right edge | 0→summit; off by default, perf‑gated |

HUD is **two corners + small center‑top badge**; never a full bar across the top.

---

## 4. Panels & Cards

| Component | Spec |
|-----------|------|
| **Glass/ice panel** | `surface.panel` @ 92%, radius 20, 1px border, panel elevation; the base material for all modals |
| **Compact modal** | ≤ 300 wide, centered, scrim behind |
| **Game Over result card** | title + 2 stat rows + primary button; coral title |
| **Tower Complete card** | same layout, success palette, aurora pulse behind |
| **Settings card** | toggle rows, icon labels |

Scrim: `background.primary` @ 55–72% (dim, not opaque) so the play field stays
visible behind — preserves spatial context.

---

## 5. Mobile Controls (detailed)

Rules:
- Touch target ≥ **56 px**; visual circle 64.
- **◀ ▶** bottom‑left pair; **JUMP** bottom‑right; **Pause** top‑right (HUD).
- 16 px from screen edges; never cover the central play column.
- Semi‑transparent but always legible; **must not disappear** during Snow/hail
  (keep ≥ 0.4 alpha even when "idle").

Visual: ice‑glass circle, faint inner glow, glyph in `text.primary`.

| State | Treatment |
|-------|-----------|
| idle | glass @ ~0.5 alpha, soft border |
| pressed | scale **0.94**, **cyan glow**, glyph brightens |
| active (held) | sustained cyan ring |
| disabled (paused / end‑run) | drop to ~0.25 alpha, no input |

Layout anchors (portrait, 400×700): left ◀ ≈ (60, 644), right ▶ ≈ (132, 644),
JUMP ≈ (340, 644). Re‑anchor to bottom‑safe‑area on resize; push to corners in
landscape. (Current `MobileControls` already follows this spirit — this is the
polish target, not a rewrite.)

---

## 6. Icons

Single‑line, 2px stroke, 24‑grid, generated or one small atlas. Set:
`play, pause, restart, sound‑on, sound‑off, snow, projectile‑warning, height,
trophy, tower, lock, arrow‑left, arrow‑right, jump`.

Style: rounded joins, consistent stroke, no fills except status dots. Each ships
in `text.primary` and an accent variant (ice/gold/coral) where it conveys state.

---

## 7. Badges

| Badge | Color | Trigger |
|-------|-------|---------|
| **Warmup** | ice | height < 30 m |
| **Mixed Ice** | frost white | height ≥ 30 m |
| **Snow Time** | aurora, pulsing | snow active |
| **Tower Complete** | gold/mint | summit reached |
| **New Best** | gold, pop‑in | score beats saved best |

Badges are small uppercase pills (10 radius), used sparingly so they keep impact.

---

## 8. Responsive Layout Rules (Playables)

- **Portrait‑first.** Design at 400×700; everything anchors, nothing absolute‑only.
- **Safe area:** 16 px inset; top 64 reserved HUD, bottom 120 reserved controls.
- **Landscape fallback:** HUD → corners, controls → far corners, overlays stay
  centered. No layout *redesign*, just re‑anchor.
- **HUD adaptive:** shrink number font one step before any wrap; never 3 lines.
- **Controls adaptive:** glued to bottom‑safe‑area; gap scales with width.
- **Overlays:** always centered in safe area, max‑width 320, scrim full‑bleed.
- **Touch min:** 56 px everywhere, non‑negotiable.
- **Text scaling:** clamp font between a min (legibility) and max (don't balloon
  on tablets).
- **No DOM UI.** Everything is Phaser GameObjects, `setScrollFactor(0)`, correct
  depth band.
- **resize handling:** every Ui class stores its `resize` handler and detaches it
  on `destroy()` (project already mandates this — see CLAUDE.md resize rule).
- **Pixel ratio / perf:** cap effective DPR for particle‑heavy scenes; UI is
  vector‑cheap, but keep glow/shadow counts low on mobile.

---

## 9. Component → Screen matrix

| Component | Menu | HUD | Pause | Game Over | Complete | Settings |
|-----------|:--:|:--:|:--:|:--:|:--:|:--:|
| Primary button | ● | | ● | ● | ● | |
| Secondary button | ● | | ● | | | ● |
| Icon button | ● | ● | ● | | | ● |
| Score/Height chip | | ● | | | | |
| Result card | | | | ● | ● | |
| Glass panel | | | ● | ● | ● | ● |
| Badge | ● | ● | | ● | ● | |
| Mobile controls | | ● | | | | |

This matrix is the build checklist for UI Steps 3–5.
