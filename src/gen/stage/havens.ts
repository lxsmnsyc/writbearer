// Small safe fields: the Waystation, the Guild House, a Town, a Camp and an Event.
import type RNG from '../../core/rng';
import type { Spot } from '../../sim/nav';
import { layerIndexOf } from '../layers';
import { type Ahead, type ExitSide, beyond, onRoads, placeExits } from './exits';
import { type Add, type PropKind, adder, tallFor } from './props';
import type { AreaPlan, Stage } from './types';

// A small safe field: the entrance on the west, the exits on the east and
// a place between the roads, with trees or pillars round the edge.
export function smallField(
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
  const add = adder(stage, rng);
  placeExits(stage, add, ahead, depth / 2, sides, width * 0.7);
  stage.roads = stage.exits.map((e) => [entrance, e, beyond(e)]);
  return { stage, add };
}

// Trees or pillars round a small field's edge, off the roads and its place.
export function edgeTrees(stage: Stage, add: Add, rng: RNG, place: Spot): void {
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
export const GUILD_RECRUITS = 5;

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
    x: mid.x - 5 + i * 2.5,
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
export function generateTown(
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
export function generateCamp(
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
export function generateEvent(
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
