import type { MonsterKind } from '../content/roster';
import type RNG from '../core/rng';
import Nav, { type Spot } from '../sim/nav';

export type PropKind =
  | 'pillar'
  | 'wall'
  | 'rubble'
  | 'gibbet'
  | 'pike'
  | 'banner'
  | 'altar'
  | 'candle'
  | 'chest'
  | 'stair'
  | 'brazier'
  | 'campfire';

export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
  // How far it blocks bodies and sight, in tiles. Absent for props that do not.
  r?: number;
  // For drawing variations, such as a wall block's height
  seed: number;
  // A chest the bearer has opened
  open?: boolean;
}

/** A pack to spawn: its monsters, where it stands, and which one is an elite. */
export interface Pack {
  kinds: MonsterKind[];
  x: number;
  z: number;
  // Index into `kinds` of the elite, or -1
  elite: number;
}

/**
 * One generated stage: an open field the bearer crosses from the entrance
 * on the west edge to the stair down on the east edge.
 */
export interface Stage {
  // 0 for the first stage of a run, counting up
  index: number;
  width: number;
  depth: number;
  entrance: Spot;
  exit: Spot;
  props: Prop[];
  // Blood sigils painted on the floor
  sigils: Spot[];
  // Old blood already on the floor
  stains: { x: number; z: number; r: number }[];
  packs: Pack[];
  // Where a wandering merc waits by its fire, on stages that have one
  recruit?: Spot;
}

// Solid radius of each prop that blocks, in tiles.
const SOLID: Partial<Record<PropKind, number>> = {
  pillar: 0.45,
  wall: 0.5,
  altar: 0.8,
  gibbet: 0.3,
  pike: 0.2,
  banner: 0.2,
  chest: 0.35,
  campfire: 0.3,
};

// Threat each monster costs from a stage's budget. An elite costs more.
const THREAT: Record<MonsterKind, number> = {
  crawler: 2,
  penitent: 2,
  hollowSoldier: 3,
  hollowed: 3,
  cantor: 3,
};
const ELITE_THREAT = 6;

// Ground kept clear around each place, in tiles.
const KEEP_ENTRANCE = 5;
const KEEP_EXIT = 3.5;
const KEEP_PLACE = 3;
// Recruits are offered in phases 1 and 2, the first 16 stages, as the
// mercenaries design says. Below that, no one is left to hire.
export const RECRUIT_STAGES = 16;
const RECRUIT_CHANCE = 0.6;
// Packs never stand this close to the entrance, so a stage does not open in a fight.
const PACK_DISTANCE = 13;

/**
 * Builds a stage from a random stream, following the steps in the stages
 * design: size, entrance and exit, places, terrain from noise, a check that
 * everything can be reached, then packs from a threat budget.
 */
export function generateStage(rng: RNG, index: number): Stage {
  const width = rng.int(54, 62);
  const depth = rng.int(34, 42);
  const entrance = { x: 2.5, z: depth / 2 + rng.range(-depth / 5, depth / 5) };
  const exit = { x: width - 3, z: depth / 2 + rng.range(-depth / 4, depth / 4) };
  const stage: Stage = {
    index,
    width,
    depth,
    entrance,
    exit,
    props: [],
    sigils: [],
    stains: [],
    packs: [],
  };
  const add = (kind: PropKind, x: number, z: number): Prop => {
    const prop: Prop = { kind, x, z, r: SOLID[kind], seed: rng.random() };
    stage.props.push(prop);
    return prop;
  };

  // The stair down, between two braziers.
  add('stair', exit.x, exit.z);
  add('brazier', exit.x - 1.2, exit.z - 1.6);
  add('brazier', exit.x - 1.2, exit.z + 1.6);

  // A ruined wall across the whole field, broken in one or two places: the
  // choke point the design asks for on every main route.
  const wallX = width * rng.range(0.45, 0.58);
  const breaches = [rng.range(depth * 0.2, depth * 0.8)];
  if (rng.chance(0.5)) {
    const second = rng.range(3, depth - 3);
    if (Math.abs(second - breaches[0]) > 8) {
      breaches.push(second);
    }
  }
  const wall: Spot[] = [];
  for (let z = 0.5; z < depth; z += 0.9) {
    if (breaches.some((b) => Math.abs(z - b) < 1.6)) {
      continue;
    }
    const x = wallX + Math.sin(z * 0.35) * 0.8;
    wall.push({ x, z });
    add('wall', x, z);
  }

  // Places: the Church's sealing site, a lair, a cache.
  const keep: { x: number; z: number; r: number }[] = [
    { ...entrance, r: KEEP_ENTRANCE },
    { ...exit, r: KEEP_EXIT },
  ];
  const away = (x: number, z: number, gap: number): boolean =>
    keep.every((k) => Math.hypot(k.x - x, k.z - z) >= k.r + gap) &&
    wall.every((w) => Math.hypot(w.x - x, w.z - z) >= 2 + gap);
  const spot = (x0: number, x1: number, gap: number): Spot => {
    for (let i = 0; i < 60; i++) {
      const x = rng.range(x0, x1);
      const z = rng.range(4, depth - 4);
      if (away(x, z, gap)) {
        return { x, z };
      }
    }
    return { x: (x0 + x1) / 2, z: depth / 2 };
  };

  // The site sits on whichever side of the wall the seed picks.
  const siteFirst = rng.chance(0.5);
  const site = siteFirst ? spot(16, wallX - 6, 4) : spot(wallX + 6, width - 10, 4);
  keep.push({ ...site, r: 5 });
  stage.sigils.push(site);
  add('altar', site.x, site.z);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    add('candle', site.x + Math.cos(a) * 2.4, site.z + Math.sin(a) * 2.4);
  }
  add('banner', site.x - 2, site.z - 2.8);

  const lair = siteFirst ? spot(wallX + 6, width - 8, 3) : spot(16, wallX - 6, 3);
  keep.push({ ...lair, r: 4 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(i % 2 ? 'gibbet' : 'pike', lair.x + Math.cos(a) * 3.2, lair.z + Math.sin(a) * 3.2);
  }

  const cache = spot(10, width - 8, 1);
  keep.push({ ...cache, r: KEEP_PLACE });
  add('chest', cache.x, cache.z);

  // A wandering merc by its fire, only while there is still anyone to hire.
  if (index >= 1 && index < RECRUIT_STAGES && rng.chance(RECRUIT_CHANCE)) {
    const camp = spot(10, wallX - 4, 2);
    keep.push({ ...camp, r: 5 });
    add('campfire', camp.x, camp.z);
    stage.recruit = { x: camp.x + 1, z: camp.z };
  }

  // Terrain from noise: pillars where it runs high, rubble where it runs low.
  const noise = valueNoise(rng, width, depth, 7);
  const solids: Spot[] = [];
  for (let i = 0; i < width * depth * 0.06; i++) {
    const x = rng.range(1.5, width - 1.5);
    const z = rng.range(1.5, depth - 1.5);
    const n = noise(x, z);
    if (!away(x, z, 0) || solids.some((s) => Math.hypot(s.x - x, s.z - z) < 2.2)) {
      continue;
    }
    if (n > 0.68) {
      add('pillar', x, z);
      solids.push({ x, z });
    } else if (n < 0.3) {
      const r = rng.range(0.35, 0.6);
      add('rubble', x, z).r = r;
      solids.push({ x, z });
    }
  }
  // Pikes and gibbets along the way: the Church's offerings.
  for (let i = 0; i < 6; i++) {
    const s = spot(8, width - 6, 0.5);
    add(rng.chance(0.6) ? 'pike' : 'gibbet', s.x, s.z);
  }

  ensureReachable(stage, [exit, site, lair, cache]);

  for (let i = 0; i < 10; i++) {
    stage.stains.push({
      x: rng.range(3, width - 3),
      z: rng.range(3, depth - 3),
      r: rng.range(0.4, 0.9),
    });
  }

  placePacks(stage, rng, { site, lair, breach: { x: wallX, z: breaches[0] } });
  return stage;
}

// Removes loose obstacles between the entrance and any place it cannot reach.
// Walls stay: their breaches already guarantee a way through.
function ensureReachable(stage: Stage, places: Spot[]): void {
  for (let attempt = 0; attempt < 6; attempt++) {
    const nav = navFor(stage);
    const stuck = places.filter((p) => !reaches(nav, stage.entrance, p));
    if (stuck.length === 0) {
      return;
    }
    for (const p of stuck) {
      stage.props = stage.props.filter(
        (prop) =>
          prop.kind === 'wall' ||
          prop.r === undefined ||
          distanceToSegment(prop, stage.entrance, p) > prop.r + 1.2,
      );
    }
  }
}

/** Where units can walk on a stage. */
export function navFor(stage: Stage): Nav {
  return new Nav(stage.width, stage.depth, solidsOf(stage));
}

/** The props that block bodies, as obstacles. */
export function solidsOf(stage: Stage): { x: number; z: number; r: number }[] {
  return stage.props.flatMap((p) => (p.r === undefined ? [] : [{ x: p.x, z: p.z, r: p.r }]));
}

function reaches(nav: Nav, from: Spot, to: Spot): boolean {
  const path = nav.path(from, to);
  const end = path.at(-1);
  return end !== undefined && Math.hypot(end.x - to.x, end.z - to.z) < 2;
}

function distanceToSegment(p: Spot, a: Spot, b: Spot): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
}

// The factions a pack can come from, and what each fields.
const FACTIONS: MonsterKind[][] = [
  ['crawler', 'crawler', 'crawler'],
  ['hollowSoldier', 'hollowSoldier'],
  ['penitent', 'penitent', 'hollowed'],
  ['hollowed', 'hollowed'],
];

function placePacks(
  stage: Stage,
  rng: RNG,
  places: { site: Spot; lair: Spot; breach: Spot },
): void {
  let budget = 24 + stage.index * 5;
  const cost = (kinds: MonsterKind[], elite: number): number =>
    kinds.reduce((sum, k) => sum + THREAT[k], 0) + (elite >= 0 ? ELITE_THREAT : 0);
  const push = (pack: Pack): void => {
    stage.packs.push(pack);
    budget -= cost(pack.kinds, pack.elite);
  };

  // The Church keeps its site: Penitents and the Cantor who sings for them.
  push({
    kinds: ['penitent', 'penitent', 'cantor'],
    x: places.site.x,
    z: places.site.z,
    elite: -1,
  });
  // The lair holds the strongest pack, led by an elite.
  push({
    kinds: ['hollowSoldier', 'hollowSoldier', 'hollowSoldier'],
    x: places.lair.x,
    z: places.lair.z,
    elite: 0,
  });
  // A pack watches the first breach in the wall, from the far side.
  const breach = places.breach;
  push({ kinds: [...rng.pick(FACTIONS)].slice(0, 2), x: breach.x + 2.5, z: breach.z, elite: -1 });
  const nav = navFor(stage);
  for (let i = 0; i < 40; i++) {
    if (budget <= 0) {
      break;
    }
    const kinds = [...rng.pick(FACTIONS)].slice(0, rng.int(2, 3));
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
      !nav.walkable(x, z) ||
      Math.hypot(x - stage.entrance.x, z - stage.entrance.z) < PACK_DISTANCE
    ) {
      continue;
    }
    push({ kinds, x, z, elite: -1 });
  }
}

// Smooth noise from 0 to 1: random values on a coarse lattice, blended.
function valueNoise(
  rng: RNG,
  width: number,
  depth: number,
  cell: number,
): (x: number, z: number) => number {
  const cols = Math.ceil(width / cell) + 2;
  const rows = Math.ceil(depth / cell) + 2;
  const grid = Array.from({ length: cols * rows }, () => rng.random());
  const at = (i: number, j: number): number => grid[j * cols + i];
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  return (x, z) => {
    const fx = x / cell;
    const fz = z / cell;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = smooth(fx - i);
    const tz = smooth(fz - j);
    const top = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
    const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
    return top + (bottom - top) * tz;
  };
}
