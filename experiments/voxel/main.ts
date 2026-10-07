import * as THREE from 'three';
import { citizen, corpse, crawler, bones, brokenPillar, hollowSoldier, ranger, rubble, vanguard } from './models';
import { C, PALETTE, SIDE } from './palette';
import { buildMesh, VoxelModel } from './voxel';

// Internal resolution. The canvas is scaled up with no smoothing.
const W = 384;
const H = 216;
const TILES = 14;

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.void);
scene.fog = new THREE.Fog(C.void, 48, 62);

// ---------- terrain ----------
// Terrain voxels are 1/4 of a tile.
const T = 4;
const rand = rng(7);
const terrain = new VoxelModel();
const water = new Set<string>();
for (let tx = 0; tx < TILES; tx++) {
  for (let tz = 0; tz < TILES; tz++) {
    let height = 2;
    let top: number = [C.stone, C.stoneDeep, C.stone, C.stoneLight][Math.floor(rand() * 4)];
    const wallX = tx === 0 && !(tz >= 6 && tz <= 7);
    const wallZ = tz === 0;
    if (wallX || wallZ) {
      height = 14;
      top = C.stoneLight;
    } else if (tx >= 2 && tx <= 4 && tz >= 2 && tz <= 5) {
      height = 5;
      top = C.stoneLight;
    } else if (tx >= 9 && tx <= 12 && tz >= 8 && tz <= 11) {
      height = 1;
      top = C.water;
      water.add(`${tx},${tz}`);
    } else if (tx >= 8 && tx <= 13 && tz >= 7 && tz <= 12 && rand() < 0.5) {
      top = C.moss;
    }
    for (let x = tx * T; x < tx * T + T; x++) {
      for (let z = tz * T; z < tz * T + T; z++) {
        for (let y = 0; y < height; y++) {
          const wallBand = height > 5 && y % 4 === 3 ? C.stoneDeep : C.stone;
          terrain.set(x, y, z, y === height - 1 ? top : wallBand);
        }
        // Speckle the floor so tiles read as worn stone.
        if (height === 2 && rand() < 0.08) terrain.set(x, height - 1, z, C.stoneDeep);
      }
    }
  }
}
const terrainMesh = buildMesh(terrain);
terrainMesh.scale.setScalar(1 / T);
scene.add(terrainMesh);

// ---------- units and props ----------
type Side = keyof typeof SIDE | null;
const idMaterials = new Map<THREE.Object3D, THREE.Material>();
const bobbing: { group: THREE.Group; base: number; phase: number }[] = [];
const FLOOR = 2 / T;

function place(
  model: VoxelModel,
  x: number,
  z: number,
  side: Side,
  face?: [number, number],
  glow: number[] = [],
  y = FLOOR,
): THREE.Group {
  const group = buildMesh(model, new Set(glow));
  const holder = new THREE.Group();
  holder.add(group);
  holder.position.set(x, y, z);
  if (face) holder.rotation.y = Math.atan2(face[0] - x, face[1] - z);
  const idColor = new THREE.Color(side ? SIDE[side] : 0x000000);
  holder.traverse((o) => {
    if (o instanceof THREE.Mesh) idMaterials.set(o, new THREE.MeshBasicMaterial({ color: idColor }));
  });
  scene.add(holder);
  if (side) bobbing.push({ group: holder, base: y, phase: x * 1.7 + z });
  return holder;
}

// The party stands on the left and faces three-quarters toward the camera.
// The monsters come from the right. Facing +x shows a unit's front-right,
// and facing +z shows its front-left.
const SOLDIER = { x: 9.6, z: 6.4 };
const bearer = place(citizen(), 5.6, 8.4, 'citizen', [99, 8.4], [C.flame]);
place(vanguard(), 7.2, 8.0, 'merc', [99, 8.0]);
place(ranger(), 4.6, 9.9, 'merc', [99, 9.9]);
place(hollowSoldier(), SOLDIER.x, SOLDIER.z, 'monster', [SOLDIER.x - 3, SOLDIER.z + 9], [C.spectral]);
place(crawler(), 10.4, 9.4, 'monster', [7, 12], [C.blightGlow]);
place(corpse(), 8.4, 11.6, null, [9, 12]);
place(bones(), 3.3, 10.5, null, [4, 11]);
place(bones(), 12, 3.2, null, [12, 4]);
place(brokenPillar(18), 2.5, 9, null);
place(brokenPillar(9), 6.5, 2.5, null);
place(rubble(), 5.5, 3.5, null);
place(rubble(), 12.4, 6.4, null);
place(rubble(), 3.2, 12.2, null);

// ---------- light ----------
scene.add(new THREE.AmbientLight(0x6a7096, 1.6));
const moon = new THREE.DirectionalLight(0x9fb3d7, 1.8);
moon.position.set(-6, 14, 4);
scene.add(moon);
const lantern = new THREE.PointLight(0xffb04a, 26, 9, 1.2);
scene.add(lantern);
const spectralLight = new THREE.PointLight(0x6fc2ae, 6, 4, 1.4);
spectralLight.position.set(SOLDIER.x, 2.4, SOLDIER.z);
scene.add(spectralLight);

// ---------- camera ----------
const target = new THREE.Vector3(TILES / 2, 0, TILES / 2);
const VIEW = 6.6;
const camera = new THREE.OrthographicCamera((-VIEW * W) / H, (VIEW * W) / H, VIEW, -VIEW, 0.1, 200);
const yaw = Math.PI / 4;
const pitch = Math.atan(0.5); // about 26.6 degrees, the 2:1 pixel-art angle
camera.position
  .set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
  .multiplyScalar(50)
  .add(target);
camera.lookAt(target);

// ---------- render passes ----------
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
document.getElementById('stage')!.appendChild(renderer.domElement);

const colorTarget = new THREE.WebGLRenderTarget(W, H, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  depthTexture: new THREE.DepthTexture(W, H),
});
const idTarget = new THREE.WebGLRenderTarget(W, H, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
});

const palette = PALETTE.map((hex) => new THREE.Color().setHex(hex, THREE.SRGBColorSpace));
const post = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: colorTarget.texture },
    tDepth: { value: colorTarget.depthTexture },
    tId: { value: idTarget.texture },
    res: { value: new THREE.Vector2(W, H) },
    palette: { value: palette.map((c) => new THREE.Vector3(c.r, c.g, c.b)) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    #define N ${palette.length}
    uniform sampler2D tColor, tDepth, tId;
    uniform vec2 res;
    uniform vec3 palette[N];
    varying vec2 vUv;

    const float bayer[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);

    vec3 toSrgb(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

    void main() {
      vec2 px = 1.0 / res;
      vec3 id = texture2D(tId, vUv).rgb;
      float depth = texture2D(tDepth, vUv).r;
      vec3 color = toSrgb(texture2D(tColor, vUv).rgb);

      // A one-pixel outline outside each unit, tinted by its side.
      vec2 offsets[4] = vec2[4](vec2(px.x, 0.), vec2(-px.x, 0.), vec2(0., px.y), vec2(0., -px.y));
      for (int i = 0; i < 4; i++) {
        vec3 nid = texture2D(tId, vUv + offsets[i]).rgb;
        float nd = texture2D(tDepth, vUv + offsets[i]).r;
        if (dot(nid, nid) > 0.0001 && distance(nid, id) > 0.01 && nd < depth - 0.00002) {
          color = toSrgb(nid);
        }
      }

      // Ordered dither, then snap to the palette.
      ivec2 p = ivec2(mod(gl_FragCoord.xy, 4.0));
      // Pure darkness stays flat, so the void does not crawl with dither.
      float luma = dot(color, vec3(0.30, 0.59, 0.11));
      color += (bayer[p.y * 4 + p.x] / 16.0 - 0.5) * 0.04 * smoothstep(0.05, 0.12, luma);
      vec3 best = palette[0];
      float bestD = 1e9;
      for (int i = 0; i < N; i++) {
        vec3 d = palette[i] - color;
        float dd = dot(d, d);
        if (dd < bestD) { bestD = dd; best = palette[i]; }
      }
      gl_FragColor = vec4(best, 1.0);
    }
  `,
});
const postScene = new THREE.Scene();
const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

const lit = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
scene.traverse((o) => {
  if (o instanceof THREE.Mesh) lit.set(o, o.material);
});

function frame(time: number): void {
  const t = time / 1000;
  // Units bob one voxel at a time, so motion stays on the pixel grid.
  for (const b of bobbing) {
    b.group.position.y = b.base + (Math.sin(t * 3 + b.phase) > 0.3 ? 1 / 8 : 0);
  }
  const lanternLocal = new THREE.Vector3(3.5, 4.5, 3.5).multiplyScalar(1 / 8);
  lantern.position.copy(bearer.localToWorld(lanternLocal));
  lantern.intensity = 26 + Math.sin(t * 11) * 2 + Math.sin(t * 23) * 1.2;

  renderer.setRenderTarget(colorTarget);
  renderer.render(scene, camera);

  scene.fog = null;
  const background = scene.background;
  scene.background = new THREE.Color(0x000000);
  for (const [mesh] of lit) mesh.material = idMaterials.get(mesh) ?? mesh.material;
  renderer.setRenderTarget(idTarget);
  renderer.render(scene, camera);
  for (const [mesh, material] of lit) mesh.material = material;
  scene.background = background;
  scene.fog = new THREE.Fog(C.void, 48, 62);

  renderer.setRenderTarget(null);
  renderer.render(postScene, postCamera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as unknown as { ready: boolean }).ready = true;

// Water tiles are recorded for later use, such as Frost freezing them.
void water;
