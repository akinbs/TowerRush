# IcyTower — Motion Guide

> Motion language for UI. Gameplay FX (puffs, shake, shatter, pulse) already
> exist in `FxController` — this guide governs **UI** motion and stays consistent
> with that feel. Implementation in UI Steps 2–5.

---

## 1. Motion language

**Icy snap.** Fast in, soft settle. Springy but never floaty. Every motion is
short enough to feel responsive on a phone and never delays input.

Principles:
- **Input is instant.** Visual flourish may animate; the *action* never waits for it.
- **Short over smooth.** 80–280 ms is the working range; >400 ms only for the
  single celebratory beat (tower complete).
- **One thing moves at a time** in the UI. Stagger, don't pile.
- **Motion confirms, never decorates.** If a tween doesn't communicate state, cut it.

---

## 2. Easing palette

| Easing | Phaser key | Use |
|--------|-----------|-----|
| easeOutCubic | `"Cubic.easeOut"` | most entrances, slide/settle |
| backOut (small) | `"Back.easeOut"` (overshoot ~1.1) | button release, chip bounce, pop‑in badges |
| sineInOut | `"Sine.easeInOut"` | loops: snow indicator pulse, idle breathe |
| linear | `"Linear"` | continuous telegraphs (warning flash, snow drift) |

Avoid heavy `Elastic`/`Bounce` on UI — reads cheap. Keep overshoot ≤ 12%.

---

## 3. Animation specs

| Animation | Duration | Easing | Notes |
|-----------|----------|--------|-------|
| Button press | 80–120 ms | Cubic.out | scale → 0.96 (UI) / 0.94 (mobile control) |
| Button release | 120 ms | Back.out | spring to 1.0, tiny overshoot |
| Modal open | 180–240 ms | Cubic.out | scale 0.96→1 + fade 0→1; scrim fades 160 ms |
| Modal close | 140–180 ms | Cubic.in | reverse, slightly faster |
| HUD score bump | 120 ms | Back.out | scale 1→1.12→1 on increase, **debounced** |
| Height tick | 100 ms | Sine.inOut | subtle, only on meaningful change |
| Game Over card | 280 ms | Cubic.out | drop ~24 px + fade; shake already fires once |
| New Best badge | 200 ms | Back.out | pops 180 ms **after** card settles |
| Tower Complete pulse | 400–650 ms | Cubic.out | aurora ring (already in FxController) |
| Hazard warning flash | 300–450 ms | Linear | alpha pulse on edge marker |
| Snow active indicator | 1200–1600 ms loop | Sine.inOut | slow alpha/scale pulse |
| Menu element stagger | 60 ms offset | Cubic.out | each item rises 12 px + fades |
| Splash logo | 220 ms | Cubic.out | fade + rise; must clear ≤ ~1 s |

---

## 4. Rules

- **Never block gameplay.** UI tweens run on overlays/HUD only; the play loop is
  untouched. Overlays appear *after* state changes (already the pattern in
  `triggerGameOver` / `triggerTowerComplete`).
- **No long intro.** Playables must reach interactive fast — splash/menu motion
  is < 1 s total to first input.
- **Pause‑safe:** UI tweens run on the Tween manager, which keeps animating under
  physics pause — fine for overlays. Do **not** queue new gameplay FX while
  paused (the update early‑return already prevents this).
- **Debounce repeating triggers** (score bumps) so rapid changes don't stack
  tweens on one object — kill/replace the previous tween.
- **Clean up:** every UI tween targets a tracked object; on scene shutdown those
  objects are destroyed (mirrors `FxController.destroy()` and the resize rule).

---

## 5. Reduced motion (forward‑looking)

Build the toggle into the design now, implement later (Settings panel):

- A single `reducedMotion` flag (Settings). When on:
  - replace scale/spring entrances with **fade‑only** (same durations, no movement),
  - stop looping pulses (snow/idle breathe) — show a static state instead,
  - keep functional flashes (hazard warning) but lower amplitude,
  - never remove the *information*, only the movement.
- Respect the host where possible; default off, user‑toggleable. No code this step.

---

## 6. Consistency with existing game FX

These already ship and define the baseline feel — UI motion should rhyme with them:

| Existing FX | Feel it sets |
|-------------|--------------|
| jump/land puff | quick, light, icy |
| landing squash (Back.Out, ~140 ms) | snappy spring — match for button release |
| game‑over shake (180 ms, 0.008) | short, low‑amplitude — don't exceed for UI |
| tower‑complete aurora pulse (~560 ms) | the one allowed "big" celebratory beat |
| hail shatter / ice shards (~300–480 ms) | crisp, fast decay |

UI never out‑animates gameplay; gameplay is the star.
