import type { HitOptions } from './unit';
import type Unit from './unit';

/**
 * Something in flight. A homing projectile follows its target and lands on
 * it. A straight one flies along its line and hits each enemy it passes,
 * so it can be walked out of.
 */
export interface Projectile {
  source: Unit;
  x: number;
  z: number;
  // Unit direction of travel
  dx: number;
  dz: number;
  // Tiles per second
  speed: number;
  // Tiles it may still fly
  left: number;
  // Followed until it lands. Null for a straight projectile.
  homing: Unit | null;
  // How close an enemy must pass to be hit
  radius: number;
  // Whether it keeps flying after a hit
  pierce: boolean;
  hits: Set<Unit>;
  options: HitOptions;
  // The skill that fired it, or null for a basic attack
  skill: string | null;
  done: boolean;
}
