import {
  HIT_FRACTION,
  type Kind,
  type Palette,
  type Part,
  type Projected,
  type Pt,
  type RigUnit,
  type Skeleton,
  type V3,
  add,
  avg,
  clamp01,
  fill,
  handPath,
  hexAt,
  hull,
  look,
  norm,
  phases,
  projector,
  reach,
  scale,
  skeleton,
  sub,
  taper,
  v,
} from './rig';

// Sprites for the party, after Ragnarok Online's: one shared body with its
// actions in eight facings, and attachments for what it carries and wears.
//
// - The body is only the skeleton and its animations: limbs, torso, head.
// - An attachment is a piece of gear placed on the posed skeleton: a weapon
//   in the right hand, a shield on the left forearm, a hood on the head, a
//   robe over the legs.
// - A look is a body with its attachments. Each look is baked once into a
//   sheet of frames, every action in every facing, the first time it is
//   drawn. Ragnarok stacks its parts at draw time in a fixed order per
//   facing. Here the parts are sorted by depth when the look is baked, so a
//   sword arm can pass behind the torso while the other arm stays in front.
// - In play, a frame is copied whole at a whole pixel. The same frame always
//   has the same pixels, so a figure changes shape only between frames.

/** What the body is doing. Each has its own frames, in every facing. */
export type Action =
  | 'idle'
  | 'walk'
  | 'slash'
  | 'shoot'
  | 'aim'
  | 'cast'
  | 'shout'
  | 'hurt'
  | 'dead';

const FRAMES: Record<Action, number> = {
  idle: 4,
  walk: 8,
  slash: 10,
  shoot: 10,
  aim: 1,
  cast: 10,
  shout: 8,
  hurt: 1,
  dead: 6,
};

const ACTIONS: readonly Action[] = [
  'idle',
  'walk',
  'slash',
  'shoot',
  'aim',
  'cast',
  'shout',
  'hurt',
  'dead',
];

/** Facings: 0 along +x, each a quarter of a right angle further round. */
export const FACINGS = 8;

/** The facing nearest to an angle on the floor. */
export const facingOf = (angle: number): number =>
  ((Math.round(angle / (Math.PI / 4)) % FACINGS) + FACINGS) % FACINGS;

// A frame's size on its sheet, and where the feet stand in it
const CELL_W = 72;
const CELL_H = 80;
const ORIGIN_X = 36;
const ORIGIN_Y = 64;

// How long the idle breath takes, in seconds, as the skeleton breathes
const BREATH = (Math.PI * 2) / 2.2;

/** Gear that can be attached to the body. */
export type Attachment =
  | 'sword'
  | 'mace'
  | 'dagger'
  | 'bow'
  | 'staff'
  | 'sunStaff'
  | 'towerShield'
  | 'hood'
  | 'writ'
  | 'lantern'
  | 'robe';

/** A body and what is attached to it. */
export interface Look {
  // The paper the body is cut from, and how big it is drawn
  paper: keyof Palette;
  size: number;
  attachments: readonly Attachment[];
  // The attack it plays: a swing, a bowshot or a prayer
  attack: 'slash' | 'shoot' | 'cast';
}

// The pose of one frame: the skeleton, and the attack's state for the gear
interface Pose {
  action: Action;
  sk: Skeleton;
  // How far the bowstring is pulled, 0 to 1, and whether an arrow is nocked
  pull: number;
  nocked: boolean;
  // Lantern sway, in figure units
  sway: number;
}

// The unit the skeleton is posed from, for a frame of an action.
function poseUnit(action: Action, t: number, angle: number, size: number): RigUnit {
  const u: RigUnit = {
    kind: action === 'shoot' || action === 'aim' ? 'ranger' : 'vanguard',
    x: 0,
    z: 0,
    angle,
    walk: 0,
    stride: 0,
    atk: -1,
    shout: -1,
    fall: -1,
    hurt: 9,
    alert: action === 'aim',
    size,
  };
  if (action === 'walk') {
    u.walk = t * Math.PI * 2;
    u.stride = 1;
  } else if (action === 'slash' || action === 'shoot' || action === 'cast') {
    u.atk = t;
  } else if (action === 'shout') {
    u.shout = t;
  } else if (action === 'hurt') {
    u.hurt = 0;
  } else if (action === 'dead') {
    u.fall = t;
  }
  return u;
}

// Poses the skeleton for a frame: the walk and breath from the skeleton,
// and the arms for the attack, the shout or the bow.
function pose(u: RigUnit, action: Action, time: number): Pose {
  const sk = skeleton(u, time);
  const p: Pose = { action, sk, pull: 0, nocked: false, sway: 0 };
  const a = u.atk;
  if (action === 'slash') {
    const ph = phases(a, 0.5, HIT_FRACTION.vanguard + 0.05);
    reach(sk, 'R', handPath(ph, v(10, 14, 56), v(-8, 12, 108), v(30, 6, 52)), v(-1, 1, 0));
  } else if (action === 'shout') {
    // The weapon raised high, then brought down before the chest.
    const ph = phases(u.shout, 0.45, 0.5);
    const up = add(sk.head, v(-6, 10, 20));
    const down = add(sk.chest, v(20, 2, -10));
    reach(sk, 'R', handPath(ph, v(10, 14, 56), up, down), v(-1, 1, 0));
  } else if (action === 'shoot' || action === 'aim') {
    // Bow arm out ahead; the string hand pulls back to the cheek.
    const grip = add(sk.shoulderL, v(30, 6, 0));
    reach(sk, 'L', grip, v(0, -1, -0.3));
    if (a >= 0) {
      const ph = phases(a, HIT_FRACTION.ranger, HIT_FRACTION.ranger + 0.08);
      p.pull = ph.strike > 0 ? 1 - ph.strike : ph.windup;
      if (ph.recover > 0) {
        p.pull = 0;
      }
    }
    const nock = add(grip, v(-4, 0, 0));
    const cheek = add(sk.neck, v(2, 6, 2));
    const released = a >= HIT_FRACTION.ranger && a < 0.9 ? add(cheek, v(-8, 8, 4)) : null;
    reach(sk, 'R', released ?? add(nock, scale(sub(cheek, nock), p.pull)), v(-1, 1, 0));
    p.nocked = a >= 0 && a < HIT_FRACTION.ranger && p.pull > 0;
  } else if (action === 'cast') {
    // The weapon lifted high, then planted. The free hand is raised.
    const rest = add(sk.chest, v(10, 10, -4));
    const ph = phases(a, HIT_FRACTION.cleric, HIT_FRACTION.cleric + 0.08);
    reach(sk, 'R', handPath(ph, rest, add(sk.head, v(6, 8, 18)), rest), v(-1, 1, 0));
    reach(sk, 'L', add(sk.head, v(10, -4, 4)), v(-1, -1, 0));
  }
  p.sway = Math.sin(u.walk) * 3 * u.stride;
  return p;
}

// Where the lantern hangs below the right hand.
const lanternOf = (p: Pose): V3 => add(p.sk.handR, v(p.sway, 0, -12));

// What each attachment adds to the parts of a frame.
interface Gear {
  pose: Pose;
  proj: (p: V3) => Projected;
  C: Palette;
  ink: string;
  paper: string;
  // Whether the front of the body faces the camera
  facing: boolean;
}

// The direction the right forearm points, for a blade or a haft
const forearm = (sk: Skeleton): V3 => norm(sub(sk.handR, sk.elbowR));

const ATTACH: Record<Attachment, (g: Gear, parts: Part[]) => void> = {
  sword(g, parts) {
    const { sk } = g.pose;
    const a = g.proj(sk.handR);
    const b = g.proj(add(sk.handR, scale(forearm(sk), 30)));
    parts.push({
      depth: avg(a, b) + 0.0003,
      draw: (c) => {
        fill(c, taper(a, b, 0.9, 0.4), g.C.bone, g.ink);
      },
    });
  },
  mace(g, parts) {
    const { sk } = g.pose;
    const a = g.proj(sk.handR);
    const b = g.proj(add(sk.handR, scale(forearm(sk), 24)));
    parts.push({
      depth: avg(a, b) + 0.0003,
      draw: (c) => {
        // A wooden haft and a flanged iron head.
        fill(c, taper(a, b, 0.6, 0.6), g.C.wood, g.ink);
        fill(c, hexAt(b, 3), g.C.bone, g.ink);
      },
    });
  },
  dagger(g, parts) {
    const { sk } = g.pose;
    const a = g.proj(sk.handR);
    const b = g.proj(add(sk.handR, scale(forearm(sk), 14)));
    parts.push({
      depth: avg(a, b) + 0.0006,
      draw: (c) => {
        fill(c, taper(a, b, 1, 0.2), g.C.bone, g.ink);
      },
    });
  },
  bow(g, parts) {
    const { sk, pull, nocked } = g.pose;
    const grip = sk.handL;
    const top = g.proj(add(grip, v(-3 - pull * 4, 0, 38)));
    const bottom = g.proj(add(grip, v(-3 - pull * 4, 0, -38)));
    const mid = g.proj(add(grip, v(14 + pull * 2, 0, 0)));
    const hand = nocked ? g.proj(sk.handR) : null;
    const tip = g.proj(add(grip, v(14, 0, 0)));
    parts.push({
      depth: avg(top, bottom, mid) + 0.0007,
      draw: (c) => {
        c.strokeStyle = g.C.gold;
        c.lineWidth = 1.5 * look.zoom;
        c.beginPath();
        c.moveTo(top.x, top.y);
        c.quadraticCurveTo(
          2 * mid.x - (top.x + bottom.x) / 2,
          2 * mid.y - (top.y + bottom.y) / 2,
          bottom.x,
          bottom.y,
        );
        c.stroke();
        c.strokeStyle = g.C.bone;
        c.lineWidth = 0.6 * look.zoom;
        c.beginPath();
        c.moveTo(top.x, top.y);
        if (hand) {
          c.lineTo(hand.x, hand.y);
        }
        c.lineTo(bottom.x, bottom.y);
        c.stroke();
        if (hand) {
          // The nocked arrow, from the string to past the bow.
          c.lineWidth = 0.8 * look.zoom;
          c.beginPath();
          c.moveTo(hand.x, hand.y);
          c.lineTo(tip.x, tip.y);
          c.stroke();
        }
      },
    });
  },
  staff(g, parts) {
    staff(g, parts, false);
  },
  sunStaff(g, parts) {
    staff(g, parts, true);
  },
  towerShield(g, parts) {
    // Strapped to the left forearm. It has thickness, so it still reads as a
    // slab when seen edge-on.
    const center = add(g.pose.sk.handL, v(5, 2, 0));
    const face = [v(3, -10, 26), v(3, 10, 26), v(3, 10, -38), v(3, -10, -38)];
    const slab = [...face, ...face.map((o) => add(o, v(-6, 0, 0)))].map((o) =>
      g.proj(add(center, o)),
    );
    const front = face.map((o) => g.proj(add(center, o)));
    const boss = g.proj(add(center, v(4, 0, -4)));
    parts.push({
      depth: avg(...front) + 0.0008,
      draw: (c) => {
        fill(c, hull(slab), g.paper, g.ink);
        if (g.facing) {
          fill(c, hexAt(boss, 1.6), g.C.gold, null);
        }
      },
    });
  },
  hood(g, parts) {
    const { sk } = g.pose;
    const hood = [
      add(sk.head, v(-6, -5, -2)),
      add(sk.head, v(-6, 5, -2)),
      add(sk.head, v(-9, 0, 14)),
      add(sk.head, v(2, 0, 11)),
    ].map(g.proj);
    parts.push({
      depth: g.proj(sk.head).depth + 0.0005,
      draw: (c) => {
        fill(c, hull(hood), g.paper, g.ink);
      },
    });
  },
  writ(g, parts) {
    // The Writ, carried on the back.
    const { sk } = g.pose;
    const writ = [
      add(sk.chest, v(-7, -5, 8)),
      add(sk.chest, v(-7, 5, 8)),
      add(sk.chest, v(-7, 5, -10)),
      add(sk.chest, v(-7, -5, -10)),
    ].map(g.proj);
    parts.push({
      depth: avg(...writ),
      draw: (c) => {
        fill(c, hull(writ), g.C.skin, g.ink);
      },
    });
  },
  lantern(g, parts) {
    const hand = g.proj(g.pose.sk.handR);
    const lamp = g.proj(lanternOf(g.pose));
    parts.push({
      depth: lamp.depth + 0.0006,
      draw: (c) => {
        c.strokeStyle = g.C.ink;
        c.lineWidth = 0.8 * look.zoom;
        c.beginPath();
        c.moveTo(hand.x, hand.y);
        c.lineTo(lamp.x, lamp.y);
        c.stroke();
        fill(c, hexAt(lamp, 2), g.C.flame, g.C.ink);
      },
    });
  },
  robe(g, parts) {
    // A robe to the ground over the legs, and a red sash.
    const { sk } = g.pose;
    const torso = [
      sk.shoulderL,
      sk.shoulderR,
      add(sk.hipR, v(0, -1, 0)),
      add(sk.hipL, v(0, 1, 0)),
    ].map(g.proj);
    const hem = [
      v(14, 0, 0),
      v(-12, 0, 0),
      v(0, 18, 0),
      v(0, -18, 0),
      v(9, 13, 0),
      v(9, -13, 0),
      v(-8, 13, 0),
      v(-8, -13, 0),
    ].map(g.proj);
    const robe = hull([...torso, ...hem]);
    const sash = hull(
      [
        add(sk.pelvis, v(0, -12, 8)),
        add(sk.pelvis, v(0, 12, 8)),
        add(sk.pelvis, v(0, 12, 2)),
        add(sk.pelvis, v(0, -12, 2)),
      ].map(g.proj),
    );
    parts.push(
      {
        depth: avg(...torso) - 0.001,
        draw: (c) => {
          fill(c, robe, g.paper, g.ink);
        },
      },
      {
        depth: avg(...torso) + 0.0005,
        draw: (c) => {
          fill(c, sash, g.C.blood, null);
        },
      },
    );
  },
};

// A staff held upright, topped with the Cleric's sunburst or the Church's eye.
function staff(g: Gear, parts: Part[], sun: boolean): void {
  const h = g.pose.sk.handR;
  const a = g.proj(add(h, v(0, 0, -40)));
  const b = g.proj(add(h, v(0, 0, 44)));
  const eye = g.proj(add(h, v(0, 0, 50)));
  parts.push({
    depth: avg(a, b) + 0.0006,
    draw: (c) => {
      fill(c, taper(a, b, 0.7, 0.7), g.C.wood, null);
      if (sun) {
        const r = 6 * look.zoom;
        c.fillStyle = g.C.gold;
        for (let i = 0; i < 8; i++) {
          const t = (i / 8) * Math.PI * 2;
          c.fillRect(
            Math.round(eye.x + Math.cos(t) * r),
            Math.round(eye.y + Math.sin(t) * r),
            1,
            1,
          );
        }
        fill(c, hexAt(eye, 3), g.C.gold, g.ink);
      } else {
        fill(c, hexAt(eye, 3.4), g.C.bone, g.ink);
        c.fillStyle = g.C.blood;
        c.fillRect(Math.round(eye.x) - 1, Math.round(eye.y) - 1, 2, 2);
      }
    },
  });
}

// The body's own parts: legs, arms, torso and head, unless a robe hides the legs.
function bodyParts(g: Gear, legs: boolean, headR: number): Part[] {
  const { sk } = g.pose;
  const parts: Part[] = [];
  const limb = (a: V3, b: V3, wa = 1.4, wb = 0.8): void => {
    const A = g.proj(a);
    const B = g.proj(b);
    parts.push({
      depth: avg(A, B),
      draw: (c) => {
        fill(c, taper(A, B, wa, wb), g.paper, g.ink);
      },
    });
  };
  if (legs) {
    limb(sk.hipL, sk.kneeL);
    limb(sk.kneeL, sk.footL);
    limb(sk.hipR, sk.kneeR);
    limb(sk.kneeR, sk.footR);
  }
  limb(sk.shoulderL, sk.elbowL, 1.2, 0.8);
  limb(sk.elbowL, sk.handL, 1.0, 0.6);
  limb(sk.shoulderR, sk.elbowR, 1.2, 0.8);
  limb(sk.elbowR, sk.handR, 1.0, 0.6);
  const torso = [
    sk.shoulderL,
    sk.shoulderR,
    add(sk.hipR, v(0, -1, 0)),
    add(sk.hipL, v(0, 1, 0)),
  ].map(g.proj);
  parts.push({
    depth: avg(...torso),
    draw: (c) => {
      fill(c, hull(torso), g.paper, g.ink);
    },
  });
  const head = g.proj(sk.head);
  parts.push({
    depth: head.depth + 0.0004,
    draw: (c) => {
      fill(c, hexAt(head, headR), g.paper, g.ink);
    },
  });
  return parts;
}

/** A look baked into frames: every action in every facing. */
interface Sheet {
  canvas: HTMLCanvasElement;
  // The first row of each action; a row per facing follows it
  rows: Map<Action, number>;
  // Where the lantern hangs in each frame, from the feet, if the look has one
  lanterns: Map<string, Pt>;
}

const sheets = new Map<string, Sheet>();

const keyOf = (l: Look): string => `${l.paper}:${l.size}:${l.attack}:${l.attachments.join(',')}`;

// Bakes a look: poses the body for each frame, attaches its gear, sorts the
// parts by depth and draws them into the frame's cell.
function bake(l: Look, C: Palette): Sheet {
  const columns = Math.max(...Object.values(FRAMES));
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * columns;
  canvas.height = CELL_H * ACTIONS.length * FACINGS;
  const ctx = canvas.getContext('2d')!;
  const rows = new Map<Action, number>();
  const lanterns = new Map<string, Pt>();
  const legs = !l.attachments.includes('robe');
  const headR = 3.2 * l.size;
  ACTIONS.forEach((action, i) => {
    rows.set(action, i * FACINGS);
    for (let dir = 0; dir < FACINGS; dir++) {
      const angle = (dir * Math.PI) / 4;
      const n = FRAMES[action];
      for (let f = 0; f < n; f++) {
        // A dying fall ends on its last frame; the others loop.
        const t = action === 'dead' ? f / Math.max(1, n - 1) : f / n;
        const u = poseUnit(action, t, angle, l.size);
        const time = action === 'idle' ? t * BREATH : 0;
        const ox = f * CELL_W + ORIGIN_X;
        const oy = (i * FACINGS + dir) * CELL_H + ORIGIN_Y;
        const g: Gear = {
          pose: pose(u, action, time),
          proj: projector(u, () => ({ x: ox, y: oy })),
          C,
          ink: C.ink,
          paper: C[l.paper],
          facing: Math.cos(angle) + Math.sin(angle) > -0.2,
        };
        const parts = bodyParts(g, legs, headR);
        for (const a of l.attachments) {
          ATTACH[a](g, parts);
        }
        parts
          .sort((p, q) => p.depth - q.depth)
          .forEach((p) => {
            p.draw(ctx);
          });
        if (l.attachments.includes('lantern')) {
          const lamp = g.proj(lanternOf(g.pose));
          lanterns.set(`${action}:${dir}:${f}`, { x: lamp.x - ox, y: lamp.y - oy });
        }
      }
    }
  });
  return { canvas, rows, lanterns };
}

function sheetOf(l: Look, C: Palette): Sheet {
  const key = keyOf(l);
  let sheet = sheets.get(key);
  if (!sheet) {
    sheet = bake(l, C);
    sheets.set(key, sheet);
  }
  return sheet;
}

/** The kinds drawn from sprites: the bearer and the mercs. */
export const isSprited = (kind: Kind): boolean =>
  kind === 'bearer' || kind === 'vanguard' || kind === 'ranger' || kind === 'cleric';

// A weapon as an attachment
type Weapon = NonNullable<NonNullable<RigUnit['held']>['weapon']>;

const WEAPON: Record<Weapon, Attachment> = {
  sword: 'sword',
  mace: 'mace',
  bow: 'bow',
  dagger: 'dagger',
  staff: 'staff',
};

// A held weapon as attachments: none, or its own. A Cleric's staff is the sunburst staff.
function held(weapon: Weapon | null, asStaff: Attachment = 'staff'): Attachment[] {
  if (!weapon) {
    return [];
  }
  return [weapon === 'staff' ? asStaff : WEAPON[weapon]];
}

/** What a party figure looks like: its body and what it carries. */
export function lookOf(u: RigUnit): Look {
  if (u.kind === 'bearer') {
    return {
      paper: 'bearer',
      size: 0.82,
      attachments: ['hood', 'writ', 'lantern'],
      attack: 'slash',
    };
  }
  const paper = 'merc';
  if (u.kind === 'ranger') {
    const weapon = u.held ? u.held.weapon : 'bow';
    return {
      paper,
      size: 1,
      attachments: ['hood', ...held(weapon)],
      attack: weapon === 'bow' ? 'shoot' : 'slash',
    };
  }
  if (u.kind === 'cleric') {
    const weapon = u.held ? u.held.weapon : 'staff';
    return {
      paper,
      size: 1,
      attachments: ['robe', ...held(weapon, 'sunStaff')],
      attack: 'cast',
    };
  }
  const weapon = u.held ? u.held.weapon : 'sword';
  const shield = u.held?.shield ?? true;
  return {
    paper,
    size: 1,
    attachments: [...held(weapon), ...(shield ? ['towerShield' as const] : [])],
    attack: weapon === 'bow' ? 'shoot' : 'slash',
  };
}

// What a figure is doing, as an action and one of its frames.
function frameOf(u: RigUnit, l: Look, time: number): { action: Action; frame: number } {
  const at = (action: Action, t: number): { action: Action; frame: number } => {
    const n = FRAMES[action];
    const k = action === 'dead' ? Math.round(clamp01(t) * (n - 1)) : Math.floor(clamp01(t) * n);
    return { action, frame: Math.min(n - 1, k) };
  };
  if (u.fall >= 0) {
    return at('dead', u.fall);
  }
  if (u.shout >= 0) {
    return at('shout', u.shout);
  }
  if (u.atk >= 0) {
    return at(l.attack, u.atk);
  }
  if (u.hurt < 0.18) {
    return at('hurt', 0);
  }
  if (u.stride > 0.3) {
    const turn = (((u.walk / (Math.PI * 2)) % 1) + 1) % 1;
    return at('walk', turn);
  }
  if (u.alert && l.attack === 'shoot') {
    return at('aim', 0);
  }
  // Each figure breathes on its own beat.
  const breath = ((((time + u.x * 0.7) / BREATH) % 1) + 1) % 1;
  return at('idle', breath);
}

// A cell to whiten a frame in, for the flash when struck
let flashCanvas: HTMLCanvasElement | null = null;

/**
 * Draws a party figure from its look's sheet, its feet at `base`, a whole
 * pixel. White while it flashes from a blow.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  u: RigUnit,
  base: Pt,
  C: Palette,
  time: number,
  flash: boolean,
): void {
  const l = lookOf(u);
  const sheet = sheetOf(l, C);
  const { action, frame } = frameOf(u, l, time);
  const dir = facingOf(u.angle);
  const sx = frame * CELL_W;
  const sy = (sheet.rows.get(action)! + dir) * CELL_H;
  const x = Math.round(base.x) - ORIGIN_X;
  const y = Math.round(base.y) - ORIGIN_Y;
  if (!flash) {
    ctx.drawImage(sheet.canvas, sx, sy, CELL_W, CELL_H, x, y, CELL_W, CELL_H);
    return;
  }
  flashCanvas ??= document.createElement('canvas');
  flashCanvas.width = CELL_W;
  flashCanvas.height = CELL_H;
  const f = flashCanvas.getContext('2d')!;
  f.clearRect(0, 0, CELL_W, CELL_H);
  f.drawImage(sheet.canvas, sx, sy, CELL_W, CELL_H, 0, 0, CELL_W, CELL_H);
  f.globalCompositeOperation = 'source-atop';
  f.fillStyle = '#ffffff';
  f.fillRect(0, 0, CELL_W, CELL_H);
  f.globalCompositeOperation = 'source-over';
  ctx.drawImage(flashCanvas, x, y);
}

/** Where the bearer's lantern hangs this frame, from its feet, or null. */
export function spriteLantern(u: RigUnit, C: Palette, time: number): Pt | null {
  const l = lookOf(u);
  if (!l.attachments.includes('lantern')) {
    return null;
  }
  const sheet = sheetOf(l, C);
  const { action, frame } = frameOf(u, l, time);
  return sheet.lanterns.get(`${action}:${facingOf(u.angle)}:${frame}`) ?? null;
}
