import type { Lifecycle } from '../core/lifecycle';
import { EventPriority } from '../core/event-emitter';
import { SimEvents } from '../sim/events';
import type { Modifier } from '../sim/stats';
import type Sim from '../sim/sim';
import { Category } from '../sim/stats';
import { DamageKind, Element, Range, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { listen } from './passives';

// Squad sets, from the items design: named pieces with fixed stats that
// help only their wearer, and bonuses for the whole party that unlock as
// more of the set is worn across it. A piece counts while a living merc
// wears it, and two pieces on one merc count once, so a set is spread.

export interface SetPiece {
  id: string;
  name: string;
  // The base it is made on, and the item level it can drop from
  base: string;
  level: number;
  modifiers: Modifier[];
  lines: string[];
  // Discipline it gives its wearer while worn
  discipline?: number;
}

export interface SetBonus {
  // Pieces worn across the party to unlock it
  count: number;
  line: string;
  // What every living merc gets, and what the bearer gets
  mercs?: Modifier[];
  bearer?: Modifier[];
  // Discipline every living merc gets
  discipline?: number;
  // What it does beyond stats, while unlocked
  effect?: (sim: Sim) => Lifecycle;
}

export interface SetDef {
  id: string;
  name: string;
  pieces: SetPiece[];
  bonuses: SetBonus[];
  lore: string;
}

// Rites of the Pale Choir, 3 pieces: once an area, the first merc to die
// rises again at 30% health, on the next tick. The set was whole when it
// died, so it still rises if its death breaks the set.
const RISE_SHARE = 0.3;
// The area each simulation last used the rise in, kept apart from the
// effect so breaking and remaking the set does not grant another.
const ROSE_IN = new WeakMap<Sim, number>();
function choirRises(sim: Sim): Lifecycle {
  let rising: Unit | null = null;
  let stopped = false;
  const dies = listen(sim, SimEvents.UnitDies, EventPriority.Post, (event) => {
    const dead = event.source;
    if (
      dead.side === Side.Party &&
      dead !== sim.bearer &&
      !dead.torn &&
      ROSE_IN.get(sim) !== sim.area
    ) {
      ROSE_IN.set(sim, sim.area);
      rising = dead;
    }
  });
  const tick = listen(sim, SimEvents.Tick, EventPriority.Post, () => {
    const u = rising;
    rising = null;
    u?.revive(RISE_SHARE);
    if (stopped) {
      tick.stop();
    }
  });
  return {
    start: () => {
      stopped = false;
      dies.start();
      tick.start();
    },
    stop: () => {
      stopped = true;
      dies.stop();
      if (!rising) {
        tick.stop();
      }
    },
  };
}

export const SETS: readonly SetDef[] = [
  {
    id: 'ironCompany',
    name: 'Oath of the Iron Company',
    lore: 'A free company that took the Guild’s coin for three generations, and never once asked what the Writ said.',
    pieces: [
      {
        id: 'ironHelm',
        name: 'Iron Company Helm',
        base: 'kettleHelm',
        level: 4,
        modifiers: [
          { stat: 'armor', add: 20 },
          { base: 'vit', add: 3 },
        ],
        lines: ['+20 armor', '+3 VIT'],
      },
      {
        id: 'ironHauberk',
        name: 'Iron Company Hauberk',
        base: 'hauberk',
        level: 5,
        modifiers: [
          { stat: 'armor', add: 25 },
          { reduce: Category.AttackRange, key: Range.Ranged, percent: 10 },
        ],
        lines: ['+25 armor', '-10% damage from ranged attacks'],
      },
      {
        id: 'ironBanner',
        name: 'Iron Company Banner',
        base: 'towerShield',
        level: 4,
        modifiers: [
          { stat: 'blockChance', add: 6 },
          { base: 'wil', add: 3 },
        ],
        lines: ['+6% block', '+3 WIL'],
      },
      {
        id: 'ironSignet',
        name: 'Iron Company Signet',
        base: 'ring',
        level: 3,
        modifiers: [],
        lines: ['+5 Discipline'],
        discipline: 5,
      },
    ],
    bonuses: [
      { count: 2, line: 'Every merc: +10% armor', mercs: [{ stat: 'armor', percent: 10 }] },
      { count: 3, line: 'Every merc: +10 Discipline', discipline: 10 },
      {
        count: 4,
        line: 'The bearer takes 15% less damage',
        bearer: [
          { reduce: Category.Kind, key: DamageKind.Physical, percent: 15 },
          { reduce: Category.Kind, key: DamageKind.Magical, percent: 15 },
        ],
      },
    ],
  },
  {
    id: 'paleChoir',
    name: 'Rites of the Pale Choir',
    lore: 'Vestments of the old faith, from before the Church went under the city and learned another hymn.',
    pieces: [
      {
        id: 'choirCenser',
        name: 'Pale Choir Censer',
        base: 'censer',
        level: 4,
        modifiers: [
          { base: 'int', add: 4 },
          { stat: 'maxMana', percent: 10 },
        ],
        lines: ['+4 INT', '+10% max mana'],
      },
      {
        id: 'choirHood',
        name: 'Pale Choir Hood',
        base: 'hood',
        level: 3,
        modifiers: [
          { base: 'wil', add: 3 },
          { stat: 'resistance', add: 10 },
        ],
        lines: ['+3 WIL', '+10 resistance'],
      },
      {
        id: 'choirVestments',
        name: 'Pale Choir Vestments',
        base: 'vestments',
        level: 5,
        modifiers: [
          { stat: 'armor', add: 15 },
          { base: 'int', add: 3 },
        ],
        lines: ['+15 armor', '+3 INT'],
      },
    ],
    bonuses: [
      {
        count: 2,
        line: 'Every merc: +15% Radiant damage',
        mercs: [{ amplify: Category.AttackElement, key: Element.Radiant, percent: 15 }],
      },
      {
        count: 3,
        line: 'Once an area, the first merc to die rises at 30% health',
        effect: choirRises,
      },
    ],
  },
  {
    id: 'wardensWatch',
    name: 'The Warden’s Watch',
    lore: 'The kit of the Marches’ last forester, who watched the road for the Old King long after there was no king.',
    pieces: [
      {
        id: 'wardenBow',
        name: 'Warden’s Longbow',
        base: 'yewLongbow',
        level: 5,
        modifiers: [
          { stat: 'atkMin', percent: 15 },
          { stat: 'atkMax', percent: 15 },
          { base: 'dex', add: 3 },
        ],
        lines: ['+15% attack', '+3 DEX'],
      },
      {
        id: 'wardenCloak',
        name: 'Warden’s Cloak',
        base: 'shroud',
        level: 3,
        modifiers: [
          { base: 'agi', add: 3 },
          { stat: 'evasion', add: 10 },
        ],
        lines: ['+3 AGI', '+10 evasion'],
      },
      {
        id: 'wardenBoots',
        name: 'Warden’s Boots',
        base: 'boots',
        level: 2,
        modifiers: [{ base: 'agi', add: 3 }],
        lines: ['+3 AGI'],
      },
    ],
    bonuses: [
      { count: 2, line: 'Every merc: +5 DEX', mercs: [{ base: 'dex', add: 5 }] },
      { count: 3, line: 'The bearer: +25 evasion', bearer: [{ stat: 'evasion', add: 25 }] },
    ],
  },
];

export const SET_BY_ID: ReadonlyMap<string, SetDef> = new Map(SETS.map((s) => [s.id, s]));

/** Every piece, with its set, by piece id. */
export const PIECE_BY_ID: ReadonlyMap<string, { set: SetDef; piece: SetPiece }> = new Map(
  SETS.flatMap((set) => set.pieces.map((piece) => [piece.id, { set, piece }] as const)),
);

const mercsOf = (sim: Sim): Unit[] => sim.living(Side.Party).filter((u) => u !== sim.bearer);

/** The set pieces a unit wears, by piece id. */
function piecesOn(unit: Unit): string[] {
  return [...unit.equipment.values()].flatMap((i) => (i.piece === undefined ? [] : [i.piece]));
}

/**
 * How many pieces of a set count across the party: distinct pieces worn by
 * living mercs, and at most one for each merc.
 */
export function setCount(sim: Sim, set: SetDef): number {
  const pieces = new Set<string>();
  let wearers = 0;
  for (const m of mercsOf(sim)) {
    const own = piecesOn(m).filter((id) => PIECE_BY_ID.get(id)?.set === set);
    if (own.length > 0) {
      wearers++;
      for (const id of own) {
        pieces.add(id);
      }
    }
  }
  return Math.min(pieces.size, wearers);
}

// The set effects running in each simulation, by set and bonus.
const RUNNING = new WeakMap<Sim, Map<string, Lifecycle>>();

/**
 * Works out every set's bonuses from what the party wears now, and gives
 * them out: to every living merc, to the bearer, and the effects beyond
 * stats. Call it whenever gear changes, or a merc dies or rises.
 */
export function applySets(sim: Sim): void {
  const running = RUNNING.get(sim) ?? new Map<string, Lifecycle>();
  RUNNING.set(sim, running);
  const mercs = mercsOf(sim);
  const party = [...sim.units].filter((u) => u.side === Side.Party);
  const mercMods: Modifier[] = [];
  const bearerMods: Modifier[] = [];
  let discipline = 0;
  const active = new Set<string>();
  for (const set of SETS) {
    const count = setCount(sim, set);
    for (const [i, bonus] of set.bonuses.entries()) {
      if (count < bonus.count) {
        continue;
      }
      mercMods.push(...(bonus.mercs ?? []));
      bearerMods.push(...(bonus.bearer ?? []));
      discipline += bonus.discipline ?? 0;
      const key = `${set.id}:${i}`;
      if (bonus.effect && !running.has(key)) {
        const life = bonus.effect(sim);
        running.set(key, life);
        life.start();
      }
      if (bonus.effect) {
        active.add(key);
      }
    }
  }
  for (const [key, life] of running) {
    if (!active.has(key)) {
      life.stop();
      running.delete(key);
    }
  }
  for (const u of party) {
    let mine: Modifier[] = [];
    if (u === sim.bearer) {
      mine = bearerMods;
    } else if (mercs.includes(u)) {
      mine = mercMods;
    }
    u.setBonus('sets', mine.length > 0 ? mine : null);
    // A piece's own Discipline, and the sets', while it is alive in the party
    const own = piecesOn(u).reduce((n, id) => n + (PIECE_BY_ID.get(id)?.piece.discipline ?? 0), 0);
    u.disciplineBonus = mercs.includes(u) ? own + discipline : 0;
  }
}
