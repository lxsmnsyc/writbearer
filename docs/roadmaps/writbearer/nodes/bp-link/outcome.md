# Outcome: bp-link

## Built

- `src/sim/link.ts`: `linksOf(sim)` gives a `Links` registry. `link(units, {window, rise, heal, healEvery})` makes a group that shares each hit evenly (passed-on parts are True damage with the `Redirected` flag, never passed on again), opens a window when the first unit dies, revives the fallen at `rise` of max health if some stand when it ends (all dead inside it: they stay dead), heals the most hurt other member, and `swap(a, b)` trades two living members' places.
- `src/sim/events/bp-link.ts`: `LinkRisen`, `LinkSwapped` events; one enum line each and `LinkEventMap` appended in `src/sim/events.ts`.
- `src/content/affixes.ts`: `Affixes.bind` is a thin wrapper (gives `bound`, links with an infinite window, so Bound packs behave as before). The private `share` and the `bound` field are removed. The link handler is registered right after the ward handler so the ward still comes first.
- `test/sim/link.test.ts`: sharing, one death event per unit, rise, stay dead, heal, swap. `.changeset/bp-link.md`.

## Deviations

- None outside owned and shared paths.

## Stubs left

- None. No monster uses a finite window, heal or swap yet; the Drowned Choir is a later node.

## Gotchas

- A body torn by a blow of 30% of max health or more cannot rise, so a linked unit killed that way stays dead even outside the window.
- `Sim.tick(dt)` is the update call; the window runs on `sim.time`.

## Proposed learnings

- None.

## Verification

- `pnpm typecheck`, `rtk proxy pnpm lint`, `pnpm test` (876 pass, 3 skipped). The verify command passes.

## Size

- Estimated S, actual S.

Landed as 6ea2e30 on batch/writbearer.
