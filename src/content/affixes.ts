import { EventPriority } from '../core/event-emitter';
import { SimEvents } from '../sim/events';
import type Sim from '../sim/sim';
import { CHILL } from '../sim/statuses';
import { DamageFlags, DamageKind, DamagePriority, Element, Range, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { warn } from '../sim/warning';

// Elite affixes, from the bestiary, after Diablo 2's champions: each makes
// an elite, and so its pack, a small puzzle with an answer.
//
// So far: Swift, Stoneskin, Fire, Frost and Venom Enchanted, Vampiric,
// Thorns, the Might and Mending auras, Warded, Bound and Herald. Not yet:
// Storm Enchanted, Mana Burn, Multishot and Teleport.

export type Affix =
  | 'swift'
  | 'stoneskin'
  | 'fireEnchanted'
  | 'frostEnchanted'
  | 'venomous'
  | 'vampiric'
  | 'thorns'
  | 'might'
  | 'mending'
  | 'warded'
  | 'bound'
  | 'herald';

/** Every affix an elite may roll. */
export const AFFIXES: readonly Affix[] = [
  'swift',
  'stoneskin',
  'fireEnchanted',
  'frostEnchanted',
  'venomous',
  'vampiric',
  'thorns',
  'might',
  'mending',
  'warded',
  'bound',
  'herald',
];

export const AFFIX_NAME: Record<Affix, string> = {
  swift: 'Swift',
  stoneskin: 'Stoneskin',
  fireEnchanted: 'Fire Enchanted',
  frostEnchanted: 'Frost Enchanted',
  venomous: 'Venomous',
  vampiric: 'Vampiric',
  thorns: 'Thorns',
  might: 'Aura: Might',
  mending: 'Aura: Mending',
  warded: 'Warded',
  bound: 'Bound',
  herald: 'Herald',
};

/**
 * The affixes an elite's pack shares, at half strength: those that work on
 * the one who has them. Auras, wards, bonds and heralds stay the elite's.
 */
export const SHARED: ReadonlySet<Affix> = new Set([
  'swift',
  'stoneskin',
  'fireEnchanted',
  'frostEnchanted',
  'venomous',
  'vampiric',
  'thorns',
]);

// Swift: how much faster it moves and attacks
const SWIFT = 0.3;
// Stoneskin: armor added
const STONESKIN = 40;
// Vampiric: the share of damage dealt it heals; Thorns: the share of melee
// damage taken it throws back
const VAMPIRIC = 0.3;
const THORNS = 0.25;
// Auras: how far they reach, Might's damage, Mending's healing a second
const AURA_REACH = 6;
const MIGHT = 25;
const MENDING = 0.02;
// Warded: how much magic the ward holds, as a share of health, and how long
// unhit before it refills
const WARD = 0.3;
const WARD_REFILL = 4;
// Herald: how often it wakes the next pack in the area
const HERALD_EVERY = 10;
const PACK_REACH = 3;
// A Fire or Frost Enchanted death: how wide, how long it shows, and what
// fire takes from the party
const BURST = { r: 2, windup: 1, share: 0.12 };

interface Held {
  affixes: Map<Affix, number>;
  // Warded: what the ward holds, its most, and time since it was last hit
  ward: number;
  wardMost: number;
  unhit: number;
  // Herald: time since it last woke a pack
  heralded: number;
  // Bound: those it shares its health with
  bound: Unit[] | null;
  // Might: the bonus its aura gives, by its own key
  aura: string;
}

export default class Affixes {
  private readonly held = new Map<Unit, Held>();
  // Whether a ward may refill, when something keeps it, such as a
  // mini-boss's Cantors
  private readonly keepers = new Map<Unit, () => boolean>();
  // For each aura's own bonus key
  private auras = 0;

  constructor(private readonly sim: Sim) {
    sim.on(SimEvents.UnitDamage, DamagePriority.Barrier, (e) => {
      this.wardOff(e.target, e);
      this.share(e.target, e);
    });
    sim.on(SimEvents.UnitDamage, DamagePriority.Post, (e) => {
      if (e.value <= 0) {
        return;
      }
      const by = this.held.get(e.source);
      const vampiric = by?.affixes.get('vampiric') ?? 0;
      if (vampiric > 0 && e.source.alive) {
        e.source.heal(e.source, e.value * VAMPIRIC * vampiric);
      }
      const on = this.held.get(e.target);
      const thorns = on?.affixes.get('thorns') ?? 0;
      const melee = e.range === Range.Melee && (e.flags & DamageFlags.Redirected) === 0;
      if (thorns > 0 && melee && e.source.alive && e.source !== e.target) {
        e.target.hit(e.source, {
          kind: DamageKind.True,
          fixed: Math.max(1, Math.round(e.value * THORNS * thorns)),
          flags: DamageFlags.Redirected,
        });
      }
      if (on) {
        on.unhit = 0;
      }
    });
    sim.on(SimEvents.UnitDies, EventPriority.Post, (e) => {
      const dead = e.source;
      const h = this.held.get(dead);
      if (!h) {
        return;
      }
      if (h.affixes.has('fireEnchanted') || h.affixes.has('frostEnchanted')) {
        this.burst(dead, h.affixes.has('fireEnchanted'));
      }
      // Its aura goes with it.
      if (h.affixes.has('might')) {
        for (const m of sim.living(Side.Monster)) {
          m.setBonus(h.aura, null);
        }
      }
      this.held.delete(dead);
    });
  }

  /** The affixes a unit has, strongest first. */
  of(u: Unit): Affix[] {
    return [...(this.held.get(u)?.affixes.keys() ?? [])];
  }

  /** Gives a unit an affix, at a strength from 0 to 1. */
  give(u: Unit, affix: Affix, strength = 1): void {
    let h = this.held.get(u);
    if (!h) {
      h = {
        affixes: new Map(),
        ward: 0,
        wardMost: 0,
        unhit: 0,
        heralded: 0,
        bound: null,
        aura: `aura:might:${this.auras++}`,
      };
      this.held.set(u, h);
    }
    if (h.affixes.has(affix)) {
      return;
    }
    h.affixes.set(affix, strength);
    if (affix === 'swift') {
      u.kit.moveSpeed *= 1 + SWIFT * strength;
      u.kit.interval /= 1 + SWIFT * strength;
    } else if (affix === 'stoneskin') {
      u.setBonus('affix:stoneskin', [{ stat: 'armor', add: STONESKIN * strength }]);
    } else if (affix === 'fireEnchanted') {
      u.attackElement = Element.Fire;
    } else if (affix === 'frostEnchanted') {
      u.attackElement = Element.Frost;
    } else if (affix === 'venomous') {
      u.attackElement = Element.Venom;
    } else if (affix === 'warded') {
      h.wardMost = u.derived.maxHp * WARD * strength;
      h.ward = h.wardMost;
    }
  }

  /** Binds units so they share their health: a hit on any of them hurts all. */
  bind(units: readonly Unit[]): void {
    const group = [...units];
    for (const u of group) {
      this.give(u, 'bound');
      const h = this.held.get(u);
      if (h) {
        h.bound = group;
      }
    }
  }

  /** Lets a unit's ward refill only while `keeps` holds. */
  keepWard(u: Unit, keeps: () => boolean): void {
    this.keepers.set(u, keeps);
  }

  /** What a unit's ward holds now, and at most. */
  wardOf(u: Unit): { ward: number; most: number } {
    const h = this.held.get(u);
    return { ward: h?.ward ?? 0, most: h?.wardMost ?? 0 };
  }

  // A ward takes magic damage before health does.
  private wardOff(u: Unit, e: { kind: DamageKind; value: number }): void {
    const h = this.held.get(u);
    if (!h || h.ward <= 0 || e.kind !== DamageKind.Magical) {
      return;
    }
    const taken = Math.min(h.ward, e.value);
    h.ward -= taken;
    e.value -= taken;
    h.unhit = 0;
  }

  // A bound unit shares a hit with the rest of its group, each taking an
  // even part. A hit passed on is not passed on again.
  private share(u: Unit, e: { source: Unit; value: number; flags: number }): void {
    const group = this.held.get(u)?.bound?.filter((b) => b.alive);
    if (!group || group.length < 2 || (e.flags & DamageFlags.Redirected) !== 0 || e.value <= 0) {
      return;
    }
    const part = e.value / group.length;
    e.value = part;
    for (const b of group) {
      if (b !== u) {
        e.source.hit(b, {
          kind: DamageKind.True,
          fixed: Math.max(1, Math.round(part)),
          flags: DamageFlags.Redirected,
        });
      }
    }
  }

  // A Fire or Frost Enchanted elite bursts as it dies, shown first: fire
  // burns the party, frost chills it.
  private burst(dead: Unit, fire: boolean): void {
    warn(this.sim, {
      x: dead.x,
      z: dead.z,
      shape: { kind: 'circle', r: BURST.r },
      windup: BURST.windup,
      spare: Side.Monster,
      source: null,
      strike: (u) => {
        if (fire) {
          u.hit(u, {
            kind: DamageKind.True,
            fixed: Math.max(1, Math.round(u.derived.maxHp * BURST.share)),
            flags: DamageFlags.Redirected,
          });
        } else {
          u.addStatus(CHILL, u);
        }
      },
    });
  }

  /** Auras, wards and heralds at work. */
  update(dt: number): void {
    const monsters = this.sim.living(Side.Monster);
    for (const [u, h] of this.held) {
      if (!u.alive) {
        continue;
      }
      const might = h.affixes.get('might') ?? 0;
      const mending = h.affixes.get('mending') ?? 0;
      for (const m of monsters) {
        const near = m !== u && m.distanceTo(u) <= AURA_REACH;
        if (might > 0) {
          const bonus = [
            { stat: 'atkMin' as const, percent: MIGHT * might },
            { stat: 'atkMax' as const, percent: MIGHT * might },
          ];
          m.setBonus(h.aura, near ? bonus : null);
        }
        if (mending > 0 && near && m.hp < m.derived.maxHp) {
          u.heal(m, m.derived.maxHp * MENDING * mending * dt);
        }
      }
      if (h.wardMost > 0) {
        h.unhit += dt;
        const keeps = this.keepers.get(u)?.() ?? true;
        if (h.unhit >= WARD_REFILL && keeps) {
          h.ward = h.wardMost;
        }
      }
      if (h.affixes.has('herald') && u.aware) {
        h.heralded += dt;
        if (h.heralded >= HERALD_EVERY) {
          h.heralded = 0;
          wakeNext(u, monsters);
        }
      }
    }
  }
}

// One set of affixes at work for each simulation
const RUNS = new WeakMap<Sim, Affixes>();

/** The affixes at work in a simulation. */
export function affixesOf(sim: Sim): Affixes {
  let run = RUNS.get(sim);
  if (!run) {
    run = new Affixes(sim);
    RUNS.set(sim, run);
  }
  return run;
}

/**
 * Gives a group its affixes: the leader all of them, the rest the first at
 * half strength if it is one they can share. A Bound group shares health.
 */
export function giveAffixes(
  sim: Sim,
  leader: Unit,
  rest: readonly Unit[],
  affixes: readonly Affix[],
): void {
  const run = affixesOf(sim);
  for (const a of affixes) {
    if (a === 'bound') {
      run.bind([leader, ...rest]);
    } else {
      run.give(leader, a);
    }
  }
  const first = affixes.at(0);
  if (first && SHARED.has(first)) {
    for (const u of rest) {
      run.give(u, first, 0.5);
    }
  }
}

// A herald wakes the nearest pack still unaware, and sends it to the fight.
function wakeNext(herald: Unit, monsters: readonly Unit[]): void {
  const next = monsters
    .filter((m) => !m.aware)
    .sort((a, b) => herald.distanceTo(a) - herald.distanceTo(b))
    .at(0);
  if (!next) {
    return;
  }
  for (const m of monsters) {
    if (!m.aware && m.distanceTo(next) <= PACK_REACH) {
      m.aware = true;
      m.lastSeen = { x: herald.x, z: herald.z };
    }
  }
}
