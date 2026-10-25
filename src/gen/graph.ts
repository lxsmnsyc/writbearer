import type RNG from '../core/rng';
import { AREAS_PER_LAYER } from './layers';

/** What waits in an area of a layer's map. */
export type NodeKind = 'combat' | 'elite' | 'camp' | 'event' | 'town' | 'boss';

/**
 * What a fight area asks of the party before its exits open, as Aghanim's
 * Labyrinth's rooms: slay the marked monsters, hold out against waves,
 * find the way through a maze of traps, see refugees across the field, or
 * take a key from the lair to open a vault, break three sigils in turn
 * while waves come, outrun a falling floor to an exit, live through an
 * ambush at what looked like a Camp, or break the horn posts before the
 * Horn-Bearers reach them.
 */
export type Objective =
  | 'hunt'
  | 'horde'
  | 'maze'
  | 'escort'
  | 'vault'
  | 'ritual'
  | 'collapse'
  | 'ambush'
  | 'silence';

export const OBJECTIVE_NAME: Record<Objective, string> = {
  hunt: 'Hunt',
  horde: 'Horde',
  maze: 'Labyrinth',
  escort: 'Escort',
  vault: 'Vault',
  ritual: 'Ritual',
  collapse: 'Collapse',
  ambush: 'Ambush',
  silence: 'Silence',
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
export type Challenge = 'untouched' | 'noLosses' | 'swift' | 'thorough' | 'silent';

/** The challenges each objective can roll. A Horde's field is empty, so it has no Thorough. */
export const CHALLENGES: Record<Objective, readonly Challenge[]> = {
  hunt: ['untouched', 'noLosses', 'swift', 'thorough'],
  horde: ['untouched', 'noLosses'],
  maze: ['untouched', 'noLosses', 'swift', 'thorough'],
  escort: ['untouched', 'noLosses', 'swift'],
  vault: ['untouched', 'noLosses', 'swift', 'thorough'],
  ritual: ['untouched', 'noLosses', 'swift'],
  collapse: ['untouched', 'noLosses', 'swift', 'thorough'],
  ambush: ['untouched', 'noLosses'],
  silence: ['silent', 'untouched', 'noLosses', 'swift'],
};

export const CHALLENGE_NAME: Record<Challenge, string> = {
  untouched: 'Untouched',
  noLosses: 'No losses',
  swift: 'Swift',
  thorough: 'Thorough',
  silent: 'Silent',
};

/**
 * A rule that changes a fight, as Aghanim's Labyrinth's room modifiers.
 * Each makes the fight harder and adds an item to its chest.
 */
export type Mutator = 'darkness' | 'bloodMoon' | 'volatile' | 'restless' | 'alarmed';

export const MUTATORS: readonly Mutator[] = [
  'darkness',
  'bloodMoon',
  'volatile',
  'restless',
  'alarmed',
];

// The fights Alarmed works in: open fields whose packs stand waiting
const ALARMABLE: ReadonlySet<Objective> = new Set(['hunt', 'escort', 'vault', 'collapse']);

export const MUTATOR_NAME: Record<Mutator, string> = {
  darkness: 'Darkness',
  bloodMoon: 'Blood moon',
  volatile: 'Volatile',
  restless: 'Restless dead',
  alarmed: 'Alarmed',
};

export const MUTATOR_TEXT: Record<Mutator, string> = {
  darkness: 'The party sees half as far.',
  bloodMoon: 'Monsters below half health deal more damage.',
  volatile: 'Monsters burst when they die.',
  restless: 'The whole dead rise as Husks.',
  alarmed: 'Every pack has a Horn-Bearer, and horn posts stand on the field.',
};

// From this layer down, an ordinary fight may roll a mutator; from the
// last, an Elite rolls two.
const MUTATE_FROM = 1;
const MUTATE_CHANCE = 0.3;
const TWO_MUTATORS_FROM = 3;

/** One area on a layer's map. */
export interface MapNode {
  // Which of its column's nodes this is, from the north edge
  row: number;
  kind: NodeKind;
  // A fight's objective, Elite or not, and what it pays
  objective?: Objective;
  reward?: Reward;
  challenge?: Challenge;
  mutators?: Mutator[];
  // Rows of the next column this area's exits lead to, north first
  next: number[];
  // Where it lies on the layer's plan
  cell: Cell;
}

/**
 * A layer's map: its areas as rooms on a plan, a column for each step from
 * the start, the last the boss's arena. Each road joins two rooms side by
 * side on the plan, so the map shows the world as it lies: a road that
 * leaves north on the map leaves north in the world. The Waystation, or
 * the Guild House, stands on `start` and leads into every room of the first
 * column.
 */
export interface LayerMap {
  columns: MapNode[][];
  start: Cell;
}

/** A room's place on a layer's plan. +x is east and +y south, as the world's x and z. */
export interface Cell {
  x: number;
  y: number;
}

// Where every layer's plan begins. The way in is to its west.
const PLAN_START: Cell = { x: 0, y: 0 };
// The four ways from a room to the next
const STEPS: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
];
const keyOf = (c: Cell): string => `${c.x},${c.y}`;
const near = (a: Cell, b: Cell): boolean => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
// Tries to lay a plan before falling back to a straight road
const PLAN_TRIES = 400;
// The most rooms a column has, and ways out of a room
const MOST_ROOMS = 3;
const MOST_WAYS = 2;

/** The rooms of each column on the plan, and the rows each room's roads lead to. */
interface Plan {
  cells: Cell[][];
  next: number[][][];
}

/**
 * Lays a layer's plan out from the start: each column's rooms beside rooms
 * of the column before, none on a room already laid, every room with a way
 * in and one or two ways out, and the last column a single room beside
 * every room before it. Rooms lean east, the way the run goes, so the plan
 * rarely boxes itself in; a plan that does is laid again.
 */
function layPlan(rng: RNG, opening: number): Plan {
  for (let t = 0; t < PLAN_TRIES; t++) {
    const plan = tryPlan(rng, opening);
    if (plan) {
      return plan;
    }
  }
  // A straight road east, which always fits
  const cells = Array.from({ length: AREAS_PER_LAYER }, (_, c) => [{ x: c + 1, y: 0 }]);
  return { cells, next: cells.slice(1).map(() => [[0]]) };
}

function tryPlan(rng: RNG, opening: number): Plan | null {
  const last = AREAS_PER_LAYER - 1;
  const taken = new Set([keyOf(PLAN_START), keyOf({ x: -1, y: 0 })]);
  const free = (c: Cell): boolean => !taken.has(keyOf(c));
  const around = (c: Cell): Cell[] =>
    STEPS.map((d) => ({ x: c.x + d.x, y: c.y + d.y })).filter(free);
  const cells: Cell[][] = [];
  const next: number[][][] = [];
  let prev: Cell[] = [PLAN_START];
  for (let c = 0; c <= last; c++) {
    let chosen: Cell[] | null;
    if (c === last) {
      // The boss's room, beside every room before it
      const before = prev;
      const common = around(before[0]).filter((b) => before.every((p) => near(p, b)));
      chosen = common.length > 0 ? [rng.pick(common)] : null;
    } else if (c === last - 1) {
      chosen = roomsBeforeBoss(rng, prev, around, free);
    } else {
      const want = c === 0 ? opening : rng.int(2, MOST_ROOMS);
      chosen = grow(rng, prev, around, Math.min(want, MOST_WAYS * prev.length));
    }
    if (!chosen || chosen.length > MOST_ROOMS) {
      return null;
    }
    // North first, as the exits are listed
    chosen.sort((a, b) => a.y - b.y || a.x - b.x);
    if (c > 0) {
      const links = linkRooms(rng, prev, chosen);
      if (!links) {
        return null;
      }
      next.push(links);
    }
    for (const cell of chosen) {
      taken.add(keyOf(cell));
    }
    cells.push(chosen);
    prev = chosen;
  }
  return { cells, next };
}

// Rooms for a column: one beside each room before it, then more beside any
// of them, up to `want`. East is favoured.
function grow(
  rng: RNG,
  prev: readonly Cell[],
  around: (c: Cell) => Cell[],
  want: number,
): Cell[] | null {
  const chosen: Cell[] = [];
  const has = (c: Cell): boolean => chosen.some((o) => o.x === c.x && o.y === c.y);
  const eastward = (cs: Cell[]): Cell[] =>
    cs
      .map((cell) => ({ cell, w: cell.x + rng.random() * 1.5 }))
      .sort((a, b) => b.w - a.w)
      .map((o) => o.cell);
  for (const p of rng.shuffle([...prev])) {
    const options = around(p);
    if (options.length === 0) {
      return null;
    }
    if (!options.some(has)) {
      chosen.push(eastward(options)[0]);
    }
  }
  const more = eastward(prev.flatMap(around).filter((c) => !has(c)));
  for (const c of more) {
    if (chosen.length >= want) {
      break;
    }
    if (!has(c)) {
      chosen.push(c);
    }
  }
  return chosen;
}

// The column before the boss: rooms round one free room, the boss's, each
// beside a room before it, and every room before beside one of them.
function roomsBeforeBoss(
  rng: RNG,
  prev: readonly Cell[],
  around: (c: Cell) => Cell[],
  free: (c: Cell) => boolean,
): Cell[] | null {
  const spots = rng.shuffle(
    [...new Set(prev.flatMap(around).flatMap(around).map(keyOf))].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    }),
  );
  for (const boss of spots) {
    if (!free(boss) || prev.some((p) => near(p, boss))) {
      continue;
    }
    const rooms = around(boss).filter((r) => prev.some((p) => near(p, r)));
    if (rooms.length >= 1 && prev.every((p) => rooms.some((r) => near(p, r)))) {
      return rng.shuffle(rooms).slice(0, Math.max(1, Math.min(MOST_ROOMS, rooms.length)));
    }
  }
  return null;
}

// Joins each room before to the rooms beside it, at most two each, so that
// every new room keeps a way in. Null if a room before would have no way out.
function linkRooms(rng: RNG, prev: readonly Cell[], rooms: readonly Cell[]): number[][] | null {
  const links = prev.map((p) => rooms.flatMap((r, j) => (near(p, r) ? [j] : [])));
  if (links.some((l) => l.length === 0)) {
    return null;
  }
  // Too many ways out: drop one whose room has another way in.
  for (const l of links) {
    while (l.length > MOST_WAYS) {
      const spare = rng.shuffle([...l]).find((j) => links.filter((o) => o.includes(j)).length > 1);
      if (spare === undefined) {
        return null;
      }
      l.splice(l.indexOf(spare), 1);
    }
  }
  return rooms.every((_, j) => links.some((l) => l.includes(j))) ? links : null;
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

// Every objective
export const OBJECTIVES: readonly Objective[] = [
  'hunt',
  'horde',
  'maze',
  'escort',
  'vault',
  'ritual',
  'collapse',
  'ambush',
  'silence',
];

// The layers that have Escorts: refugees flee down the Marches and the
// Rift Road, and no one lives below to flee. Rituals come from the
// Undercroft down, where the Church's sigils are. Collapses and Silences
// are the Rift Road's, where the road clings to the chasm's walls and the
// Old King's guard keeps watch.
const ESCORT_LAYERS = 2;
const RITUAL_FROM = 2;
const COLLAPSE_LAYER = 1;

/** The objectives a layer's fights roll from, each as often as the others. */
export const objectivesFor = (depth: number): readonly Objective[] =>
  OBJECTIVES.filter(
    (o) =>
      (o !== 'escort' || depth < ESCORT_LAYERS) &&
      (o !== 'ritual' || depth >= RITUAL_FROM) &&
      (o !== 'collapse' || depth === COLLAPSE_LAYER) &&
      (o !== 'silence' || depth === COLLAPSE_LAYER) &&
      // An Ambush is never rolled as a fight: it is laid as a Camp.
      o !== 'ambush',
  );

// How often a fight that could pass for a Camp is an Ambush
const AMBUSH_CHANCE = 0.12;

/**
 * Makes some fights Ambushes: areas that look like Camps on the map and
 * their signposts. Only where a Camp could stand, and never on a road from
 * or to a Camp, so the map never shows two Camps joined.
 */
function layAmbushes(rng: RNG, columns: MapNode[][]): void {
  columns.forEach((column, c) => {
    if (c < CAMP_FROM || c >= columns.length - 1) {
      return;
    }
    column.forEach((node, j) => {
      const before = columns[c - 1].filter((n) => n.next.includes(j));
      const after = node.next.map((r) => columns[c + 1][r]);
      const nearCamp = [...before, ...after].some((n) => n.kind === 'camp');
      if (node.kind === 'combat' && !nearCamp && rng.chance(AMBUSH_CHANCE)) {
        node.objective = 'ambush';
      }
    });
  });
}

/**
 * How an area shows on the map and on its signpost: as it is, but an
 * Ambush shows as a Camp until the party has been there.
 */
export function seenAs(node: MapNode): MapNode {
  if (node.objective !== 'ambush') {
    return node;
  }
  return {
    ...node,
    kind: 'camp',
    objective: undefined,
    reward: undefined,
    mutators: undefined,
    challenge: undefined,
  };
}

// The columns a layer's Town may stand in.
const TOWN_COLUMNS = [3, 4];

/**
 * Rolls a layer's map from the `map` stream. `opening` is how many areas
 * its first column has: 2 below a Waystation, 1 where the run begins. A
 * layer with a `town` has one Town, in its fourth or fifth column. `depth`
 * is the layer, or the endless phase, counting from 0.
 */
export function generateLayerMap(rng: RNG, opening = 2, town = false, depth = 0): LayerMap {
  const last = AREAS_PER_LAYER - 1;
  const plan = layPlan(rng, opening);
  const columns: MapNode[][] = plan.cells.map((cells, c) =>
    cells.map((cell, row) => ({
      row,
      kind: kindFor(rng, c),
      next: c < last ? plan.next[c][row] : [],
      cell,
    })),
  );
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
        node.objective = c === 0 && opening === 1 ? 'hunt' : rng.pick(objectivesFor(depth));
      }
    }
  });
  layAmbushes(rng, columns);
  rollRewards(rng, columns);
  for (const node of columns.flat()) {
    if (node.objective) {
      node.challenge = rng.pick(CHALLENGES[node.objective]);
    }
  }
  rollMutators(rng, columns, depth);
  return { columns, start: PLAN_START };
}

// An Elite always has a mutator, two from the last layer down. An ordinary
// fight has one by chance, from the second layer down.
function rollMutators(rng: RNG, columns: MapNode[][], depth: number): void {
  for (const node of columns.flat()) {
    // An Ambush has none: it would give it away.
    if (!node.objective || node.objective === 'ambush') {
      continue;
    }
    let count = 0;
    if (node.kind === 'elite') {
      count = depth >= TWO_MUTATORS_FROM ? 2 : 1;
    } else if (depth >= MUTATE_FROM && rng.chance(MUTATE_CHANCE)) {
      count = 1;
    }
    const pool = MUTATORS.filter((m) => m !== 'alarmed' || ALARMABLE.has(node.objective!));
    node.mutators = Array.from(
      { length: count },
      () => pool.splice(rng.int(0, pool.length - 1), 1)[0],
    );
  }
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
