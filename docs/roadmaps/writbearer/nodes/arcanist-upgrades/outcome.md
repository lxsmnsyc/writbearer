# Outcome: arcanist-upgrades

## Built

- The Arcanist's 12 elite upgrades in `src/content/jobs/arcanist/upgrades.ts` (replaces the placeholders), 3 per spell. Each has a `patch`, an `effect`, or both.
  - Frost Nova: Glacial Wall (patch: a wall of ice across the way from the awake enemies to the bearer, 7 tiles long, 2 tiles out, `nav.block` for 4 + 0.5r s, no damage, zone `iceWall`), Rimefield (patch plus effect: the ring also sets a 5 s zone `rimefield`; a Tick listener keeps the `RIMED` status, 40% slow, on enemies inside), Cold Snap (effect: when an enemy first comes within 1.5 tiles, once per 12 s, releases Frost Nova free).
  - Fireball: Volcano (patch plus effect: a 4 s Fire zone `volcano`, radius 2; allies inside deal 20% more Fire damage at `DamagePriority.Amplify`), Inferno (patch: radius 4, 200 + 15r%, cost 32, cooldown 12, `friendlyFire` a function of effective Discipline below 60), Echo (effect: 25% on `sim.rng`, re-releases the upgraded Fireball free after a cast).
  - Frost Shard: Chill (patch: Chill buildup 15 + 2r and `SHARD_SLOW`, 30% for 3 s), Shatterpoint (effect: an enemy that dies while Frozen, by any killer, is marked `torn` and deals 60 + 6r% Frost damage to enemies within 2 tiles), Overchannel (effect: when mana is below the cost, `CheckSkillCost` returns 0 and the windup takes 5% of max health, never below 1).
  - Firebolt: Ignite (patch plus effect: double Burn buildup; a burning enemy that dies gives 40 + 4r Burn buildup to enemies within 2 tiles), Mana Flow (effect: +3 mana on each Fire magic skill projectile hit), Piercing Bolt (patch: a straight piercing bolt that ends after 3 hits).
- Bolt patches change `release` only, so the Elemental Sense `wants` stays (the gotcha of the `arcanist` outcome). A test covers it.
- `src/content/jobs/arcanist/spells.ts`: `castAs` and `blast` are now exported.
- `src/render/zones.ts`: `iceWall` and `volcano` added to `ZONE_LOOKS` (append only).
- `test/sim/arcanist-upgrades.test.ts`: 21 tests.
- `.changeset/arcanist-upgrades.md` (minor).

## Deviations

- Edited `test/content/jobs.test.ts` (not owned): it asserted that no upgrade of any job is built. It now checks that built ones have a patch or effect. Other upgrade nodes will hit the same assertion, so whoever merges second gets a small conflict on those lines.
- Exported `castAs` and `blast` from `spells.ts`, as the brief allows.
- No edits to `src/sim/zone.ts` or `src/sim/mechanics/zones.ts`: Volcano and Rimefield use the existing zone fields and listeners.

## Stubs left

- None.

## Gotchas

- Elemental Sense works with the bolt upgrades. The split fallback is not triggered.
- Death clears statuses at `EventPriority.Exact`, so Shatterpoint and Ignite note the Frozen or Burning state at `Pre` and act at `Post`.
- Overchannel keeps a module-level `pricing` flag so the cost question does not ask itself.
- Glacial Wall needs `sim.nav`; with none it only sets the zone.
- Echo re-releases the spell with no windup, the same frame. Volcano's field is one zone per cast; overlapping fields do not stack the bonus.
- Inferno's `wants` counts only foes, so the AI casts it with allies in the blast when Discipline is under 60. That is the design.

## Proposed learnings

- A listener that reads a status at death must run at `EventPriority.Pre` of UnitDies | `death.ts` clears statuses at Exact | src/content/jobs | no

## Verification

- `pnpm vitest run test/sim/arcanist-upgrades.test.ts`: 21 passed.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (552 passed, 24 skipped). `pnpm test:e2e` not run (fixed port).

## Size

- Estimated L, actual L.
