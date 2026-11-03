// A Vault's strongroom, its door and its ring of traps.
import type { Spot } from '../../sim/nav';
import type { Keep } from '../fields';
import { type Hazard, type HazardKind, TRAP_PERIOD } from './hazards';
import type { Add } from './props';
import { navFor } from './reach';
import type { Stage } from './types';

/** A Vault's strongroom, from the gauntlets design. */
export interface Vault extends Spot {
  door: Spot;
  key?: boolean;
  open?: boolean;
}

// How far round a Vault's strongroom nothing else stands, and how far its
// door is from its middle
const VAULT_KEEP = 6;

const VAULT_DOOR = 2;
const VAULT_CLEAR = 5.5;

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
 * A Vault's strongroom at `at`, on the site's half, away from the lair whose
 * leader holds its key, ringed by traps.
 */
export function layVault(stage: Stage, add: Add, at: Spot, keep: Keep[]): void {
  const entrance = stage.entrance;
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
