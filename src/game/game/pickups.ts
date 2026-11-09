// Items on the floor and chests: dropping, picking up and
// opening them.
import { Stream } from '../../core/seed';
import { Rank } from '../../sim/types';
import type { Prop } from '../../gen/stage';
import { rollGold, rollItem, rollPotion } from '../../gen/loot';
import type { GroundItem } from '../inventory';
import type GameState from './state';
import { spoilsOf } from './rewards';

// The bearer picks up an item, or opens a chest, from this close.
export const PICK_REACH = 0.8;
const CHEST_REACH = 1.3;
// How near a click must land to a chest, in tiles, to open it
const CHEST_PICK = 1.1;
// A chest holds this many pieces of equipment, rolled as an elite's drop.
const CHEST_ITEMS = 3;
// How near a click must land to an item, in frame pixels, to pick it up.
const PICK_PIXELS = 8;

/** Drops an item from the pack at the bearer's feet. */
export function drop(g: GameState, uid: number): void {
  const item = g.pack.take(uid);
  if (item) {
    g.ground.push({ item, x: g.bearer.x + 0.3, z: g.bearer.z + 0.3 });
    g.itemsChanged();
  }
}

// Picks up what the bearer reached, and opens chests it stands at.
export function loot(g: GameState): void {
  const b = g.bearer;
  if (!b.alive) {
    return;
  }
  // Gold is picked up by walking over it. Equipment needs a click.
  // A copy, since picking up removes from the list.
  for (const item of g.ground.slice()) {
    const near = Math.hypot(item.x - b.x, item.z - b.z) <= PICK_REACH;
    if (near && (item === g.fetching || item.item.base.id === 'gold')) {
      pickUp(g, item);
    }
  }
  for (const p of g.stage.props) {
    if (p === g.opening && !p.open && b.distanceTo(p) <= CHEST_REACH) {
      p.open = true;
      g.opening = null;
      const rng = g.streams.get(1, Stream.Loot);
      const level = 4 + g.stageIndex;
      if (p.holds) {
        const extra = Array.from({ length: p.extra ?? 0 }, () =>
          rollItem(rng, level, Rank.Elite, {}, g.sim),
        );
        g.scatter([...spoilsOf(g, p.holds, rng, level, p.better === true), ...extra], p);
        continue;
      }
      const items = Array.from({ length: CHEST_ITEMS }, () =>
        rollItem(rng, level, Rank.Elite, {}, g.sim),
      );
      g.scatter([...items, rollGold(rng, level), rollPotion(rng, level, 2)], p);
    }
  }
}

function pickUp(g: GameState, item: GroundItem): void {
  if (g.fetching === item) {
    g.fetching = null;
  }
  if (g.pack.add(item.item)) {
    g.ground.splice(g.ground.indexOf(item), 1);
    g.itemsChanged();
  }
}

// The item drawn under a point on the screen, if any.
export function pickItem(g: GameState, clientX: number, clientY: number): GroundItem | null {
  const s = g.renderer.toSmall(clientX, clientY);
  let best: GroundItem | null = null;
  let bestD = PICK_PIXELS;
  for (const item of g.ground) {
    const p = g.renderer.iso(item.x, item.z);
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < bestD) {
      best = item;
      bestD = d;
    }
  }
  return best;
}

// The closed chest under a point on the screen, if any.
export function chestAt(g: GameState, clientX: number, clientY: number): Prop | null {
  const p = g.renderer.unproject(clientX, clientY);
  return (
    g.stage.props.find(
      (c) => c.kind === 'chest' && !c.open && Math.hypot(c.x - p.x, c.z - p.z) <= CHEST_PICK,
    ) ?? null
  );
}
