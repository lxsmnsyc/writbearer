---
name: concealment
version: 1
status: draft
defined_by: hidden-units
---

# Contract: concealment

## Purpose

Hidden and disguised units. A hidden unit cannot be noticed or targeted by the other side until revealed. A disguised unit is drawn and listed as another kind until revealed. Used by warden-watchman (Sentry, Read the Room) and later by bestiary (stalkers, Skulker) and the Lamplighter.

## Interface

```ts
// src/sim/unit.ts
hidden: boolean; // false by default
disguise: string | null; // kind it is drawn and listed as, or null

// src/sim/concealment.ts
export function reveal(u: Unit, by: Unit | null): void; // clears hidden and disguise, runs the unit's onReveal, emits UnitRevealed

// src/sim/events.ts
SimEvents.UnitRevealed = 'UnitRevealed' // { source: Unit (the revealed unit), by: Unit | null }, same priority type as UnitDies
```

## Behavior

- Hidden units are forbidden through `CheckTarget` (targeting contract) and skipped by noticing.
- A hidden unit is revealed when it strikes (`strike` in `src/sim/sim.ts`), when area damage hits it, or by `reveal`.
- The disguised assassin starts as an escorted refugee: `Side.Ward`, `disguise: 'refugee'`, walking with the others. When revealed, or when it strikes first, it becomes `Side.Monster` with `Hunt.Assassin`. Before that, monsters treat it as any refugee.
- The renderer does not draw hidden enemies and draws a disguised unit as its `disguise` kind (`src/render/view.ts`).

## Stub

`hidden` false, `disguise` null, `reveal` only emits UnitRevealed. warden-watchman builds against it with a test-only hidden monster.

## Contract tests

- `test/sim/concealment.test.ts`: mercs ignore a hidden monster; it is revealed when it strikes; `reveal` makes it targetable and emits UnitRevealed; a revealed assassin turns on the bearer.

## Changes

- v1: initial.
