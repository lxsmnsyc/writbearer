import { itemName } from '../../gen/loot';
import type { GroundItem } from '../../game/inventory';
import { ItemType, Quality } from '../../sim/item';
import type { Fogs } from '../fog';
import { C } from '../palette';
import type { Frame } from '../renderer';
import { SCALE, type Scene } from './scene';

// The glint over an item on the floor, by quality. Plain items have none.
const QUALITY_COLOR: Partial<Record<Quality, string>> = {
  [Quality.Superior]: C.bone,
  [Quality.Magic]: C.teal,
  [Quality.Rare]: C.gold,
  [Quality.Unique]: C.gold,
  [Quality.Set]: C.teal,
};

/** Label colors by quality: grey for crude, white for plain, teal for magic, gold for rare. */
export const LABEL_COLOR: Record<Quality, string> = {
  [Quality.Inferior]: '#7a7a7a',
  [Quality.Normal]: '#cfcac0',
  [Quality.Superior]: '#ffffff',
  [Quality.Magic]: '#5fd4c0',
  [Quality.Rare]: '#d9a845',
  // As Diablo 2's uniques: a darker gold
  [Quality.Unique]: '#b08a52',
  // As Diablo 2's sets: green
  [Quality.Set]: '#6fc25a',
};

/** The height of an item's floor label, in screen pixels. */
export const LABEL_HEIGHT = 18;

/** Where an item's floor label was drawn this frame, in screen pixels. */
export interface ItemLabel {
  item: GroundItem;
  x: number;
  y: number;
  w: number;
}

// Items on the floor: a small shape for what it is, and a glint for its quality.
export function drawItems(s: Scene, f: Frame, fog: Fogs): void {
  const { ctx } = s;
  for (const g of f.ground) {
    if (fog.visible(g.x, g.z) < 0.5) {
      continue;
    }
    const b = s.iso(g.x, g.z);
    const { type } = g.item.base;
    if (type === ItemType.Gold) {
      ctx.fillStyle = C.gold;
      ctx.fillRect(b.x - 1, b.y, 2, 1);
      ctx.fillRect(b.x + 1, b.y - 1, 1, 1);
      continue;
    }
    if (type === ItemType.Potion) {
      // A small flask: red for healing, teal for mana.
      ctx.fillStyle = C.ink;
      ctx.fillRect(b.x - 1, b.y - 4, 3, 4);
      ctx.fillStyle = g.item.base.potion?.health ? C.blood : C.teal;
      ctx.fillRect(b.x - 1, b.y - 2, 3, 2);
      ctx.fillStyle = C.bone;
      ctx.fillRect(b.x, b.y - 5, 1, 1);
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(b.x - 3, b.y, 7, 2);
    ctx.fillStyle = type === ItemType.Weapon || type === ItemType.Accessory ? C.bone : C.cloth;
    if (type === ItemType.Weapon) {
      ctx.fillRect(b.x - 3, b.y - 1, 6, 1);
      ctx.fillRect(b.x - 4, b.y - 2, 1, 3);
    } else if (type === ItemType.Accessory) {
      ctx.fillRect(b.x, b.y - 1, 1, 1);
    } else {
      ctx.fillRect(b.x - 2, b.y - 2, 5, 3);
    }
    const glint = QUALITY_COLOR[g.item.quality];
    if (glint && Math.sin(f.time * 4 + g.item.uid) > 0) {
      ctx.fillStyle = glint;
      ctx.fillRect(b.x + 2, b.y - 3, 1, 1);
    }
  }
}

// Item names over the floor, as Diablo 2's labels, in the quality's color.
// Each label drawn is pushed to `labels`, for clicks. Drawn on the screen,
// in the font and alignment the caller set.
export function drawItemLabels(s: Scene, f: Frame, fog: Fogs, labels: ItemLabel[]): void {
  const { out } = s;
  for (const g of f.ground) {
    if (fog.visible(g.x, g.z) < 0.5) {
      continue;
    }
    const b = s.iso(g.x, g.z);
    const x = b.x * SCALE - s.sub.x;
    let y = (b.y - 4) * SCALE - s.sub.y;
    const name = itemName(g.item);
    const w = out.measureText(name).width + 8;
    // Labels that would overlap stack upward, as Diablo 2's do.
    const overlaps = (ty: number): boolean =>
      labels.some((l) => Math.abs(l.x - x) < (l.w + w) / 2 && Math.abs(l.y - ty) < LABEL_HEIGHT);
    while (overlaps(y)) {
      y -= LABEL_HEIGHT;
    }
    labels.push({ item: g, x, y, w });
    out.fillStyle = 'rgba(0,0,0,0.65)';
    out.fillRect(x - w / 2, y - 14, w, LABEL_HEIGHT);
    out.fillStyle = LABEL_COLOR[g.item.quality];
    if (g.item.base.type === ItemType.Gold) {
      out.fillStyle = C.gold;
    }
    out.fillText(name, x, y);
  }
}
