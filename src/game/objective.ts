import { spawnMonster } from '../content/roster';
import type { Objective } from '../gen/graph';
import type { Stage } from '../gen/stage';
import type Sim from '../sim/sim';
import type Unit from '../sim/unit';

// A fight area's objective as it plays out, from the stages design: the
// exits stay shut until it is done.
//
// - A Hunt is done once every marked monster is dead.
// - A Labyrinth is done once the bearer reaches the hall at its far end.
// - A Horde begins once the bearer leaves the entrance. Each wave comes
//   when its time is up, or as soon as the wave before it is beaten. It is
//   done once the last wave is dead.

// How far the bearer walks from the entrance before a Horde begins
const HORDE_START = 6;
// The least time between waves, even when one is beaten at once
const WAVE_MIN_GAP = 2;

export default class ObjectiveRun {
  done = false;
  // A Horde's clock since the last wave, the next wave and who came so far
  private started = false;
  private clock = 0;
  private next = 0;
  private readonly came: Unit[] = [];

  constructor(
    readonly kind: Objective,
    private readonly stage: Stage,
  ) {}

  /**
   * Plays the objective on for a tick: a Horde's waves come. Returns true on
   * the tick it is done.
   */
  update(sim: Sim, dt: number, level: number): boolean {
    if (this.done) {
      return false;
    }
    if (this.kind === 'horde') {
      this.horde(sim, dt, level);
    }
    this.done = this.met(sim);
    return this.done;
  }

  private met(sim: Sim): boolean {
    if (this.kind === 'hunt') {
      return ![...sim.units].some((u) => u.marked && u.alive);
    }
    if (this.kind === 'horde') {
      const waves = this.stage.waves ?? [];
      return this.next >= waves.length && this.came.every((u) => !u.alive);
    }
    // A Labyrinth is done once the bearer reaches the hall at its far end.
    const bearer = sim.bearer;
    return bearer !== null && bearer.alive && bearer.x >= (this.stage.goal ?? Infinity);
  }

  private horde(sim: Sim, dt: number, level: number): void {
    const bearer = sim.bearer;
    const waves = this.stage.waves ?? [];
    if (!this.started) {
      const e = this.stage.entrance;
      if (!bearer || Math.hypot(bearer.x - e.x, bearer.z - e.z) < HORDE_START) {
        return;
      }
      this.started = true;
    }
    this.clock += dt;
    const wave = waves.at(this.next);
    if (!wave) {
      return;
    }
    const beaten = this.next > 0 && this.came.every((u) => !u.alive);
    if (this.clock < wave.delay && !(beaten && this.clock >= WAVE_MIN_GAP)) {
      return;
    }
    wave.kinds.forEach((kind, i) => {
      const a = (i / wave.kinds.length) * Math.PI * 2;
      const u = spawnMonster(
        sim,
        kind,
        level,
        wave.from.x + Math.cos(a) * 1.2,
        wave.from.z + Math.sin(a) * 1.2,
        { elite: i === wave.elite },
      );
      u.aware = true;
      this.came.push(u);
    });
    this.next++;
    this.clock = 0;
  }

  /** How far along it is, in a line. */
  status(sim: Sim): string {
    if (this.done) {
      return 'Done. The way on is open.';
    }
    if (this.kind === 'hunt') {
      const marked = [...sim.units].filter((u) => u.marked);
      return `Slay the marked: ${marked.filter((u) => !u.alive).length} of ${marked.length}`;
    }
    if (this.kind === 'horde') {
      const waves = this.stage.waves ?? [];
      if (!this.started) {
        return `Hold out against ${waves.length} waves. They come once the bearer moves on.`;
      }
      const left = this.came.filter((u) => u.alive).length;
      const wave = waves.at(this.next);
      if (!wave) {
        return `Last wave: ${left} left`;
      }
      const soon = Math.max(0, Math.ceil(wave.delay - this.clock));
      return `Wave ${this.next} of ${waves.length} · next in ${soon}s · ${left} left`;
    }
    return 'Find the way through to the hall at the far end.';
  }
}
