import type { MonsterKind } from '../content/roster';
import type RNG from '../core/rng';
import Nav, { type Rect, type Spot } from '../sim/nav';
import type { MapNode, Mutator, NodeKind, Objective, Reward } from './graph';
import { AREAS_PER_LAYER, LAYERS, layerIndexOf, leadsDown } from './layers';

export type PropKind =
  | 'pillar'
  | 'tree'
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
  | 'torch'
  | 'signpost'
  | 'post'
  | 'strongbox'
  | 'sarcophagus'
  | 'well'
  | 'anvil'
  | 'bench'
  | 'chapel'
  | 'stall'
  | 'campfire';

export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
  // How far it blocks bodies and sight, in tiles. Absent for props that do not.
  r?: number;
  // For drawing variations, such as a wall block's height
  seed: number;
  // A chest the bearer has opened, what a fight's chest holds, and whether
  // its bonus challenge was met
  open?: boolean;
  holds?: Reward;
  better?: boolean;
  // Items added for the fight's mutators
  extra?: number;
}

/** A pack to spawn: its monsters, where it stands, and which one is an elite. */
export interface Pack {
  kinds: MonsterKind[];
  x: number;
  z: number;
  // Index into `kinds` of the elite, or -1
  elite: number;
  // Index into `kinds` of a Hunt's marked monster, if the pack has one
  marked?: number;
}

/** Where an area's exit leads: an area of the layer's map, or down. */
export type Ahead = NodeKind | 'down';

/** Which edge of an area an exit leaves by, as the area is laid out: ahead, left or right. */
export type ExitSide = 'east' | 'north' | 'south';

/** A way out of an area by one of its edges, and what lies beyond it. */
export interface Exit extends Spot {
  ahead: Ahead;
  // The objective of the fight beyond it, what it pays, and its mutators
  objective?: Objective;
  reward?: Reward;
  mutators?: readonly Mutator[];
  // The edge it leaves by, and the way out across it, one tile long
  side: ExitSide;
  out: Spot;
  // Where its signpost stands
  sign: Spot;
  // The road the party took on, and roads not taken, which collapse
  taken?: boolean;
  closed?: boolean;
}

/** What an area is, and where each of its exits leads, north first. */
export interface AreaPlan {
  kind: NodeKind | 'waystation' | 'tomb' | 'guild';
  ahead: Ahead[];
  // An Event's scenery, laid round where it happens
  scene?: readonly PropKind[];
  // The layer whose ground and monsters it has, when not its own, as an
  // endless phase rolls; and whether merc are offered whatever the depth
  biome?: number;
  endless?: boolean;
  // A fight's objective, and the objective and reward of each fight its
  // exits lead to
  objective?: Objective;
  aheadFights?: readonly (Fight | undefined)[];
  // The edge each exit leaves by, in the order of `ahead`. East if absent.
  sides?: readonly ExitSide[];
}

/**
 * One generated stage: an open field the bearer crosses from the entrance
 * on the west edge to an exit on the east edge. An exit is a road on to an
 * area of the layer's map, or, in a layer's last area, the way down.
 */
export interface Stage {
  // 0 for the first stage of a run, counting up
  index: number;
  kind: AreaPlan['kind'];
  // The layer whose ground and monsters it has, from 0
  biome: number;
  width: number;
  depth: number;
  // Where its near corner lies once placed among other areas. 0 as built.
  x0?: number;
  z0?: number;
  entrance: Spot;
  // The first of `exits`
  exit: Spot;
  exits: Exit[];
  props: Prop[];
  // Blood sigils painted on the floor
  sigils: Spot[];
  // Old blood already on the floor
  stains: { x: number; z: number; r: number }[];
  packs: Pack[];
  // The roads from the entrance, through the wall's breach, to each exit
  // and off the east edge
  roads: Spot[][];
  // Whether the exit goes down to the next layer
  down: boolean;
  // Where the boss stands
  boss?: Spot;
  // A Waystation's paymaster's post, where wages are paid and the vault opens
  station?: Spot;
  // Where a wandering merc waits by its fire, on stages that have one
  recruit?: Spot;
  // Where the Guild House's recruits wait, one spot each
  recruits?: Spot[];
  // A Camp's fire, where the party rests
  rest?: Spot;
  // The Creditor's sarcophagus, where the seal breaks
  tomb?: Spot;
  // A Town's well, where its smith, bench, temple and market are dealt with
  town?: Spot;
  // Where an Event happens: the bearer walks up to it to see what waits
  event?: Spot;
  // What the party must do before the exits open, and where the spoils
  // appear once it is done
  objective?: Objective;
  reward?: Spot;
  // A Horde's waves, in the order they come
  waves?: Wave[];
  // A Labyrinth's traps, and its hall at the far end, which is its goal
  hazards?: Hazard[];
  goal?: Rect;
}

/** The floor an area covers, where it lies. */
export const rectOf = (stage: Stage): Rect => ({
  x0: stage.x0 ?? 0,
  z0: stage.z0 ?? 0,
  x1: (stage.x0 ?? 0) + stage.width,
  z1: (stage.z0 ?? 0) + stage.depth,
});

/**
 * A trap on a Labyrinth's floor. Every `period` seconds, from `phase`, it
 * warns, then strikes whoever stands on it for a share of their health.
 * Spikes are quick and small; fire vents slow, wide and hard.
 */
export interface Hazard {
  kind: 'spikes' | 'vent';
  x: number;
  z: number;
  period: number;
  phase: number;
}

/** One wave of a Horde: what comes, from where on the edge, and how long after the last. */
export interface Wave {
  kinds: MonsterKind[];
  from: Spot;
  // Seconds after the wave before it, or after the Horde begins for the first
  delay: number;
  // Index into `kinds` of an elite leading it, or -1
  elite: number;
}

// The plan of an area with one road on to a Combat area, as tests use.
const PLAIN: AreaPlan = { kind: 'combat', ahead: ['combat'] };

type Add = (kind: PropKind, x: number, z: number) => Prop;

// The way out across each edge, and along it
const OUT: Record<ExitSide, Spot> = {
  east: { x: 1, z: 0 },
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
};

/**
 * Lays out an area's exits. Exits on the east edge sit at `z`, or spread
 * along it when there are more. An exit on the north or south edge sits at
 * `sideX` along it. Each road on is marked by the Guild's signpost and two
 * torches; the way down by a stair between two braziers.
 */
function placeExits(
  stage: Stage,
  add: Add,
  ahead: Ahead[],
  z: number,
  sides: readonly ExitSide[] = [],
  sideX = stage.width * 0.75,
): void {
  const sideOf = (k: number): ExitSide => sides.at(k) ?? 'east';
  const east = ahead.map((_, k) => k).filter((k) => sideOf(k) === 'east');
  stage.exits = ahead.map((a, k) => {
    const side = sideOf(k);
    const out = OUT[side];
    let at: Spot;
    if (side === 'north') {
      at = { x: sideX, z: 3 };
    } else if (side === 'south') {
      at = { x: sideX, z: stage.depth - 3 };
    } else {
      const n = east.indexOf(k);
      at = {
        x: stage.width - 3,
        z: east.length === 1 ? z : stage.depth * (0.28 + (0.44 * n) / (east.length - 1)),
      };
    }
    // Back from the edge, and to the left of the way out
    const sign = { x: at.x - out.x * 2.2 + out.z * 2.2, z: at.z - out.z * 2.2 - out.x * 2.2 };
    return { ...at, ahead: a, side, out, sign };
  });
  stage.exit = stage.exits[0];
  for (const e of stage.exits) {
    // Two lights beside it, a step back from the edge
    const back = { x: e.x - e.out.x * 1.2, z: e.z - e.out.z * 1.2 };
    const across = { x: -e.out.z * 1.6, z: e.out.x * 1.6 };
    const light = e.ahead === 'down' ? 'brazier' : 'torch';
    if (e.ahead === 'down') {
      add('stair', e.x, e.z);
    }
    add(light, back.x - across.x, back.z - across.z);
    add(light, back.x + across.x, back.z + across.z);
    if (e.ahead !== 'down') {
      add('signpost', e.sign.x, e.sign.z);
    }
  }
}

/** Where the road from an exit leaves the area: a few tiles past its edge. */
export const beyond = (e: Exit, far = 4): Spot => ({
  x: e.x + e.out.x * far,
  z: e.z + e.out.z * far,
});

// Whether a point is on any of the roads.
const onRoads = (stage: Stage, x: number, z: number, reach = 1.6): boolean =>
  stage.roads.some((road) =>
    road.slice(1).some((b, i) => distanceToSegment({ x, z }, road[i], b) < reach),
  );

// Solid radius of each prop that blocks, in tiles.
const SOLID: Partial<Record<PropKind, number>> = {
  pillar: 0.45,
  tree: 0.4,
  signpost: 0.15,
  wall: 0.5,
  altar: 0.8,
  gibbet: 0.3,
  pike: 0.2,
  banner: 0.2,
  chest: 0.35,
  campfire: 0.3,
  post: 1.1,
  sarcophagus: 0.9,
  well: 0.6,
  anvil: 0.4,
  bench: 0.5,
  chapel: 1.1,
  stall: 0.6,
  strongbox: 0.4,
};

// Threat each monster costs from a stage's budget. An elite costs more.
export const THREAT: Record<MonsterKind, number> = {
  mite: 1,
  husk: 1,
  crawler: 2,
  penitent: 2,
  hollowSoldier: 3,
  hollowed: 3,
  cantor: 3,
  // Bosses are never rolled into a pack. They wait in their fields.
  broodMother: 20,
  gatekeeper: 20,
  abbess: 20,
  hollowedSaint: 20,
  creditor: 20,
};
const ELITE_THREAT = 6;

// Ground kept clear around each place, in tiles.
const KEEP_ENTRANCE = 5;
const KEEP_EXIT = 3.5;
const KEEP_PLACE = 3;
// Wandering mercs wait by fires only in endless mode. In the story, the
// party is hired at the Guild House before the first phase.
const RECRUIT_CHANCE = 0.6;
// What stands tall on a layer's ground: dead trees on earth, pillars on stone.
const tallFor = (biome: number): PropKind =>
  LAYERS[biome]?.ground === 'earth' ? 'tree' : 'pillar';

// Packs never stand this close to the entrance, so a stage does not open in a fight.
const PACK_DISTANCE = 13;

/**
 * Builds a stage from a random stream, following the steps in the stages
 * design: size, entrance and exit, places, terrain from noise, a check that
 * everything can be reached, then packs from a threat budget.
 */
export function generateStage(rng: RNG, index: number, plan: AreaPlan = PLAIN): Stage {
  return withFightsAhead(buildArea(rng, index, plan), plan.aheadFights);
}

/** What a signpost tells of the fight beyond its road. */
export type Fight = Pick<MapNode, 'objective' | 'reward' | 'mutators'>;

/** Notes on each exit the objective and reward of the fight it leads to, for its signpost. */
export function withFightsAhead(stage: Stage, fights: readonly (Fight | undefined)[] = []): Stage {
  stage.exits.forEach((e, k) => {
    e.objective = fights[k]?.objective;
    e.reward = fights[k]?.reward;
    e.mutators = fights[k]?.mutators;
  });
  return stage;
}

function buildArea(rng: RNG, index: number, plan: AreaPlan): Stage {
  const biome = plan.biome ?? layerIndexOf(index);
  // Mercs wait by the fires only in endless mode.
  const hires = plan.endless === true;
  if (leadsDown(index) || plan.kind === 'boss') {
    return generateArena(rng, index, biome);
  }
  if (plan.kind === 'camp') {
    return generateCamp(rng, index, plan.ahead, biome, hires, plan.sides);
  }
  if (plan.kind === 'town') {
    return generateTown(rng, index, plan.ahead, biome, hires, plan.sides);
  }
  if (plan.kind === 'event') {
    return generateEvent(rng, index, plan.ahead, plan.scene ?? [], biome, plan.sides);
  }
  if (plan.objective === 'maze') {
    return generateMaze(rng, index, plan, biome);
  }
  const width = rng.int(54, 62);
  const depth = rng.int(34, 42);
  const entrance = { x: 2.5, z: depth / 2 + rng.range(-depth / 5, depth / 5) };
  const exitZ = depth / 2 + rng.range(-depth / 4, depth / 4);
  const stage: Stage = {
    index,
    kind: plan.kind,
    biome,
    width,
    depth,
    entrance,
    exit: entrance,
    exits: [],
    props: [],
    sigils: [],
    stains: [],
    packs: [],
    roads: [],
    down: false,
  };
  const add: Add = (kind, x, z) => {
    const prop: Prop = { kind, x, z, r: SOLID[kind], seed: rng.random() };
    stage.props.push(prop);
    return prop;
  };
  placeExits(stage, add, plan.ahead, exitZ, plan.sides, width * 0.78);
  stage.down = stage.exits.some((e) => e.ahead === 'down');

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
  stage.roads = stage.exits.map((e) => [
    entrance,
    { x: wallX - 3, z: breaches[0] },
    { x: wallX + 3, z: breaches[0] },
    e,
    beyond(e),
  ]);
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
    ...stage.exits.map((e) => ({ ...e, r: KEEP_EXIT })),
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
  if (index >= 1 && hires && rng.chance(RECRUIT_CHANCE)) {
    const camp = spot(10, wallX - 4, 2);
    keep.push({ ...camp, r: 5 });
    add('campfire', camp.x, camp.z);
    stage.recruit = { x: camp.x + 1, z: camp.z };
  }

  // Terrain from noise: trees or pillars where it runs high, rubble where it
  // runs low. The road stays clear.
  const tall = tallFor(biome);
  const noise = valueNoise(rng, width, depth, 7);
  const solids: Spot[] = [];
  for (let i = 0; i < width * depth * 0.06; i++) {
    const x = rng.range(1.5, width - 1.5);
    const z = rng.range(1.5, depth - 1.5);
    const n = noise(x, z);
    if (
      !away(x, z, 0) ||
      onRoads(stage, x, z) ||
      solids.some((s) => Math.hypot(s.x - x, s.z - z) < 2.2)
    ) {
      continue;
    }
    if (n > 0.68) {
      add(tall, x, z);
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

  ensureReachable(stage, [...stage.exits, site, lair, cache]);

  for (let i = 0; i < 10; i++) {
    stage.stains.push({
      x: rng.range(3, width - 3),
      z: rng.range(3, depth - 3),
      r: rng.range(0.4, 0.9),
    });
  }

  // A Horde's field stands empty: its monsters come in waves.
  if (plan.objective === 'horde') {
    stage.waves = buildWaves(stage, rng, plan.kind === 'elite');
  } else {
    placePacks(
      stage,
      rng,
      { site, lair, breach: { x: wallX, z: breaches[0] } },
      plan.kind === 'elite',
    );
  }
  if (plan.objective) {
    stage.objective = plan.objective;
    // The spoils of a finished objective appear before the exits.
    const mid = stage.exits.reduce((n, e) => n + e.z, 0) / Math.max(1, stage.exits.length);
    stage.reward = { x: width - 7, z: mid };
  }
  if (plan.objective === 'hunt') {
    markHunt(stage, rng, plan.kind === 'elite');
  }
  return stage;
}

// How many marked monsters a Hunt has: 3, one more in an Elite area and one
// more below the Marches.
const HUNT_MARKS = 3;

/**
 * Marks a Hunt's quarry: the lair's leader, then leaders of other packs
 * spread over the field. The exits open once every marked monster is dead.
 */
function markHunt(stage: Stage, rng: RNG, elite: boolean): void {
  const want = HUNT_MARKS + (elite ? 1 : 0) + (stage.index >= AREAS_PER_LAYER ? 1 : 0);
  // The lair's pack is the second placed, after the Church's site.
  const lair = stage.packs[1];
  lair.marked = Math.max(0, lair.elite);
  // Of the packs farthest from the entrance, some at random, so the hunt
  // crosses the field.
  const far = stage.packs
    .filter((p) => p !== lair)
    .sort((a, b) => b.x - a.x)
    .slice(0, 2 * (want - 1));
  for (const p of rng.shuffle(far).slice(0, want - 1)) {
    p.marked = 0;
  }
}

// A small safe field: the entrance on the west, the exits on the east and
// a place between the roads, with trees or pillars round the edge.
function smallField(
  rng: RNG,
  index: number,
  kind: AreaPlan['kind'],
  ahead: Ahead[],
  biome: number,
  sides?: readonly ExitSide[],
): { stage: Stage; add: Add } {
  const width = 28;
  const depth = 24;
  const entrance = { x: 2.5, z: depth / 2 };
  const stage: Stage = {
    index,
    kind,
    biome,
    width,
    depth,
    entrance,
    exit: entrance,
    exits: [],
    props: [],
    sigils: [],
    stains: [],
    packs: [],
    roads: [],
    down: false,
  };
  const add: Add = (k, x, z) => {
    const prop: Prop = { kind: k, x, z, r: SOLID[k], seed: rng.random() };
    stage.props.push(prop);
    return prop;
  };
  placeExits(stage, add, ahead, depth / 2, sides, width * 0.7);
  stage.roads = stage.exits.map((e) => [entrance, e, beyond(e)]);
  return { stage, add };
}

// Trees or pillars round a small field's edge, off the roads and its place.
function edgeTrees(stage: Stage, add: Add, rng: RNG, place: Spot): void {
  const tall = tallFor(stage.biome);
  for (let i = 0; i < 16; i++) {
    const x = rng.range(1.5, stage.width - 1.5);
    const z = rng.chance(0.5) ? rng.range(1, 3.5) : rng.range(stage.depth - 3.5, stage.depth - 1);
    if (Math.hypot(x - place.x, z - place.z) > 4 && !onRoads(stage, x, z)) {
      add(tall, x, z);
    }
  }
}

/**
 * The Guild's Waystation at the top of a layer, before its first area: a
 * small safe field with the paymaster's post and the vault's strongbox
 * between the roads on. No monsters come here. `index` is the index of the
 * layer's first area.
 */
export function generateWaystation(
  rng: RNG,
  index: number,
  ahead: Ahead[] = ['combat'],
  biome = layerIndexOf(index),
  sides?: readonly ExitSide[],
): Stage {
  const { stage, add } = smallField(rng, index, 'waystation', ahead, biome, sides);
  const post = { x: stage.width / 2, z: stage.depth / 2 };
  stage.station = { x: post.x - 1.8, z: post.z };
  add('post', post.x, post.z);
  add('strongbox', post.x + 1.6, post.z + 1.4);
  add('torch', post.x - 1.6, post.z - 1.4);
  edgeTrees(stage, add, rng, post);
  return stage;
}

/** How many recruits wait at the Guild House. */
export const GUILD_RECRUITS = 4;

/**
 * The Guild House at the rim, where a run begins: a small safe field where
 * the bearer hires its party from the recruits waiting along the north
 * wall, and buys potions at the quartermaster's stall, before the road east
 * to the first phase.
 */
export function generateGuild(rng: RNG, ahead: Ahead[], sides?: readonly ExitSide[]): Stage {
  const { stage, add } = smallField(rng, 0, 'guild', ahead, 0, sides);
  const mid = { x: stage.width / 2, z: stage.depth / 2 };
  stage.recruits = Array.from({ length: GUILD_RECRUITS }, (_, i) => ({
    x: mid.x - 4.5 + i * 3,
    z: mid.z - 4,
  }));
  add('banner', mid.x - 6.5, mid.z - 5.5);
  add('banner', mid.x + 6.5, mid.z - 5.5);
  add('torch', mid.x - 6, mid.z - 3);
  add('torch', mid.x + 6, mid.z - 3);
  add('stall', mid.x, mid.z + 4);
  stage.town = { x: mid.x, z: mid.z + 2.4 };
  add('strongbox', mid.x + 2, mid.z + 4.4);
  edgeTrees(stage, add, rng, mid);
  return stage;
}

/**
 * A Town, in the layers where people still live: a small safe field round a
 * well, with a smithy, a Synthesis bench, a chapel and a market stall.
 * While anyone is left to hire, a merc waits at the tavern fire.
 */
function generateTown(
  rng: RNG,
  index: number,
  ahead: Ahead[],
  biome: number,
  hires: boolean,
  sides?: readonly ExitSide[],
): Stage {
  const { stage, add } = smallField(rng, index, 'town', ahead, biome, sides);
  const well = { x: stage.width / 2, z: stage.depth / 2 };
  add('well', well.x, well.z);
  stage.town = { x: well.x - 1.4, z: well.z };
  add('anvil', well.x - 2, well.z - 3.2);
  add('bench', well.x + 2.2, well.z - 3.2);
  add('chapel', well.x + 3.6, well.z + 0.2);
  add('stall', well.x - 2, well.z + 3.2);
  add('torch', well.x + 0.4, well.z - 1.8);
  if (hires) {
    add('campfire', well.x + 2, well.z + 3.4);
    stage.recruit = { x: well.x + 3, z: well.z + 3.8 };
  }
  edgeTrees(stage, add, rng, { x: well.x, z: well.z });
  return stage;
}

/**
 * A Camp: a small safe field with a fire between the roads on. The party
 * rests there once, back to full health and mana. While anyone is left to
 * hire, a wandering merc always waits by it.
 */
function generateCamp(
  rng: RNG,
  index: number,
  ahead: Ahead[],
  biome: number,
  hires: boolean,
  sides?: readonly ExitSide[],
): Stage {
  const { stage, add } = smallField(rng, index, 'camp', ahead, biome, sides);
  const fire = { x: stage.width / 2, z: stage.depth / 2 };
  add('campfire', fire.x, fire.z);
  stage.rest = fire;
  if (hires) {
    stage.recruit = { x: fire.x + 1, z: fire.z + 0.6 };
  }
  edgeTrees(stage, add, rng, fire);
  return stage;
}

/**
 * An Event: a small safe field with something waiting by the road, between
 * the roads on. Its scenery stands in an arc round where it happens.
 */
function generateEvent(
  rng: RNG,
  index: number,
  ahead: Ahead[],
  scene: readonly PropKind[],
  biome: number,
  sides?: readonly ExitSide[],
): Stage {
  const { stage, add } = smallField(rng, index, 'event', ahead, biome, sides);
  const at = { x: stage.width / 2, z: stage.depth / 2 };
  stage.event = at;
  // An arc behind it, open to the west where the bearer comes from
  scene.forEach((kind, i) => {
    const a = scene.length > 1 ? (-0.7 + (1.4 * i) / (scene.length - 1)) * Math.PI : 0;
    add(kind, at.x + Math.cos(a) * 2.2, at.z + Math.sin(a) * 2.2);
  });
  edgeTrees(stage, add, rng, at);
  return stage;
}

/**
 * The Creditor's tomb, below the Sunken Crown: a closed chamber with no way
 * out, the Church's sigils and candles round a sarcophagus. The bearer
 * walks the Writ to it. `index` is the index after the last layer's arena.
 */
export function generateTomb(rng: RNG, index: number): Stage {
  const width = 30;
  const depth = 24;
  const entrance = { x: 2.5, z: depth / 2 };
  const tomb = { x: width * 0.62, z: depth / 2 };
  const stage: Stage = {
    index,
    kind: 'tomb',
    biome: LAYERS.length - 1,
    width,
    depth,
    entrance,
    exit: entrance,
    exits: [],
    props: [],
    sigils: [tomb],
    stains: [],
    packs: [],
    roads: [],
    down: false,
    tomb,
  };
  const add: Add = (k, x, z) => {
    const prop: Prop = { kind: k, x, z, r: SOLID[k], seed: rng.random() };
    stage.props.push(prop);
    return prop;
  };
  add('sarcophagus', tomb.x, tomb.z);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add('candle', tomb.x + Math.cos(a) * 3, tomb.z + Math.sin(a) * 3);
  }
  // The Church's eye watches from every side, as it has the whole way down.
  for (const dz of [-6, 6]) {
    add('banner', tomb.x - 2, tomb.z + dz);
    add('banner', tomb.x + 4, tomb.z + dz);
  }
  // Pillars round the chamber's edge.
  for (let x = 4; x < width - 2; x += 3.2) {
    add('pillar', x, 2);
    add('pillar', x, depth - 2);
  }
  for (let i = 0; i < 12; i++) {
    stage.stains.push({
      x: tomb.x + rng.range(-5, 5),
      z: tomb.z + rng.range(-5, 5),
      r: rng.range(0.4, 1),
    });
  }
  return stage;
}

// A boss's field, wide enough to run in, and the ground kept clear round it
const BOSS_WIDTH = 64;
const BOSS_DEPTH = 46;
const BOSS_CLEAR = 6;

/**
 * A layer's last area: a wide open field with no way back, the boss in its
 * middle and the way down far beyond it, shut while the boss lives. There
 * is room to run from its blows. A few pillars or dead trees stand about,
 * and packs of the layer's own stray on the near side.
 */
function generateArena(rng: RNG, index: number, biome: number): Stage {
  const width = BOSS_WIDTH;
  const depth = BOSS_DEPTH;
  const entrance = { x: 2.5, z: depth / 2 };
  const boss = { x: width * 0.6, z: depth / 2 };
  const exit = { x: width - 3, z: depth / 2 };
  const stage: Stage = {
    index,
    kind: 'boss',
    biome,
    width,
    depth,
    entrance,
    exit,
    exits: [{ ...exit, ahead: 'down', side: 'east', out: OUT.east, sign: exit }],
    props: [],
    sigils: [boss],
    stains: [],
    packs: [],
    roads: [],
    down: true,
    boss,
  };
  const add = (kind: PropKind, x: number, z: number): Prop => {
    const prop: Prop = { kind, x, z, r: SOLID[kind], seed: rng.random() };
    stage.props.push(prop);
    return prop;
  };

  add('stair', exit.x, exit.z);
  add('brazier', exit.x - 1.2, exit.z - 1.6);
  add('brazier', exit.x - 1.2, exit.z + 1.6);

  // Old blood round where the boss waits
  for (let i = 0; i < 10; i++) {
    const a = rng.random() * Math.PI * 2;
    const d = rng.range(1, BOSS_CLEAR);
    stage.stains.push({
      x: boss.x + Math.cos(a) * d,
      z: boss.z + Math.sin(a) * d,
      r: rng.range(0.5, 1.1),
    });
  }

  // Sparse cover: something to put between the bearer and a charge, never
  // enough to wall it in.
  const tall = tallFor(biome);
  const clearOf = (x: number, z: number): boolean =>
    Math.hypot(x - entrance.x, z - entrance.z) > KEEP_ENTRANCE &&
    Math.hypot(x - boss.x, z - boss.z) > BOSS_CLEAR &&
    Math.hypot(x - exit.x, z - exit.z) > KEEP_EXIT;
  const solids: Spot[] = [];
  for (let i = 0; i < width * depth * 0.012; i++) {
    const x = rng.range(3, width - 3);
    const z = rng.range(3, depth - 3);
    if (!clearOf(x, z) || solids.some((o) => Math.hypot(o.x - x, o.z - z) < 4)) {
      continue;
    }
    if (rng.chance(0.7)) {
      add(tall, x, z);
    } else {
      add('rubble', x, z).r = rng.range(0.35, 0.6);
    }
    solids.push({ x, z });
  }
  for (const t of [0.3, 0.45]) {
    const x = width * t;
    const z = entrance.z + (t < 0.4 ? -1 : 1) * rng.range(5, 10);
    stage.packs.push({ kinds: approachPack(rng, biome), x, z, elite: -1 });
  }
  ensureReachable(stage, [boss, exit]);
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

// The packs a stage can field, by how deep it is: weak things near the
// surface, the Church's mad and the Old King's guard further down.
// Each layer's packs, as the lore lays the Hollow out. `from` is the first
// area of the layer, from 0, a pack can appear in.
const FACTIONS: { layer: number; from: number; kinds: MonsterKind[] }[] = [
  // The Marches: the Blight at the rim, the drowned, and the Church's first keepers
  { layer: 0, from: 0, kinds: ['mite', 'mite', 'mite'] },
  { layer: 0, from: 0, kinds: ['husk', 'husk', 'husk'] },
  { layer: 0, from: 0, kinds: ['husk', 'mite', 'mite'] },
  { layer: 0, from: 2, kinds: ['crawler', 'mite', 'mite'] },
  { layer: 0, from: 2, kinds: ['hollowSoldier', 'husk', 'husk'] },
  { layer: 0, from: 4, kinds: ['penitent', 'penitent', 'husk'] },
  { layer: 0, from: 4, kinds: ['crawler', 'crawler', 'crawler'] },
  { layer: 0, from: 4, kinds: ['hollowSoldier', 'hollowSoldier'] },
  { layer: 0, from: 5, kinds: ['penitent', 'penitent', 'hollowed'] },
  { layer: 0, from: 6, kinds: ['hollowed', 'hollowed'] },
  // The Rift Road: the Old King's guard holds the road down
  { layer: 1, from: 0, kinds: ['hollowSoldier', 'hollowSoldier', 'husk'] },
  { layer: 1, from: 0, kinds: ['hollowSoldier', 'husk', 'husk'] },
  { layer: 1, from: 0, kinds: ['crawler', 'crawler', 'mite'] },
  { layer: 1, from: 2, kinds: ['hollowSoldier', 'hollowSoldier', 'hollowSoldier'] },
  { layer: 1, from: 4, kinds: ['hollowSoldier', 'hollowSoldier', 'penitent'] },
  // The Drowned Undercroft: the Church's keepers and the drowned
  { layer: 2, from: 0, kinds: ['penitent', 'penitent', 'husk'] },
  { layer: 2, from: 0, kinds: ['husk', 'husk', 'husk'] },
  { layer: 2, from: 0, kinds: ['penitent', 'penitent', 'cantor'] },
  { layer: 2, from: 3, kinds: ['penitent', 'penitent', 'penitent'] },
  { layer: 2, from: 4, kinds: ['penitent', 'hollowed'] },
  // The Sunken Crown: the mad, and the last of the guard
  { layer: 3, from: 0, kinds: ['hollowed', 'hollowed'] },
  { layer: 3, from: 0, kinds: ['hollowed', 'penitent', 'penitent'] },
  { layer: 3, from: 0, kinds: ['hollowSoldier', 'hollowSoldier', 'cantor'] },
  { layer: 3, from: 3, kinds: ['hollowed', 'hollowed', 'hollowed'] },
];

// A pack straying on the way to a boss: the Brood Mother's mites in
// the Marches, the layer's own packs below.
function approachPack(rng: RNG, layer: number): MonsterKind[] {
  if (layer === 0) {
    return ['mite', 'mite', 'mite'];
  }
  return [...rng.pick(FACTIONS.filter((f) => f.layer === layer && f.from === 0)).kinds];
}

/** The level of a stage's monsters: low near the surface, one more each stage. */
export const monsterLevel = (index: number): number => 2 + index;

// What keeps the Church's site, by depth: one Penitent near the surface,
// then more, then a Cantor to sing for them.
function siteKeepers(index: number): MonsterKind[] {
  if (index < 2) {
    return ['penitent'];
  }
  return index < 4 ? ['penitent', 'penitent'] : ['penitent', 'penitent', 'cantor'];
}

// What holds the lair, by depth, and below the Marches by layer.
function lairPack(index: number, layer: number): MonsterKind[] {
  if (layer === 2) {
    return ['penitent', 'penitent', 'cantor'];
  }
  if (layer === 3) {
    return ['hollowed', 'hollowed', 'hollowed'];
  }
  if (index < 2) {
    return ['husk', 'husk', 'husk'];
  }
  return index < 4
    ? ['hollowSoldier', 'husk', 'husk']
    : ['hollowSoldier', 'hollowSoldier', 'hollowSoldier'];
}

// An elite leads the lair's pack from this stage on.
const ELITE_FROM = 4;
const ELITE_BUDGET = 1.4;

function placePacks(
  stage: Stage,
  rng: RNG,
  places: { site: Spot; lair: Spot; breach: Spot },
  eliteArea = false,
): void {
  // An Elite area holds more, and its lair always has an elite.
  let budget = (9 + stage.index * 5) * (eliteArea ? ELITE_BUDGET : 1);
  const layer = stage.biome;
  const pool = FACTIONS.filter(
    (f) => f.layer === layer && f.from <= stage.index % AREAS_PER_LAYER,
  ).map((f) => f.kinds);
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
  // A pack watches the first breach in the wall, from the far side.
  const breach = places.breach;
  push({ kinds: [...rng.pick(pool)].slice(0, 2), x: breach.x + 2.5, z: breach.z, elite: -1 });
  const nav = navFor(stage);
  for (let i = 0; i < 40; i++) {
    if (budget <= 0) {
      break;
    }
    const kinds = [...rng.pick(pool)].slice(0, rng.int(2, 3));
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

// The packs a stage's layer fields at its depth.
const factionPool = (stage: Stage): MonsterKind[][] =>
  FACTIONS.filter((f) => f.layer === stage.biome && f.from <= stage.index % AREAS_PER_LAYER).map(
    (f) => [...f.kinds],
  );

// A Horde's waves: 4, one more in an Elite area and one more below the
// Marches, each a little stronger, 20 seconds apart unless beaten sooner.
const HORDE_WAVES = 4;
const WAVE_GAP = 20;
const FIRST_WAVE = 3;

/**
 * A Horde's waves, from the threat budget a stage's packs would have had,
 * split over them and rising. Each comes from a spot on the north, south or
 * east edge, far from the entrance. The last is led by an elite once deep
 * enough, or always in an Elite area.
 */
function buildWaves(stage: Stage, rng: RNG, elite: boolean): Wave[] {
  const count = HORDE_WAVES + (elite ? 1 : 0) + (stage.index >= AREAS_PER_LAYER ? 1 : 0);
  const total = (9 + stage.index * 5) * (elite ? ELITE_BUDGET : 1) * 1.2;
  const pool = factionPool(stage);
  const nav = navFor(stage);
  const edge = (): Spot => {
    for (let i = 0; i < 40; i++) {
      const side = rng.int(0, 2);
      const x = side === 2 ? stage.width - 2 : rng.range(PACK_DISTANCE + 4, stage.width - 3);
      const z = [1.5, stage.depth - 1.5, rng.range(3, stage.depth - 3)][side];
      if (nav.walkable(x, z)) {
        return { x, z };
      }
    }
    return { x: stage.width - 4, z: stage.depth / 2 };
  };
  const waves: Wave[] = [];
  for (let w = 0; w < count; w++) {
    // Later waves are stronger: shares rising from 0.6 to 1.4 of the mean
    let budget = (total / count) * (0.6 + (0.8 * w) / Math.max(1, count - 1));
    const kinds: MonsterKind[] = [];
    while (budget > 0 && kinds.length < 9) {
      const group = rng.pick(pool);
      for (const k of group) {
        kinds.push(k);
        budget -= THREAT[k];
      }
    }
    const last = w === count - 1;
    waves.push({
      kinds,
      from: edge(),
      delay: w === 0 ? FIRST_WAVE : WAVE_GAP,
      elite: last && (elite || stage.index >= ELITE_FROM) ? 0 : -1,
    });
  }
  return waves;
}

// A Labyrinth's cells, in tiles across, and how many across and down
const CELL = 4;
const MAZE_COLUMNS = 14;
const MAZE_ROWS = 9;
// Walls taken down at random after the maze is carved, so it has loops
const MAZE_LOOPS = 0.12;

/**
 * A Labyrinth: a maze of ruined walls cut into square cells, carved from
 * the entrance on the west, with loops, and a hall down the east side to
 * the exits. Traps stand in its corridors and packs in its dead ends. The
 * objective is to reach the hall.
 */
function generateMaze(rng: RNG, index: number, plan: AreaPlan, biome: number): Stage {
  const width = MAZE_COLUMNS * CELL;
  const depth = MAZE_ROWS * CELL;
  const startRow = Math.floor(MAZE_ROWS / 2);
  const entrance = { x: 2, z: startRow * CELL + CELL / 2 };
  const stage: Stage = {
    index,
    kind: plan.kind,
    biome,
    width,
    depth,
    entrance,
    exit: entrance,
    exits: [],
    props: [],
    sigils: [],
    stains: [],
    packs: [],
    roads: [],
    down: false,
    objective: 'maze',
    goal: { x0: width - CELL, z0: 0, x1: width, z1: depth },
    hazards: [],
  };
  const add: Add = (kind, x, z) => {
    const prop: Prop = { kind, x, z, r: SOLID[kind], seed: rng.random() };
    stage.props.push(prop);
    return prop;
  };
  placeExits(stage, add, plan.ahead, depth / 2, plan.sides, width - CELL / 2);
  stage.reward = { x: width - CELL / 2, z: depth / 2 };

  // Walls east of each cell and south of each, all standing at first.
  const east = Array.from({ length: MAZE_COLUMNS }, () => Array<boolean>(MAZE_ROWS).fill(true));
  const south = Array.from({ length: MAZE_COLUMNS }, () => Array<boolean>(MAZE_ROWS).fill(true));
  // The last column is the hall: no walls across it.
  const hall = MAZE_COLUMNS - 1;
  for (let j = 0; j < MAZE_ROWS; j++) {
    south[hall][j] = false;
  }
  // Carved depth first from the entrance, over every cell but the hall.
  const seen = new Set<number>();
  const key = (i: number, j: number): number => i * MAZE_ROWS + j;
  const stack: [number, number][] = [[0, startRow]];
  seen.add(key(0, startRow));
  while (stack.length > 0) {
    const [i, j] = stack[stack.length - 1];
    const next = (
      [
        [i + 1, j],
        [i - 1, j],
        [i, j + 1],
        [i, j - 1],
      ] as [number, number][]
    ).filter(([a, b]) => a >= 0 && a < hall && b >= 0 && b < MAZE_ROWS && !seen.has(key(a, b)));
    if (next.length === 0) {
      stack.pop();
      continue;
    }
    const [a, b] = rng.pick(next);
    if (a === i) {
      south[i][Math.min(b, j)] = false;
    } else {
      east[Math.min(a, i)][j] = false;
    }
    seen.add(key(a, b));
    stack.push([a, b]);
  }
  // Two ways into the hall, and loops elsewhere
  for (const j of rng.shuffle(Array.from({ length: MAZE_ROWS }, (_, n) => n)).slice(0, 2)) {
    east[hall - 1][j] = false;
  }
  for (let i = 0; i < hall; i++) {
    for (let j = 0; j < MAZE_ROWS; j++) {
      if (rng.chance(MAZE_LOOPS)) {
        if (i < hall - 1) {
          east[i][j] = false;
        }
        if (j < MAZE_ROWS - 1) {
          south[i][j] = false;
        }
      }
    }
  }
  // Each standing wall as a row of wall blocks along the cell's edge, kept
  // low, so the party sees over them though not through them
  const STEP = 0.9;
  for (let i = 0; i < MAZE_COLUMNS; i++) {
    for (let j = 0; j < MAZE_ROWS; j++) {
      const x0 = i * CELL;
      const z0 = j * CELL;
      if (east[i][j] && i < MAZE_COLUMNS - 1) {
        for (let t = 0; t <= CELL + 0.01; t += STEP) {
          add('wall', x0 + CELL, z0 + t).seed = rng.random() * 0.2;
        }
      }
      if (south[i][j] && j < MAZE_ROWS - 1) {
        for (let t = 0; t <= CELL + 0.01; t += STEP) {
          add('wall', x0 + t, z0 + CELL).seed = rng.random() * 0.2;
        }
      }
    }
  }

  // Dead ends hold packs; corridors hold traps.
  const walls = (i: number, j: number): number =>
    [
      i === 0 || east[i - 1][j],
      east[i][j],
      j === 0 || south[i][j - 1],
      j === MAZE_ROWS - 1 || south[i][j],
    ].filter(Boolean).length;
  const cells: [number, number][] = [];
  for (let i = 1; i < hall; i++) {
    for (let j = 0; j < MAZE_ROWS; j++) {
      cells.push([i, j]);
    }
  }
  rng.shuffle(cells);
  const middle = (i: number, j: number): Spot => ({
    x: i * CELL + CELL / 2,
    z: j * CELL + CELL / 2,
  });
  const elite = plan.kind === 'elite';
  let budget = (9 + index * 5) * (elite ? ELITE_BUDGET : 1) * 0.8;
  const pool = factionPool(stage);
  const used = new Set<number>();
  for (const [i, j] of cells) {
    if (budget <= 0) {
      break;
    }
    if (walls(i, j) < 3 || i < 2) {
      continue;
    }
    const kinds = [...rng.pick(pool)].slice(0, rng.int(2, 3));
    const at = middle(i, j);
    const lead = stage.packs.length === 0 && (elite || index >= ELITE_FROM) ? 0 : -1;
    stage.packs.push({ kinds, x: at.x, z: at.z, elite: lead });
    budget -= kinds.reduce((n, k) => n + THREAT[k], 0) + (lead >= 0 ? ELITE_THREAT : 0);
    used.add(key(i, j));
  }
  // A cache in one more dead end
  const cache = cells.find(([i, j]) => walls(i, j) >= 3 && !used.has(key(i, j)));
  if (cache) {
    const at = middle(...cache);
    add('chest', at.x, at.z);
    used.add(key(...cache));
  }
  const traps = 8 + Math.floor(index / 2) + (elite ? 3 : 0);
  for (const [i, j] of cells.filter(([a, b]) => !used.has(key(a, b))).slice(0, traps)) {
    const at = middle(i, j);
    const vent = rng.chance(0.35);
    stage.hazards?.push({
      kind: vent ? 'vent' : 'spikes',
      x: at.x,
      z: at.z,
      period: vent ? 5 : 3,
      phase: rng.range(0, vent ? 5 : 3),
    });
  }
  return stage;
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
