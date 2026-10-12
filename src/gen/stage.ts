import type { MonsterKind } from '../content/roster';
import type RNG from '../core/rng';
import Nav, { type Spot } from '../sim/nav';
import type { NodeKind } from './graph';
import { AREAS_PER_LAYER, layerIndexOf, layerOf, leadsDown } from './layers';

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
  | 'gate'
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

/** Where an area's exit leads: an area of the layer's map, or down. */
export type Ahead = NodeKind | 'down';

/** A way out of an area on its east edge, and what lies beyond it. */
export interface Exit extends Spot {
  ahead: Ahead;
}

/** What an area is, and where each of its exits leads, north first. */
export interface AreaPlan {
  kind: NodeKind | 'waystation' | 'tomb';
  ahead: Ahead[];
  // An Event's scenery, laid round where it happens
  scene?: readonly PropKind[];
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
  width: number;
  depth: number;
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
  // A layer's last area: the walled arena its boss waits in, and whether
  // its gate has shut behind the party
  arena?: { x: number; z: number; r: number; closed: boolean };
  // Where the boss stands
  boss?: Spot;
  // A Waystation's paymaster's post, where wages are paid and the vault opens
  station?: Spot;
  // Where a wandering merc waits by its fire, on stages that have one
  recruit?: Spot;
  // A Camp's fire, where the party rests
  rest?: Spot;
  // The Creditor's sarcophagus, where the seal breaks
  tomb?: Spot;
  // A Town's well, where its smith, bench, temple and market are dealt with
  town?: Spot;
  // Where an Event happens: the bearer walks up to it to see what waits
  event?: Spot;
}

// The plan of an area with one road on to a Combat area, as tests use.
const PLAIN: AreaPlan = { kind: 'combat', ahead: ['combat'] };

type Add = (kind: PropKind, x: number, z: number) => Prop;

/**
 * Lays out an area's exits on its east edge. One exit sits at `z`; two or
 * more spread along the edge. Each road on is marked by the Guild's signpost
 * and two torches; the way down by a stair between two braziers.
 */
function placeExits(stage: Stage, add: Add, ahead: Ahead[], z: number): void {
  const x = stage.width - 3;
  stage.exits = ahead.map((a, k) => ({
    x,
    z: ahead.length === 1 ? z : stage.depth * (0.28 + (0.44 * k) / (ahead.length - 1)),
    ahead: a,
  }));
  stage.exit = stage.exits[0];
  for (const e of stage.exits) {
    if (e.ahead === 'down') {
      add('stair', e.x, e.z);
      add('brazier', e.x - 1.2, e.z - 1.6);
      add('brazier', e.x - 1.2, e.z + 1.6);
    } else {
      add('torch', e.x - 1.2, e.z - 1.6);
      add('torch', e.x - 1.2, e.z + 1.6);
      add('signpost', e.x - 2.2, e.z - 2.2);
    }
  }
}

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
  // Bosses are never rolled into a pack. They wait in their arenas.
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
export function generateStage(rng: RNG, index: number, plan: AreaPlan = PLAIN): Stage {
  if (leadsDown(index) || plan.kind === 'boss') {
    return generateArena(rng, index);
  }
  if (plan.kind === 'camp') {
    return generateCamp(rng, index, plan.ahead);
  }
  if (plan.kind === 'town') {
    return generateTown(rng, index, plan.ahead);
  }
  if (plan.kind === 'event') {
    return generateEvent(rng, index, plan.ahead, plan.scene ?? []);
  }
  const width = rng.int(54, 62);
  const depth = rng.int(34, 42);
  const entrance = { x: 2.5, z: depth / 2 + rng.range(-depth / 5, depth / 5) };
  const exitZ = depth / 2 + rng.range(-depth / 4, depth / 4);
  const stage: Stage = {
    index,
    kind: plan.kind,
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
  placeExits(stage, add, plan.ahead, exitZ);
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
    { x: width + 1, z: e.z },
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
  if (index >= 1 && index < RECRUIT_STAGES && rng.chance(RECRUIT_CHANCE)) {
    const camp = spot(10, wallX - 4, 2);
    keep.push({ ...camp, r: 5 });
    add('campfire', camp.x, camp.z);
    stage.recruit = { x: camp.x + 1, z: camp.z };
  }

  // Terrain from noise: trees or pillars where it runs high, rubble where it
  // runs low. The road stays clear.
  const tall = layerOf(index).ground === 'earth' ? 'tree' : 'pillar';
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

  placePacks(
    stage,
    rng,
    { site, lair, breach: { x: wallX, z: breaches[0] } },
    plan.kind === 'elite',
  );
  return stage;
}

// A small safe field: the entrance on the west, the exits on the east and
// a place between the roads, with trees or pillars round the edge.
function smallField(
  rng: RNG,
  index: number,
  kind: AreaPlan['kind'],
  ahead: Ahead[],
): { stage: Stage; add: Add } {
  const width = 28;
  const depth = 24;
  const entrance = { x: 2.5, z: depth / 2 };
  const stage: Stage = {
    index,
    kind,
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
  placeExits(stage, add, ahead, depth / 2);
  stage.roads = stage.exits.map((e) => [entrance, e, { x: width + 1, z: e.z }]);
  return { stage, add };
}

// Trees or pillars round a small field's edge, off the roads and its place.
function edgeTrees(stage: Stage, add: Add, rng: RNG, place: Spot): void {
  const tall = layerOf(stage.index).ground === 'earth' ? 'tree' : 'pillar';
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
export function generateWaystation(rng: RNG, index: number, ahead: Ahead[] = ['combat']): Stage {
  const { stage, add } = smallField(rng, index, 'waystation', ahead);
  const post = { x: stage.width / 2, z: stage.depth / 2 };
  stage.station = { x: post.x - 1.8, z: post.z };
  add('post', post.x, post.z);
  add('strongbox', post.x + 1.6, post.z + 1.4);
  add('torch', post.x - 1.6, post.z - 1.4);
  edgeTrees(stage, add, rng, post);
  return stage;
}

/**
 * A Town, in the layers where people still live: a small safe field round a
 * well, with a smithy, a Synthesis bench, a chapel and a market stall.
 * While anyone is left to hire, a merc waits at the tavern fire.
 */
function generateTown(rng: RNG, index: number, ahead: Ahead[]): Stage {
  const { stage, add } = smallField(rng, index, 'town', ahead);
  const well = { x: stage.width / 2, z: stage.depth / 2 };
  add('well', well.x, well.z);
  stage.town = { x: well.x - 1.4, z: well.z };
  add('anvil', well.x - 2, well.z - 3.2);
  add('bench', well.x + 2.2, well.z - 3.2);
  add('chapel', well.x + 3.6, well.z + 0.2);
  add('stall', well.x - 2, well.z + 3.2);
  add('torch', well.x + 0.4, well.z - 1.8);
  if (index < RECRUIT_STAGES) {
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
function generateCamp(rng: RNG, index: number, ahead: Ahead[]): Stage {
  const { stage, add } = smallField(rng, index, 'camp', ahead);
  const fire = { x: stage.width / 2, z: stage.depth / 2 };
  add('campfire', fire.x, fire.z);
  stage.rest = fire;
  if (index < RECRUIT_STAGES) {
    stage.recruit = { x: fire.x + 1, z: fire.z + 0.6 };
  }
  edgeTrees(stage, add, rng, fire);
  return stage;
}

/**
 * An Event: a small safe field with something waiting by the road, between
 * the roads on. Its scenery stands in an arc round where it happens.
 */
function generateEvent(rng: RNG, index: number, ahead: Ahead[], scene: readonly PropKind[]): Stage {
  const { stage, add } = smallField(rng, index, 'event', ahead);
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

// The arena's wall, in tiles from its centre, and the gate's half width.
const ARENA_R = 9;
const GATE_HALF = 1.6;
// Gate posts, solid once the gate shuts
export const GATE_SOLID = 0.5;

/**
 * A layer's last area: an approach from the west, then a walled arena with
 * one gate. The boss waits inside, before the way down. The gate shuts once
 * the bearer is in.
 */
function generateArena(rng: RNG, index: number): Stage {
  const width = rng.int(44, 48);
  const depth = rng.int(30, 34);
  const entrance = { x: 2.5, z: depth / 2 };
  const arena = { x: width - ARENA_R - 3, z: depth / 2, r: ARENA_R, closed: false };
  const exit = { x: arena.x + ARENA_R - 2.5, z: arena.z };
  const gate = { x: arena.x - ARENA_R, z: arena.z };
  const stage: Stage = {
    index,
    kind: 'boss',
    width,
    depth,
    entrance,
    exit,
    exits: [{ ...exit, ahead: 'down' }],
    props: [],
    sigils: [],
    stains: [],
    packs: [],
    roads: [[entrance, gate, { x: arena.x, z: arena.z }]],
    down: true,
    arena,
    boss: { x: arena.x + 1.5, z: arena.z },
  };
  const add = (kind: PropKind, x: number, z: number): Prop => {
    const prop: Prop = { kind, x, z, r: SOLID[kind], seed: rng.random() };
    stage.props.push(prop);
    return prop;
  };

  add('stair', exit.x, exit.z);
  add('brazier', exit.x - 1.2, exit.z - 1.6);
  add('brazier', exit.x - 1.2, exit.z + 1.6);

  // The ring wall stands tall all round, but for the gate on the west.
  const steps = Math.ceil((2 * Math.PI * ARENA_R) / 0.9);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = arena.x + Math.cos(a) * ARENA_R;
    const z = arena.z + Math.sin(a) * ARENA_R;
    if (Math.abs(z - gate.z) < GATE_HALF && x < arena.x) {
      continue;
    }
    add('wall', x, z).seed = 0.55 + rng.random() * 0.45;
  }
  // The gate stands open until the party is in.
  for (const dz of [-1, 0, 1]) {
    add('gate', gate.x, gate.z + dz * GATE_HALF * 0.66);
  }

  // Old blood on the arena floor, and gibbets of what she fed on.
  for (let i = 0; i < 8; i++) {
    const a = rng.random() * Math.PI * 2;
    const d = rng.range(2, ARENA_R - 2);
    stage.stains.push({
      x: arena.x + Math.cos(a) * d,
      z: arena.z + Math.sin(a) * d,
      r: rng.range(0.5, 1.1),
    });
  }

  // The approach: dead trees and rubble off the road, and her brood astray.
  const tall = layerOf(index).ground === 'earth' ? 'tree' : 'pillar';
  const clearOf = (x: number, z: number): boolean =>
    Math.hypot(x - entrance.x, z - entrance.z) > KEEP_ENTRANCE &&
    Math.hypot(x - arena.x, z - arena.z) > ARENA_R + 2 &&
    distanceToSegment({ x, z }, entrance, gate) > 1.6;
  const solids: Spot[] = [];
  for (let i = 0; i < width * depth * 0.04; i++) {
    const x = rng.range(1.5, width - 1.5);
    const z = rng.range(1.5, depth - 1.5);
    if (!clearOf(x, z) || solids.some((o) => Math.hypot(o.x - x, o.z - z) < 2.2)) {
      continue;
    }
    if (rng.chance(0.6)) {
      add(tall, x, z);
    } else {
      add('rubble', x, z).r = rng.range(0.35, 0.6);
    }
    solids.push({ x, z });
  }
  for (const t of [0.45, 0.75]) {
    const x = entrance.x + (gate.x - entrance.x) * t;
    const z = entrance.z + (t < 0.6 ? -1 : 1) * rng.range(3, 6);
    stage.packs.push({ kinds: approachPack(rng, index), x, z, elite: -1 });
  }
  ensureReachable(stage, [gate]);
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

// A pack straying on the way to a boss's arena: the Brood Mother's mites in
// the Marches, the layer's own packs below.
function approachPack(rng: RNG, index: number): MonsterKind[] {
  const layer = layerIndexOf(index);
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
function lairPack(index: number): MonsterKind[] {
  const layer = layerIndexOf(index);
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
  const layer = layerIndexOf(stage.index);
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
    kinds: lairPack(stage.index),
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
