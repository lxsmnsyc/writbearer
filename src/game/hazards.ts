import type { Hazard, Stage } from '../gen/stage';
import { DamageFlags, DamageKind, Side } from '../sim/types';
import type Sim from '../sim/sim';
import type Unit from '../sim/unit';
import { type WarningShape, warn } from '../sim/warning';

// A Labyrinth's traps at work: each warns on its own beat, then strikes
// everyone on it, party and monsters alike, for a share of their health.
// A monster lured onto one is hurt as much as a merc. A falling floor has
// no beat: it gives way once the party steps on it, and stays a pit.

const SPIKES = { r: 1.2, windup: 0.8, share: 0.12 };
const VENT = { r: 1.6, windup: 1.4, share: 0.22 };
// A bolt down the corridor, the cell's length and a tile wide
const ARROWS = { length: 4, width: 1, windup: 0.6, share: 0.1 };
// A blade across the corridor, a tile to one side of the middle, then the other
const BLADE = { offset: 1, length: 4, width: 0.9, windup: 0.5, share: 0.14 };
const FLOOR = { r: 1, windup: 0.8, share: 0.1 };

/** Where a floor has fallen in, for the caller to make a pit of. */
export type Fallen = (h: Hazard) => void;

function hurt(share: number): (u: Unit) => void {
  return (u) => {
    u.hit(u, {
      kind: DamageKind.True,
      fixed: Math.max(1, Math.round(u.derived.maxHp * share)),
      flags: DamageFlags.Redirected,
    });
  };
}

// A line through a trap along an axis, `along` from its middle, `length` long
function line(
  h: Hazard,
  axis: 'x' | 'z',
  length: number,
  width: number,
  along = 0,
): { x: number; z: number; shape: WarningShape } {
  const half = length / 2;
  if (axis === 'x') {
    return {
      x: h.x - half,
      z: h.z + along,
      shape: { kind: 'line', x2: h.x + half, z2: h.z + along, width },
    };
  }
  return {
    x: h.x + along,
    z: h.z - half,
    shape: { kind: 'line', x2: h.x + along, z2: h.z + half, width },
  };
}

// A trap warns, and strikes once its windup is over.
function spring(sim: Sim, h: Hazard, beat: number): void {
  const axis = h.axis ?? 'x';
  const across = axis === 'x' ? 'z' : 'x';
  let place: { x: number; z: number; shape: WarningShape };
  let kind = SPIKES;
  if (h.kind === 'vent') {
    kind = VENT;
    place = { x: h.x, z: h.z, shape: { kind: 'circle', r: VENT.r } };
  } else if (h.kind === 'arrows') {
    place = line(h, axis, ARROWS.length, ARROWS.width);
    kind = { r: 0, windup: ARROWS.windup, share: ARROWS.share };
  } else if (h.kind === 'blade') {
    // Across the corridor, to one side of the middle, then the other
    const side = beat % 2 === 0 ? -BLADE.offset : BLADE.offset;
    place = line(h, across, BLADE.length, BLADE.width, side);
    kind = { r: 0, windup: BLADE.windup, share: BLADE.share };
  } else {
    place = { x: h.x, z: h.z, shape: { kind: 'square', r: SPIKES.r } };
  }
  warn(sim, {
    ...place,
    windup: kind.windup,
    spare: null,
    source: null,
    strike: hurt(kind.share),
  });
}

export default class Hazards {
  private clock = 0;
  // Floors that have given way
  private readonly gone = new Set<Hazard>();

  constructor(
    private readonly stage: Stage,
    private readonly fallen: Fallen = () => undefined,
  ) {}

  update(sim: Sim, dt: number): void {
    const before = this.clock;
    this.clock += dt;
    for (const h of this.stage.hazards ?? []) {
      if (h.kind === 'floor') {
        this.floor(sim, h);
        continue;
      }
      const was = Math.floor((before + h.phase) / h.period);
      const now = Math.floor((this.clock + h.phase) / h.period);
      if (was !== now) {
        spring(sim, h, now);
      }
    }
  }

  // A floor gives way under the first of the party to step on it.
  private floor(sim: Sim, h: Hazard): void {
    if (this.gone.has(h)) {
      return;
    }
    const square = { x: h.x, z: h.z, shape: { kind: 'square', r: FLOOR.r } as const };
    const stepped = sim
      .living(Side.Party)
      .some((u) => Math.abs(u.x - h.x) <= FLOOR.r && Math.abs(u.z - h.z) <= FLOOR.r);
    if (!stepped) {
      return;
    }
    this.gone.add(h);
    warn(sim, {
      ...square,
      windup: FLOOR.windup,
      spare: null,
      source: null,
      strike: hurt(FLOOR.share),
      done: () => {
        this.fallen(h);
      },
    });
  }
}
