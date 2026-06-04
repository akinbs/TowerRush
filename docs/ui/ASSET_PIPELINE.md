# IcyTower — Asset Pipeline Plan

> How art gets from concept to a single Playables bundle without blowing the
> size budget. No assets are added this step.

---

## 1. Hard constraints (YouTube Playables)

- **Single self‑contained bundle.** `vite.config.ts` keeps `manualChunks:
  undefined`; no CDN, no `fetch`, no external `<script src>`, no external fonts.
- **Size:** **< 30 MiB mandatory**, **< 15 MiB target**. The whole game today is
  ~1.5 MB JS + zero image assets (all textures are generated at runtime in
  `PreloadScene`). That headroom is a feature — spend it deliberately.
- **No DOM UI, no network.** Everything renders via Phaser GameObjects.
- Prefer **runtime‑generated textures** (current approach) until hand art is
  truly needed; they cost ~0 bundle bytes.

---

## 2. Phased plan

### Phase 1 — System & generated graphics (UI Steps 2–5)
- UI from primitives: rounded rects, circles, lines, text, tweens (no images).
- Implement design tokens (extend `uiConfig.ts`), components, screens.
- Icons: start **generated** (Graphics) or one tiny atlas if generation gets
  unwieldy. Keep them monochrome + tint.
- **Outcome:** full UI, still ~0 image bytes.

### Phase 2 — Hand art where it pays off (UI Steps 6–8)
- **Character sprite sheet** — the highest‑value art upgrade. One horizontal
  strip → sliced (matches current `TEX_PLAYER` flow). 48×64 frames, ~10–12 frames.
- **Platform atlas** — normal/slippery/breakable/moving/goal surfaces, if the
  generated look is outgrown. One atlas, power‑of‑two, trimmed.
- **Hazard sprites** — projectile, hail (per‑radius like current generated set),
  shatter shards. Small, can stay generated if quality holds.
- **UI icon atlas** — only if the generated icon set needs more finesse.

### Phase 3 — Environment & polish (UI Step 7+)
- Parallax background layers (aurora / tower silhouette / motes) — generated
  gradients + a small atlas, **2–3 layers max**.
- Polish particles — reuse `FxController` patterns; no new particle JSON.
- **Compression pass:** quantize PNGs (pngquant/oxipng), strip metadata, verify
  bundle still < target.

---

## 3. Atlas strategy

- One atlas per category (character, platforms, hazards, icons) — not one mega
  atlas (keeps texture swaps and edits sane).
- Power‑of‑two, trimmed, 1–2 px padding to avoid bleeding.
- 8‑bit/indexed PNG where palette allows (the ice palette is small → big wins).
- Generated textures and atlases can coexist; swap one category at a time so the
  game stays runnable throughout (no big‑bang art drop).

---

## 4. Placeholder → final swap plan

The codebase already isolates art behind texture keys (`TEX_PLAYER`,
`TEX_PLATFORM*`, `TEX_PROJECTILE`, `hailstone-${r}`) generated in `PreloadScene`.
That indirection is the swap seam:

1. Author final atlas offline.
2. In `PreloadScene`, replace the matching `generate*Texture()` with a load (or
   embed) under the **same key** — no gameplay/system code changes.
3. Keep frame sizes/slicing identical so `AnimationController` and body sizes
   (`setCircle`, `setDisplaySize`) need no edits.
4. Verify per‑swap: visual parity, body alignment, bundle size, build green.

This lets art land incrementally without touching managers, entities, or scenes.

---

## 5. Fonts

- Default: **no external font** (system stack from `UI_ART_DIRECTION.md §4`).
- If a display face is later deemed worth it: woff2, **subset to Latin + digits +
  punctuation**, target < 30 KB, embed in bundle, measure before/after. Mono for
  numbers stays system to guarantee tabular width with zero bytes.

---

## 6. Budgets (working targets)

| Category | Target | Notes |
|----------|--------|-------|
| JS bundle | keep ≲ 2 MB | currently ~1.5 MB |
| Character atlas | < 256 KB | indexed PNG |
| Platform atlas | < 256 KB | or stay generated |
| Hazard sprites | < 96 KB | or stay generated |
| Icon atlas | < 64 KB | or stay generated |
| Background layers | < 512 KB | generated gradients preferred |
| Optional font | < 30 KB | subset woff2 |
| **Total** | **< 15 MiB** | mandatory ceiling 30 MiB |

Every art addition is justified against "could a generated texture do this?" —
if yes, prefer generated.

---

## 7. Tooling / workflow notes
- Keep art sources (`.aseprite`/`.fig`) **outside** the bundle (e.g. `art/` or
  external), only export optimized atlases into `src`/`public`.
- Automate a size check in CI/build later (warn if bundle > target).
- One PR per asset category swap, each independently revertible.
