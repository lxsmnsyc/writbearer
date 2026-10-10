import { C } from './palette';

export interface Pt {
  x: number;
  y: number;
}

export const pt = (x: number, y: number): Pt => ({ x, y });

/** Fills a paper shape with an ink edge. Pass null to skip the edge. */
export function fillPoly(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  color: string,
  stroke: string | null = C.ink,
): void {
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i) {
      ctx.lineTo(p.x, p.y);
    } else {
      ctx.moveTo(p.x, p.y);
    }
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** A strip from `a` to `b` that narrows from `wa` to `wb`. */
export function quad(a: Pt, b: Pt, wa: number, wb: number): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  return [
    pt(a.x + nx * wa, a.y + ny * wa),
    pt(b.x + nx * wb, b.y + ny * wb),
    pt(b.x - nx * wb, b.y - ny * wb),
    pt(a.x - nx * wa, a.y - ny * wa),
  ];
}

export function hex(c: Pt, r: number, rot = 0.5): Pt[] {
  return [0, 1, 2, 3, 4, 5].map((i) =>
    pt(c.x + r * Math.cos((i * Math.PI) / 3 + rot), c.y + r * Math.sin((i * Math.PI) / 3 + rot)),
  );
}

/** An uneven round shape, the same for the same `seed`. Used for blood pools. */
export function blob(c: Pt, rx: number, ry: number, n = 9, seed = 1): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const noise = (((Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) % 1) + 1) % 1;
    const k = 0.7 + noise * 0.5;
    return pt(c.x + Math.cos(a) * rx * k, c.y + Math.sin(a) * ry * k);
  });
}
