import { type MonsterKind, spawnBearer, spawnMerc, spawnMonster } from '../content/roster';
import type RNG from '../core/rng';
import type Sim from '../sim/sim';
import type Unit from '../sim/unit';

export type PropKind = 'pillar' | 'gibbet' | 'pike' | 'banner' | 'altar' | 'candle';

export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
}

/** A hand-made test stage: a Church sealing site in the dark. */
export interface Stage {
  size: number;
  props: Prop[];
  sigil: { x: number; z: number };
}

const SOLID: Partial<Record<PropKind, number>> = {
  pillar: 0.45,
  altar: 0.8,
  gibbet: 0.3,
  pike: 0.2,
  banner: 0.2,
};

export function sealingSite(): Stage {
  const sigil = { x: 17, z: 8 };
  const props: Prop[] = [
    { kind: 'pillar', x: 9, z: 9 },
    { kind: 'pillar', x: 12, z: 18 },
    { kind: 'pillar', x: 4, z: 7 },
    { kind: 'pillar', x: 20, z: 15 },
    { kind: 'gibbet', x: 10.5, z: 5 },
    { kind: 'pike', x: 14, z: 13 },
    { kind: 'pike', x: 21, z: 5 },
    { kind: 'pike', x: 3, z: 12 },
    { kind: 'banner', x: 15, z: 5.2 },
    { kind: 'altar', x: sigil.x, z: sigil.z },
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    props.push({ kind: 'candle', x: sigil.x + Math.cos(a) * 2.4, z: sigil.z + Math.sin(a) * 2.4 });
  }
  return { size: 26, props, sigil };
}

/** Places the party and the first packs, and makes props solid. */
export function populate(sim: Sim, stage: Stage): Unit {
  sim.size = stage.size;
  for (const p of stage.props) {
    const r = SOLID[p.kind];
    if (r) {
      sim.obstacles.push({ x: p.x, z: p.z, r });
    }
  }
  const bearer = spawnBearer(sim, 6, 17);
  spawnMerc(sim, 'vanguard', 5, 7, 16);
  spawnMerc(sim, 'ranger', 5, 5, 17.6);
  // Penitents keep the seal at the altar.
  for (const [x, z] of [
    [16, 6.6],
    [18.6, 9],
    [15.4, 9.4],
  ]) {
    spawnMonster(sim, 'penitent', 4, x, z);
  }
  for (const [x, z] of [
    [20, 18],
    [21, 19.4],
  ]) {
    spawnMonster(sim, 'hollowSoldier', 4, x, z);
  }
  for (const [x, z] of [
    [8, 4],
    [6.5, 3.5],
  ]) {
    spawnMonster(sim, 'crawler', 4, x, z);
  }
  return bearer;
}

const WAVE: MonsterKind[] = ['hollowSoldier', 'hollowSoldier', 'crawler', 'penitent'];

/** A pack out of the dark, about 10 tiles from the bearer. It comes awake. */
export function spawnWave(sim: Sim, rng: RNG, bearer: Unit, size: number): void {
  const a = rng.random() * Math.PI * 2;
  const cx = Math.min(size - 2, Math.max(2, bearer.x + Math.cos(a) * 10));
  const cz = Math.min(size - 2, Math.max(2, bearer.z + Math.sin(a) * 10));
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const u = spawnMonster(sim, rng.pick(WAVE), 4, cx + rng.range(-1, 1), cz + rng.range(-1, 1));
    u.aware = true;
  }
}
