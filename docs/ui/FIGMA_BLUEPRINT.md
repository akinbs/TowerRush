# IcyTower — Figma Screen Blueprint

> Figma‑ready frame + screen spec. No Figma file is required this step; this maps
> 1:1 into frames and components. Base logical canvas = **400 × 700** (matches
> `GAME_WIDTH/HEIGHT`, `Phaser.Scale.FIT`, `CENTER_BOTH`). Design at this size;
> FIT scales to device.

---

## 0. Frames to create

| Frame | Size | Purpose |
|-------|------|---------|
| **Portrait (primary)** | 400 × 700 (9:16‑ish) | the real target, all screens designed here first |
| **Compact portrait** | 360 × 640 | smallest phones — verify nothing clips |
| **Landscape fallback** | 700 × 400 | rotated devices; HUD/controls re‑anchor |
| **Desktop preview** | 800 × 1400 (2×) | crisp review / marketing stills |
| **Component sheet** | free | all components + states (see UI_COMPONENT_SYSTEM.md) |
| **Ice Tower theme sheet** | free | palette swatches, platform/hazard art, character poses |

**Safe area:** keep all interactive/critical UI inside a **16 px** inset on every
edge (portrait). Reserve the **bottom 120 px** band for mobile controls and the
**top 64 px** band for HUD. The central column (y ≈ 130–560) is sacred play space —
overlays may dim it but persistent UI must not occupy it.

Depth bands (align Figma layer order to code):
`gameplay 0 · FX 50 · hail 65 · projectile 70 · HUD 90 · buttons 100 · snow 120 · gameOver 150 · towerComplete 160`.

---

## 1. Splash / Loading
- **Purpose:** instant, branded first frame; covers texture generation + SDK init.
- **Elements:** centered IcyTower wordmark (ice + aurora), thin indeterminate
  frost shimmer bar, version micro‑text bottom.
- **Layout:** vertically centered; logo at 42% height.
- **Responsive:** logo scales by min(width, height); bar fixed 160 px.
- **Motion:** logo fade+rise 220 ms; shimmer loops; **must clear ≤ ~1 s** —
  Playables needs a fast first paint. No long intro.
- **Playables:** call `firstFrameReady()` behind this; no network, no video.

## 2. Main Menu
- **Purpose:** start the run; house settings; show best.
- **Elements:** wordmark (top third), **PLAY** primary button (center), small
  best‑score chip, sound toggle (icon button), "Ice Tower" tower badge.
- **Layout:** single centered column; PLAY at ~58% height (thumb‑reachable).
- **Responsive:** column max‑width 320; controls bottom‑anchored in landscape.
- **Motion:** elements stagger‑in 60 ms apart, easeOutCubic; PLAY breathes subtly.
- **Playables:** menu itself is interactive = good `gameReady()` point.

## 3. Start / Character Preview
- **Purpose:** brief identity moment before the climb (optional, can fold into menu).
- **Elements:** character idle on a hero slab, tower name, "Tap to climb" hint.
- **Layout:** character centered low, name above, hint pulsing at bottom.
- **Responsive:** character anchored to a baseline; hint respects safe area.
- **Motion:** character idle loop; hint slow blink.
- **Playables:** keep optional/skippable — never block the first input.

## 4. In‑Game HUD
- **Purpose:** score, height, best, phase/status, pause — at a glance, scroll‑independent.
- **Elements:** top‑left **Height chip** (accent.ice) + **Score chip** (gold);
  top‑right **Pause** button; under height, a small **Phase badge**
  (Warmup / Mixed Ice / Summit); transient **Snow Time** + **hazard** indicators.
- **Layout:** two HUD corners only; center top stays clear. Max **two lines**.
- **Responsive:** chips shrink text before wrapping; pause stays 56 px touch.
- **Motion:** score **micro‑bounce** on increase (120 ms); snow indicator slow
  pulse; hazard indicator short flash.
- **Playables:** all HUD `setScrollFactor(0)`, depth 90.

## 5. Mobile Controls Layout
- **Purpose:** left/right + jump, always usable through chaos.
- **Elements:** bottom‑left **◀ ▶** pair, bottom‑right **JUMP**, (pause lives in HUD).
- **Layout:** ◀▶ centers ~x(56, 132) y(640); JUMP ~x(344) y(640); 64 px circles,
  ≥56 px touch, 16 px from edges.
- **Responsive:** controls hug bottom‑safe‑area; widen gap on large screens; in
  landscape move further into corners.
- **Motion:** press → scale 0.94 + cyan glow; release springs back.
- **Playables:** semi‑transparent ice‑glass; never fully hidden during Snow/hail.

## 6. Pause Overlay
- **Purpose:** pause without losing context.
- **Elements:** dim scrim (not black‑out), centered glass panel: **PAUSED**,
  Resume (primary), Restart (secondary), sound toggle.
- **Layout:** centered modal ≤ 300 wide; play field dimmed but visible behind.
- **Responsive:** panel centers in safe area both orientations.
- **Motion:** scrim fade 160 ms; panel scale 0.96→1 + fade 200 ms.
- **Playables:** pause must also handle SDK platform‑pause gracefully (already wired).

## 7. Game Over Screen
- **Purpose:** result + fast retry.
- **Elements:** **GAME OVER** title (coral), **Height** + **Score** result rows,
  **New Best** badge if applicable, **RESTART** primary, "or press R" hint.
- **Layout:** result card center; title ~28%, stats ~44–52%, button ~65%.
- **Responsive:** card max‑width 320; stacks fine on compact.
- **Motion:** card drop+fade 280 ms; light **game‑over shake** already fires;
  New Best badge pops 200 ms after card.
- **Playables:** overlay depth 150; never covers itself with FX.

## 8. Tower Complete Screen
- **Purpose:** celebrate the summit.
- **Elements:** **ICE TOWER COMPLETE** title (gold/aurora), height + score,
  RESTART primary, **Next Tower: Coming Soon** disabled placeholder.
- **Layout:** mirrors Game Over for muscle memory; success palette (mint/aurora).
- **Responsive:** same as Game Over.
- **Motion:** **aurora pulse** (400–650 ms, already implemented), then card in.
- **Playables:** depth 160; pulse renders behind text, above dimmed bg.

## 9. Settings Mini Panel
- **Purpose:** the few real toggles — sound on/off (audio respects host state),
  reduced‑motion (future), maybe SFX volume.
- **Elements:** compact card with toggle rows + icon labels.
- **Layout:** small modal from menu/pause; not a full screen.
- **Responsive:** centered; rows full‑width within card.
- **Motion:** toggle thumb slides 120 ms; panel like Pause.
- **Playables:** no persistence beyond existing SaveController; no new storage.

## 10. First‑Run Tutorial Hints
- **Purpose:** teach controls during the 0–30 m warmup, diegetically.
- **Elements:** ghost button prompts ("◀ ▶ move", "JUMP"), a "30 m: it gets real"
  marker, all **non‑modal**, fade after first successful action.
- **Layout:** hints near their controls; warmup marker near the height chip.
- **Responsive:** anchored to controls/HUD, not absolute coords.
- **Motion:** gentle pulse; auto‑dismiss on use; never blocks input.
- **Playables:** zero‑friction — Playables players bounce if onboarding nags.

## 11. Tower Select Placeholder
- **Purpose:** reserve the multi‑tower future without building it.
- **Elements:** Ice Tower card (active) + locked card (lock icon, "Coming Soon").
- **Layout:** horizontal cards; only Ice Tower interactive.
- **Responsive:** single column on compact.
- **Motion:** locked card has no hover energy (clearly disabled).
- **Playables:** purely visual placeholder — **do not implement navigation now**.

## 12. Ice Tower Visual Theme Sheet
- Palette swatches (all tokens), platform type studies (normal→goal), hazard
  studies (projectile/hail/snow/warning), character pose row, snow‑cap study.
- Reference artboard only; the contract between art + code.

## 13. Component Sheet
- Every component from `UI_COMPONENT_SYSTEM.md` with all states laid out. Source
  of truth for sizes/touch targets/states.

---

## Cross‑screen rules
- **One primary action per screen.** Cyan = go, neutral = secondary, coral = danger only.
- Overlays **dim, never delete** the play field (keeps spatial context).
- Every tappable ≥ **56 px** touch target.
- Reuse Game Over ↔ Tower Complete layout so retry is muscle memory.
- All persistent UI `setScrollFactor(0)`; all overlays centered in safe area.
