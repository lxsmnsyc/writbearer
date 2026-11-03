# Outcome: hidden-units

## Built

- `src/sim/concealment.ts`: `reveal(u, by)` clears `hidden` and `disguise`, runs `onReveal` and emits `UnitRevealed`; it does nothing if the unit is neither. `setupConcealment(sim)` is called from `src/sim/mechanics/index.ts`. Its listeners: `CheckTarget` (Post) forbids a hidden target; `UnitDamage` (Post) reveals a hit target and a damaging source, so area damage and spells reveal too.
- `src/sim/unit.ts`: `hidden = false`, `disguise: string | null = null`, `onReveal: ((by) => void) | null = null` and `fuse = Infinity`. `name` is no longer `readonly`.
- `src/sim/events.ts`: `SimEvents.UnitRevealed`, `UnitRevealedEvent { source, by }`, on `EventPriority`.
- `src/sim/sim.ts`: `strike` reveals a hidden or disguised source first.
- `src/sim/ai.ts`: `thinkWard` counts a disguised assassin's `fuse` down once it has joined the bearer, and reveals it when the fuse is out and the bearer is within 3 tiles. Mercs and monsters already skip forbidden units, so hidden ones are ignored.
- `src/content/roster.ts`: `spawnDisguisedAssassin(sim, level, x, z)`: a Hollowed (`Hunt.Assassin`) on `Side.Ward`, named Refugee, `disguise: 'refugee'`, fuse 12 s. Its `onReveal` moves it to `Side.Monster`, renames it Assassin and wakes it.
- `src/game/stage.ts`: one Escort in four spawns one refugee as the assassin. The pick comes from a small `RNG` seeded from the stage (index, entrance, size), so the same seed gives the same Escort and no existing stream shifts.
- `src/game/objective.ts`: `stillWard` (alive and `Side.Ward`) replaces `alive` in the Escort's failed check, the refugees brought and the objective text, so a turned assassin is not counted as a refugee.
- `src/render/view.ts`: a disguised unit is drawn as its `disguise` kind. `src/render/draw/figures.ts`: `seen()` returns 0 for a hidden enemy, so figure, bar, glows, labels and quarry arrows are all skipped; `barHeight` uses the disguise kind. `draw/standing.ts` needed no change.
- `test/sim/concealment.test.ts`: 6 tests (mercs ignore a hidden monster, strike reveals, `reveal` makes it targetable and emits, area damage reveals, the assassin turns on the bearer after its fuse, and turns when hurt).
- `.changeset/hidden-units.md` (minor).

## Deviations

- Edited a file outside the owned and shared lists: `src/game/stage.ts` (the 1-in-4 pick and the spawn call), because `spawnStage` is where refugees are spawned.
- The pick does not draw from a layout stream: that would shift every later draw in `src/gen/stage/field.ts` (not this node's file) and change existing seeds. A stage-seeded `RNG` is used instead.
- `Unit.name` lost `readonly`, so the assassin can be renamed on reveal.
- The assassin's unit kind is `hollowed`, not `refugee`; it is drawn as a refugee only through `disguise`.
- The assassin turns by its fuse, since a ward never attacks; once revealed it is a monster that strikes.
- The Escort's `wards` snapshot still counts the assassin in `needed()` and in the "N of M" text, on purpose: a changed count would give the disguise away. Effect: an Escort with an assassin needs one more real refugee (half of all, rounded up, counting the assassin).
- `UnitRevealed` also fires when a hidden unit is revealed by a hit or by its own damage, not only by `strike`.

## Stubs left

- None. No listener sets `hidden` yet: warden-watchman and bestiary will.

## Gotchas

- A hidden monster stays aware and acts. Only picking (CheckTarget) and drawing are blocked. Content skills that gather their own victims still ignore CheckTarget (see targeting-rules), so they can hit a hidden monster, and that reveals it.
- `seen()` hides only hidden units of `Side.Monster`. A hidden party unit is still drawn.
- `Unit.fuse` is only read for a disguised unit with `Hunt.Assassin`.

## Proposed learnings

- Count units by their current `side`, not by a list taken at spawn | the Escort list kept the assassin as a refugee after it turned | src/game | no

## Verification

- `pnpm vitest run test/sim/concealment.test.ts`: 6 passed.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (63 files, 537 passed, 24 skipped). `pnpm test:e2e` not run.

## Final interface (for freezing)

```ts
// src/sim/unit.ts
hidden: boolean; // false
disguise: string | null; // null
onReveal: ((by: Unit | null) => void) | null; // addition
fuse: number; // addition: Infinity
// src/sim/concealment.ts
export function reveal(u: Unit, by: Unit | null): void;
export default function setupConcealment(sim: Sim): void; // addition
// src/sim/events.ts
SimEvents.UnitRevealed = 'UnitRevealed'; // { source, by }, EventPriority
```

## Size

- Estimated M, actual M.
