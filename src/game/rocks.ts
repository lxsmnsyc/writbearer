import type { Hazard } from '../gen/stage';
import { RUBBLE_R } from '../gen/stage/hazards';
import { DamageFlags, DamageKind } from '../sim/types';
import type Unit from '../sim/unit';
import { warn } from '../sim/warning';
import type GameState from './game/state';

// A trap field's pressure plates: whoever steps on one, party or monster,
// brings a rock down on the circle round it. The circle is shown first, the
// rock strikes everyone inside it for a share of their health, and the
// rubble it leaves blocks. A plate drops its rock once.

const PLATE_REACH = 0.8;
const ROCK = { r: 2.2, windup: 1.2, share: 0.3 };

function crush(u: Unit): void {
  u.hit(u, {
    kind: DamageKind.True,
    fixed: Math.max(1, Math.round(u.derived.maxHp * ROCK.share)),
    flags: DamageFlags.Redirected,
  });
}

// The rock lands: its rubble stands where the plate was, and the plate is gone.
function land(g: Pick<GameState, 'stage' | 'sim'>, h: Hazard): void {
  const stage = g.stage;
  stage.hazards = (stage.hazards ?? []).filter((o) => o !== h);
  stage.props.push({ kind: 'rubble', x: h.x, z: h.z, r: RUBBLE_R, seed: 0.4 });
  g.sim.obstacles.push({ x: h.x, z: h.z, r: RUBBLE_R });
  g.sim.setWorld(g.sim.floor);
}

/** Works the area's plates: any living unit on one brings its rock down. */
export default function dropRocks(g: Pick<GameState, 'stage' | 'sim'>): void {
  for (const h of g.stage.hazards ?? []) {
    if (h.kind !== 'plate' || h.spent) {
      continue;
    }
    let stepped = false;
    for (const u of g.sim.units) {
      if (u.alive && Math.hypot(u.x - h.x, u.z - h.z) <= PLATE_REACH) {
        stepped = true;
        break;
      }
    }
    if (!stepped) {
      continue;
    }
    h.spent = true;
    warn(g.sim, {
      x: h.x,
      z: h.z,
      shape: { kind: 'circle', r: ROCK.r },
      windup: ROCK.windup,
      spare: null,
      source: null,
      strike: crush,
      done: () => {
        land(g, h);
      },
    });
  }
}
