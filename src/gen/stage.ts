import { AFFIXES, type Affix } from '../content/affixes';
import { MINI_BOSSES, type MiniBossId } from '../content/minibosses';
import type { MonsterKind } from '../content/roster';
import type RNG from '../core/rng';
import Flow from '../sim/flow';
import Nav, { type Rect, type Spot } from '../sim/nav';
import type { MapNode, Mutator, NodeKind, Objective, Reward } from './graph';
import { AREAS_PER_LAYER, LAYERS, layerIndexOf, leadsDown } from './layers';
import { type Keep, type Plan, layOut, planFor } from './fields';

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
  | 'campfire'
  | 'gate'
  | 'lever'
  | 'key'
  | 'pit'
  | 'blossom'
  | 'vault';

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

/** A patch of ground that works on whoever stands in it: shallow water slows, embers burn. */
export interface Patch extends Spot {
  kind: 'water' | 'embers';
  r: number;
}

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
  // How much of its usual threat a fight holds, as the level director sets
  // it from the party's standing. 1 if absent.
  scale?: number;
  // The mini-boss it holds, if any
  miniBoss?: MiniBossId;
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
  // A Labyrinth's gates: across corridors, opened by levers, and into the
  // hall, opened by the key
  gates?: Gate[];
  // An open field's ground plan, and its chasm: floor cells, one tile each,
  // that cannot be crossed but can be seen across
  layout?: Plan;
  chasm?: Spot[];
  // An open field's pools of water and patches of embers
  patches?: Patch[];
  // Where an Escort's refugees wait at the start, one spot each
  refugees?: Spot[];
  // A Vault's strongroom: where its door is, whether the bearer holds its
  // key, and whether it is open
  vault?: Vault;
  // A Ritual's sigils, in the order the bearer breaks them
  rites?: Rite[];
  // A Collapse's falling floor
  collapse?: Collapse;
  // The level director's key points: where waves may come from, where an
  // elite or mini-boss may stand, and where relief may appear
  spots?: KeyPoint[];
  // Mobs the director sends in a Hunt or an Escort, in turn
  mobs?: Mob[];
  // How much of its usual threat it holds, as the level director set it
  scale?: number;
}

/** A mob, as Left 4 Dead's: what comes, and how many seconds after the last, or the start. */
export interface Mob {
  kinds: MonsterKind[];
  after: number;
}

/** A key point the level director works with. See the director design. */
export interface KeyPoint extends Spot {
  kind: 'spawn' | 'boss' | 'relief';
}

/**
 * A Collapse's floor, falling away from the entrance's edge toward the
 * exits: the way it falls, how far it has fallen, where it stops, and how
 * fast it goes, in tiles a second.
 */
export interface Collapse {
  dir: Spot;
  front: number;
  stop: number;
  speed: number;
}

/** How long the bearer stands on a Ritual's sigil to break it, and how near its middle. */
export const RITE_TIME = 15;
export const RITE_REACH = 2.2;

/** A sigil a Ritual's bearer stands on to break: how long it has stood there so far. */
export interface Rite extends Spot {
  held: number;
  broken?: boolean;
}

/** A Vault's strongroom, from the gauntlets design. */
export interface Vault extends Spot {
  door: Spot;
  key?: boolean;
  open?: boolean;
}

/** A gate across a Labyrinth's corridor, and the lever that opens it. The hall's gates have none: the key opens them. */
export interface Gate {
  blocks: Prop[];
  lever?: Prop;
  open?: boolean;
}

/**
 * Opens a gate: its bars drop, so they no longer block. Returns where they
 * stood, to take them out of the simulation's obstacles.
 */
export function openGate(gate: Gate): Spot[] {
  if (gate.open === true) {
    return [];
  }
  gate.open = true;
  if (gate.lever) {
    gate.lever.open = true;
  }
  for (const b of gate.blocks) {
    b.r = undefined;
    b.open = true;
  }
  return gate.blocks.map((b) => ({ x: b.x, z: b.z }));
}

/** The floor an area covers, where it lies. */
export const rectOf = (stage: Stage): Rect => ({
  x0: stage.x0 ?? 0,
  z0: stage.z0 ?? 0,
  x1: (stage.x0 ?? 0) + stage.width,
  z1: (stage.z0 ?? 0) + stage.depth,
});

/**
 * The floor of an area still standing: all of it, but what a Collapse has
 * taken. The floor falls a whole tile at a time.
 */
export function floorOf(stage: Stage): Rect {
  const r = rectOf(stage);
  const fallen = Math.floor(stage.collapse?.front ?? 0);
  const dir = stage.collapse?.dir;
  if (!dir || fallen <= 0) {
    return r;
  }
  if (dir.x > 0) {
    return { ...r, x0: r.x0 + fallen };
  }
  if (dir.x < 0) {
    return { ...r, x1: r.x1 - fallen };
  }
  if (dir.z > 0) {
    return { ...r, z0: r.z0 + fallen };
  }
  return { ...r, z1: r.z1 - fallen };
}

/**
 * A trap on a Labyrinth's floor. Every `period` seconds, from `phase`, it
 * warns, then strikes whoever stands on it for a share of their health.
 * Spikes are quick and small; fire vents slow, wide and hard.
 */
export interface Hazard {
  kind: HazardKind;
  x: number;
  z: number;
  period: number;
  phase: number;
  // The way a corridor runs through it, for arrow slits and blades
  axis?: 'x' | 'z';
}

/**
 * A Labyrinth's traps, from the gauntlets design. Each keeps a fixed beat.
 *
 * - Spikes: a square that strikes, quick and small.
 * - Vent: a circle of fire, slow, wide and hard.
 * - Arrows: a bolt along the corridor, shown as a line first.
 * - Blade: sweeps across the corridor, one side of the cell then the other.
 * - Floor: drops away once the party steps on it, and stays a pit.
 */
export type HazardKind = 'spikes' | 'vent' | 'arrows' | 'blade' | 'floor';

// The traps a Labyrinth may hold, by how deep it is: the new kinds come in
// after the first layer.
const TRAPS_SHALLOW: readonly HazardKind[] = ['spikes', 'spikes', 'vent', 'arrows'];
const TRAPS_DEEP: readonly HazardKind[] = ['spikes', 'vent', 'arrows', 'blade', 'floor'];
const TRAP_PERIOD: Record<HazardKind, number> = {
  spikes: 3,
  vent: 5,
  arrows: 4,
  blade: 2,
  floor: 0,
};
// Inner gates in a Labyrinth: one, and two deeper in
const GATES_DEEP_FROM = 8;

/** One wave of a Horde: what comes, from where on the edge, and how long after the last. */
export interface Wave {
  kinds: MonsterKind[];
  from: Spot;
  // Seconds after the wave before it, or after the Horde begins for the first
  delay: number;
  // Index into `kinds` of an elite leading it, or -1
  elite: number;
  // Its elite's affixes, the first shared by the wave
  affixes?: Affix[];
  // A mini-boss leading it, with its escort, ahead of its kinds
  mini?: MiniBossId;
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

// How far across a Collapse's floor falls, as a share of its width, how
// fast in tiles a second, and how much faster in an Elite area
const COLLAPSE_STOP = 0.68;
const COLLAPSE_SPEED = 0.5;
const COLLAPSE_ELITE = 1.2;

// How far round a Vault's strongroom nothing else stands, and how far its
// door is from its middle
const VAULT_KEEP = 6;
const VAULT_DOOR = 2;
const VAULT_CLEAR = 5.5;

// An open field's side, in tiles: it is square
const FIELD_SIZE: [number, number] = [46, 54];

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
  gate: 0.5,
  pit: 1,
  vault: 1.3,
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
  if (plan.objective === 'ambush') {
    return generateAmbush(rng, index, plan, biome);
  }
  if (plan.objective === 'maze') {
    return generateMaze(rng, index, plan, biome);
  }
  // A square field, entered near a corner of its west edge and left by the
  // far side, so the way crosses it.
  const size = rng.int(FIELD_SIZE[0], FIELD_SIZE[1]);
  const width = size;
  const depth = size;
  const entrance = { x: 2.5, z: depth * (rng.chance(0.5) ? 0.22 : 0.78) };
  const exitZ = depth / 2 + rng.range(-depth / 6, depth / 6);
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
    scale: plan.scale,
  };
  const add: Add = (kind, x, z) => {
    const prop: Prop = { kind, x, z, r: SOLID[kind], seed: rng.random() };
    stage.props.push(prop);
    return prop;
  };
  placeExits(stage, add, plan.ahead, exitZ, plan.sides, width * 0.78);
  stage.down = stage.exits.some((e) => e.ahead === 'down');

  // The ground plan: islands of trees, walled chambers or halls, or islands
  // over the chasm. See fields.ts.
  stage.layout = planFor(rng, biome);
  const keep: Keep[] = [
    { ...entrance, r: KEEP_ENTRANCE },
    ...stage.exits.map((e) => ({ x: e.x, z: e.z, r: KEEP_EXIT })),
  ];
  const ground = layOut(rng, stage.layout, size, keep);
  const tall = tallFor(biome);
  for (const t of ground.trees) {
    add(tall, t.x, t.z);
  }
  for (const w of ground.walls) {
    add('wall', w.x, w.z).seed = stage.layout === 'halls' ? rng.random() * 0.3 + 0.5 : rng.random();
  }
  for (const p of ground.pillars) {
    add(stage.layout === 'halls' ? 'pillar' : 'rubble', p.x, p.z);
  }
  stage.chasm = ground.chasm;

  // Places stand on open ground, with room around them.
  let nav = navFor(stage);
  const roomFor = (p: Spot, r: number): boolean =>
    nav.roomy(p.x, p.z) &&
    Array.from({ length: 8 }, (_, k) => (k / 8) * Math.PI * 2).every((a) =>
      nav.walkable(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r),
    );
  const spot = (x0: number, x1: number, r: number, gap: number): Spot => {
    for (let i = 0; i < 120; i++) {
      const p = { x: rng.range(x0, x1), z: rng.range(4, depth - 4) };
      if (roomFor(p, r) && !keep.some((k) => Math.hypot(k.x - p.x, k.z - p.z) < k.r + gap)) {
        return p;
      }
    }
    return nav.free((x0 + x1) / 2, depth / 2, size);
  };
  // The Church's site and the lair stand on opposite halves of the field.
  const half = width / 2;
  const siteFirst = rng.chance(0.5);
  const site = siteFirst ? spot(12, half - 3, 3, 4) : spot(half + 3, width - 8, 3, 4);
  keep.push({ ...site, r: 5 });
  stage.sigils.push(site);
  add('altar', site.x, site.z);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    add('candle', site.x + Math.cos(a) * 2.4, site.z + Math.sin(a) * 2.4);
  }
  add('banner', site.x - 2, site.z - 2.8);

  const lair = siteFirst ? spot(half + 3, width - 8, 3, 3) : spot(12, half - 3, 3, 3);
  keep.push({ ...lair, r: 4 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(i % 2 ? 'gibbet' : 'pike', lair.x + Math.cos(a) * 3.2, lair.z + Math.sin(a) * 3.2);
  }

  // A Vault's strongroom stands on the site's half, away from the lair
  // whose leader holds its key, ringed by traps.
  if (plan.objective === 'vault') {
    const at = siteFirst ? spot(12, half - 3, 4, 4) : spot(half + 3, width - 8, 4, 4);
    keep.push({ ...at, r: VAULT_KEEP });
    // The ground round it is cleared of trees and loose rock, so its traps
    // stand in the open.
    stage.props = stage.props.filter(
      (p) =>
        !(p.kind === 'tree' || p.kind === 'rubble' || p.kind === 'pillar') ||
        Math.hypot(p.x - at.x, p.z - at.z) > VAULT_CLEAR,
    );
    add('vault', at.x, at.z);
    // Its door faces the way in, or failing that, another open side.
    const open = navFor(stage);
    const sides = [
      { x: -1, z: 0 },
      { x: 0, z: Math.sign(entrance.z - at.z) || 1 },
      { x: 0, z: -(Math.sign(entrance.z - at.z) || 1) },
      { x: 1, z: 0 },
    ].map((d) => ({ x: at.x + d.x * VAULT_DOOR, z: at.z + d.z * VAULT_DOOR }));
    const door = sides.find((d) => open.roomy(d.x, d.z)) ?? open.free(sides[0].x, sides[0].z);
    stage.vault = { ...at, door };
    stage.hazards = vaultTraps(at, stage.biome);
  }

  // A Ritual's sigils stand across the field, one in each third, west to east.
  if (plan.objective === 'ritual') {
    stage.rites = [0, 1, 2].map((k) => {
      const at = spot(Math.max(10, (width * k) / 3), (width * (k + 1)) / 3 - 4, 3, 3);
      keep.push({ ...at, r: KEEP_PLACE + 1 });
      stage.sigils.push(at);
      return { ...at, held: 0 };
    });
  }

  const cache = spot(10, width - 8, 1, 1);
  keep.push({ ...cache, r: KEEP_PLACE });
  add('chest', cache.x, cache.z);

  // A wandering merc by its fire, only while there is still anyone to hire.
  if (index >= 1 && hires && rng.chance(RECRUIT_CHANCE)) {
    const camp = spot(10, half, 2, 2);
    keep.push({ ...camp, r: 5 });
    add('campfire', camp.x, camp.z);
    stage.recruit = { x: camp.x + 1, z: camp.z };
  }
  // Pikes and gibbets along the way: the Church's offerings.
  for (let i = 0; i < 6; i++) {
    const s = spot(8, width - 6, 0.5, 0.5);
    add(rng.chance(0.6) ? 'pike' : 'gibbet', s.x, s.z);
  }

  ensureReachable(stage, [
    ...stage.exits,
    site,
    lair,
    cache,
    ...(stage.vault ? [stage.vault.door] : []),
    ...(stage.rites ?? []),
  ]);

  // The roads follow the way a body walks from the entrance to each exit.
  nav = navFor(stage);
  stage.roads = stage.exits.map((e) => {
    const path = nav.path(entrance, e).filter((_, k, all) => k % 3 === 0 || k === all.length - 1);
    return [entrance, ...path, e, beyond(e)];
  });
  layGround(stage, rng, nav, keep);
  stage.spots = laySpots(stage, rng, nav, keep);
  const road = stage.roads[0];
  // A pack watches the narrowest point of the way, halfway along the road.
  const choke = road[Math.floor(road.length / 2)];

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
  } else if (plan.objective === 'ritual') {
    // Two waves for each sigil: as the bearer steps onto it, and halfway through
    stage.waves = buildWaves(stage, rng, plan.kind === 'elite', (stage.rites?.length ?? 0) * 2);
  } else {
    placePacks(stage, rng, { site, lair, breach: choke }, plan.kind === 'elite');
  }
  if (plan.objective) {
    stage.objective = plan.objective;
    // The spoils of a finished objective appear before the exits.
    const mid = stage.exits.reduce((n, e) => n + e.z, 0) / Math.max(1, stage.exits.length);
    stage.reward = navFor(stage).free(width - 7, mid, size);
  }
  if (plan.objective === 'hunt') {
    markHunt(stage, rng, plan.kind === 'elite');
  }
  if (plan.objective === 'escort') {
    stage.refugees = refugeesAt(stage, plan.kind === 'elite');
  }
  if (plan.objective === 'hunt' || plan.objective === 'escort') {
    stage.mobs = buildMobs(stage, rng, plan.kind === 'elite');
  }
  if (plan.objective === 'collapse') {
    // The floor falls from the entrance's edge, and stops short of the exits.
    stage.collapse = {
      dir: { x: 1, z: 0 },
      front: 0,
      stop: width * COLLAPSE_STOP,
      speed: COLLAPSE_SPEED * (plan.kind === 'elite' ? COLLAPSE_ELITE : 1),
    };
  }
  if (plan.miniBoss) {
    placeMiniBoss(stage, rng, plan.miniBoss, plan.kind === 'elite');
  }
  if (plan.objective === 'vault') {
    // A mini-boss holds the key, or else the lair's leader. The spoils wait
    // at the vault's door.
    (stage.packs.find((p) => p.mini) ?? stage.packs[1]).key = 0;
    stage.reward = { ...stage.vault!.door };
  }
  return stage;
}

// Spawn spots: one in each cell of a grid this many tiles across, at most
// this many, no nearer the entrance than this
const SPAWN_GRID = 8;
const SPAWNS_MOST = 16;
const SPAWN_FROM_ENTRANCE = 6;
// How many places a spot is tried at before it is given up
const SPOT_TRIES = 6;
// Boss spots, at these shares of the way along the first road, a few tiles
// to its side; relief spots along every road, a few apart
const BOSS_ALONG = [0.35, 0.6, 0.85];
const BOSS_ASIDE = 3;
const RELIEF_SPOTS = 4;
const RELIEF_ASIDE = 2.5;
const RELIEF_NEAR = 0.8;
const RELIEF_APART = 6;

// The point a share of the way along a road, and the way it runs there
function along(road: readonly Spot[], share: number): { at: Spot; dir: Spot } {
  const legs = road.slice(1).map((b, i) => Math.hypot(b.x - road[i].x, b.z - road[i].z));
  let left = legs.reduce((n, l) => n + l, 0) * share;
  for (const [i, l] of legs.entries()) {
    if (left <= l && l > 0) {
      const a = road[i];
      const b = road[i + 1];
      const t = left / l;
      return {
        at: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t },
        dir: { x: (b.x - a.x) / l, z: (b.z - a.z) / l },
      };
    }
    left -= l;
  }
  return { at: road[road.length - 1], dir: { x: 1, z: 0 } };
}

/**
 * Lays the level director's key points over an open field: spawn spots
 * spread across it, boss spots along the first road, and relief spots
 * beside the roads. Each stands on open ground, clear of the places.
 */
function laySpots(stage: Stage, rng: RNG, nav: Nav, keep: readonly Keep[]): KeyPoint[] {
  const spots: KeyPoint[] = [];
  // Only where the party can walk to from the entrance
  const flow = new Flow(rectOf(stage), stage.entrance, (x, z) => nav.walkable(x, z));
  const clear = (p: Spot, gap: number): boolean =>
    Number.isFinite(flow.at(p)) &&
    p.x > 1 &&
    p.z > 1 &&
    p.x < stage.width - 1 &&
    p.z < stage.depth - 1 &&
    nav.roomy(p.x, p.z) &&
    !keep.some((k) => Math.hypot(k.x - p.x, k.z - p.z) < k.r + gap);
  // A few tries in each cell of the grid, anywhere in it
  const cells = Math.floor(stage.width / SPAWN_GRID);
  const tryCell = (i: number, j: number): Spot | null => {
    for (let t = 0; t < SPOT_TRIES; t++) {
      const p = { x: (i + rng.random()) * SPAWN_GRID, z: (j + rng.random()) * SPAWN_GRID };
      const far = Math.hypot(p.x - stage.entrance.x, p.z - stage.entrance.z) >= SPAWN_FROM_ENTRANCE;
      if (far && clear(p, 0)) {
        return p;
      }
    }
    return null;
  };
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const p = tryCell(i, j);
      if (p) {
        spots.push({ kind: 'spawn', ...p });
      }
    }
  }
  spots.splice(SPAWNS_MOST, Infinity);
  const road = stage.roads.at(0);
  // Each boss spot to one side of the road or the other, a little along it
  // if both are taken
  for (const share of road ? BOSS_ALONG : []) {
    const first = rng.chance(0.5) ? 1 : -1;
    const tries = [0, 0.04, -0.04, 0.08, -0.08].flatMap((nudge) =>
      [first, -first].map((side) => ({ nudge, side })),
    );
    for (const { nudge, side } of tries) {
      const { at, dir } = along(road!, share + nudge);
      const p = nav.free(at.x - dir.z * side * BOSS_ASIDE, at.z + dir.x * side * BOSS_ASIDE);
      if (clear(p, 0)) {
        spots.push({ kind: 'boss', ...p });
        break;
      }
    }
  }
  const relief: KeyPoint[] = [];
  // Beside the road where there is room, nearer it where there is not, as
  // on a bridge
  for (let tries = 0; tries < 80 && relief.length < RELIEF_SPOTS; tries++) {
    const r = rng.pick(stage.roads);
    const { at, dir } = along(r, rng.range(0.2, 0.8));
    const side = (rng.chance(0.5) ? 1 : -1) * (tries < 40 ? RELIEF_ASIDE : RELIEF_NEAR);
    const p = { x: at.x - dir.z * side, z: at.z + dir.x * side };
    const apart = relief.every((o) => Math.hypot(o.x - p.x, o.z - p.z) >= RELIEF_APART);
    if (apart && clear(p, 0)) {
      relief.push({ kind: 'relief', ...p });
    }
  }
  return [...spots, ...relief];
}

// What lies on each layer's open fields, as counts to roll between: pools
// of shallow water, patches of embers and healing blossoms.
const GROUND: readonly {
  water: [number, number];
  embers: [number, number];
  blossoms: [number, number];
}[] = [
  { water: [1, 2], embers: [0, 0], blossoms: [2, 2] },
  { water: [0, 0], embers: [2, 3], blossoms: [1, 1] },
  { water: [2, 3], embers: [0, 0], blossoms: [1, 2] },
  { water: [1, 2], embers: [1, 2], blossoms: [1, 1] },
];
const WATER_R: [number, number] = [2.5, 4];
const EMBERS_R: [number, number] = [1.5, 2.5];
// How far embers keep from the roads, past their own edge, so the way on
// never has to cross them
const EMBERS_OFF_ROAD = 1.2;

/**
 * Lays an open field's water, embers and blossoms on open ground, clear of
 * the entrance, the exits and the places. Water may lie across a road;
 * embers keep off them.
 */
function layGround(stage: Stage, rng: RNG, nav: Nav, keep: readonly Keep[]): void {
  const counts = GROUND[stage.biome] ?? GROUND[0];
  const { width, depth } = stage;
  const clear = (p: Spot, r: number): boolean =>
    nav.roomy(p.x, p.z) && !keep.some((k) => Math.hypot(k.x - p.x, k.z - p.z) < k.r + r);
  const patches: Patch[] = [];
  const lay = (kind: Patch['kind'], n: number, radius: [number, number]): void => {
    let laid = 0;
    for (let tries = 0; tries < 60 && laid < n; tries++) {
      const r = rng.range(...radius);
      const p = { x: rng.range(r + 2, width - r - 2), z: rng.range(r + 2, depth - r - 2) };
      const apart = patches.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > o.r + r + 2);
      const offRoad = kind === 'water' || !onRoads(stage, p.x, p.z, r + EMBERS_OFF_ROAD);
      if (clear(p, r) && apart && offRoad) {
        patches.push({ kind, ...p, r });
        laid++;
      }
    }
  };
  lay('water', rng.int(...counts.water), WATER_R);
  lay('embers', rng.int(...counts.embers), EMBERS_R);
  stage.patches = patches;
  const want = rng.int(...counts.blossoms);
  let grown = 0;
  for (let tries = 0; tries < 60 && grown < want; tries++) {
    const p = { x: rng.range(6, width - 6), z: rng.range(4, depth - 4) };
    if (clear(p, 1) && patches.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > o.r + 1)) {
      stage.props.push({ kind: 'blossom', ...p, seed: rng.random() });
      grown++;
    }
  }
}

// The ring of traps round a Vault's strongroom: how far out, how many
const VAULT_RING = 3.6;
const VAULT_TRAPS = 6;

// Traps ringing a Vault's strongroom: spike grates and fire vents in turn,
// each on its own beat, so there is a way through for whoever watches.
function vaultTraps(at: Spot, layer: number): Hazard[] {
  const n = VAULT_TRAPS + (layer >= 2 ? 2 : 0);
  return Array.from({ length: n }, (_, i): Hazard => {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const kind: HazardKind = i % 2 === 0 ? 'spikes' : 'vent';
    return {
      kind,
      x: at.x + Math.cos(a) * VAULT_RING,
      z: at.z + Math.sin(a) * VAULT_RING,
      period: TRAP_PERIOD[kind],
      phase: (i / n) * TRAP_PERIOD[kind],
    };
  });
}

/**
 * Places a fight's mini-boss, as Left 4 Dead deals its bosses along the
 * flow: an Elite fight's at its farthest boss spot, so it ends on it, any
 * other's at one of them. A Horde's last wave is led by it, and an Elite
 * Hunt's first quarry is it.
 */
function placeMiniBoss(stage: Stage, rng: RNG, id: MiniBossId, elite: boolean): void {
  const def = MINI_BOSSES[id];
  const last = stage.waves?.at(-1);
  if (last) {
    last.mini = id;
    last.elite = -1;
    last.affixes = undefined;
    return;
  }
  const spots = (stage.spots ?? []).filter((s) => s.kind === 'boss');
  const lair = stage.packs.at(1);
  const fallback = lair
    ? { x: lair.x + 4, z: lair.z }
    : { x: stage.width * 0.7, z: stage.depth / 2 };
  let at: Spot = fallback;
  if (spots.length > 0) {
    at = elite ? spots[spots.length - 1] : rng.pick(spots);
  }
  const pack: Pack = { kinds: [def.kind, ...def.escort], x: at.x, z: at.z, elite: 0, mini: id };
  if (elite && stage.objective === 'hunt') {
    pack.marked = 0;
  }
  stage.packs.push(pack);
}

// How many refugees an Escort has, one more in an Elite area, and how far
// from the entrance they wait
const REFUGEES = 5;
const REFUGEE_RING = 1.4;

// An Escort's refugees wait in a ring just inside the entrance.
function refugeesAt(stage: Stage, elite: boolean): Spot[] {
  const n = REFUGEES + (elite ? 1 : 0);
  const at = { x: stage.entrance.x + 2.5, z: stage.entrance.z };
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: at.x + Math.cos(a) * REFUGEE_RING, z: at.z + Math.sin(a) * REFUGEE_RING };
  });
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

// An Ambush's groups: how many, one more in an Elite area, how far from the
// fire they wait, and the share of an area's threat they hold between them
const AMBUSH_GROUPS = 3;
const AMBUSH_RING = 9;
const AMBUSH_SHARE = 0.8;

/**
 * An Ambush: laid out as a Camp, its fire in the middle, but with groups
 * waiting unseen all round it. They close in once the bearer comes near
 * the fire or an exit. Once they are dead, the fire is a real Camp's.
 */
function generateAmbush(rng: RNG, index: number, plan: AreaPlan, biome: number): Stage {
  const { stage, add } = smallField(rng, index, plan.kind, plan.ahead, biome, plan.sides);
  stage.scale = plan.scale;
  const fire = { x: stage.width / 2, z: stage.depth / 2 };
  add('campfire', fire.x, fire.z);
  stage.rest = fire;
  edgeTrees(stage, add, rng, fire);
  stage.objective = 'ambush';
  const elite = plan.kind === 'elite';
  const count = AMBUSH_GROUPS + (elite ? 1 : 0);
  // The groups share most of a fight's threat, from all round the fire.
  const waves = buildWaves(stage, rng, elite, count);
  const nav = navFor(stage);
  const turn = rng.range(0, Math.PI * 2);
  waves.forEach((w, i) => {
    const a = turn + (i / count) * Math.PI * 2;
    const want = {
      x: Math.max(2, Math.min(stage.width - 2, fire.x + Math.cos(a) * AMBUSH_RING)),
      z: Math.max(2, Math.min(stage.depth - 2, fire.z + Math.sin(a) * AMBUSH_RING)),
    };
    w.from = nav.free(want.x, want.z);
    w.kinds = w.kinds.slice(0, Math.max(3, Math.round(w.kinds.length * AMBUSH_SHARE)));
  });
  stage.waves = waves;
  stage.reward = { x: fire.x + 2.5, z: fire.z };
  // Its groups wait at its spawn spots; relief may come by the fire.
  stage.spots = [
    ...waves.map((w): KeyPoint => ({ kind: 'spawn', ...w.from })),
    ...[-1, 1].map((k): KeyPoint => ({ kind: 'relief', ...nav.free(fire.x, fire.z + k * 3) })),
  ];
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
          prop.kind === 'vault' ||
          prop.r === undefined ||
          distanceToSegment(prop, stage.entrance, p) > prop.r + 1.2,
      );
    }
  }
}

/** Where units can walk on a stage. */
export function navFor(stage: Stage): Nav {
  return new Nav(stage.width, stage.depth, [...solidsOf(stage), ...holesOf(stage)]);
}

// How far a chasm cell blocks bodies from its middle, so its corners do too
const CHASM_R = 0.72;

/** The chasm's cells, as places bodies cannot go. They do not block sight. */
export function holesOf(stage: Stage): { x: number; z: number; r: number }[] {
  return (stage.chasm ?? []).map((c) => ({ x: c.x, z: c.z, r: CHASM_R }));
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
// area of the layer, from 0, a pack can appear in. A pack is its kinds over
// and over until it is `size` strong: swarms of the weak, fewer of the
// strong.
interface Faction {
  layer: number;
  from: number;
  kinds: MonsterKind[];
  size: [number, number];
}

// Swarms of fodder, mixed packs, and packs of the strong
const SWARM: [number, number] = [6, 12];
const MIXED: [number, number] = [4, 8];
const STRONG: [number, number] = [3, 5];

const FACTIONS: Faction[] = [
  // The Marches: the Blight at the rim, the drowned, and the Church's first keepers
  { layer: 0, from: 0, kinds: ['mite'], size: SWARM },
  { layer: 0, from: 0, kinds: ['husk'], size: SWARM },
  { layer: 0, from: 0, kinds: ['husk', 'mite', 'mite'], size: MIXED },
  { layer: 0, from: 2, kinds: ['crawler', 'mite', 'mite'], size: MIXED },
  { layer: 0, from: 2, kinds: ['hollowSoldier', 'husk', 'husk', 'husk'], size: MIXED },
  { layer: 0, from: 4, kinds: ['penitent', 'penitent', 'husk'], size: MIXED },
  { layer: 0, from: 4, kinds: ['crawler'], size: MIXED },
  { layer: 0, from: 4, kinds: ['hollowSoldier'], size: STRONG },
  { layer: 0, from: 5, kinds: ['hollowed', 'penitent', 'penitent'], size: MIXED },
  { layer: 0, from: 6, kinds: ['hollowed'], size: STRONG },
  // The Rift Road: the Old King's guard holds the road down
  { layer: 1, from: 0, kinds: ['hollowSoldier', 'hollowSoldier', 'husk'], size: MIXED },
  { layer: 1, from: 0, kinds: ['hollowSoldier', 'husk', 'husk', 'husk'], size: MIXED },
  { layer: 1, from: 0, kinds: ['crawler', 'mite', 'mite'], size: SWARM },
  { layer: 1, from: 2, kinds: ['hollowSoldier'], size: STRONG },
  { layer: 1, from: 4, kinds: ['penitent', 'hollowSoldier', 'hollowSoldier'], size: MIXED },
  // The Drowned Undercroft: the Church's keepers and the drowned
  { layer: 2, from: 0, kinds: ['penitent', 'penitent', 'husk'], size: MIXED },
  { layer: 2, from: 0, kinds: ['husk'], size: SWARM },
  { layer: 2, from: 0, kinds: ['cantor', 'penitent', 'penitent', 'penitent'], size: MIXED },
  { layer: 2, from: 3, kinds: ['penitent'], size: MIXED },
  { layer: 2, from: 4, kinds: ['hollowed', 'penitent'], size: STRONG },
  // The Sunken Crown: the mad, and the last of the guard
  { layer: 3, from: 0, kinds: ['hollowed'], size: STRONG },
  { layer: 3, from: 0, kinds: ['hollowed', 'penitent', 'penitent'], size: MIXED },
  { layer: 3, from: 0, kinds: ['cantor', 'hollowSoldier', 'hollowSoldier'], size: MIXED },
  { layer: 3, from: 3, kinds: ['hollowed', 'hollowed', 'husk', 'husk'], size: MIXED },
];

/** A pack of a faction: its kinds over and over, as many as its size rolls, at most `cap`. */
function packOf(rng: RNG, f: Faction, cap = Infinity): MonsterKind[] {
  const n = Math.min(cap, rng.int(f.size[0], f.size[1]));
  return Array.from({ length: n }, (_, i) => f.kinds[i % f.kinds.length]);
}

// A pack straying on the way to a boss: the Brood Mother's mites in
// the Marches, the layer's own packs below.
function approachPack(rng: RNG, layer: number): MonsterKind[] {
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
const ELITE_FROM = 4;
const BUDGET_BASE = 24;
const BUDGET_STEP = 6;
const ELITE_BUDGET = 1.4;

// The packs a stage's layer fields at its depth.
const factionPool = (stage: Stage): Faction[] =>
  FACTIONS.filter((f) => f.layer === stage.biome && f.from <= stage.index % AREAS_PER_LAYER);

/**
 * The threat an area's monsters add up to: much more than a few small packs,
 * so the field can swarm, and more each area. An Elite area holds more.
 */
export function areaBudget(index: number, elite: boolean, scale = 1): number {
  return (BUDGET_BASE + index * BUDGET_STEP) * (elite ? ELITE_BUDGET : 1) * scale;
}

function placePacks(
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
      p.affixes = rollAffixes(rng, stage.biome, p.kinds.length);
    }
  }
}

// How many affixes an elite rolls, by layer: one in the Marches, two in the
// Rift Road and the Undercroft, three in the Sunken Crown
const AFFIX_COUNT = [1, 2, 2, 3];

/** An elite's affixes, rolled from the layout stream. Bound only for a pack to bind. */
export function rollAffixes(rng: RNG, layer: number, packSize: number): Affix[] {
  const pool = AFFIXES.filter((a) => a !== 'bound' || packSize >= 3);
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

// A Horde's waves: 4, one more in an Elite area and one more below the
// Marches, each a little stronger, 20 seconds apart unless beaten sooner.
const HORDE_WAVES = 4;
const WAVE_GAP = 20;
const FIRST_WAVE = 3;
// The most monsters in one wave
const WAVE_MOST = 15;

/**
 * A Horde's waves, from the threat budget a stage's packs would have had,
 * split over them and rising. Each comes from a spot on the north, south or
 * east edge, far from the entrance. The last is led by an elite once deep
 * enough, or always in an Elite area.
 */
function buildWaves(
  stage: Stage,
  rng: RNG,
  elite: boolean,
  count = HORDE_WAVES + (elite ? 1 : 0) + (stage.index >= AREAS_PER_LAYER ? 1 : 0),
): Wave[] {
  const total = areaBudget(stage.index, elite, stage.scale);
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
    while (budget > 0 && kinds.length < WAVE_MOST) {
      for (const k of packOf(rng, rng.pick(pool), WAVE_MOST - kinds.length)) {
        kinds.push(k);
        budget -= THREAT[k];
      }
    }
    const last = w === count - 1;
    const led = last && (elite || stage.index >= ELITE_FROM);
    waves.push({
      kinds,
      from: edge(),
      delay: w === 0 ? FIRST_WAVE : WAVE_GAP,
      elite: led ? 0 : -1,
      affixes: led ? rollAffixes(rng, stage.biome, kinds.length) : undefined,
    });
  }
  return waves;
}

// Mobs in a Hunt or an Escort: how many, how much of an area's threat each
// holds, and how many seconds apart they come, at the least
const MOBS = 3;
const MOB_SHARE = 0.15;
const MOB_EVERY: [number, number] = [60, 120];

/**
 * A Hunt's or an Escort's mobs, as Left 4 Dead's: groups the director sends
 * on a randomized beat while it is building up, each a share of the area's
 * threat, from the layer's packs.
 */
function buildMobs(stage: Stage, rng: RNG, elite: boolean): Mob[] {
  const pool = factionPool(stage);
  if (pool.length === 0) {
    return [];
  }
  return Array.from({ length: MOBS }, () => {
    let budget = areaBudget(stage.index, elite, stage.scale) * MOB_SHARE;
    const kinds: MonsterKind[] = [];
    while (budget > 0 && kinds.length < WAVE_MOST) {
      for (const k of packOf(rng, rng.pick(pool), WAVE_MOST - kinds.length)) {
        kinds.push(k);
        budget -= THREAT[k];
      }
    }
    return { kinds, after: rng.range(...MOB_EVERY) };
  });
}

// A Labyrinth's cells, in tiles across, and how many across and down
const CELL = 4;
const MAZE_COLUMNS = 14;
const MAZE_ROWS = 9;
// Walls taken down at random after the maze is carved, so it has loops
const MAZE_LOOPS = 0.12;
// The most monsters a dead end holds
const MAZE_PACK = 6;

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
  let budget = areaBudget(index, elite, plan.scale) * 0.8;
  const pool = factionPool(stage);
  const used = new Set<number>();
  for (const [i, j] of cells) {
    if (budget <= 0) {
      break;
    }
    if (walls(i, j) < 3 || i < 2) {
      continue;
    }
    // A dead end holds no more than this many
    const kinds = packOf(rng, rng.pick(pool), MAZE_PACK);
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
  // The cells the party reaches from the entrance with some passages shut
  // and some cells fallen in
  const pits = new Set<number>();
  const reachable = (
    shut: ReadonlySet<string>,
    fallen: ReadonlySet<number> = pits,
  ): Set<number> => {
    const seen2 = new Set([key(0, startRow)]);
    const todo: [number, number][] = [[0, startRow]];
    for (let next = todo.pop(); next; next = todo.pop()) {
      const [i, j] = next;
      const ways: [number, number, boolean][] = [
        [i + 1, j, i < hall - 1 && !east[i][j]],
        [i - 1, j, i > 0 && !east[i - 1][j]],
        [i, j + 1, j < MAZE_ROWS - 1 && !south[i][j]],
        [i, j - 1, j > 0 && !south[i][j - 1]],
      ];
      for (const [a, b, open] of ways) {
        const id = [Math.min(i, a), Math.min(j, b), Math.max(i, a), Math.max(j, b)].join();
        if (open && !shut.has(id) && !seen2.has(key(a, b)) && !fallen.has(key(a, b))) {
          seen2.add(key(a, b));
          todo.push([a, b]);
        }
      }
    }
    return seen2;
  };
  const traps = 8 + Math.floor(index / 2) + (elite ? 3 : 0);
  const kinds = index >= AREAS_PER_LAYER ? TRAPS_DEEP : TRAPS_SHALLOW;
  for (const [i, j] of cells.filter(([a, b]) => !used.has(key(a, b))).slice(0, traps)) {
    const at = middle(i, j);
    // The way the corridor runs: along x if both its east and west are open
    const axis = !east[i][j] && !east[i - 1][j] ? 'x' : 'z';
    let kind = rng.pick(kinds);
    // A floor falls in only where the maze stays whole without the cell.
    if (kind === 'floor') {
      const all = reachable(new Set()).size;
      const without = new Set([...pits, key(i, j)]);
      if (reachable(new Set(), without).size === all - 1) {
        pits.add(key(i, j));
      } else {
        kind = 'spikes';
      }
    }
    used.add(key(i, j));
    const period = TRAP_PERIOD[kind];
    stage.hazards?.push({ kind, x: at.x, z: at.z, period, phase: rng.range(0, period), axis });
  }

  // Passages between cells, as the cells on either side
  const passages: [number, number, number, number][] = [];
  for (let i = 1; i < hall; i++) {
    for (let j = 0; j < MAZE_ROWS; j++) {
      if (i < hall - 1 && !east[i][j]) {
        passages.push([i, j, i + 1, j]);
      }
      if (j < MAZE_ROWS - 1 && !south[i][j]) {
        passages.push([i, j, i, j + 1]);
      }
    }
  }
  // A gate's bars along the wall between two cells
  const bars = ([i, j, a, b]: [number, number, number, number]): Prop[] => {
    const out: Prop[] = [];
    for (let t = STEP / 2; t < CELL; t += STEP) {
      const x = a > i ? (i + 1) * CELL : i * CELL + t;
      const z = b > j ? (j + 1) * CELL : j * CELL + t;
      out.push(add('gate', x, z));
    }
    return out;
  };
  stage.gates = [];
  // Inner gates that each cut off part of the maze, with levers before them
  const shut = new Set<string>();
  const want = index >= GATES_DEEP_FROM ? 2 : 1;
  for (const passage of rng.shuffle(passages)) {
    if (shut.size >= want) {
      break;
    }
    const id = passage.join();
    const before = reachable(shut).size;
    shut.add(id);
    if (reachable(shut).size === before) {
      shut.delete(id);
    }
  }
  const open = reachable(shut);
  const leverCells = rng.shuffle(
    cells.filter(([i, j]) => open.has(key(i, j)) && !used.has(key(i, j)) && i > 0),
  );
  for (const passage of passages.filter((x) => shut.has(x.join()))) {
    const cell = leverCells.pop();
    if (!cell) {
      break;
    }
    const at = middle(...cell);
    used.add(key(...cell));
    const lever = add('lever', at.x, at.z);
    stage.gates.push({ blocks: bars(passage), lever });
  }
  // The hall's gates, and the key one of the packs carries
  const keyPack = stage.packs.length > 0 ? rng.pick(stage.packs) : undefined;
  if (keyPack) {
    keyPack.key = 0;
    for (let j = 0; j < MAZE_ROWS; j++) {
      if (!east[hall - 1][j]) {
        stage.gates.push({ blocks: bars([hall - 1, j, hall, j]) });
      }
    }
  }
  return stage;
}
