import type { StatusDef } from './status';
import type Unit from './unit';

/** A trap on the floor. The first enemy to step in springs it. */
export interface Trap {
  owner: Unit;
  x: number;
  z: number;
  // How close an enemy must step, in tiles
  radius: number;
  // Seconds left before it rusts away
  life: number;
  status: StatusDef;
  duration: number;
  sprung: boolean;
  // The skill that set it, so each counts only its own
  skill?: string;
}
