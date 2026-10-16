import type { Hazard, Stage } from '../gen/stage';
import { DamageFlags, DamageKind } from '../sim/types';
import type Sim from '../sim/sim';
import { warn } from '../sim/warning';

// A Labyrinth's traps at work: each warns on its own beat, then strikes
// everyone on it, party and monsters alike, for a share of their health.
// A monster lured onto one is hurt as much as a merc.

const SPIKES = { r: 1.2, windup: 0.8, share: 0.12 };
const VENT = { r: 1.6, windup: 1.4, share: 0.22 };

// A trap warns, and strikes once its windup is over.
function spring(sim: Sim, h: Hazard): void {
  const kind = h.kind === 'vent' ? VENT : SPIKES;
  warn(sim, {
    x: h.x,
    z: h.z,
    shape: h.kind === 'vent' ? { kind: 'circle', r: kind.r } : { kind: 'square', r: kind.r },
    windup: kind.windup,
    spare: null,
    source: null,
    strike: (u) => {
      u.hit(u, {
        kind: DamageKind.True,
        fixed: Math.max(1, Math.round(u.derived.maxHp * kind.share)),
        flags: DamageFlags.Redirected,
      });
    },
  });
}

export default class Hazards {
  private clock = 0;

  constructor(private readonly stage: Stage) {}

  update(sim: Sim, dt: number): void {
    const before = this.clock;
    this.clock += dt;
    for (const h of this.stage.hazards ?? []) {
      if (
        Math.floor((before + h.phase) / h.period) !== Math.floor((this.clock + h.phase) / h.period)
      ) {
        spring(sim, h);
      }
    }
  }
}
