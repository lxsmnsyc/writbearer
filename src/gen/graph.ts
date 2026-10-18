import type RNG from '../core/rng';
import { AREAS_PER_LAYER } from './layers';

/** What waits in an area of a layer's map. */
export type NodeKind = 'combat' | 'elite' | 'camp' | 'event' | 'town' | 'boss';

/**
 * What a fight area asks of the party before its exits open, as Aghanim's
 * Labyrinth's rooms: slay the marked monsters, hold out against waves, or
 * find the way through a maze of traps.
 */
export type Objective = 'hunt' | 'horde' | 'maze';

export const OBJECTIVE_NAME: Record<Objective, string> = {
  hunt: 'Hunt',
  horde: 'Horde',
  maze: 'Labyrinth',
};

/**
 * What a fight's chest holds once its objective is done, as Hades's doors.
 * The signpost and the map show it before the party chooses the road.
 */
export type Reward = 'gold' | 'arms' | 'cards' | 'materials' | 'respite';

export const REWARDS: readonly Reward[] = ['gold', 'arms', 'cards', 'materials', 'respite'];

export const REWARD_NAME: Record<Reward, string> = {
  gold: 'Gold',
  arms: 'Arms',
  cards: 'Cards',
  materials: 'Materials',
  respite: 'Respite',
};

/**
 * A fight's bonus challenge, as Aghanim's Labyrinth's room grades. Meeting
 * it upgrades the reward. Failing it loses only the upgrade.
 */
export type Challenge = 'untouched' | 'noLosses' | 'swift' | 'thorough';

/** The challenges each objective can roll. A Horde's field is empty, so it has no Thorough. */
export const CHALLENGES: Record<Objective, readonly Challenge[]> = {
  hunt: ['untouched', 'noLosses', 'swift', 'thorough'],
  horde: ['untouched', 'noLosses'],
  maze: ['untouched', 'noLosses', 'swift', 'thorough'],
};

export const CHALLENGE_NAME: Record<Challenge, string> = {
  untouched: 'Untouched',
  noLosses: 'No losses',
  swift: 'Swift',
  thorough: 'Thorough',
};

/** One area on a layer's map. */
export interface MapNode {
  // Which of its column's nodes this is, from the north edge
  row: number;
  kind: NodeKind;
  // A fight's objective, Elite or not, and what it pays
  objective?: Objective;
  reward?: Reward;
  challenge?: Challenge;
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
// Events from the second column.
const EVENT_FROM = 1;
const EVENT_CHANCE = 0.16;

// Each objective as often as the others
export const OBJECTIVES: readonly Objective[] = ['hunt', 'horde', 'maze'];

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
  // No road joins two Camps, two Elites or two Events: a fight comes between them.
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
  // Every fight has an objective. The run opens on a Hunt, the gentlest.
  columns.forEach((column, c) => {
    for (const node of column) {
      if (node.kind === 'combat' || node.kind === 'elite') {
        node.objective = c === 0 && opening === 1 ? 'hunt' : rng.pick(OBJECTIVES);
      }
    }
  });
  rollRewards(rng, columns);
  for (const node of columns.flat()) {
    if (node.objective) {
      node.challenge = rng.pick(CHALLENGES[node.objective]);
    }
  }
  return { columns };
}

// Gives every fight a reward. No two roads from one fork pay the same: the
// first column's areas all lie beyond the one before the map, and each
// later area differs from the others its roads in come from.
function rollRewards(rng: RNG, columns: MapNode[][]): void {
  columns.forEach((column, c) => {
    for (const [j, node] of column.entries()) {
      if (!node.objective) {
        continue;
      }
      // The areas beside it beyond each fork it lies past
      const forks =
        c === 0
          ? [column]
          : columns[c - 1]
              .filter((n) => n.next.includes(j))
              .map((n) => n.next.map((row) => column[row]));
      const taken = new Set(forks.flat().map((n) => n.reward));
      const free = REWARDS.filter((r) => !taken.has(r));
      node.reward = rng.pick(free.length > 0 ? free : REWARDS);
    }
  });
}

function kindFor(rng: RNG, column: number): NodeKind {
  if (column >= CAMP_FROM && rng.chance(CAMP_CHANCE)) {
    return 'camp';
  }
  if (column >= ELITE_FROM && rng.chance(ELITE_CHANCE)) {
    return 'elite';
  }
  if (column >= EVENT_FROM && rng.chance(EVENT_CHANCE)) {
    return 'event';
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
