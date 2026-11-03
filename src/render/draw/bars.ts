import { Side } from '../../sim/types';
import type Unit from '../../sim/unit';
import type { Fogs } from '../fog';
import { C } from '../palette';
import type { Frame } from '../renderer';
import { look } from '../rig';
import { barHeight, seen } from './figures';
import type { Scene } from './scene';
import { BUILDUP_STATUS, STATUS_COLOR } from './statuses';

// Each side's health bar
const BAR: Record<Side, string> = {
  [Side.Party]: C.gold,
  [Side.Monster]: C.blood,
  [Side.Ward]: C.bone,
};

// Health bars: gold for the party, pale for its wards, red for monsters.
export default function drawHealth(s: Scene, f: Frame, fog: Fogs): void {
  const { ctx } = s;
  for (const u of f.sim.living()) {
    if (u.side !== Side.Monster && u.hp >= u.derived.maxHp && u.buildup.size === 0) {
      continue;
    }
    if (u.side === Side.Monster && !u.aware) {
      continue;
    }
    const r = f.views.rig(u, f.alpha);
    if (seen(fog, u, r.x, r.z) < 0.5) {
      continue;
    }
    const b = s.body(r.x, r.z);
    const y = b.y - Math.round(barHeight(u) * look.zoom);
    ctx.fillStyle = C.ink;
    ctx.fillRect(b.x - 7, y, 14, 2);
    ctx.fillStyle = BAR[u.side];
    ctx.fillRect(b.x - 7, y, Math.max(0, Math.round((14 * u.hp) / u.derived.maxHp)), 2);
    drawBuildup(s, u, b.x, y);
  }
}

// Under a health bar, a thin bar in an element's color fills as a status
// builds up.
function drawBuildup(s: Scene, u: Unit, bx: number, y: number): void {
  let best: { id: string; share: number } | null = null;
  for (const [id, value] of u.buildup) {
    const def = BUILDUP_STATUS.get(id);
    const limit = def?.threshold?.(u) ?? 0;
    if (limit > 0 && (!best || value / limit > best.share)) {
      best = { id, share: value / limit };
    }
  }
  if (!best) {
    return;
  }
  s.ctx.fillStyle = C.ink;
  s.ctx.fillRect(bx - 7, y + 2, 14, 1);
  s.ctx.fillStyle = STATUS_COLOR[best.id] ?? C.bone;
  s.ctx.fillRect(bx - 7, y + 2, Math.max(1, Math.round(14 * best.share)), 1);
}
