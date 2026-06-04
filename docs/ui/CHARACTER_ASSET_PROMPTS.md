# IcyTower — Character Asset Generation Prompt Pack (UI Step 8A)

> Ready‑to‑paste prompts for generating the final character sprite sheet. Three
> style variants share one **format + frame + negative** contract. Pick a
> variant, generate, then validate against `CHARACTER_SPRITE_SPEC.md §6`.
>
> Reality note: most image generators do **not** reliably output a pixel‑exact
> 12‑cell strip with a shared baseline. Treat these as **frame/pose references**;
> expect to composite, re‑align to the 48×64 grid, fix the feet baseline, and
> clean edges in an editor before export. The spec — not the generator — is the
> source of truth.

---

## Shared contract (include in every prompt)

```
Single horizontal sprite sheet, 12 frames in one row, 48x64 px per frame
(576x64 total), fully transparent background. A small "ice climber / frost
runner" 2D game character, SIDE PROFILE ONLY, facing right. Consistent character
proportions and a consistent feet baseline across all 12 frames (feet on the same
bottom line). Thick dark-navy outline, limited cool palette: glacier blue and
deep navy kit, frost-white / ice-cyan highlights, one small gold-or-aurora scarf
accent. Small hood or beanie, short fluttering scarf, distinct gloves and boots,
minimal face (two dot eyes). Clean, readable mobile-game silhouette; neutral
top lighting (not hard-lit on one side, so horizontal mirroring looks correct).

Frame order, left to right:
0 idle (neutral stand), 1 idle (subtle breathe),
2 walk contact, 3 walk passing, 4 walk contact (opposite), 5 walk passing,
6 jump (stretched up, arms raised, scarf trailing down),
7 fall (arms out, scarf up),
8 land (squat / squash, knees bent),
9 hit (knocked back, tilted, faint coral impact, no wound),
10 win (victory, arm rising), 11 win (victory peak / scarf flutter).
```

---

## Prompt A — Clean premium 2D

```
[Shared contract above]

STYLE: clean premium 2D vector-ish game art, smooth flat shading with one soft
highlight band, crisp anti-aliased thick outline, no texture noise. Polished
arcade mobile look, frozen-tower athlete. High contrast so the character pops
off a busy snowy background. Cohesive cool ice palette, single warm scarf accent.
```

## Prompt B — Modern pixel‑inspired

```
[Shared contract above]

STYLE: modern pixel-art-inspired but clean (not retro-noisy) — chunky readable
forms, 2px outline, limited indexed palette (~6 colors), subtle dithered
highlight only on the kit. Crisp at small size, no sub-pixel blur. Arcade ice
climber. Each 48x64 cell hand-aligned to a shared feet baseline.
```

## Prompt C — Soft vector mobile

```
[Shared contract above]

STYLE: soft rounded vector mobile-game character, gentle gradients within a
limited cool palette, friendly-but-competitive frost runner, bold clean outline,
slightly oversized head and hands for readability at small scale. Smooth scarf
curves that flutter across the idle/jump/fall frames. No gritty texture.
```

---

## Negative prompt (paste into every generation)

```
front view, front-facing, back view, back-facing, three-quarter view, turntable,
rotating, perspective camera, 3D render, isometric, top-down,
multiple characters, character sheet with face/expression studies,
random extra poses not in the listed frame order, inconsistent proportions,
inconsistent height or baseline, feet at different heights,
opaque background, solid color background, scene background, ground, platform,
drop shadow outside the body, baked floor shadow,
blurry edges, soft mushy outline, heavy glow, neon bloom,
large weapon, big axe, sword, gun dominating the silhouette,
gore, blood, injury, wound,
text, labels, frame numbers, captions, watermark, signature, logo, UI, grid lines.
```

---

## Post‑generation alignment notes (Aşama 1 → handoff)

1. Composite/cut the 12 poses onto a **576×64** canvas, one per 48‑wide cell.
2. Snap every pose so **feet land on y ≈ 62**; center on x ≈ 24 per cell.
3. Verify facing **right**; mirror‑test (`flip horizontal`) each frame for
   lighting symmetry.
4. Flatten to transparent PNG, **indexed** if the palette allows; strip metadata.
5. Run the `CHARACTER_SPRITE_SPEC.md §6` checklist before handing to Step 8B.
