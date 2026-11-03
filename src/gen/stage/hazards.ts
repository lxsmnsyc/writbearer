// Trap kinds and their beats, for the Labyrinth and the Vault.
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
export const TRAPS_SHALLOW: readonly HazardKind[] = ['spikes', 'spikes', 'vent', 'arrows'];
export const TRAPS_DEEP: readonly HazardKind[] = ['spikes', 'vent', 'arrows', 'blade', 'floor'];
export const TRAP_PERIOD: Record<HazardKind, number> = {
  spikes: 3,
  vent: 5,
  arrows: 4,
  blade: 2,
  floor: 0,
};
