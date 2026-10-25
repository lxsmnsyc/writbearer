import type { Patch } from '../gen/stage';
import type Sim from '../sim/sim';
import type { Modifier } from '../sim/stats';
import type Unit from '../sim/unit';
import { type Affix, affixesOf, giveAffixes } from './affixes';
import { type MonsterKind, spawnMonster } from './roster';

// Mini-bosses, from the bestiary, after Diablo 2's Bishibosh and
// Rakanishu: named monsters with fixed affixes, an escort and a gimmick.
// Each is built on a monster already in the game. A run meets each at most
// once.
//
// So far seven of the sixteen, those the monsters in the game can carry:
// the Bell-Ringer and the First Keeper in the Marches, the Shield-Oath, the
// Bone Quartermaster and the Horn of the Road on the Rift Road, the
// Drowned Cantor in the Undercroft and the Last Herald in the Sunken Crown.

export type MiniBossId =
  | 'bellRinger'
  | 'firstKeeper'
  | 'shieldOath'
  | 'boneQuartermaster'
  | 'hornOfTheRoad'
  | 'drownedCantor'
  | 'lastHerald';

export interface MiniBoss {
  id: MiniBossId;
  name: string;
  // The layer it is met in, from 0
  layer: number;
  // The monster it is built on, and those with it
  kind: MonsterKind;
  escort: MonsterKind[];
  affixes: Affix[];
  // What a captain's calls it makes, if it calls more to its side
  calls?: MonsterKind[];
  // Its gimmick, in a line, for its floor label and the log
  text: string;
}

export const MINI_BOSSES: Record<MiniBossId, MiniBoss> = {
  bellRinger: {
    id: 'bellRinger',
    name: 'The Bell-Ringer',
    layer: 0,
    kind: 'penitent',
    escort: ['penitent', 'penitent', 'penitent'],
    affixes: ['herald', 'might'],
    text: 'A Penitent with a hand bell. Every ten seconds it wakes the next pack.',
  },
  firstKeeper: {
    id: 'firstKeeper',
    name: 'The First Keeper',
    layer: 0,
    kind: 'penitent',
    escort: ['cantor', 'cantor', 'penitent', 'penitent'],
    affixes: ['warded', 'mending'],
    text: 'The oldest Penitent of the Marches. Its Ward refills while its Cantors live.',
  },
  shieldOath: {
    id: 'shieldOath',
    name: 'The Shield-Oath',
    layer: 1,
    kind: 'hollowSoldier',
    escort: ['hollowSoldier', 'hollowSoldier', 'hollowSoldier', 'hollowSoldier'],
    affixes: ['bound', 'stoneskin'],
    text: 'A Hollow soldier sworn to its pack. A hit on any of them hurts all.',
  },
  boneQuartermaster: {
    id: 'boneQuartermaster',
    name: 'The Bone Quartermaster',
    layer: 1,
    kind: 'hollowArcher',
    escort: ['hollowArcher', 'hollowArcher', 'hollowSoldier', 'hollowSoldier'],
    affixes: ['multishot', 'stoneskin'],
    text: 'A Hollow Archer captain. It looses three arrows at once. Barriers stop them.',
  },
  hornOfTheRoad: {
    id: 'hornOfTheRoad',
    name: 'The Horn of the Road',
    layer: 1,
    kind: 'hornBearer',
    escort: ['hollowSoldier', 'hollowSoldier', 'hollowSoldier'],
    affixes: ['herald', 'swift'],
    text: 'A Horn-Bearer that runs from post to post. Each horn blown sends a pack.',
  },
  drownedCantor: {
    id: 'drownedCantor',
    name: 'The Drowned Cantor',
    layer: 2,
    kind: 'cantor',
    escort: ['penitent', 'penitent', 'penitent', 'husk', 'husk'],
    affixes: ['mending', 'frostEnchanted'],
    text: 'It sings, and the floor floods round it. The water slows the party until it is silenced.',
  },
  lastHerald: {
    id: 'lastHerald',
    name: 'The Last Herald',
    layer: 3,
    kind: 'hollowed',
    escort: ['hollowed', 'hollowed', 'hollowed'],
    affixes: ['herald', 'might'],
    calls: ['hollowed', 'hollowed'],
    text: 'The Crown’s last guard captain. It calls the dead from the ruins.',
  },
};

/** The mini-bosses a layer may hold. */
export const miniBossesOf = (layer: number): MiniBoss[] =>
  Object.values(MINI_BOSSES).filter((m) => m.layer === layer % 4);

// A mini-boss is much stronger than an elite.
const MINI: Modifier[] = [
  { stat: 'maxHp', percent: 250 },
  { stat: 'atkMin', percent: 40 },
  { stat: 'atkMax', percent: 40 },
  { stat: 'armor', add: 20 },
];
// How far round it its escort stands
const ESCORT_RING = 1.4;

/** A mini-boss and its escort, standing at a spot. */
export function spawnMiniBoss(
  sim: Sim,
  def: MiniBoss,
  level: number,
  x: number,
  z: number,
): { boss: Unit; escort: Unit[] } {
  const boss = spawnMonster(sim, def.kind, level, x, z, {
    elite: true,
    name: def.name,
    modifiers: MINI,
  });
  boss.named = true;
  const escort = def.escort.map((kind, i) => {
    const a = (i / def.escort.length) * Math.PI * 2;
    return spawnMonster(
      sim,
      kind,
      level,
      x + Math.cos(a) * ESCORT_RING,
      z + Math.sin(a) * ESCORT_RING,
    );
  });
  giveAffixes(sim, boss, escort, def.affixes);
  if (def.calls) {
    boss.calls = def.calls;
  }
  // The First Keeper's Ward refills only while its Cantors live.
  if (def.id === 'firstKeeper') {
    const cantors = escort.filter((u) => u.kind === 'cantor');
    affixesOf(sim).keepWard(boss, () => cantors.some((c) => c.alive));
  }
  return { boss, escort };
}

// The Drowned Cantor's flood: how often a pool rises, how big, how far from
// it, and how many at most
const FLOOD_EVERY = 6;
const FLOOD_R = 2.5;
const FLOOD_REACH = 7;
const FLOOD_MOST = 4;

/**
 * Mini-bosses' gimmicks that change the ground: the Drowned Cantor floods
 * the floor round it while it sings, and the water drains once it is dead.
 */
export class Floods {
  private readonly pools = new Map<Unit, { patches: Patch[]; clock: number }>();

  /** Works each Drowned Cantor in the fight, on the patches of its area. */
  update(sim: Sim, dt: number, patches: Patch[]): void {
    for (const u of sim.units) {
      if (u.name !== MINI_BOSSES.drownedCantor.name || !u.named) {
        continue;
      }
      let f = this.pools.get(u);
      if (!f) {
        f = { patches: [], clock: 0 };
        this.pools.set(u, f);
      }
      if (!u.alive) {
        for (const p of f.patches) {
          const i = patches.indexOf(p);
          if (i >= 0) {
            patches.splice(i, 1);
          }
        }
        f.patches.length = 0;
        continue;
      }
      if (!u.aware) {
        continue;
      }
      f.clock += dt;
      if (f.clock < FLOOD_EVERY || f.patches.length >= FLOOD_MOST) {
        continue;
      }
      f.clock = 0;
      const a = f.patches.length * 2.4;
      const d = FLOOD_REACH * (0.4 + 0.15 * f.patches.length);
      const at = sim.nav?.free(u.x + Math.cos(a) * d, u.z + Math.sin(a) * d) ?? u;
      const pool: Patch = { kind: 'water', x: at.x, z: at.z, r: FLOOD_R };
      f.patches.push(pool);
      patches.push(pool);
    }
  }
}
