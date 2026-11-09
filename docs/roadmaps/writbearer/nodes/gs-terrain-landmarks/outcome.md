# Outcome: gs-terrain-landmarks

## Built

`src/render/landmarks.ts`: `LANDMARKS` maps every `Ahead` kind to a landmark (or none), `landmarkOf(ahead)` reads it, and the default export `drawLandmarks(scene, frame)` draws it 10 tiles past each open exit (not `closed`, not `taken`), after the dark, so it shows through the fog. Not gated by fog, since the area ahead does not exist yet.

- camp: smoke column over a spark; town: window lights; elite: breathing red glow; event: teal flicker; boss: rising red embers; combat and down: nothing.
- Input is `exit.ahead` only. The objective, monster count and reward are never read, so an Ambush (whose `ahead` is what it pretends to be) shows that look and leaks nothing. No Shrine landmark (gs-node-kinds adds Shrines).
- `renderer.ts`: one import and one call, `drawLandmarks(scene, f)`, after `drawGlow`.
- Test `test/render/landmarks.test.ts`: every `Ahead` kind is mapped, camp/town/elite looks, combat/down show nothing.
- Changeset `.changeset/gs-terrain-landmarks.md` (minor).

## Deviations

- Placed in `src/render/landmarks.ts` (owned path) and not under `draw/`; `renderer.ts` (shared) gets the two lines. `draw/glow.ts` and `effects.ts` untouched.

## Stubs left

- None.

## Gotchas

- Drawing was not checked in a browser (no e2e run); only typecheck, lint and tests.
- Distance 10 tiles and the shapes are first guesses (`LANDMARK_DISTANCE`).

## Verification

- `pnpm typecheck && rtk proxy pnpm lint && pnpm test`: pass (93 files, 873 tests).

## Size

- Estimated S, actual S.

Landed as 21c0a67 on batch/writbearer.
