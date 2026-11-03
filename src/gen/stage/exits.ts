// Exits, the roads to them, and the signposts' fights ahead.
import type { Spot } from '../../sim/nav';
import type { MapNode, Mutator, NodeKind, Objective, Reward } from '../graph';
import type { Add } from './props';
import { distanceToSegment } from './reach';
import type { Stage } from './types';

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

// The way out across each edge, and along it
export const OUT: Record<ExitSide, Spot> = {
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
export function placeExits(
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
export const onRoads = (stage: Stage, x: number, z: number, reach = 1.6): boolean =>
  stage.roads.some((road) =>
    road.slice(1).some((b, i) => distanceToSegment({ x, z }, road[i], b) < reach),
  );

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
