import * as THREE from 'three';

// One voxel is 1/8 of a tile.
export const VOXEL = 1 / 8;

export class VoxelModel {
  readonly voxels = new Map<string, number>();

  set(x: number, y: number, z: number, color: number): this {
    this.voxels.set(`${x},${y},${z}`, color);
    return this;
  }

  // Fills an inclusive box.
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
          this.set(x, y, z, color);
        }
      }
    }
    return this;
  }

  has(x: number, y: number, z: number): boolean {
    return this.voxels.has(`${x},${y},${z}`);
  }
}

// Each face is spanned by u and v, with u x v pointing out of the face.
// The corners then wind counter-clockwise when seen from outside.
const FACES = [
  { n: [1, 0, 0], base: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], base: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], base: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { n: [0, -1, 0], base: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], base: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], base: [0, 0, 0], u: [0, 1, 0], v: [1, 0, 0] },
];

interface Buffers {
  position: number[];
  normal: number[];
  color: number[];
}

function pushFace(b: Buffers, x: number, y: number, z: number, face: (typeof FACES)[number], c: THREE.Color): void {
  const p = (du: number, dv: number) => [
    x + face.base[0] + face.u[0] * du + face.v[0] * dv,
    y + face.base[1] + face.u[1] * du + face.v[1] * dv,
    z + face.base[2] + face.u[2] * du + face.v[2] * dv,
  ];
  const corners = [p(0, 0), p(1, 0), p(1, 1), p(0, 1)];
  for (const i of [0, 1, 2, 0, 2, 3]) {
    b.position.push(...corners[i]);
    b.normal.push(...face.n);
    b.color.push(c.r, c.g, c.b);
  }
}

function toGeometry(b: Buffers): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normal, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.color, 3));
  return g;
}

/**
 * Builds a mesh with only the faces that touch empty space.
 * Colors in `glow` are unlit, so they stay bright in the dark.
 */
export function buildMesh(model: VoxelModel, glow: ReadonlySet<number> = new Set()): THREE.Group {
  const lit: Buffers = { position: [], normal: [], color: [] };
  const bright: Buffers = { position: [], normal: [], color: [] };
  const color = new THREE.Color();

  for (const [key, hex] of model.voxels) {
    const [x, y, z] = key.split(',').map(Number);
    color.setHex(hex);
    const target = glow.has(hex) ? bright : lit;
    for (const face of FACES) {
      if (!model.has(x + face.n[0], y + face.n[1], z + face.n[2])) {
        pushFace(target, x, y, z, face, color);
      }
    }
  }

  const group = new THREE.Group();
  if (lit.position.length) {
    group.add(new THREE.Mesh(toGeometry(lit), new THREE.MeshLambertMaterial({ vertexColors: true })));
  }
  if (bright.position.length) {
    group.add(new THREE.Mesh(toGeometry(bright), new THREE.MeshBasicMaterial({ vertexColors: true })));
  }
  group.scale.setScalar(VOXEL);
  return group;
}
