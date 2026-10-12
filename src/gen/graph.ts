import type RNG from '../core/rng';
import { AREAS_PER_LAYER } from './layers';

/** What waits in an area of a layer's map. */
export type NodeKind = 'combat' | 'elite' | 'camp' | 'town' | 'boss';

/** One area on a layer's map. */
export interface MapNode {
  // Which of its column's nodes this is, from the north edge
  row: number;
  kind: NodeKind;
  // Rows of the next column this area's exits lead to, north first
  next: number[];
}

/**
 * A layer's map, as Slay the Spire's: one column per area, the last the
 * boss's arena. The Waystation leads into every node of the first column.
 */
export interface LayerMap {
  columns: MapNode[][];
}

// Elites from the third column, Camps from the fourth. The column before
// the boss always has a Camp.
const ELITE_FROM = 2;
const ELITE_CHANCE = 0.25;
const CAMP_FROM = 3;
const CAMP_CHANCE = 0.18;

// The columns a layer's Town may stand in.
const TOWN_COLUMNS = [3, 4];

/**
 * Rolls a layer's map from the `map` stream. `opening` is how many areas
 * its first column has: 2 below a Waystation, 1 where the run begins. A
 * layer with a `town` has one Town, in its fourth or fifth column.
 */
export function generateLayerMap(rng: RNG, opening = 2, town = false): LayerMap {
  const last = AREAS_PER_LAYER - 1;
  const columns: MapNode[][] = [];
  for (let c = 0; c <= last; c++) {
    let count = rng.int(2, 3);
    if (c === 0) {
      count = opening;
    } else if (c === last) {
      count = 1;
    } else {
      // Each area has at most two ways out.
      count = Math.min(count, 2 * columns[c - 1].length);
    }
    columns.push(
      Array.from({ length: count }, (_, row) => ({ row, kind: kindFor(rng, c), next: [] })),
    );
  }
  for (let c = 0; c < last; c++) {
    link(rng, columns[c], columns[c + 1]);
  }
  // No road joins two Camps or two Elites: a fight comes between them.
  for (let c = 1; c < last; c++) {
    for (const [j, node] of columns[c].entries()) {
      const before = columns[c - 1].filter((n) => n.next.includes(j));
      if (node.kind !== 'combat' && before.some((n) => n.kind === node.kind)) {
        node.kind = 'combat';
      }
    }
  }
  if (town) {
    rng.pick(columns[rng.pick(TOWN_COLUMNS)]).kind = 'town';
  }
  columns[last][0].kind = 'boss';
  // The party can always rest before the boss.
  const beforeBoss = columns[last - 1];
  for (const node of beforeBoss) {
    if (node.kind === 'elite') {
      node.kind = 'combat';
    }
  }
  if (!beforeBoss.some((n) => n.kind === 'camp')) {
    rng.pick(beforeBoss).kind = 'camp';
  }
  beforeBoss.forEach((node, j) => {
    for (const n of columns[last - 2]) {
      if (node.kind === 'camp' && n.kind === 'camp' && n.next.includes(j)) {
        n.kind = 'combat';
      }
    }
  });
  return { columns };
}

function kindFor(rng: RNG, column: number): NodeKind {
  if (column >= CAMP_FROM && rng.chance(CAMP_CHANCE)) {
    return 'camp';
  }
  if (column >= ELITE_FROM && rng.chance(ELITE_CHANCE)) {
    return 'elite';
  }
  return 'combat';
}

// Joins two columns without crossing paths: a staircase from the north
// corner to the south one that steps down one column, the other or both.
// Every node gets at least one way in and one way out, and at most two out.
function link(rng: RNG, from: MapNode[], to: MapNode[]): void {
  let i = 0;
  let j = 0;
  for (;;) {
    from[i].next.push(j);
    const lastFrom = i === from.length - 1;
    const lastTo = j === to.length - 1;
    if (lastFrom && lastTo) {
      return;
    }
    // Whether the nodes left in `from` can still reach every node left in
    // `to` from (i2, j2): the next one adds one more, each after it two.
    const room = (i2: number, j2: number): boolean =>
      to.length - 1 - j2 <= 1 + 2 * (from.length - 1 - i2);
    const steps: [number, number][] = [];
    if (!lastFrom && room(i + 1, j)) {
      steps.push([1, 0]);
    }
    if (!lastTo && from[i].next.length < 2) {
      steps.push([0, 1]);
    }
    if (!lastFrom && !lastTo && room(i + 1, j + 1)) {
      steps.push([1, 1]);
    }
    const [di, dj] = rng.pick(steps);
    i += di;
    j += dj;
  }
}
