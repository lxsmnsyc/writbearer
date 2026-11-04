import type Unit from './unit';

/**
 * A unit leaves the map without dying: removed, not killed, so no death
 * listener runs and it drops nothing. It reads as not alive, so objectives
 * that keep their own lists of units count it as gone.
 */
export default function leaveMap(u: Unit): void {
  if (!u.alive) {
    return;
  }
  u.alive = false;
  u.cast = null;
  u.swing = -1;
  u.target = null;
  u.sim.units.delete(u);
}
