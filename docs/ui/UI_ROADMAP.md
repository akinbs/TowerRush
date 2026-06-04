# IcyTower — UI Roadmap

> Sequenced UI implementation plan. Each step: **Goal · Do · Don't · Risks ·
> Acceptance.** Gameplay/physics/hazard/SDK systems stay frozen throughout —
> these steps are visual/UX only.

Guiding rule for every step: *the UI frames the chaos, it never adds to it.*
Keep typecheck + build green and the single‑bundle / Playables constraints intact.

---

## UI Step 2 — Main Menu + Start Flow
- **Goal:** a fast, branded entry that reaches interactive in < 1 s.
- **Do:** Splash → Main Menu → start run; implement design tokens (extend
  `uiConfig.ts`), Primary/Secondary/Icon buttons, glass panel, best chip, sound
  toggle; wire `firstFrameReady()`/`gameReady()` cleanly around it.
- **Don't:** build tower select navigation; add assets; change scene flow beyond
  inserting a menu before `GameScene`.
- **Risks:** delaying first input (Playables bounce); over‑animated splash.
- **Acceptance:** menu interactive ≤ 1 s; PLAY starts a run; tokens centralized;
  build green; no gameplay change.

## UI Step 3 — In‑Game HUD Redesign
- **Goal:** legible HUD that survives snow + hail + projectile on screen.
- **Do:** redesign score/height/best chips, phase badge, pause button, snow +
  hazard indicators; score micro‑bounce; `setScrollFactor(0)`, depth 90; two
  corners only.
- **Don't:** add a full top bar; cover the central play column; touch scoring/
  height logic.
- **Risks:** HUD wrapping on compact screens; indicator clutter.
- **Acceptance:** ≤ 2 lines on 360‑wide; readable over bright platforms; no
  overlap with play space; resize‑safe (handler detached on destroy).

## UI Step 4 — Mobile Controls Polish
- **Goal:** controls that are always usable, never lost in chaos.
- **Do:** ice‑glass ◀▶ + JUMP, press scale 0.94 + cyan glow, ≥56 touch, bottom‑
  safe‑area anchoring, ≥0.4 idle alpha; disabled state on pause/end‑run.
- **Don't:** rewrite `InputController`/`MobileControls` logic; move pause out of HUD.
- **Risks:** thumb occlusion; controls fading during Snow Time.
- **Acceptance:** controls visible and responsive during snow+hail; correct
  anchoring portrait + landscape; no input regressions.

## UI Step 5 — Pause / Game Over / Tower Complete Screens
- **Goal:** consistent, fast result/overlay screens with one clear action each.
- **Do:** glass result cards, dim‑not‑black scrim, New Best badge, Game Over ↔
  Tower Complete shared layout, motion per `MOTION_GUIDE.md`; reuse existing
  controllers' show/hide/consume API.
- **Don't:** add new flows (no leaderboard, no share); break restart/continue
  wiring; cover FX with the card.
- **Risks:** overlay depth conflicts with snow (120) / FX; double‑trigger.
- **Acceptance:** overlays at 150/160 render above gameplay; one primary action;
  restart works; play field dimmed‑visible behind.

## UI Step 6 — Character Sprite Direction + Asset Prompt Pack
- **Goal:** production character art ready to slot behind `TEX_PLAYER`.
- **Do:** finalize style, frame size (48×64), frame list, atlas spec; produce an
  art prompt/reference pack; define the placeholder→final swap (same keys/slicing).
- **Don't:** change `AnimationController` frame indices or body sizes; ship art
  that breaks flip‑X symmetry.
- **Risks:** silhouette unreadable at small size; flip lighting artifacts.
- **Acceptance:** approved sheet swaps in via `PreloadScene` only; animations and
  body alignment unchanged; bundle within budget.

## UI Step 7 — Ice Tower Environment Art + Parallax
- **Goal:** depth + sense of height without hurting perf or readability.
- **Do:** 2–3 parallax layers (aurora/tower/motes) driven by `scrollY`; subtle
  height‑based brightness shift; generated/atlas only.
- **Don't:** exceed 3 layers; dim the play field; large PNGs.
- **Risks:** overdraw/fill‑rate on mobile; background competing with platforms.
- **Acceptance:** stable frame rate on mid mobile; platforms still pop; bundle
  within budget.

## UI Step 8 — Hazard Visual Polish
- **Goal:** projectile/hail/snow/warning read as fair, premium telegraphs.
- **Do:** refine projectile core+glow+trail, hail/shatter, snow layering, and the
  edge warning marker (gameplay telegraph, not UI panel).
- **Don't:** change hazard timing, damage, knockback, or balance (visual only).
- **Risks:** warning too subtle (unfair) or too loud (UI‑like); snow blinding.
- **Acceptance:** warning unmissable yet lightweight; snow softens without hiding
  player; no balance/logic change.

## UI Step 9 — Responsive QA + Playables Certification Polish
- **Goal:** ship‑ready across devices and within Playables rules.
- **Do:** safe‑area/orientation pass, touch‑target audit, reduced‑motion toggle,
  bundle/size check, perf pass, SDK pause/audio‑state UI behavior verification.
- **Don't:** introduce new features; add DOM/network.
- **Risks:** orientation edge cases; oversize bundle; audio‑state UI mismatch.
- **Acceptance:** all screens correct portrait+landscape+compact; ≥56 touch
  everywhere; bundle < 15 MiB target; reduced‑motion works; build green.

---

## Sequencing notes
- Steps 2–5 are **primitive‑only** (zero new assets) — fastest path to a polished
  feel. Steps 6–8 introduce hand art behind existing texture keys. Step 9 is the
  certification gate.
- Each step is independently shippable and revertible; never block a run.
- After every step: `npm run typecheck` + `npm run build` green, no gameplay diff.

## Definition of done (whole UI track)
A first‑time Playables player, on a mid‑range phone, in portrait, understands the
game in the warmup, reads the HUD through a snowstorm, retries in two taps, and
the whole thing loads fast and stays under budget — without a single change to
how the game *plays*.
