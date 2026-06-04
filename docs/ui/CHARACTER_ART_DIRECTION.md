# IcyTower — Character Art Direction (UI Step 8A)

> Scope: visual + readability direction for the **final hero character** of the
> first tower (Ice Tower). **No code, no asset files this step.** This is the
> brief the sprite sheet in Step 8B is authored against. Extends
> `UI_ART_DIRECTION.md §5` with production-ready detail.

---

## 1. North Star

**Mini ice climber / frost runner.** A small, agile, competitive winter athlete
scaling a frozen tower — *premium arcade*, never childish, never grimdark.

One line: *reads as a confident silhouette at 32×48 on a phone, with just enough
personality (hood + scarf) to feel like a character, not a token.*

| Keep | Avoid |
|------|-------|
| nimble, light, fast | bulky, heavy, slow |
| frost athlete, glacier kit | medieval knight / generic hero |
| cute‑but‑competitive | kiddie mascot / chibi baby |
| crisp readable silhouette | busy detail that muddies small |
| neutral side lighting | hard one‑side shading (breaks on flip) |

---

## 2. Orientation rule (hard constraint)

- **Side profile only.** The character faces screen‑left or screen‑right.
- **No front view, no back view, no ¾, no perspective.** The game mirrors the
  art with `setFlipX` to change facing, so the sheet is authored facing **one
  direction only** (author facing **right**; engine flips for left).
- Because of the flip, **lighting must be side‑neutral** (soft top key, no strong
  left‑or‑right rim). A face baked bright on one cheek looks wrong when mirrored.

---

## 3. Form & costume

- **Proportions:** ~2.5–3 heads tall, slightly stylised (bigger head/hands for
  readability), athletic not chunky. Clear limb separation for animation.
- **Head:** small hood **or** beanie; minimal face — **two‑pixel eyes max**, no
  detailed mouth/nose (mud at small size). The current placeholder’s restraint
  (two white eye dots) is the target, not a regression.
- **Scarf:** short scarf is the signature motion element — it flutters on
  idle/jump/fall and sells speed. Keep it short so it never dominates the
  silhouette.
- **Hands/feet:** gloves and boots **read as distinct blocks** — they’re the
  limbs the eye tracks during the run cycle.
- **Ice tool:** optional tiny pick/axe **only if it never enlarges the
  silhouette** or reads as a weapon. Default: omit it; the climb is implied.

---

## 4. Color & lighting

| Role | Token / hue | Notes |
|------|-------------|-------|
| Kit base | glacier blue → deep navy | `~0x2277cc`→`0x1a5599` family (matches current) |
| Highlight | frost white / ice cyan | `0xf4fbff` / `0x48d5ff`, top edge catch |
| Accent | aurora purple **or** gold scarf detail | one small accent, used sparingly |
| Outline | deep navy | `~0x071027`, thick + consistent |
| Hit accent | coral | `0xff5d6c`, **only** on the hit frame, subtle |

Rules:
- **Thick, consistent outline** (≈1.5–2 px equivalent at source scale) — the
  silhouette is the brand.
- **Limited palette** (≈5–6 colors + outline). Small palette = crisp, tiny PNG,
  easy flip.
- **Side‑neutral light:** soft cool key from top; no hard directional rim.
- Glow is **not** a character property — energy/glow lives in FX, not baked art.

---

## 5. In‑game readability (must pass)

The play field is busy: platforms, snow, hail, projectiles, parallax backdrop.
The character must stay the clearest thing on screen.

- **Separates from platforms:** the kit’s navy/cyan must not match the slippery
  (`0x22eeff`) / breakable (`0xbbeeff`) / moving (`0x2255bb`) platform hues — use
  the outline + frost‑white highlight to pop off them.
- **Survives Snow Time / hail:** keep enough white highlight + dark outline
  contrast that a snowstorm (screen‑space flakes, depth 120) never dissolves the
  body. Don’t make the whole character pale.
- **Reads over the parallax backdrop** (deep navy + faint aurora, depths −100…−70):
  the dark outline guarantees contrast against the light aurora bands.
- **Flip‑safe:** mirrored art must look identical in quality — verify both
  facings during QA.
- **No overflow:** every pose stays inside the 48×64 frame with ≥2 px breathing
  room; feet sit on a shared baseline (see `CHARACTER_SPRITE_SPEC.md`).

---

## 6. Personality through motion (animation intent)

The static art is restrained; the *life* comes from the animation set:

- **idle** — subtle breathe + scarf flutter (alive, not statue).
- **walk/run** — energetic, leaning‑forward sprint; the signature of "fast climb".
- **jump** — body stretched, arms up, scarf trailing down.
- **fall** — arms out, scarf up, a readable "falling" read (not just jump inverted).
- **land** — squash/anticipation (pairs with the existing landing squash tween).
- **hit** — tilted back from a projectile knock; impact pose, **no gore/wound**.
- **win** — small victory beat (one arm raised / scarf flutter) for TowerComplete.

Full frame list + timings: `CHARACTER_SPRITE_SPEC.md §4`.
