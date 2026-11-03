// One frame of the run: the fixed ticks of the simulation since the last
// frame, and everything the run checks after each tick, in order.
import { TICK } from '../../sim/sim';
import { affixesOf } from '../../content/affixes';
import { wakeBoss } from '../stage';
import type GameState from './state';
import { steer } from './input';
import { loot } from './pickups';
import { meet } from './recruits';
import { rest, visitStation, visitTown } from './station';
import { visitEvent } from './encounter';
import { workWalkUps } from './walkups';
import { checkObjective, exitsOpen, noteMonsters, relieve, soundAlarms } from './fight';
import { leave, moveOn, workGround } from './areas';
import { breakSeal, endFinale } from './tomb';

// Never simulate more than this much time in one frame, so a stalled tab
// does not fast-forward the fight.
export const MAX_FRAME = 0.25;
// The bearer leaves by the exit once this close to it.
const EXIT_REACH = 1.2;

/**
 * Moves the run on by `dt` seconds of the frame, and returns how far the
 * frame is between the last tick and the next, to draw it.
 */
export function advance(g: GameState, dt: number): number {
  if (g.paused) {
    // Everything stops, including blood in the air.
    return 0;
  }
  g.time += dt;
  g.shake *= 0.82;
  if (g.hitStop > 0) {
    // Hit-stop: the world holds still for a moment on a heavy blow.
    g.hitStop -= dt;
    return g.acc / TICK;
  }
  if (!g.over) {
    g.acc += dt;
    while (g.acc >= TICK) {
      step(g);
    }
  }
  g.views.frame(g.sim, dt);
  g.effects.update(dt);
  return g.over ? 1 : g.acc / TICK;
}

// One tick of the simulation, and what the run does after it.
function step(g: GameState): void {
  steer(g);
  g.sim.tick(TICK);
  g.views.afterTick(g.sim);
  loot(g);
  meet(g);
  visitStation(g);
  visitTown(g);
  visitEvent(g);
  workWalkUps(g);
  noteMonsters(g);
  g.hazards?.update(g.sim, TICK);
  workGround(g);
  for (const c of g.captains.update(g.sim, TICK)) {
    g.say(`The ${c.name} captain calls more of its pack. Kill it to stop the calls.`);
  }
  g.mutators.update(TICK);
  g.director.update(TICK);
  affixesOf(g.sim).update(TICK);
  g.floods.update(g.sim, TICK, (g.stage.patches ??= []));
  soundAlarms(g);
  relieve(g);
  checkObjective(g);
  g.acc -= TICK;
  if (wakeBoss(g.sim, g.boss)) {
    // The boss rises to meet the party.
    g.shake = Math.max(g.shake, 4);
    g.say(`${g.boss?.name ?? 'Something'} rises. There is no way back.`);
  }
  rest(g);
  breakSeal(g);
  endFinale(g);
  // The way down opens only once the boss is dead.
  // The bearer leaves only by the exit it was sent to.
  const exit = g.stage.exits.findIndex(
    (e, i) =>
      i === g.leaving &&
      exitsOpen(g) &&
      g.bearer.distanceTo(e) <= EXIT_REACH &&
      !(e.ahead === 'down' && g.boss?.alive),
  );
  if (g.bearer.alive && exit >= 0 && g.stage.exits[exit].taken !== true) {
    leave(g, exit);
    g.acc = 0;
  }
  moveOn(g);
}
