export const enum Element {
  Neutral = 0,
  Fire = 1,
  Frost = 2,
  Storm = 3,
  Earth = 4,
  Venom = 5,
  Radiant = 6,
  Occult = 7,
  Spectral = 8,
}

/**
 * How a hit is mitigated. True damage skips defense.
 */
export const enum DamageKind {
  Physical = 0,
  Magical = 1,
  True = 2,
}

export const enum Range {
  Melee = 0,
  Ranged = 1,
}

export const enum Race {
  Human = 0,
  Beast = 1,
  Undead = 2,
  Demon = 3,
  Insect = 4,
  Construct = 5,
  Plant = 6,
  Spirit = 7,
  Dragon = 8,
}

export const enum Rank {
  Normal = 0,
  Elite = 1,
  Boss = 2,
}

export const enum Side {
  Party = 0,
  Monster = 1,
  // Those the party keeps safe, such as an Escort's refugees. Monsters go
  // for them as for the party; they never fight.
  Ward = 2,
}

export const enum DamageFlags {
  BasicAttack = 0x1,
  Skill = 0x2,
  Projectile = 0x4,
  AoE = 0x8,
  DoT = 0x10,
  Critical = 0x20,
  // Skips hard defense
  Pierce = 0x40,
  // Cannot bring health below 1
  NonLethal = 0x80,
  FriendlyFire = 0x100,
  Redirected = 0x200,
  Reflected = 0x400,
  // Comes from behind the target, so a shield cannot block it
  Flank = 0x800,
  Blocked = 0x1000,
  // Never misses: a blow warned of on the ground is dodged by stepping out
  Sure = 0x2000,
  // Lands on a monster that had not noticed the party
  Ambush = 0x4000,
}

/**
 * The priority scale of `UnitDamage`. The order follows rAthena renewal's
 * `battle_calc_weapon_attack`, without the size step.
 */
export const enum DamagePriority {
  Initial = 0,
  SkillRatio = 1,
  SkillFlat = 2,
  Amplify = 3,
  Defense = 4,
  Affinity = 5,
  Critical = 6,
  Reduce = 7,
  Block = 8,
  Barrier = 9,
  Pre = 10,
  Exact = 11,
  Post = 12,
}

export const enum HealPriority {
  Initial = 0,
  Amplify = 1,
  Reduce = 2,
  Pre = 3,
  Exact = 4,
  Post = 5,
}

/**
 * The priority scale of `Check*` events. `Initial` writes the base answer,
 * the next steps adjust it.
 */
export const enum ValuePriority {
  Initial = 0,
  Additive = 1,
  Multiplicative = 2,
  Pre = 3,
  Exact = 4,
  Post = 5,
}
