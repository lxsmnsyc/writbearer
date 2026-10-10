# Elements

Elements work as they do in rAthena and Diablo 2. There are no custom reactions between statuses.

The mercs act on their own, so the player cannot aim element combos directly. Elements still matter through:

- Which mercs and gear the player brings into a phase.
- Toggles such as "prefer targets weak to my element".
- Element fields and status changes that the mercs use on their own.

## Rules

- An element is separate from the damage kind. A fire sword deals Physical damage with the Fire element. Armor still reduces it, and it still builds up Burn.
- Each job has at most two native elements.
- Only Rare and better items carry an element, so elements do not flood the loot. Cards are the exception. See [items](06-items-inventory.md#cards).
- The element table is data. Adding an element later is a data change.

## Element set

| Element | rAthena match | Effect of buildup |
|---|---|---|
| Neutral | Neutral | None. Default for weapons. |
| Fire | Fire | Burn: damage over time. |
| Frost | Water | Chill, then Freeze. |
| Storm | Wind | Shock: a short stun. Storm skills can chain to nearby targets. |
| Earth | Earth | Petrify: the target cannot act. |
| Venom | Poison | Poison: damage over time that ignores armor. Also cuts healing received. |
| Radiant | Holy | Sear: bonus damage against Occult and Undead. |
| Occult | Shadow | Dread: drains morale and Ward. Causes fear. |
| Spectral | Ghost | Defense only for most units. Neutral attacks deal 90% to 50% against it, by level. |

- The four natural elements form a cycle, as in rAthena: Frost beats Fire, Fire beats Earth, Earth beats Storm, Storm beats Frost.
- Radiant and Occult oppose each other.
- Spectral makes an elemental weapon or card worth carrying, since Neutral loses up to half its damage. Spectral attacks exist but are rare, as in rAthena.

## Element levels

- Every unit has a defense element and a level from 1 to 3. This follows rAthena's `attr_fix.yml`, which uses 1 to 4.
- The level changes the percent. A Fire 3 monster resists Fire more and takes more from Frost than a Fire 1 monster.
- Mercs are Neutral 1 by default. Armor, cloaks, cards and buffs can change their defense element.

The values are rAthena renewal's (`db/re/attr_fix.yml`, levels 1 to 3), with Water as Frost, Wind as Storm, Poison as Venom, Holy as Radiant, Dark as Occult and Ghost as Spectral. The full table is in `src/sim/elements.ts`.

Example rows (attack element against a Fire target):

| Attack | Fire 1 | Fire 2 | Fire 3 |
|---|---|---|---|
| Neutral | 100% | 100% | 100% |
| Fire | 25% | 0% | 0% |
| Frost | 150% | 175% | 200% |
| Earth | 90% | 80% | 70% |

Example rows against a Spectral target:

| Attack | Spectral 1 | Spectral 2 | Spectral 3 |
|---|---|---|---|
| Neutral | 90% | 70% | 50% |
| Fire, Frost, Storm, Earth | 100% | 100% | 100% |
| Venom | 75% | 75% | 50% |
| Spectral | 125% | 150% | 175% |

Values above 100% are weak points. Renewal is gentler on Neutral against Spectral than pre-renewal was, so Spectral targets are a cost, not a wall.

## Buildup

Statuses come from buildup, not from a chance roll. This idea comes from Elden Ring.

- Each elemental hit adds buildup to the target.
- When buildup reaches the target's threshold, the status triggers and buildup resets.
- Buildup decays slowly when the target is not hit.
- Magical hits add more buildup per point of damage. INT raises it further.
- The UI shows the buildup bar, so the player can see a freeze coming.
- `CheckBuildup` lets passives and items change buildup.

Buildup is deterministic and easy to read. It suits real-time combat with autonomous units.

## Interactions

These are the only interactions. Each one exists in rAthena or Diablo 2.

### Status changes the defense element

From rAthena's `status_calc_element`.

- A Frozen unit becomes Frost 1 while frozen. Storm hits it for extra damage.
- A Petrified unit becomes Earth 1 while petrified. Fire hits it for extra damage.
- Skills and items can also change a unit's defense element for a while, as rAthena's Benedictio or elemental armor options.

The mercs use this on their own when the "weak to my element" toggle is on, because the target's current element is what the toggle reads.

### Element fields

From rAthena's Volcano, Deluge and Violent Gale.

- A field is a ground area tied to one element.
- Units standing in it deal more damage with that element.
- Fields come from skills, such as the Arcanist's Volcano, and from some biome tiles.
- Weather in a phase can act as a field across the whole stage. Example: rain boosts Frost damage everywhere.
- Fields only boost. They never hurt anyone.

### Shatter

From Diablo 2.

- A monster killed while Frozen shatters and leaves no corpse.
- Without a corpse, enemy summoners cannot raise it, and enemy healers cannot resurrect it.
- Mercs never shatter. The player cannot steer mercs out of danger, so losing a merc for good to a random Freeze would be too punishing.

## Corpses

From rAthena, where a dead character stays on the ground until resurrected.

- A dead merc's corpse stays where it fell until it is resurrected.
- Monster corpses stay until the stage ends. Enemy summoners and the Necromancer can use them.
- Shattered monsters leave no corpse.

## Friendly fire

- Elemental attacks never hurt allies or the citizen by default.
- Only skills that declare `friendlyFire` hurt their own side. See [combat engine](03-combat-engine.md#friendly-fire).
- Stage traps hurt anyone who triggers them. They are part of the stage, not an attack.

## Risks

- Too many elements bloat the loot tables. Limit elements to Rare and better items and to cards.
- Players may ignore elements if the percents are small. Weak points should be clearly worth it, around 150% or more.
