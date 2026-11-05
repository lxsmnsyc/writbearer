// Threat, factions and the packs placed on a field.
import { AFFIXES, type Affix } from '../../content/affixes';
import type { MiniBossId } from '../../content/minibosses';
import { MONSTERS, type MonsterKind } from '../../content/roster';
import type RNG from '../../core/rng';
import type { Spot } from '../../sim/nav';
import { Range } from '../../sim/types';
import { AREAS_PER_LAYER } from '../layers';
import { navFor } from './reach';
import type { Stage } from './types';

/** A pack to spawn: its monsters, where it stands, and which one is an elite. */
export interface Pack {
  kinds: MonsterKind[];
  x: number;
  z: number;
  // Index into `kinds` of the elite, or -1
  elite: number;
  // Index into `kinds` of a Labyrinth's key-bearer, if the pack has one
  key?: number;
  // Index into `kinds` of a Hunt's marked monster, if the pack has one
  marked?: number;
  // Index into `kinds` of its captain, who calls more of the pack while it lives
  captain?: number;
  // Its elite's affixes, the first shared by the pack
  affixes?: Affix[];
  // A mini-boss and its escort, standing in place of its kinds
  mini?: MiniBossId;
}

// Whether a kind of monster shoots
export const shoots = (kind: MonsterKind): boolean => MONSTERS[kind].job.range === Range.Ranged;

// Threat each monster costs from a stage's budget. An elite costs more.
export const THREAT: Record<MonsterKind, number> = {
  mite: 1,
  husk: 1,
  crawler: 2,
  penitent: 2,
  hollowSoldier: 3,
  hornBearer: 2,
  hollowArcher: 2,
  hollowShieldbearer: 3,
  bloat: 2,
  penitentSlinger: 2,
  hornPost: 0,
  hollowed: 3,
  cantor: 3,
  // Bosses are never rolled into a pack. They wait in their fields.
  broodMother: 20,
  gatekeeper: 20,
  abbess: 20,
  hollowedSaint: 20,
  creditor: 20,
  ossuaryPriest: 4,
  titheTaker: 3,
  confessor: 3,
  flagellant: 3,
};
const ELITE_THREAT = 6;

// Packs never stand this close to the entrance, so a stage does not open in a fight.
export const PACK_DISTANCE = 13;

// The packs a stage can field, by how deep it is: weak things near the
// surface, the Church's mad and the Old King's guard further down.
// Each layer's packs, as the lore lays the Hollow out. `from` is the first
// area of the layer, from 0, a pack can appear in. A pack is its kinds over
// and over until it is `size` strong: swarms of the weak, fewer of the
// strong.
export interface Faction {
  layer: number;
  from: number;
  kinds: MonsterKind[];
  size: [number, number];
}

// Swarms of fodder, mixed packs, and packs of the strong
const SWARM: [number, number] = [6, 12];
export const MIXED: [number, number] = [4, 8];
const STRONG: [number, number] = [3, 5];

export const FACTIONS: Faction[] = [
  // The Marches: the Blight at the rim, the drowned, and the Church's first keepers
  { layer: 0, from: 0, kinds: ['mite'], size: SWARM },
  { layer: 0, from: 0, kinds: ['husk'], size: SWARM },
  { layer: 0, from: 0, kinds: ['husk', 'mite', 'mite'], size: MIXED },
  { layer: 0, from: 2, kinds: ['crawler', 'mite', 'mite'], size: MIXED },
  { layer: 0, from: 2, kinds: ['hollowSoldier', 'husk', 'husk', 'husk'], size: MIXED },
  { layer: 0, from: 2, kinds: ['husk', 'bloat', 'husk', 'husk'], size: MIXED },
  { layer: 0, from: 4, kinds: ['penitent', 'penitent', 'husk'], size: MIXED },
  { layer: 0, from: 4, kinds: ['crawler'], size: MIXED },
  { layer: 0, from: 4, kinds: ['hollowSoldier'], size: STRONG },
  { layer: 0, from: 3, kinds: ['penitent', 'penitentSlinger', 'penitent'], size: MIXED },
  { layer: 0, from: 5, kinds: ['hollowed', 'penitent', 'penitent'], size: MIXED },
  { layer: 0, from: 6, kinds: ['hollowed'], size: STRONG },
  // The Rift Road: the Old King's guard holds the road down
  { layer: 1, from: 0, kinds: ['hollowSoldier', 'hollowSoldier', 'husk'], size: MIXED },
  { layer: 1, from: 0, kinds: ['hollowSoldier', 'husk', 'husk', 'husk'], size: MIXED },
  { layer: 1, from: 0, kinds: ['crawler', 'mite', 'mite'], size: SWARM },
  {
    layer: 1,
    from: 1,
    kinds: ['hollowSoldier', 'hollowSoldier', 'hollowArcher', 'hollowArcher'],
    size: MIXED,
  },
  {
    layer: 1,
    from: 1,
    kinds: ['hollowShieldbearer', 'hollowArcher', 'hollowSoldier'],
    size: MIXED,
  },
  { layer: 1, from: 2, kinds: ['hollowSoldier'], size: STRONG },
  { layer: 1, from: 3, kinds: ['crawler', 'mite', 'bloat', 'mite'], size: MIXED },
  { layer: 1, from: 4, kinds: ['penitent', 'hollowSoldier', 'hollowSoldier'], size: MIXED },
  // The Drowned Undercroft: the Church's keepers and the drowned
  { layer: 2, from: 0, kinds: ['penitent', 'penitent', 'husk'], size: MIXED },
  { layer: 2, from: 0, kinds: ['husk'], size: SWARM },
  { layer: 2, from: 0, kinds: ['cantor', 'penitent', 'penitent', 'penitent'], size: MIXED },
  {
    layer: 2,
    from: 1,
    kinds: ['penitent', 'penitent', 'penitentSlinger', 'penitentSlinger'],
    size: MIXED,
  },
  { layer: 2, from: 3, kinds: ['penitent'], size: MIXED },
  { layer: 2, from: 4, kinds: ['hollowed', 'penitent'], size: STRONG },
  { layer: 2, from: 1, kinds: ['ossuaryPriest', 'penitent', 'penitent', 'husk'], size: MIXED },
  { layer: 2, from: 2, kinds: ['titheTaker', 'penitent', 'penitent'], size: MIXED },
  { layer: 2, from: 2, kinds: ['confessor', 'penitent', 'penitentSlinger'], size: MIXED },
  { layer: 2, from: 3, kinds: ['flagellant', 'penitent', 'penitent'], size: MIXED },
  // The Sunken Crown: the mad, and the last of the guard
  { layer: 3, from: 0, kinds: ['hollowed'], size: STRONG },
  { layer: 3, from: 0, kinds: ['hollowed', 'penitent', 'penitent'], size: MIXED },
  { layer: 3, from: 0, kinds: ['cantor', 'hollowSoldier', 'hollowSoldier'], size: MIXED },
  { layer: 3, from: 1, kinds: ['hollowSoldier', 'hollowArcher', 'hollowArcher'], size: MIXED },
  {
    layer: 3,
    from: 2,
    kinds: ['hollowShieldbearer', 'hollowSoldier', 'hollowArcher'],
    size: MIXED,
  },
  { layer: 3, from: 3, kinds: ['hollowed', 'hollowed', 'husk', 'husk'], size: MIXED },
];

/** A pack of a faction: its kinds over and over, as many as its size rolls, at most `cap`. */
export function packOf(rng: RNG, f: Faction, cap = Infinity): MonsterKind[] {
  const n = Math.min(cap, rng.int(f.size[0], f.size[1]));
  return Array.from({ length: n }, (_, i) => f.kinds[i % f.kinds.length]);
}

// A pack straying on the way to a boss: the Brood Mother's mites in
// the Marches, the layer's own packs below.
export function approachPack(rng: RNG, layer: number): MonsterKind[] {
  if (layer === 0) {
    return packOf(rng, FACTIONS[0]);
  }
  return packOf(rng, rng.pick(FACTIONS.filter((f) => f.layer === layer && f.from === 0)));
}

/** The level of a stage's monsters: low near the surface, one more each stage. */
export const monsterLevel = (index: number): number => 2 + index;

// What keeps the Church's site, by depth: one Penitent near the surface,
// then more, then a Cantor to sing for them.
function siteKeepers(index: number): MonsterKind[] {
  if (index < 2) {
    return ['penitent', 'penitent', 'penitent'];
  }
  return index < 4
    ? ['penitent', 'penitent', 'penitent', 'penitent']
    : ['cantor', 'penitent', 'penitent', 'penitent', 'penitent'];
}

// What holds the lair, by depth, and below the Marches by layer.
function lairPack(index: number, layer: number): MonsterKind[] {
  // The leader first: an elite leads the lair from deep enough.
  if (layer === 2) {
    return ['cantor', 'penitent', 'penitent', 'penitent', 'penitent', 'husk', 'husk'];
  }
  if (layer === 3) {
    return ['hollowed', 'hollowed', 'hollowed', 'hollowed', 'penitent', 'penitent'];
  }
  if (index < 2) {
    return ['husk', 'husk', 'husk', 'husk', 'husk', 'husk'];
  }
  return index < 4
    ? ['hollowSoldier', 'husk', 'husk', 'husk', 'husk', 'husk']
    : ['hollowSoldier', 'hollowSoldier', 'hollowSoldier', 'husk', 'husk', 'husk', 'husk'];
}

// An elite leads the lair's pack from this stage on.
export const ELITE_FROM = 4;
const BUDGET_BASE = 24;
const BUDGET_STEP = 6;
const ELITE_BUDGET = 1.4;

// The packs a stage's layer fields at its depth.
export const factionPool = (stage: Stage): Faction[] =>
  FACTIONS.filter((f) => f.layer === stage.biome && f.from <= stage.index % AREAS_PER_LAYER);

/**
 * The threat an area's monsters add up to: much more than a few small packs,
 * so the field can swarm, and more each area. An Elite area holds more.
 */
export function areaBudget(index: number, elite: boolean, scale = 1): number {
  return (BUDGET_BASE + index * BUDGET_STEP) * (elite ? ELITE_BUDGET : 1) * scale;
}

export function placePacks(
  stage: Stage,
  rng: RNG,
  places: { site: Spot; lair: Spot; breach: Spot },
  eliteArea = false,
): void {
  // An Elite area holds more, and its lair always has an elite.
  let budget = areaBudget(stage.index, eliteArea, stage.scale);
  const pool = factionPool(stage);
  const cost = (kinds: MonsterKind[], elite: number): number =>
    kinds.reduce((sum, k) => sum + THREAT[k], 0) + (elite >= 0 ? ELITE_THREAT : 0);
  const push = (pack: Pack): void => {
    stage.packs.push(pack);
    budget -= cost(pack.kinds, pack.elite);
  };

  // The Church keeps its site.
  push({
    kinds: siteKeepers(stage.index),
    x: places.site.x,
    z: places.site.z,
    elite: -1,
  });
  // The lair holds the strongest pack, led by an elite once deep enough.
  push({
    kinds: lairPack(stage.index, stage.biome),
    x: places.lair.x,
    z: places.lair.z,
    elite: stage.index >= ELITE_FROM || eliteArea ? 0 : -1,
  });
  // A pack watches the narrowest point of the way, from a little past it,
  // on open ground.
  const nav = navFor(stage);
  const watch = nav.free(places.breach.x + 2.5, places.breach.z);
  push({ kinds: packOf(rng, rng.pick(pool)), ...watch, elite: -1 });
  for (let i = 0; i < 40; i++) {
    if (budget <= 0) {
      break;
    }
    const kinds = packOf(rng, rng.pick(pool));
    if (cost(kinds, -1) > budget) {
      break;
    }
    const x = rng.range(PACK_DISTANCE, stage.width - 3);
    const z = rng.range(3, stage.depth - 3);
    // Packs keep apart from each other and from the wanderer's fire.
    const tooNear =
      stage.packs.some((p) => Math.hypot(p.x - x, p.z - z) < 7) ||
      (stage.recruit !== undefined && Math.hypot(stage.recruit.x - x, stage.recruit.z - z) < 9);
    if (
      tooNear ||
      !nav.roomy(x, z) ||
      Math.hypot(x - stage.entrance.x, z - stage.entrance.z) < PACK_DISTANCE
    ) {
      continue;
    }
    push({ kinds, x, z, elite: -1 });
  }
  appointCaptains(stage, rng, eliteArea);
  for (const p of stage.packs) {
    if (p.elite >= 0) {
      p.affixes = rollAffixes(rng, stage.biome, p.kinds.length, shoots(p.kinds[p.elite]));
    }
  }
}

// How many affixes an elite rolls, by layer: one in the Marches, two in the
// Rift Road and the Undercroft, three in the Sunken Crown
const AFFIX_COUNT = [1, 2, 2, 3];

/**
 * An elite's affixes, rolled from the layout stream. Bound only for a pack
 * to bind, Multishot only for an elite that shoots.
 */
export function rollAffixes(rng: RNG, layer: number, packSize: number, ranged = false): Affix[] {
  const pool = AFFIXES.filter(
    (a) => (a !== 'bound' || packSize >= 3) && (a !== 'multishot' || ranged),
  );
  const n = AFFIX_COUNT[Math.min(layer, AFFIX_COUNT.length - 1)];
  return rng.shuffle([...pool]).slice(0, n);
}

// The lair's leader is a captain from this area on, or in an Elite area;
// below the Marches, another pack's leader may be one too.
const CAPTAIN_FROM = 2;
const SECOND_CAPTAIN = 0.5;

// Makes the leaders of some packs captains: the lair's, and below the
// Marches, sometimes one of the packs roaming the field.
function appointCaptains(stage: Stage, rng: RNG, eliteArea: boolean): void {
  // The lair's pack is the second placed, after the Church's site.
  if (stage.packs.length > 1 && (stage.index >= CAPTAIN_FROM || eliteArea)) {
    stage.packs[1].captain = 0;
  }
  const roaming = stage.packs.slice(3).filter((p) => p.kinds.length >= 4);
  if (stage.index >= AREAS_PER_LAYER && roaming.length > 0 && rng.chance(SECOND_CAPTAIN)) {
    rng.pick(roaming).captain = 0;
  }
}
