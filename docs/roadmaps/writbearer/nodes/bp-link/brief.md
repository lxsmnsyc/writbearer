---
id: bp-link
title: Linked units
status: todo
priority: should
type: feature
outline: false
milestone: bestiary
target:
from:
size: S
spike: false
verify: pnpm vitest run test/sim/link.test.ts && pnpm vitest run test/sim/affixes.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/sim/link.ts
  - test/sim/link.test.ts
shared:
  - src/content/affixes.ts
  - src/sim/events.ts
reserves: []
provides: []
depends_on:
  - on: be-affixes
    kind: hard
    why: both edit affixes.ts
---

# Linked units

## Goal

A link group: units that share hits (extracted from `Affixes.bind` and `share`), must all fall within a window or the fallen rise, heal each other, and can swap places. `Affixes.bind` stays as a thin wrapper.

## Context

- Base: `Affixes.bind`/`share` in `src/content/affixes.ts` (~216-268) passes split hits on as True damage with the `Redirected` flag.
- Source: `docs/design/13-bestiary.md#the-drowned-undercroft` (Drowned Choir).

## Acceptance

- [ ] Shared damage works as the affixes test expects.
- [ ] One dies and the rest outlive the window: the dead rise; all fall inside it: they stay dead.
- [ ] Swap works; no hit loops.
- [ ] Fast check passes.

## Sizing

One small module and a wrapper. S.

## Notes for the worker

- Redirected hits must not trigger Thorns, Storm or on-hit passives.
- A redirect that kills gives one death event per unit.
