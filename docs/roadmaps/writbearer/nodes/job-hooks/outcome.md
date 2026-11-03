# Outcome: job-hooks

## Built

Eight hooks, each with tests in `test/sim/job-hooks.test.ts` (22 tests, listeners made in the test). No hook has a listener in the game yet, so play is unchanged except one new option in the merc target priority list.

Final shapes, for freezing `contracts/job-hooks.md`:

1. **Friendly fire**, `src/sim/skill.ts`. Needed by Arcanist Inferno.
   - `Skill.friendlyFire?: boolean | ((unit: Unit) => boolean)`. The function form lets Inferno turn it off at effective Discipline 60.
   - `areaVictims(source: Unit, skill: Skill, at: {x, z}, radius: number): { target: Unit; flags: number }[]`. Returns the foes the source may target (through CheckTarget) with flags `AoE`, plus, when the skill has friendly fire for this source, every living unit of the source's side except the source (bearer included) with flags `AoE | FriendlyFire`. The skill then calls `source.hit(target, { flags })` for each. The area skill must use this helper, or `allowed()` for foes only.
2. **Stealable buffs**, `src/sim/status.ts`. Needed by Sellsword Cutpurse.
   - `StatusDef.buff?: boolean`. Set on Mending, Refreshing, Renewed and Shield Wall in `statuses.ts`, and the Abbess's SANCTIFIED in `bosses.ts`. Monster buff statuses added later must set `buff: true` or `stealBuff` cannot take them. Job and monster statuses opt in with `buff: true`.
   - `buffsOf(unit): ActiveStatus[]` and `stealBuff(thief, from): ActiveStatus | null` (adds to the thief first, keeps stacks, and removes from `from` only if the add took; null if none or the thief is immune or dead).
3. **BLIND**, `src/sim/statuses.ts`. Needed by Sellsword Pocket Sand and Salt the Wound; reusable by the Lamplighter and monsters.
   - `BLIND: StatusDef`, id `blind`, 4 s, immunity 3 s, threshold from DEX like Shock. While active, a CheckHit listener at `ValuePriority.Additive` takes 30 points off the blinded unit's hit chance (physical hits only; criticals and Sure hits skip it). Not in `ELEMENT_STATUS`; skills add it with `buildup: [{ status: BLIND, amount }]` or `buildUp`. Salt the Wound (more damage taken) and Play Dead are the job's own listeners. The status has no drawn icon yet (`src/render/draw/statuses.ts`).
4. **CheckChase**, `src/sim/events.ts`, `src/sim/ai.ts`. Needed by Warden Tether.
   - `SimEvents.CheckChase`, payload `{ source: Unit; value: number }`, priority `ValuePriority`. Emitted each think by `thinkMerc`; `value` starts at the chase of the merc's orders after traits and shouts (Rally). The result is the distance from the bearer within which enemies are picked. No Initial listener: it starts with the value.
5. **CheckProjectile**, `src/sim/events.ts`, `src/sim/sim.ts`. Needed by Warden Cover.
   - `SimEvents.CheckProjectile`, payload `{ source: Unit /* shooter */; target: Unit; projectile: Projectile }`, priority `EventPriority`. Emitted just before a projectile strikes a unit, homing (after the CheckTarget check) or straight (once per unit it passes). A listener sets `event.disabled = true` to block: no hit, no `onHit`, and the projectile is done (a piercing arrow also stops). The listener decides "from the front" from `projectile.dx/dz` or `x/z`.
6. **nav.block**, `src/sim/nav.ts`, `src/sim/sim.ts`, `src/sim/unit.ts`. Needed by Arcanist Glacial Wall.
   - `nav.block(tiles: readonly (readonly [number, number])[], seconds: number): void`. A tile is `[x, z]`, the tile starting at those whole numbers (4 grid cells). Paths go round blocked tiles, `walkable`, `clear`, `roomy`, `free` and A* goals treat them as closed, `separate()` undoes a push into one, and `Unit.walkTo` will not step into one. A body already inside may only step toward open ground (`nav.exitDistance`). All of this is inert while nothing is blocked (`nav.anyShut`). `nav.shut(x, z)` tells if a point is in one. `nav.advance(dt)` counts them down; `Sim.tick` calls it. Calling `block` again on a tile keeps the longer time.
   - Projectiles are not stopped by it. Rampart's wall zone with `blocks: true` stops them; Glacial Wall can set both.
7. **WeakToElement**, `src/sim/ai.ts`, `src/ui/merc-panel.tsx`. Needed by Arcanist Elemental Sense.
   - `Priority.WeakToElement = 6`: of the enemies, those that take the most damage (above 100%) from the merc's attack elements, nearest of them; if none takes more than 100%, the next priority applies. Shown in the merc panel as "Enemies weak to its element".
   - `SimEvents.CheckAttackElements`, payload `{ source: Unit; elements: Element[] }`, priority `ValuePriority`. New, not in the draft contract. `elements` starts as `[source.attackElement]`; the Arcanist pushes Fire and Frost in a listener, so the priority considers both. The Arcanist's choice of bolt per target is the job's own `wants`.
8. **CheckSkillRank**, `src/sim/events.ts`, `src/content/skills.ts`. Needed by Sellsword Veteran of Many Wars.
   - `SimEvents.CheckSkillRank`, payload `{ source: Unit; skill: string; value: number }`, priority `ValuePriority`. `rankOf(u, id)` emits it; `value` starts at `max(1, u.skillRank(id))`. A listener adds bonus ranks and caps as it wants. Shards and `u.skillRank` are unchanged.

## Deviations

- Edited `src/sim/unit.ts` (not in `shared:`): `walkTo` refuses a step into a blocked tile. Without it a body with no route would walk through the wall. Four lines.
- Added `CheckAttackElements`, `areaVictims`, `buffsOf`, `stealBuff`, `nav.shut`, `nav.advance`: additions to the draft contract.
- Marked four core statuses `buff: true` in `statuses.ts`.
- Added a changeset (minor): the new priority option is the one visible change.

## Dropped from the draft contract

- None of the eight was dropped; each has a user in doc 16. Not hooks, left to the job nodes with existing events: Overchannel (CheckSkillCost to 0 at 0 mana, health loss on UnitSkillWindup), Echo (remember the last spell in a UnitSkillRelease listener), Riposte and Untouchable (CheckHit / UnitMiss then `hit`), Interpose (UnitDamage at `DamagePriority.Pre` with `DamageFlags.Redirected`), Marked for Death and Salt the Wound (Amplify listeners), Duel (CheckTarget), Trap Field (a Tick listener or a Zone with `pulse`).

## Stubs left

- None.

## Gotchas

- Game-layer needs that are not sim hooks: Sellsword Pocket Change (gold on a kill) and Bribe (spend gold) live in `src/game`; sellsword-upgrades must add them there or defer them. Shatterpoint's "no corpse" is the job's listener on `UnitDies` at `Post` setting `torn`.
- Veteran of Many Wars needs the phase count, which lives only in `src/game/game/fight.ts`, not in Sim. Weapon Habit needs a per-run count of use by weapon type, which probably needs a save field.
- `merc-panel.tsx` and `spell-panel.tsx` show `unit.skillRank`, not `rankOf`: a bonus rank from CheckSkillRank is not shown. Veteran of Many Wars should decide whether to change the panels.
- `CheckProjectile` fires for every projectile, enemy ones too. A listener must check `event.target` and `event.projectile.source.side`.
- A blocked tile under a standing unit makes `separate()` count it as stuck after 1 s, and it is moved to the nearest open ground.
- A merc picks its own area-skill victims; `areaVictims` is not called by the engine.

## Proposed learnings

- Area skills take their victims from `areaVictims` or `allowed`, never from `sim.foes` | one place for CheckTarget and friendly fire | src/content | no

## Verification

- `pnpm vitest run test/sim/job-hooks.test.ts`: 25 passed.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (58 files, no existing test changed). `pnpm build`: pass.
- `pnpm test:e2e` not run (the orchestrator runs it).

## Size

- Estimated M, actual M.
