# Combat engine and damage

Combat runs on an event engine ported from the-fighting-game. Damage follows the order of steps in rAthena's `battle.cpp`, adapted to real time.

## Event engine

- One bus holds many event types. Each type has its own emitter and its own priority scale.
- Every event has `Pre`, `Exact` and `Post` steps at least. `Pre` runs before the mechanic, `Exact` is the mechanic itself, and `Post` reacts to the result.
- Some events have longer scales with named steps, such as damage.
- A listener cancels an event by setting `disabled`. The remaining listeners are skipped.
- Skills, passives, statuses, item affixes and monster cards all have the same shape. They register listeners in `setup` and return a `Lifecycle`. The engine starts and stops that lifecycle as the thing is gained, lost, enabled or disabled.

### Two kinds of events

- `Check*` events ask a question. Listeners change a field on the event, and the caller reads the answer. Examples: `CheckHit`, `CheckSkillCost`, `CheckCastTime`, `CheckCastAllowed`, `CheckMonsterTarget`, `CheckBuildup`, `CheckStatusDuration`, `CheckItemRoll`, `CheckDropRate`.
- `Unit*` events say something happened. Examples: `UnitDamage`, `UnitHeal`, `UnitSkillHit`, `UnitDies`, `UnitResurrected`.

The `Check*` list comes from wAthena's hooks (`skill_cost`, `cast_time`, `cast_allowed`, `monster_target`, `status_chance`, `status_duration`, `item_roll`, `drop_rate`).

### Loop safety

- An effect that emits new events runs only on `UnitTriggerSkill` or on `Tick`. It never runs inside another event's listener chain. This is the same rule as cards in the-fighting-game.
- Redirects and reflects are the exception. They mark their new event with a flag (`Redirected`, `Reflected`), and listeners ignore events that carry it. This stops two reflect effects from bouncing forever.

## Damage axes

Every hit carries three independent properties.

```ts
const enum DamageKind {
  Physical, // weapons and physical skills
  Magical,  // spells
  True,     // bleeding, falls, curses: skips defense
}

const enum Range {
  Melee,
  Ranged,
}

// See 04-elements.md
const enum Element { Neutral, Fire, Frost, Storm, Earth, Venom, Radiant, Occult }
```

Flags add detail: `BasicAttack`, `Skill`, `Projectile`, `AoE`, `DoT`, `Critical`, `Pierce`, `NonLethal`, `FriendlyFire`, `Redirected`, `Reflected`.

Units have no size. rAthena scales damage by weapon type against target size, and this game does not. Weapon types still differ in attack speed, reach and the skills that use them.

`DamageKind` and `Range` together match rAthena's `BF_WEAPON`, `BF_MAGIC`, `BF_MISC`, `BF_SHORT` and `BF_LONG`. Barrier skills read them. A wall that stops melee hits and a field that stops ranged physical hits are both simple checks on these two values.

## Friendly fire

- Attacks never hurt allies or the citizen by default.
- A skill hurts its own side only when it declares `friendlyFire: true`.
- Hits from such a skill carry the `FriendlyFire` flag, so passives and items can react to them.
- Area skills without the flag hit enemies only, even when allies stand inside the area.
- Monster attacks follow the same rule. A monster's skill hurts other monsters only when it declares the flag.
- Environment hazards are not skills. See [elements](04-elements.md#friendly-fire).

## Physical and magical rules

| | Physical | Magical |
|---|---|---|
| Scaling | STR for melee, DEX for ranged | INT |
| Hit check | Accuracy against Evasion | Always hits. Projectiles can still be walked out of. |
| Critical | Yes. Crits skip the hit check. | No crits. INT adds element buildup instead. |
| Block | Shields block from the front | No |
| Defense | Armor (hard, percent) and VIT (soft, flat) | Resistance (hard, percent) and WIL (soft, flat) |
| Barrier | Hit-count walls, ranged fields | Ward pool |
| Interrupt | Melee hits can interrupt casts | Large hits can interrupt casts |

## Mana

- Every skill costs mana. Basic attacks are free.
- Max mana comes from the job's base pool and INT.
- Physical jobs have small pools and cheap skills.
- `CheckSkillCost` lets passives and items change costs.

Regeneration and gain follow rAthena and Diablo 2. Neither gives physical classes mana on hit by default. Both rely on regeneration, items and potions.

| Source | rAthena | Diablo 2 | This game |
|---|---|---|---|
| Natural regeneration | SP regenerates on a timer, scaled by max SP and INT. Sitting doubles it. | Mana regenerates over time, scaled by max mana. | Regenerates every tick, scaled by max mana and WIL. Doubled outside combat. |
| On hit | Items and cards only (`bSPDrainValue`, `bSPDrainRate`). | Items only (mana stolen per hit). | Items and cards only. |
| On kill | Items and cards only (`bSPGainValue`, `bMagicSPGainValue`). | Items only (mana after each kill). | Items and cards only. |
| Potions | Yes. | Yes. | Yes, through the belt. |

A few job passives may add mana gain, such as the Duelist's Flourish. They are the exception.

## Skill lifecycle

A skill goes through these events in real time.

```
CheckCastAllowed   toggles, mana, cooldown, range, silence
CheckSkillCost     final mana cost
CheckCastTime      windup length, reduced by DEX and items
UnitSkillWindup    cast bar. Can be interrupted.
UnitSkillRelease   spawns the delivery: melee arc, projectile, ground zone or instant
UnitSkillHit       once per target hit
  CheckHit         hit and crit rolls (physical only)
  UnitDamage       the damage pipeline below
UnitSkillRecovery  recovery time before the next action
```

Timing values per skill, taken from rAthena:

- `windup`: rAthena's cast time. A hit can interrupt it unless the skill or an item prevents it.
- `recovery`: rAthena's after-cast delay. The unit cannot act during it.
- `cooldown`: per skill.
- Basic attacks use attack speed (AGI and weapon) instead.

A skill that hits several times sends one `UnitSkillHit` per hit. Each hit goes through the full pipeline, so on-hit effects scale with hit count.

## Hit check

`CheckHit` runs before damage, because a crit decides whether evasion applies.

1. Roll crit from the attacker's crit rate. A crit skips step 2.
2. Hit chance is `clamp(80 + Accuracy - Evasion, 5, 95)` percent. This is rAthena's formula.
3. On a miss, no `UnitDamage` is sent. A `UnitMiss` event is sent instead.

Magical hits skip this check.

## Damage pipeline

`UnitDamage` uses its own priority scale. The order follows `battle_calc_weapon_attack` and `battle_calc_magic_attack` in rAthena renewal.

```ts
export const enum DamagePriority {
  Initial,        // base damage
  SkillRatio,     // skill percent
  SkillFlat,      // skill flat bonus
  Amplify,        // attacker's bonus categories
  Defense,        // hard and soft defense
  Element,        // element against target element
  Critical,       // crit multiplier
  Reduce,         // target's reduction categories
  Block,          // shield block, physical only
  Barrier,        // walls, fields, Ward
  Pre,            // redirect, cancel, cap
  Exact,          // health removed
  Post,           // reflect, drain, buildup, threat, on kill
}
```

### Initial

- Physical: a roll between the weapon's min and max damage, plus status attack, plus the refine bonus.
  - Status attack for melee is `STR * 2 + DEX / 5`.
  - Status attack for ranged is `DEX * 2 + STR / 5`.
- Magical: a roll between min and max magic attack. Both come from INT and the weapon's magic attack.
- The roll uses the `combat` stream.

### SkillRatio and SkillFlat

- `damage = damage * ratio / 100 + flat`.
- A basic attack has ratio 100 and flat 0.

### Amplify and Reduce

These steps follow rAthena's `battle_calc_cardfix`. Bonuses are grouped into categories.

- Bonuses in the same category add together.
- Different categories multiply.

Attacker categories:

- Against target race.
- Against target element.
- Own attack element.
- Specific skill.
- Melee or ranged.
- Against elites and bosses.

Target categories mirror these as damage taken.

Example: an item gives +20% against Undead and a card gives +15% against Undead. A second card gives +10% against elites. The result is `1.35 * 1.10`.

This rule keeps item stacking predictable. Players are pushed to spread bonuses across categories instead of stacking one.

### Defense

Hard defense is a percent with diminishing returns. Soft defense is flat. Both formulas are from rAthena renewal.

```
physical: damage * (4000 + armor)      / (4000 + armor * 10)      - softDef
magical:  damage * (1000 + resistance) / (1000 + resistance * 10) - softMdef
```

- Hard defense never reduces more than 90%.
- Physical soft defense comes from VIT. Magical soft defense comes from WIL and INT.
- `Pierce` and armor-break effects lower or skip hard defense.
- `True` damage skips this step.

### Element

- A table of attack element against defense element and defense level gives a percent.
- See [elements](04-elements.md).

### Critical

- A crit multiplies damage by 1.4.
- In rAthena renewal crits also skip the hit check. That part happens in `CheckHit`.

### Block

- Physical only.
- A shield blocks a hit from the front arc. Block chance and block amount come from the shield.
- A blocked hit loses most of its damage but can still apply on-hit effects.

### Barrier

Based on `battle_calc_damage` in rAthena, where status effects absorb hits.

- Hit-count walls stop a number of melee hits. Based on Safety Wall.
- Ranged fields stop ranged physical hits. Based on Pneuma.
- Ward is a pool that absorbs magical damage first. Based on Kyrie Eleison, but magic only.
- These come from skills, items and statuses. They are listeners on this step.

### Pre

- Last chance to change the hit.
- The Warden's Interpose redirects hits aimed at the citizen here.
- Caps such as "no hit can deal more than 30% of max health" go here.

### Exact

- Health goes down by the final value, rounded down, at least 0.
- `NonLethal` stops at 1 health.
- At 0 health, a unit dies. A merc leaves a corpse until it is resurrected. See [mercenaries](05-mercenaries.md#death-and-resurrection).
- If the citizen dies, the run ends.

### Post

- Reflect, based on `battle_calc_return_damage`. Sends a new `UnitDamage` with the `Reflected` flag.
- Drain, based on `battle_calc_drain`.
- Element buildup.
- Threat for monster targeting.
- Stagger and cast interrupt.
- On-kill effects and morale.

## Healing pipeline

```ts
export const enum HealPriority {
  Initial,  // base heal
  Amplify,  // caster bonuses
  Reduce,   // target penalties, such as Venom
  Pre,
  Exact,    // health restored, capped at max
  Post,     // overheal becomes a short shield on some skills
}
```

## Skill definition

Same shape as cards in the-fighting-game.

```ts
export interface Skill {
  id: SkillId;
  name: string;
  kind: DamageKind;
  range: Range;
  element: Element;
  tags: SkillTag[];      // Melee, Projectile, AoE, Heal, Guard, Mobility, Buff, Debuff
  cost: number;          // mana
  cooldown: number;      // ms
  windup: number;        // ms
  recovery: number;      // ms
  reach: number;         // tiles
  targeting: TargetRule; // Enemy, Ally, Citizen, Self, Ground
  friendlyFire?: boolean; // hurts allies and the citizen. Off by default.
  maxRank: number;
  description(rank: number): Description;
  setup(context: SkillContext): Lifecycle;
}
```

Passive nodes of the skill tree, statuses, affixes and monster cards use the same `setup` shape.

### Example: Interpose

A Warden passive. Hits aimed at the citizen are taken by the Warden instead, at 70%.

```ts
export default createSkill({
  id: SkillId.Interpose,
  name: 'Interpose',
  kind: DamageKind.Physical,
  range: Range.Melee,
  element: Element.Neutral,
  tags: [SkillTag.Guard],
  // ...
  setup({ sim, unit }) {
    return sim.on(Events.UnitDamage, DamagePriority.Pre, (event) => {
      if (
        event.target === sim.citizen &&
        unit.alive &&
        sim.distance(unit, sim.citizen) <= INTERPOSE_RANGE &&
        !(event.flags & DamageFlags.Redirected)
      ) {
        event.disabled = true;
        unit.takeDamage(
          event.source,
          event.kind,
          event.element,
          event.value * 0.7,
          event.flags | DamageFlags.Redirected,
        );
      }
    });
  },
});
```

### Example: Sunder

A Vanguard passive. Melee hits lower the target's armor for a few seconds.

```ts
setup({ sim, unit }) {
  return sim.on(Events.UnitDamage, DamagePriority.Post, (event) => {
    if (event.source === unit && event.range === Range.Melee && event.value > 0) {
      event.target.addStatus(StatusId.Sundered, { stacks: 1, duration: 4000 });
    }
  });
}
```

## Status effects

- Elemental statuses use buildup, not a chance roll. See [elements](04-elements.md#buildup).
- Other statuses, such as stun, silence, blind and fear, also use buildup, with their own resist stat.
  - Stun and bleed are resisted by VIT.
  - Silence, fear and curse are resisted by WIL.
  - Blind is resisted by DEX.
- After a status ends, the target is briefly immune to it. This prevents permanent lock.

## Threat and targeting

- Monsters pick targets through `CheckMonsterTarget`.
- Damage dealt, healing done and taunts add threat. Threat decays over time.
- Some monster types ignore threat and always go for the citizen.
