# IcyTower — Character Integration Plan (UI Step 8A → 8B)

> The wiring plan for swapping the placeholder character for the final sheet.
> **8A (this step): docs only — no code.** 8B executes the steps below once a
> sheet that passes `CHARACTER_SPRITE_SPEC.md §6` exists.

---

## Two‑stage strategy

- **Stage 1 (now, 8A):** author the sprite sheet from `CHARACTER_ASSET_PROMPTS.md`,
  align it to the spec, pass the QA checklist. Produces one PNG.
- **Stage 2 (8B):** integrate the PNG behind the existing `TEX_PLAYER` seam,
  extend animations, retune the body, verify build. No gameplay/camera/control
  changes.

Do **not** integrate during 8A.

---

## The swap seam (why this is low‑risk)

Art is already isolated behind a texture key. The whole game references the
player only via `TEX_PLAYER = "player"` and frame **indices**, so swapping the
texture source — generated → loaded PNG — touches `PreloadScene` and
`animationConfig` only. Managers, `Player`, camera, input, collisions reference
indices/keys, not pixels.

---

## 8B work items

### 1. Add the asset
- Path: `src/game/assets/character/icy_climber_sheet.png` (576×64, per spec).
- **Single‑bundle constraint:** YouTube Playables needs one self‑contained
  bundle. Import the PNG through Vite (`import sheetUrl from ".../icy_climber_sheet.png"`)
  and ensure it is **inlined** (base64) into the JS — either raise
  `build.assetsInlineLimit` in `vite.config.ts` to cover ~128–256 KB or use an
  explicit `?inline` import. Confirm no separate asset request appears in the
  network panel (must be zero network).

### 2. `PreloadScene` — load, keep generated as fallback
- Replace the call site of `createPlayerSpritesheet()` with a real load:
  `this.load.spritesheet(TEX_PLAYER, sheetUrl, { frameWidth: 48, frameHeight: 64 })`.
- **Keep `createPlayerSpritesheet()` as a fallback**: register a
  `this.load.once("loaderror", …)` (or a guard when the import is absent) that
  regenerates the placeholder under the same key so the game never ships
  characterless.
- The existing `if (this.textures.exists(TEX_PLAYER)) return;` idempotency guard
  pattern carries over for restarts.

### 3. Frame count & constants
- Update `PLAYER_FRAME_COUNT` 7 → **12** and the layout comment.
- **Extend the generated fallback to 12 frames** in the same order as the final
  sheet, so both the loaded and fallback paths share one animation mapping (avoids
  "anim references frame 9 that the 7‑frame fallback lacks"). If the fallback is
  left at 7, gate the new anims (land/hit/win, 2‑frame idle, 4‑frame walk) behind
  a frame‑count check instead.

### 4. `animationConfig.ts` — extend `PLAYER_ANIM_DEFS` (additive)
- **Keep existing keys** (`player-idle/walk/jump/fall`) — retune frames:
  - idle `[0,1]` @3–4, walk `[2,3,4,5]` @10–12, jump `[6]`, fall `[7]`.
- **Add** `player-land [8]`, `player-hit [9]`, `player-win [10,11]` (new constant
  keys in `constants.ts`). `AnimationController.register()` already loops the defs
  and skips existing keys — **no AnimationController code change needed**.
- Whoever selects anims (the Player/anim‑select logic) may optionally start using
  `player-land`/`player-hit`; if not wired, the existing squash tween + idle/fall
  still work — **fallback behaviour preserved**.

### 5. `Player` — body & display retune (the main risk)
Today: `setDisplaySize(32,48)` and `body.setSize(32,48)` (full placeholder frame).
The 48×64 final frame has **transparent padding around the character**, so:
- **Do not** set the body to the full 48×64 — it would be far too loose.
- Measure the character’s trimmed silhouette in source px (≈ 28×56 expected),
  then `body.setSize(silhouetteW, silhouetteH)` + `body.setOffset(...)` to keep
  feet on the platform and the hitbox matching the visible body.
- Choose `setDisplaySize` so the **character** (not the frame) renders at roughly
  today’s on‑screen size — keep gameplay feel identical. Re‑capture
  `baseScaleX/baseScaleY` from the new display scale (squash tween relies on it).
- Verify: standing on platforms, edge/coyote behaviour, slippery/moving carry,
  projectile/hail knockback alignment — all unchanged. **Tune body, not physics
  constants.**

### 6. `MainMenuScene` preview
- The preview sprite uses `TEX_PLAYER` frame `0` automatically → picks up new art.
- Re‑check `setScale(1.7)` and origin `(0.5, 1)` with the 48×64 frame; likely
  reduce the scale so the preview matches the menu composition.

### 7. Optional — wire `player-win`
- TowerComplete may later play `player-win` on the player sprite for a victory
  beat. Optional in 8B; the result card already celebrates.

---

## Validation (8B exit criteria)

- [ ] `npm run typecheck` clean.
- [ ] `npm run build` clean; **measure bundle delta** (PNG inlined, target keeps
      JS ≲ 2 MB, sheet < 256 KB).
- [ ] **Zero** new network requests (asset inlined — Playables rule).
- [ ] Character renders with the new art in‑game and in the menu preview.
- [ ] idle/walk/jump/fall play correctly; new land/hit/win available.
- [ ] `setFlipX` left/right both correct.
- [ ] Body/collision feel identical to before (no float, no early/late landings).
- [ ] Fallback generated sheet still loads if the asset is removed.
- [ ] Readable over platforms, snow/hail, and the parallax backdrop.

---

## Files 8B will touch (preview)

| File | Change |
|------|--------|
| `vite.config.ts` | asset inline limit (single‑bundle) |
| `src/game/assets/character/icy_climber_sheet.png` | **new** asset |
| `scenes/PreloadScene.ts` | load sheet + keep generated fallback |
| `utils/constants.ts` | `PLAYER_FRAME_COUNT`→12, new anim keys |
| `config/animationConfig.ts` | extend `PLAYER_ANIM_DEFS` |
| `entities/Player.ts` | body `setSize`/`setOffset`, display scale, baseScale |
| `scenes/MainMenuScene.ts` | preview scale check (likely) |

`AnimationController.ts`, managers, camera, input, gameplay configs: **untouched**.
