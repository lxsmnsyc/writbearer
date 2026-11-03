# Log: split-renderer

- Reset to main (634d4ea), branch refactor/split-renderer. No `src/render/draw/` existed: the work was not done before.
- Baseline fast check: typecheck and lint pass; `pnpm test` had 2 to 6 timeouts (5 s limit) in heavy sim tests (rng, boss, bosses, flow, spawn, fields) under load from the parallel worktrees. None touch the renderer.
- renderer.ts before: 2,156 lines.
- Seams picked from the eight downstream briefs: a props table (braziers need light and flame per kind), a hazards table (terrain-hazards), the light and sight numbers in one module (lantern), the standing sort list (height-view), `seen()` with the figures (hidden-units), exits and signs (landmarks), the collapse with the objectives (bp-ground).
- Moved every feature into `src/render/draw/` (16 modules plus `props/`). Prop kinds now go through `PROP_LOOKS` (shape, light, flame), and hazards through `HAZARD_LOOKS`. renderer.ts after: 366 lines.
- Lint wants default exports in single-export files: glow, bars, embers, quarry, hud and the prop group files use them.
- Comparing two dev servers in real time was too noisy (the camera drifted). Switched to drawing one captured Frame with both Renderers in the same page (a temporary copy of main's renderer, deleted afterwards): 0 differing pixels in 15 scenes; a 1.6 to 1.7 candle-radius mutation gave 10,964.
- Final: typecheck, lint and test (436 passed) pass, and the build succeeds.
