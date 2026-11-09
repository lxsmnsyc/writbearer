// Trap kinds and their beats, for the Labyrinth and the Vault, and the trap
// field of an open fight.
import RNG from '../../core/rng';
import Nav, { type Spot } from '../../sim/nav';
import type { Keep } from '../fields';
import { adder } from './props';
import { holesOf, solidsOf } from './reach';
import type { Stage } from './types';

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
  // A plate that has been stepped on and is dropping its rock
  spent?: boolean;
}

/**
 * A Labyrinth's traps, from the gauntlets design. Each keeps a fixed beat.
 *
 * - Spikes: a square that strikes, quick and small.
 * - Vent: a circle of fire, slow, wide and hard.
 * - Arrows: a bolt along the corridor, shown as a line first.
 * - Blade: sweeps across the corridor, one side of the cell then the other.
 * - Floor: drops away once the party steps on it, and stays a pit.
 * - Plate: a pressure plate in a trap field. Whoever steps on it brings a
 *   rock down on the circle round it, which leaves rubble that blocks.
 */
export type HazardKind = 'spikes' | 'vent' | 'arrows' | 'blade' | 'floor' | 'plate';

// The traps a Labyrinth may hold, by how deep it is: the new kinds come in
// after the first layer.
export const TRAPS_SHALLOW: readonly HazardKind[] = ['spikes', 'spikes', 'vent', 'arrows'];
export const TRAPS_DEEP: readonly HazardKind[] = ['spikes', 'vent', 'arrows', 'blade', 'floor'];
export const TRAP_PERIOD: Record<HazardKind, number> = {
  spikes: 3,
  vent: 5,
  arrows: 4,
  blade: 2,
  floor: 0,
  plate: 0,
};

// A trap field: how far its plates and pits spread from its middle, how many
// of each, and the room each keeps from roads, places and each other
const FIELD_CHANCE = 0.45;
const FIELD_SPREAD = 5.5;
const FIELD_PLATES = [2, 3] as const;
const FIELD_PITS = [3, 5] as const;
const PLATE_CLEAR = 2.2;
const PIT_CLEAR = 1.6;
const ROAD_CLEAR = 3;
const ITEM_GAP = 2.6;

// The fork of the stage's stream the field rolls on, so the stage's own
// draws, and the stages rolled after it, do not move
const FIELD_STREAM = 0x7a9e51;

/** How far the rubble of a fallen rock blocks, in tiles. */
export const RUBBLE_R = 0.9;

function nearRoad(roads: readonly (readonly Spot[])[], p: Spot, clear: number): boolean {
  for (const road of roads) {
    for (let i = 0; i + 1 < road.length; i++) {
      const a = road[i];
      const b = road[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
      if (Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z) < clear) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Sometimes lays a trap field in an open fight: pressure plates that bring a
 * rock down, and open pits no body can enter. It keeps off the entrance, the
 * exits, the roads and every place in `keep`, and is dropped whole if the
 * pits, or the rubble of every plate, would cut a place off. It rolls on its
 * own stream.
 */
export function layTrapField(stage: Stage, rng: RNG, keep: readonly Keep[], places: Spot[]): void {
  const roll = new RNG((rng.state ^ FIELD_STREAM) >>> 0);
  if (!roll.chance(FIELD_CHANCE)) {
    return;
  }
  const nav = new Nav(stage.width, stage.depth, [...solidsOf(stage), ...holesOf(stage)]);
  const clear = (p: Spot, r: number): boolean =>
    nav.roomy(p.x, p.z) &&
    !keep.some((k) => Math.hypot(k.x - p.x, k.z - p.z) < k.r + r) &&
    !nearRoad(stage.roads, p, ROAD_CLEAR);
  // The middle of the field
  let middle: Spot | null = null;
  for (let i = 0; i < 60 && !middle; i++) {
    const p = {
      x: roll.range(10, stage.width - 10),
      z: roll.range(FIELD_SPREAD, stage.depth - FIELD_SPREAD),
    };
    if (clear(p, FIELD_SPREAD * 0.5)) {
      middle = p;
    }
  }
  if (!middle) {
    return;
  }
  const centre = middle;
  const spread = (clearBy: number, n: number, apart: readonly Spot[]): Spot[] => {
    const out: Spot[] = [];
    for (let i = 0; i < n * 12 && out.length < n; i++) {
      const a = roll.range(0, Math.PI * 2);
      const d = roll.range(0, FIELD_SPREAD);
      const p = { x: centre.x + Math.cos(a) * d, z: centre.z + Math.sin(a) * d };
      if (
        clear(p, clearBy) &&
        [...out, ...apart].every((o) => Math.hypot(o.x - p.x, o.z - p.z) >= ITEM_GAP)
      ) {
        out.push(p);
      }
    }
    return out;
  };
  const plates = spread(PLATE_CLEAR, roll.int(FIELD_PLATES[0], FIELD_PLATES[1]), []);
  const pits = spread(PIT_CLEAR, roll.int(FIELD_PITS[0], FIELD_PITS[1]), plates);
  if (plates.length === 0) {
    return;
  }
  // Every place must still be reached with all the pits open and all the
  // rock down.
  const blocked = new Nav(stage.width, stage.depth, [
    ...solidsOf(stage),
    ...holesOf(stage),
    ...pits.map((p) => ({ ...p, r: 1 })),
    ...plates.map((p) => ({ ...p, r: RUBBLE_R })),
  ]);
  for (const p of places) {
    const end = blocked.path(stage.entrance, p).at(-1);
    if (!end || Math.hypot(end.x - p.x, end.z - p.z) >= 2) {
      return;
    }
  }
  const add = adder(stage, roll);
  for (const p of pits) {
    add('pit', p.x, p.z);
  }
  stage.hazards ??= [];
  for (const p of plates) {
    stage.hazards.push({ kind: 'plate', x: p.x, z: p.z, period: 0, phase: 0 });
  }
}
