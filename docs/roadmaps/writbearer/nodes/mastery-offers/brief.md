---
id: mastery-offers
title: Elite upgrade offers: Waystations and the Mastery road reward
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/game/mastery.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/game/mastery.ts
  - src/ui/upgrade-offer.tsx
  - test/game/mastery.test.ts
shared:
  - src/gen/graph.ts
  - src/game/game.ts
  - src/game/save.ts
  - src/ui/station.tsx
  - src/ui/icons.ts
  - src/ui/app.tsx
reserves: []
provides: []
depends_on:
  - on: build-rules
    kind: contract
    via: builds
---

# Elite upgrade offers: Waystations and the Mastery road reward

## Goal

Give mercs their elite upgrades during a run, as `docs/design/16-builds.md` says. An offer is 3 cards; the player picks 1.

- At the Waystations of phases 2 to 4, each living merc gets an offer from its own spells' upgrades.
- A new road reward, `mastery`, gives one offer of 3 cards, each for a different living merc.
- A merc whose 4 spells all hold an upgrade gets a card for +2 shards instead.

## Context

- Rules: `contracts/builds.md` (`offerUpgrades`, `applyUpgrade`).
- Rewards: `Reward` in `src/gen/graph.ts`; their chests and spoils in `Game.spoilsOf` (`src/game/game.ts`); signposts in `docs/design/14-gauntlets.md#rewards-shown-on-the-road`.
- The Waystation screen is `src/ui/station.tsx`.
- Offers are drawn from a run stream so a saved run offers the same cards after load.

## Acceptance

- [ ] A run reaching the phase 2 Waystation offers each living merc 3 upgrades of its own spells; picking one sets it on the merc.
- [ ] A Mastery road reward exists in the graph and offers 3 cards for 3 different mercs.
- [ ] An open offer survives save and load.
- [ ] Fast check passes.

## Sizing

One reward kind, one offer screen, a hook at the Waystation. M.

## Notes for the worker

- Build and test against a test job with spells and upgrades from `test/support/build.ts`; the real jobs land later.
- Add `mastery` at the end of `Reward` and give it a weight in the road reward draw; new RNG draws go last so existing seeds keep their maps.
