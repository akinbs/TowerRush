# IcyTower — UI Art Direction

> Scope: visual language only. No gameplay, physics, generator, hazard or SDK
> changes. This is the design foundation that UI Steps 2+ implement.

---

## 1. North Star

**Premium arcade ice‑climb.**

One sentence: *a fast, frozen vertical challenge that feels crisp and competitive
on a phone — readable chaos, never childish, never grimdark.*

Keywords that pass / fail every decision:

| Keep | Avoid |
|------|-------|
| frozen arcade, glacier climb | candy/cartoon kiddie |
| aurora energy, icy motion | dark hardcore / gritty |
| crisp UI, readable chaos | muddy, low‑contrast |
| fast vertical challenge | slow, ornamental |

**Design tension to hold:** the play field can get visually busy (snow, hail,
projectiles, breaking platforms). The UI's job is to stay *quiet and certain* so
the chaos reads as exciting, not confusing. UI never competes with gameplay for
attention — it frames it.

### Anti‑generic guardrails (Impeccable)
- No full‑screen glassmorphism. Glass is a **panel material**, used sparingly.
- No rainbow gradients. Max 2 hues per gradient, low contrast within the ramp.
- Not everything glows. Glow is an **accent reserved for success/energy** (goal,
  new best, aurora), not a default state.
- Readability beats decoration, always. If an effect costs legibility, cut it.

---

## 2. The World

| Element | Visual intent |
|---------|---------------|
| **Ice Tower** | deep navy void → glacier‑blue tower body, glass‑edge rim light, drifting crystal motes |
| **Platforms** | flat, high‑contrast slabs; type is identifiable in <150 ms |
| **Projectile** | small fast ice core, hard outline + faint motion glow |
| **Snow Time** | screen‑space flurry that *softens* the scene without hiding the player |
| **Hail** | chunkier physical ice; reads heavier than a snowflake |
| **Goal / summit** | brighter, wider, aurora glow — "you made it" energy |

Lighting model: single cool key from upper‑left, subtle aurora bounce from
behind the tower. Everything is rim‑lit on its top edge (snow/light catches the
top of slabs), which also reinforces "where to land".

---

## 3. Color System (design tokens)

Base background is deep navy so cyan/white gameplay pops. Tokens are named by
**role**, not by color, so re‑theming a future tower only swaps values.

> Hex for design tools; `0x` for Phaser fills (the codebase already uses `0x`).

| Token | Hex | Phaser | Use | Contrast note |
|-------|-----|--------|-----|---------------|
| `background.primary` | `#0B1026` | `0x0b1026` | scene backdrop top | deep navy base |
| `background.secondary` | `#121A3A` | `0x121a3a` | backdrop bottom / vignette | 2‑stop vertical ramp w/ primary |
| `surface.panel` | `#1B2547` | `0x1b2547` | modals, result cards (≈92% alpha) | ≥7:1 with text.primary |
| `surface.panelSoft` | `#26335E` | `0x26335e` | chips, secondary fills | ≥4.5:1 with text.secondary |
| `text.primary` | `#EAF2FF` | `0xeaf2ff` | scores, titles | frost white, AAA on panels |
| `text.secondary` | `#9DB2D8` | `0x9db2d8` | labels, hints | AA min; never on bright cyan |
| `accent.ice` | `#48D5FF` | `0x48d5ff` | primary actions, height, focus | the brand color |
| `accent.aurora` | `#9A7BFF` | `0x9a7bff` | success energy, goal glow | secondary accent only |
| `accent.gold` | `#FFC24B` | `0xffc24b` | score, trophy, "new best" | warm pop vs all‑cool palette |
| `danger.projectile` | `#FF5D6C` | `0xff5d6c` | projectile core/warning | coral‑red, reserved for threat |
| `danger.warning` | `#FF9F45` | `0xff9f45` | hazard telegraph, caution | amber, lower urgency than projectile |
| `success.complete` | `#5BE6A8` | `0x5be6a8` | tower complete, confirms | mint, distinct from gold |
| `neutral.border` | `#3A4A7A` | `0x3a4a7a` | 1px panel/chip stroke | subtle, never pure white |
| `shadow.glow` | `#48D5FF` @ 35% | — | outer glow on accents | additive, used *rarely* |

**Rules**
- Danger red is *only* for genuine threat (projectile, fatal warning). Never for
  buttons, never decorative.
- Gold + cyan + white is the core HUD triad. Aurora purple is a guest, not a host.
- Min text contrast on any surface: **4.5:1**. Titles/scores target **7:1+**.
- The play field already maps colors (slippery `0x22eeff`, breakable `0xbbeeff`,
  moving `0x2255bb`, goal `0xfff4cc`, projectile `0x99e0ff`). UI accents stay in
  the cyan/gold/coral lane so UI never collides with platform identity colors.

---

## 4. Typography

No external fonts this step (Playables bundle discipline). Ship with a tight
system stack; the codebase currently uses `"monospace"` for HUD — we keep a
mono for **numbers** (steady width = no score jitter) and move titles/labels to
a clean sans.

```
Display / titles : "Eurostile, 'Arial Narrow', 'Segoe UI', system-ui, sans-serif"  (bold, slightly condensed, arcade-modern)
Body / labels    : "system-ui, 'Segoe UI', Roboto, sans-serif"
Numbers / HUD    : "'DejaVu Sans Mono', ui-monospace, 'Courier New', monospace"  (tabular)
```

If a custom display face is added later, evaluate bundle cost in Asset Pipeline
(woff2 subset only, Latin + digits, <30 KB). **Do not add it this step.**

| Role | Size (logical @400×700) | Weight | Treatment |
|------|--------------------------|--------|-----------|
| Screen title (GAME OVER, COMPLETE) | 34–40 | 800 | 2px dark stroke + soft drop |
| Result number (score) | 30–36 | 700 mono | tabular, gold |
| HUD score / height | 18–22 | 700 mono | tabular, 1.5px stroke |
| HUD label / chip text | 12–14 | 600 | uppercase, +4% tracking |
| Button label | 16–18 | 700 | uppercase optional |
| Hint / micro | 11–13 | 500 | text.secondary |

**Minimum readable on phone:** 11 px logical (≈ scales up via FIT). Below that,
use an icon instead of text. Always pair number changes with a 1px+ stroke so
they stay legible over bright platforms and snow.

---

## 5. Character Asset Direction

**Mini ice climber / frost runner.** Side‑profile only (game flips X for facing).
No front/back views.

- Small but characterful; **reads as a silhouette** at ~32×48 logical.
- Thick outline (1.5–2 px equivalent), blue‑white kit, small **scarf or hood**
  for personality and a motion element (scarf trails on jump/fall).
- Clean limb separation in animation — legibility over detail. No tiny facial
  rendering that muddies at small size; two‑pixel eyes max (current placeholder
  already does this well — keep that restraint).
- Faces the direction of travel via `setFlipX`; **art must be symmetric‑safe**
  (lighting baked neutral, not hard‑lit on one side) so flipping looks correct.

**Animation set (final target):** `idle, walk/run (4f), jump, fall, land,
hit/knockback, towerComplete pose`.

**Sprite sheet recommendation**
- Frame size: **48×64** logical source (current is 32×48; bump for detail room,
  display‑scaled down — gives crisper outline on retina).
- Frame count: ~10–12 total (idle 1, walk 4, jump 1, fall 1, land 1, hit 1,
  win 1–2).
- Single horizontal strip → sliced (matches current `tex.add(i, …)` approach).
- Bundle: one atlas, indexed/8‑bit PNG if possible. Until final art exists, the
  **generated‑graphics placeholder stays** — see Asset Pipeline for the swap plan.

---

## 6. Platform Visual Direction

Each type must be separable in a glance. Keep the existing hue assignments;
this is about *form language* polish, applied later via texture generation/atlas.

| Type | Form language |
|------|---------------|
| **normal** | solid ice slab, clean bevel, single top highlight |
| **slippery** | glassier sheen, cyan specular streak, subtle reflection |
| **breakable** | etched crack lines; pre‑break **flash/alpha pulse** (already implemented — keep) |
| **moving** | directional rail marks / chevrons so travel direction is readable |
| **goal** | wider, pale‑gold body, **aurora glow** + center star (matches current goal tex) |
| **snow cap** | thin soft white layer on top edge; **fade‑melt on snow end** (already implemented) |

Top‑edge rim light on every slab doubles as a landing cue.

---

## 7. Hazard Visual Direction

| Hazard | Direction |
|--------|-----------|
| **Projectile** | small fast ice core, hard outline + faint trailing glow; always paired with its edge warning so it's *telegraphed, not cheap* |
| **Hail** | bigger than a flake, ice‑stone read, single bounce → shatter shards (already implemented) |
| **Snow** | screen‑space layered flakes, mixed sizes, wind drift; softens scene, never blinds — keep flake alpha moderate |
| **Warning telegraph** | a thin player‑height marker on the incoming side; reads as a **gameplay telegraph, not a UI panel** (amber/coral, fades in <450 ms) |

The warning is the contract that makes the projectile fair — art must make it
unmissable but lightweight.

---

## 8. Environment / Background Direction (for UI Step 7)

- 2–3 parallax layers max (perf): far aurora gradient, mid tower silhouette,
  near drifting crystal motes.
- Background brightness subtly shifts with height (warmer/auroral near summit) to
  reinforce progress *without* a literal progress bar.
- All generated or single‑atlas; no large PNGs. Parallax driven by `scrollY`.

---

## 9. What "done right" looks like
- A new player understands every platform type and threat within the first
  30 m warmup, *from visuals alone*.
- The HUD is legible while snow + hail + a projectile are all on screen.
- Nothing in the UI layer ever sits on top of the player or the next platform.
