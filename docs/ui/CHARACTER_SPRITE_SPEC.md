# IcyTower — Character Sprite Sheet Technical Spec (UI Step 8A)

> The exact, build‑against technical contract for the final character sheet.
> **No code/assets this step.** Step 8B integrates a sheet that satisfies this.

---

## 1. Current pipeline (ground truth — do not break in 8B)

| Fact | Value (verified in code) |
|------|--------------------------|
| Texture key | `TEX_PLAYER = "player"` (`constants.ts`) |
| Placeholder frame | **32×48** (`PLAYER_WIDTH`=32, `PLAYER_HEIGHT`=48) |
| Placeholder frames | **7** (`PLAYER_FRAME_COUNT`): `0 idle · 1–4 walk · 5 jump · 6 fall` |
| Generation | `PreloadScene.createPlayerSpritesheet()` draws + `generateTexture` |
| Slicing | `tex.add(i, 0, i*PLAYER_WIDTH, 0, PLAYER_WIDTH, PLAYER_HEIGHT)` |
| Anim registration | `AnimationController.register()` → `generateFrameNumbers(key,{frames})` |
| Anim defs | `animationConfig.ts › PLAYER_ANIM_DEFS` (idle/walk/jump/fall) |
| Sprite origin | **0.5, 0.5** (Arcade sprite default; never re‑set) |
| Display | `setDisplaySize(32, 48)` |
| Physics body | `body.setSize(32, 48)` (full frame today) |
| Squash baseline | `baseScaleX/Y` captured from the display scale |
| Menu preview | `MainMenuScene` sprite, origin **0.5, 1**, `setScale(1.7)` |

> Only **idle / walk / jump / fall** animations exist today. `land` is currently
> a squash **tween** (no land frame); `hit` / `win` have no frames yet.

---

## 2. Target sheet format

| Property | Value |
|----------|-------|
| Frame size | **48 × 64 px** (upscaled from 32×48 for outline room; display‑scaled down) |
| Layout | **single horizontal strip** (matches `tex.add` x‑offset slicing) |
| Frame count | **12** |
| Total sheet | **576 × 64 px** (12 × 48 wide, 64 tall) |
| Background | **fully transparent** (alpha 0) |
| Format | **PNG**, 8‑bit/indexed if palette allows (it does — small ice palette) |
| Color profile | sRGB, no embedded ICC bloat |
| Trim/padding | character **centered horizontally** in each 48‑wide cell; **no** inter‑frame gutter (strip is contiguous, cell = 48 px exactly) |

Style may be **clean 2D / soft‑vector / lightly pixel‑inspired** — see the three
prompt variants in `CHARACTER_ASSET_PROMPTS.md`. Whatever the style, the format
above is fixed so slicing math is unchanged.

---

## 3. Alignment contract (critical for integration)

- **Shared feet baseline:** in *every* frame the feet rest on the **same y line**,
  recommended **y ≈ 62** (2 px breathing room above the 64 px bottom edge).
- **Vertical fill:** head near **y ≈ 2–6**, feet at the baseline — the character
  fills the frame so it doesn’t look tiny after display‑scaling.
- **Horizontal center:** character centered on the cell’s x‑midline (x ≈ 24),
  shifting only as a pose needs (a lunging run frame may lean forward a few px).
- **Facing:** authored facing **right**. The engine uses `setFlipX` for left.
- **Why baseline matters:** the menu preview uses origin **(0.5, 1)** (feet) and
  the gameplay squash scales around origin **(0.5, 0.5)** — a consistent feet
  baseline keeps the character planted on platforms in both, with no per‑frame
  "foot bounce".

---

## 4. Frame order & animation plan (12‑frame, recommended)

| Idx | Name | Anim | Pose intent |
|----:|------|------|-------------|
| 0 | `idle_0` | idle | neutral stand, scarf settled |
| 1 | `idle_1` | idle | subtle breathe up / scarf lifted |
| 2 | `walk_0` | walk | contact, lead leg forward |
| 3 | `walk_1` | walk | passing, body rising |
| 4 | `walk_2` | walk | contact, opposite leg |
| 5 | `walk_3` | walk | passing, body rising |
| 6 | `jump` | jump | stretched up, arms raised, scarf trailing down |
| 7 | `fall` | fall | arms out, scarf up, clear "falling" read |
| 8 | `land` | land | squat / squash, knees bent |
| 9 | `hit` | hit | tilted back, knockback impact (coral accent, no wound) |
| 10 | `win_0` | win | victory, one arm starting up |
| 11 | `win_1` | win | victory peak / scarf flutter |

**Animation mapping (target for 8B `PLAYER_ANIM_DEFS`):**

| Anim key | frames | frameRate | repeat |
|----------|--------|----------:|-------:|
| `player-idle` | `[0,1]` | 3–4 | −1 |
| `player-walk` | `[2,3,4,5]` | 10–12 | −1 |
| `player-jump` | `[6]` | 1 | 0 |
| `player-fall` | `[7]` | 1 | 0 |
| `player-land`* | `[8]` | 1 | 0 |
| `player-hit`*  | `[9]` | 1 | 0 |
| `player-win`*  | `[10,11]` | 5–6 | −1 (or 0, hold last) |

\* New keys — additive in 8B. idle/walk/jump/fall **keep their existing keys**
so nothing that references them breaks.

### Fallback: 8‑frame minimal sheet
If a smaller sheet is preferred: `0 idle · 1 walk_0 · 2 walk_1 · 3 walk_2 ·
4 jump · 5 fall · 6 hit · 7 win`. **Final recommendation is the 12‑frame sheet**;
the 8‑frame is a budget fallback only.

---

## 5. Export rules

- Transparent PNG, **exactly 576 × 64**, 12 contiguous 48×64 cells.
- **No** baked drop shadow outside the body, **no** background fill, **no** text,
  labels, frame numbers, grid lines, or watermark.
- No glow bloom bleeding across cell borders (would smear into neighbours when
  sliced).
- Keep art sources (`.aseprite`/`.psd`) **out** of the bundle; export only the
  optimized PNG into the repo (see `CHARACTER_INTEGRATION_PLAN.md`).

---

## 6. QA checklist (sign‑off before 8B)

- [ ] PNG is transparent (no opaque/solid background).
- [ ] Exactly **12** frames present, in the order of §4.
- [ ] Every frame is **48 × 64**.
- [ ] Total sheet is **576 × 64** (no stray padding/gutter).
- [ ] Feet sit on the **same baseline** (y ≈ 62) in all 12 frames.
- [ ] Character is **side profile**, facing **right**, in every frame.
- [ ] `setFlipX` mirror looks correct — no one‑side‑lit weirdness.
- [ ] walk loop `2→3→4→5→2` cycles smoothly (no popping/limb swap glitch).
- [ ] jump (6) and fall (7) are **distinct** and individually readable.
- [ ] hit (9) reads as knockback (tilt back), no gore/wound.
- [ ] win (10,11) reads as a victory pose, suitable for TowerComplete.
- [ ] Silhouette is legible at on‑screen size (~32×48 displayed) on a phone.
- [ ] Body stays visible over snow/hail and the parallax backdrop.
- [ ] PNG file size **< 256 KB** (target **< 128 KB**); indexed if possible.
- [ ] No text/watermark/shadow outside frames.
