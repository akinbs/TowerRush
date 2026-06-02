# IcyTower — Claude Code Talimatları

## Proje özeti
Phaser 3.88 + TypeScript 5.4 + Vite 5.4 ile yapılmış dikey platform arcade oyunu.
YouTube Playables hedefi: harici istek yok, harici font yok, tek self-contained bundle.

## Build & Dev

```bash
npm run dev        # localhost:3000
npm run build      # tsc --noEmit && vite build → dist/
npm run typecheck  # tsc --noEmit
```

## Mimari kurallar

- **Magic number yasak** — her sayısal sabit `src/game/utils/constants.ts` veya ilgili config dosyasına gider.
- **UI config** — renk, boyut, depth, alpha değerleri `src/game/config/uiConfig.ts` içindedir.
- **Modüller:** entity, system, manager, scene, config, type katmanları birbirini aşamaz (ör. Manager → Scene import edemez).
- **TypeScript strict** — `noUnusedLocals`, `noUnusedParameters` açık; her unused import derlemeyi kırar.
- **Single bundle** — `vite.config.ts`'de `manualChunks: undefined` kalmalı, harici CDN linki eklenmemeli.

## Klasör yapısı

```
src/game/
  config/      — gameConfig, physicsConfig, towerConfig, platformGenerationConfig, uiConfig
  entities/    — Player, Platform
  managers/    — PlatformManager
  scenes/      — BootScene, PreloadScene, GameScene
  systems/     — InputController, MobileControls, CameraController,
                 HudController, ScoreController,
                 FallDeathController, GameOverController
  types/       — gameTypes
  utils/       — constants
```

## Önemli sabitler (constants.ts)

| Sabit | Değer | Açıklama |
|-------|-------|----------|
| `WORLD_HEIGHT` | 20000 | Toplam dünya yüksekliği (px) |
| `GROUND_SURFACE_Y` | 19976 | Zemin üst yüzeyi (Y=0m referansı) |
| `PIXELS_PER_METER` | 40 | px → metre dönüşümü |
| `COYOTE_TIME_MS` | 100 | Platform kenarı sonrası geçerli zıplama süresi |
| `JUMP_BUFFER_MS` | 120 | İniş öncesi zıplama kuyruğu |
| `CAMERA_UP_LERP` | 0.10 | Yukarı kamera lerp katsayısı |
| `CAMERA_DOWN_LERP` | 0.28 | Düşüş sırasında hızlı kamera lerp |
| `FALL_DEATH_DISTANCE_METERS` | 10 | Ölüm için en yüksek noktadan düşüş mesafesi |

## GameState machine

```
"playing" ──pause──▶ "paused" ──pause──▶ "playing"
"playing" ──death──▶ "gameOver" ──restart──▶ (scene.restart)
```

Pause yalnızca `"playing"` ↔ `"paused"` arasında geçer. GameOver'dan çıkış yalnızca restart ile olur.

## Resize listener kuralı

`scene.scale.on("resize", handler)` çağrısı yapan her sınıf:
1. Handler referansını field olarak saklar.
2. `destroy()` içinde `scene.scale.off("resize", handler)` çağırır.
3. GameScene `SHUTDOWN` eventinde tüm controller'ların `destroy()`'unu çağırır.

## Adım durumu

- **Adım 1** ✅ Phaser + TS + Vite iskeleti
- **Adım 2** ✅ Procedural platform üretimi, coyote time, jump buffer
- **Adım 3** ✅ Mobil kontroller, HUD, ScoreController, Pause
- **Adım 4** ✅ Düşüş kamerası, ölüm sistemi, GameOver overlay, restart akışı
- **Adım 5** — Sprite/animasyon, ses, tower phase geçişi, YouTube Playables SDK

## YouTube Playables notları

- `index.html` içindeki SDK TODO yorumlarına bak.
- `GameScene.create()` sonunda `ytgame.game.gameReady()` çağrılacak.
- Hiçbir zaman `fetch`, `XMLHttpRequest` veya harici `<script src>` ekleme.
