import { Rank, Side } from '../../sim/types';
import type Unit from '../../sim/unit';
import { type Pt, pt } from '../draw';
import type { Fogs } from '../fog';
import { C } from '../palette';
import { type Iso, type RigUnit, drawShadow, drawUnit, emissives, look } from '../rig';
import { drawSprite, isSprited, spriteLantern } from '../sprites';

// A figure: the party from its sprite sheet, the rest cut from paper.
export function drawFigure(
  ctx: CanvasRenderingContext2D,
  r: RigUnit,
  iso: Iso,
  time: number,
  flash: boolean,
): void {
  if (r.kind === 'hornPost') {
    drawHornPost(ctx, iso(r.x, r.z), r.fall, flash);
    return;
  }
  if (r.kind === 'drownedBell') {
    drawBell(ctx, iso(r.x, r.z), r.fall, flash);
    return;
  }
  if (isSprited(r.kind)) {
    drawShadow(ctx, r, iso);
    drawSprite(ctx, r, iso(r.x, r.z), C, time, flash);
  } else {
    drawUnit(ctx, r, iso, C, time, flash);
  }
}

// What glows on a figure: the bearer's lantern from its sprite, eyes and
// growths from the paper figures.
export function glowsOf(r: RigUnit, body: Iso, time: number): ReturnType<typeof emissives> {
  if (!isSprited(r.kind)) {
    return emissives(r, body, time);
  }
  const lamp = spriteLantern(r, C, time);
  if (!lamp) {
    return [];
  }
  const b = body(r.x, r.z);
  return [{ p: pt(Math.round(b.x) + lamp.x, Math.round(b.y) + lamp.y), color: 'flame' }];
}

// How much higher a boss's health bar floats than its kind's.
const BOSS_BAR = 1.7;

/** How high over a unit's feet its health bar floats, in design pixels. */
export function barHeight(u: Unit): number {
  const elite = u.rank === Rank.Normal ? 1 : 1.25;
  // A disguised unit has the bar of the kind it passes for.
  const kind = u.disguise ?? u.kind;
  if (kind === 'bearer') {
    return 36;
  }
  if (kind === 'crawler') {
    return 16 * elite;
  }
  if (kind === 'broodMother') {
    return 34;
  }
  // The other bosses are drawn as their kind, larger.
  if (u.rank === Rank.Boss) {
    return 44 * BOSS_BAR;
  }
  if (kind === 'mite') {
    return 10 * elite;
  }
  if (kind === 'hollowed') {
    return 38 * elite;
  }
  return 44 * elite;
}

// How visible a unit is, 0 to 1. The party and its wards are always seen.
export function seen(fog: Fogs, u: Unit, x: number, z: number): number {
  // A hidden enemy is not drawn at all.
  if (u.hidden && u.side === Side.Monster) {
    return 0;
  }
  if (u.side !== Side.Monster) {
    return 1;
  }
  return fog.visible(x, z);
}

// A horn post: a pole with the guard's great horn hung at its top, in gold.
// Broken, a stump with the horn on the ground.
function drawHornPost(ctx: CanvasRenderingContext2D, base: Pt, fall: number, flash: boolean): void {
  const z = look.zoom;
  const x = Math.round(base.x);
  const y = Math.round(base.y);
  const wood = flash ? C.bone : C.wood;
  if (fall >= 0) {
    ctx.fillStyle = wood;
    ctx.fillRect(x - 2 * z, y - 6 * z, 4 * z, 6 * z);
    ctx.fillStyle = C.gold;
    ctx.fillRect(x + 4 * z, y - 2 * z, 8 * z, 2 * z);
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 5 * z, y - z, 10 * z, 2 * z);
  ctx.fillStyle = wood;
  ctx.fillRect(x - 2 * z, y - 34 * z, 4 * z, 34 * z);
  ctx.fillRect(x - 6 * z, y - 30 * z, 12 * z, 2 * z);
  ctx.fillStyle = flash ? C.bone : C.gold;
  ctx.fillRect(x + 3 * z, y - 30 * z, 2 * z, 8 * z);
  ctx.fillRect(x + 5 * z, y - 24 * z, 6 * z, 2 * z);
  ctx.fillRect(x + 9 * z, y - 28 * z, 4 * z, 6 * z);
}

// A drowned bell: a cracked bronze bell hung from a low beam, far larger than
// a man. Broken, it lies on its side.
function drawBell(ctx: CanvasRenderingContext2D, base: Pt, fall: number, flash: boolean): void {
  const z = look.zoom;
  const x = Math.round(base.x);
  const y = Math.round(base.y);
  const bronze = flash ? C.bone : C.gold;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 10 * z, y - z, 20 * z, 2 * z);
  if (fall >= 0) {
    ctx.fillStyle = bronze;
    ctx.fillRect(x - 8 * z, y - 8 * z, 16 * z, 8 * z);
    ctx.fillRect(x - 5 * z, y - 11 * z, 10 * z, 3 * z);
    return;
  }
  // The frame
  ctx.fillStyle = flash ? C.bone : C.wood;
  ctx.fillRect(x - 9 * z, y - 46 * z, 3 * z, 46 * z);
  ctx.fillRect(x + 6 * z, y - 46 * z, 3 * z, 46 * z);
  ctx.fillRect(x - 9 * z, y - 48 * z, 18 * z, 3 * z);
  // The bell, widening to the lip
  ctx.fillStyle = bronze;
  ctx.fillRect(x - 3 * z, y - 44 * z, 6 * z, 6 * z);
  ctx.fillRect(x - 5 * z, y - 38 * z, 10 * z, 8 * z);
  ctx.fillRect(x - 7 * z, y - 30 * z, 14 * z, 8 * z);
  ctx.fillRect(x - 9 * z, y - 22 * z, 18 * z, 7 * z);
  // The crack
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + z, y - 36 * z, z, 8 * z);
  ctx.fillRect(x - z, y - 28 * z, z, 7 * z);
  ctx.fillRect(x + z, y - 22 * z, z, 7 * z);
}
