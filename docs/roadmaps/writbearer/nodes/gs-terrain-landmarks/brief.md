---
id: gs-terrain-landmarks
title: Distant landmarks
status: active
priority: should
type: feature
outline: false
milestone: gauntlets-stages
target:
from:
size: S
spike: false
verify: pnpm vitest run test/render/landmarks.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/render/landmarks.ts
  - test/render/landmarks.test.ts
shared:
  - src/render/renderer.ts
  - src/render/effects.ts
  - src/render/draw/glow.ts
reserves: []
provides: []
depends_on:
  - on: split-renderer
    kind: hard
    why: moves renderer.ts features into modules under src/render/draw/; this node edits the moved code
---

# Distant landmarks

## Goal

Beyond each exit the party sees what lies ahead from afar: smoke for a Camp, lights for a Town, a red glow for an Elite and so on, drawn above the fog from the exit's `ahead` kind.

## Context

- The next area is not generated until the party nears it, so landmarks come from `exit.ahead` only.
- Pattern: the captain's pennant that shows in the dark (`drawGlow` in `src/render/draw/glow.ts`).
- Source: `docs/design/11-stages.md#seamless-connections`.
- Code layout: `src/render/renderer.ts` only gets the call line in `render()`. Signposts are drawn by `drawSigns` in `src/render/draw/exits.ts`; read it for the exit pattern.

## Acceptance

- [ ] A pure mapping covers every `Ahead` kind that exists.
- [ ] Fast check passes.

## Sizing

A mapping and a draw call. S.

## Notes for the worker

- An Ambush looks like what it pretends to be; never leak the objective or monster count.
- No Shrine glow until gs-node-kinds adds Shrines.
