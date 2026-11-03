// The layer's map and the party's way through it: which area it is in, what
// lies beyond each exit, and how the next area is planned and built.
import { Stream } from '../../core/seed';
import {
  type Ahead,
  type AreaPlan,
  type ExitSide,
  type Fight,
  type Stage,
  generateStage,
} from '../../gen/stage';
import { type Cell, type LayerMap, type MapNode, generateLayerMap, seenAs } from '../../gen/graph';
import { AREAS_PER_LAYER, LAYERS } from '../../gen/layers';
import { type MiniBossId, miniBossesOf } from '../../content/minibosses';
import { EVENT_BY_ID, pickEvent } from '../../content/events';
import type GameState from './state';

const AREA_ROW_STREAM = 100;
// Towns stand in the first two layers only.
const TOWN_LAYERS = 2;
// Each endless phase rolls its biome from its own stream.
const ENDLESS_BIOME = 10000;
// How often an ordinary fight from the Rift Road down holds a mini-boss
const MINI_BOSS_CHANCE = 0.25;

// The area the party is in on the layer's map.
export function here(g: GameState): MapNode | null {
  return g.node ? (g.map.columns[g.node.column]?.[g.node.row] ?? null) : null;
}

// What lies beyond each of this area's exits.
export function aheadOf(g: GameState, node: MapNode | null): Ahead[] {
  if (!node) {
    return g.map.columns[0].map((n) => seenAs(n).kind);
  }
  if (node.kind === 'boss') {
    return ['down'];
  }
  const next = g.map.columns[(g.node?.column ?? 0) + 1];
  return node.next.map((row) => seenAs(next[row]).kind);
}

// The areas beyond each of this area's exits, for their signposts.
export function fightsAhead(g: GameState, node: MapNode | null): (Fight | undefined)[] {
  if (!node) {
    return g.map.columns[0].map(seenAs);
  }
  const next = g.map.columns[(g.node?.column ?? 0) + 1] ?? [];
  return node.kind === 'boss' ? [] : node.next.map((row) => seenAs(next[row]));
}

// Rolls the map of the layer the current area is in.
export function rollMap(g: GameState): void {
  const layer = Math.floor(g.stageIndex / AREAS_PER_LAYER);
  // Towns stand only in the layers where people still live, and in every
  // endless phase.
  g.map = generateLayerMap(
    g.streams.area(1, Stream.Map, layer),
    layer === 0 ? 1 : 2,
    g.endless || layer < TOWN_LAYERS,
    layer,
  );
  g.path = [];
}

// Which layer's ground and monsters the current area has: its own in the
// story, one rolled for each phase in endless mode.
export function biome(g: GameState): number {
  const phase = Math.floor(g.stageIndex / AREAS_PER_LAYER);
  if (!g.endless) {
    return Math.min(phase, LAYERS.length - 1);
  }
  return g.streams.area(1, Stream.Map, ENDLESS_BIOME + phase).int(0, LAYERS.length - 1);
}

// Where the party is, for the HUD and the map: the layer, or the phase.
export function region(g: GameState): string {
  const phase = Math.floor(g.stageIndex / AREAS_PER_LAYER);
  return g.endless ? `Phase ${phase + 1}` : LAYERS[Math.min(phase, LAYERS.length - 1)].name;
}

// Enters an area of the layer's map, by its column and row.
export function goTo(g: GameState, column: number, row: number): void {
  g.node = { column, row };
  g.path.push({ column, row });
  g.stageIndex = Math.floor(g.stageIndex / AREAS_PER_LAYER) * AREAS_PER_LAYER + column;
}

// Builds the area the party is in, as the map has it, or as `kind`.
export function buildStage(g: GameState, kind?: MapNode['kind']): Stage {
  const node = here(g);
  const row = g.node?.row ?? 0;
  const area = g.stageIndex + AREA_ROW_STREAM * row;
  g.pendingEvent = null;
  const plan: AreaPlan = {
    kind: kind ?? node?.kind ?? 'combat',
    ahead: aheadOf(g, node),
    aheadFights: fightsAhead(g, node),
    objective: node?.objective && (g.options.objective ?? node.objective),
    biome: biome(g),
    endless: g.endless,
  };
  plan.sides = sidesAhead(g);
  // The director sets how much threat a fight holds, by the party's standing.
  if (plan.objective) {
    plan.scale = g.director.scale(plan.kind === 'elite');
    plan.mutators = node?.mutators;
    plan.miniBoss = pickMiniBoss(g, plan, area);
  }
  if (plan.kind === 'event') {
    const rng = g.streams.area(1, Stream.Events, area);
    const forced = g.options.event ? EVENT_BY_ID.get(g.options.event) : undefined;
    const def = forced ?? pickEvent(rng, biome(g), g.eventsSeen);
    g.eventsSeen.add(def.id);
    g.pendingEvent = { def, rng, state: rng.state };
    plan.scene = def.props;
  }
  // Each area of a column lays out from its own stream; the first keeps
  // the stream areas had before the map.
  return generateStage(g.streams.area(1, Stream.Layout, area), g.stageIndex, plan);
}

/**
 * Which edge each of the current area's exits leaves by, from the layer's
 * plan: toward the room each road leads to, ahead, left or right of the
 * way the party came in. So the world turns as the map shows it.
 */
export function sidesAhead(g: GameState): ExitSide[] {
  const node = here(g);
  const { columns, start } = g.map;
  if (!node) {
    return sidesToward(
      start,
      { x: 1, y: 0 },
      columns[0].map((n) => n.cell),
    );
  }
  if (node.kind === 'boss') {
    return [];
  }
  const before = g.path.at(-2);
  const from = before ? (columns[before.column]?.[before.row]?.cell ?? start) : start;
  const facing = { x: node.cell.x - from.x, y: node.cell.y - from.y };
  const next = columns[(g.node?.column ?? 0) + 1] ?? [];
  return sidesToward(
    node.cell,
    facing,
    node.next.map((row) => next[row].cell),
  );
}

// Whether a fight holds a mini-boss, and which: always in an Elite fight,
// a quarter of the time from the Rift Road down, never one met before in
// the run, and none in a Labyrinth, an Ambush or a Ritual.
function pickMiniBoss(g: GameState, plan: AreaPlan, area: number): MiniBossId | undefined {
  const o = plan.objective;
  if (!o || o === 'maze' || o === 'ambush' || o === 'ritual') {
    return undefined;
  }
  const elite = plan.kind === 'elite';
  if (!elite && o === 'horde') {
    return undefined;
  }
  const rng = g.streams.area(1, Stream.Director, area);
  const layer = biome(g);
  if (!elite && (layer < 1 || !rng.chance(MINI_BOSS_CHANCE))) {
    return undefined;
  }
  const left = miniBossesOf(layer).filter((m) => !g.metMiniBosses.has(m.id));
  if (left.length === 0) {
    return undefined;
  }
  const pick = rng.pick(left);
  g.metMiniBosses.add(pick.id);
  return pick.id;
}

/** This layer's map, the areas crossed, and where the party is now. */
export function layerMap(g: GameState): {
  map: LayerMap;
  path: { column: number; row: number }[];
  at: { column: number; row: number } | null;
  layer: number;
  title: string;
} {
  return {
    // An Ambush shows as a Camp until the party has been there.
    map: {
      ...g.map,
      columns: g.map.columns.map((column, c) =>
        column.map((n, row) =>
          g.path.some((p) => p.column === c && p.row === row) ? n : seenAs(n),
        ),
      ),
    },
    path: [...g.path],
    at: g.node,
    layer: Math.floor(g.stageIndex / AREAS_PER_LAYER),
    title: region(g),
  };
}

/**
 * The edge of an area each road leaves by, for rooms on the layer's plan:
 * the one straight on from the way in is ahead, east as the area is built;
 * the one to its left north, and to its right south.
 */
export function sidesToward(from: Cell, facing: Cell, rooms: readonly Cell[]): ExitSide[] {
  return rooms.map((r) => {
    const d = { x: r.x - from.x, y: r.y - from.y };
    if (d.x === facing.x && d.y === facing.y) {
      return 'east';
    }
    // Left of the way in, as an area turned to face it has its north
    return d.x === facing.y && d.y === -facing.x ? 'north' : 'south';
  });
}
