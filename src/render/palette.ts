// The world is grey. Color is information: red for blood and danger, gold for
// light and the bearer, teal for the Hollow's dead and magic. Element colors
// show only briefly, on statuses and their buildup.
export const C = {
  void: '#0a0a0a',
  stoneA: '#3e3e3e',
  stoneB: '#373737',
  stoneLine: '#1a1a1a',
  ink: '#0c0c0c',
  merc: '#e4e4e4',
  bearer: '#7a7a7a',
  monster: '#1c1c1c',
  penitent: '#2a2a2a',
  wood: '#2e2e2e',
  skin: '#b8b8b8',
  bone: '#d6d6d6',
  cloth: '#9a9a9a',
  blood: '#8e1414',
  bloodDark: '#560b0b',
  gold: '#c9973a',
  flame: '#f2c25a',
  teal: '#5fd4c0',
  venom: '#86a83c',
  frost: '#a4c8e4',
  storm: '#ece4a4',
  earth: '#9a7a4a',
} as const;

type RGB = [number, number, number];

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const ramp = (steps: number, r: number, g: number, b: number): RGB[] =>
  Array.from({ length: steps }, (_, i): RGB => {
    const v = 8 + i * (247 / (steps - 1));
    return [
      Math.min(255, Math.round(v * r)),
      Math.min(255, Math.round(v * g)),
      Math.min(255, Math.round(v * b)),
    ];
  });

// A neutral grey ramp, a warm one for lantern light, a cold one for the dark,
// and the information colors with their dark steps.
const PALETTE: RGB[] = [
  ...ramp(16, 1, 1, 1),
  ...ramp(12, 1.08, 0.97, 0.8),
  ...ramp(8, 0.9, 0.94, 1.08),
  ...[
    C.blood,
    C.bloodDark,
    '#3a0808',
    C.gold,
    '#7a5a22',
    C.flame,
    C.teal,
    '#2f6a60',
    C.venom,
    C.frost,
    C.storm,
    C.earth,
  ].map(hex),
];

/**
 * The pixelating filter: averages each `block` by `block` square of a
 * sharp frame into one pixel of a small one, snapped to the palette.
 */
export function pixelate(
  from: CanvasRenderingContext2D,
  to: CanvasRenderingContext2D,
  w: number,
  h: number,
  block: number,
): void {
  const src = from.getImageData(0, 0, w * block, h * block).data;
  const img = to.createImageData(w, h);
  const d = img.data;
  const row = w * block * 4;
  const n = block * block;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < block; dy++) {
        let i = (y * block + dy) * row + x * block * 4;
        for (let dx = 0; dx < block; dx++) {
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          i += 4;
        }
      }
      const c = PALETTE[nearest(r / n, g / n, b / n)];
      const o = (y * w + x) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
  }
  to.putImageData(img, 0, 0);
}

const nearestCache = new Map<number, number>();

function nearest(r: number, g: number, b: number): number {
  const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
  const hit = nearestCache.get(key);
  if (hit !== undefined) {
    return hit;
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PALETTE.length; i++) {
    const c = PALETTE[i];
    const d = (c[0] - r) ** 2 * 0.3 + (c[1] - g) ** 2 * 0.59 + (c[2] - b) ** 2 * 0.11;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  nearestCache.set(key, best);
  return best;
}
