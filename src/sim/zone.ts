import type Sim from './sim';
import type { Element, Side } from './types';
import type Unit from './unit';

// A zone on the ground that a skill leaves for a while, as rAthena's
// ground skills: Sanctuary, Pneuma, Safety Wall, Volcano. Each does one or
// more of the things below while it lasts.

export interface Zone {
  // The skill that set it, for drawing
  kind: string;
  owner: Unit;
  x: number;
  z: number;
  r: number;
  // Seconds left
  life: number;
  // Its color on the ground
  element: Element;
  // Every second, on each unit inside
  pulse?: (unit: Unit, zone: Zone) => void;
  // Stops hits of this range on the owner's side inside: 'ranged' for a
  // Pneuma, 'melee' for a Safety Wall
  guards?: 'ranged' | 'melee';
  // Hits it can still stop. It breaks at 0. Absent means no limit.
  charges?: number;
  // Enemy projectiles that fly into it are stopped, as by a wall
  blocks?: boolean;
  // Dread builds up in the owner's side inside at this share
  calm?: number;
  // Enemies within this far, and awake, walk to it and stand there
  lure?: number;
  // Seconds since it was set
  t: number;
}

/** Sets a zone on the ground. */
export function setZone(sim: Sim, zone: Omit<Zone, 't'>): Zone {
  const z = { ...zone, t: 0 };
  sim.zones.push(z);
  return z;
}

/** Whether a point is inside a zone. */
export const within = (zone: Zone, at: { x: number; z: number }): boolean =>
  Math.hypot(at.x - zone.x, at.z - zone.z) <= zone.r;

/** The zones of one side's owners that cover a point. */
export function zonesAt(sim: Sim, at: { x: number; z: number }, side?: Side): Zone[] {
  return sim.zones.filter((z) => (side === undefined || z.owner.side === side) && within(z, at));
}

/** Ages each zone, pulses those due, and lifts those spent. */
export function updateZones(sim: Sim, dt: number): void {
  for (const z of sim.zones) {
    const before = Math.floor(z.t);
    z.t += dt;
    z.life -= dt;
    if (z.pulse && Math.floor(z.t) > before) {
      for (const u of sim.living()) {
        if (within(z, u)) {
          z.pulse(u, z);
        }
      }
    }
  }
  for (let i = sim.zones.length - 1; i >= 0; i--) {
    const z = sim.zones[i];
    if (z.life <= 0 || z.charges === 0) {
      sim.zones.splice(i, 1);
    }
  }
}
