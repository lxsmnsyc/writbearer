import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MINI_BOSSES, type MiniBossId } from '../../src/content/minibosses';
import RNG from '../../src/core/rng';
import { OBJECTIVES } from '../../src/gen/graph';
import {
  type AreaPlan,
  type Stage,
  bossHand,
  generateGuild,
  generateStage,
  generateTomb,
  generateWaystation,
  rollAffixes,
} from '../../src/gen/stage';

// Seeded stages must not change when the generator's code moves. Each case
// is hashed, so the snapshot stays small and any change to a stage shows.

const SEEDS = [1, 7, 4242];
// The first area, a mid area and a late area of each layer
const INDEXES = [0, 3, 6, 9, 13, 18, 21, 27, 30];
const MINIS: MiniBossId[] = [];
for (const m of Object.values(MINI_BOSSES)) {
  MINIS.push(m.id);
}

const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

const stageAt = (seed: number, index: number, plan?: AreaPlan): Stage =>
  generateStage(new RNG(seed * 1000 + index), index, plan);

describe('generated stages', () => {
  it('plain fields and arenas are unchanged', () => {
    const out: Record<string, string> = {};
    for (const seed of SEEDS) {
      for (const index of [...INDEXES, 7, 15, 23, 31]) {
        out[`${seed}/${index}`] = hash(stageAt(seed, index));
      }
    }
    expect(out).toMatchSnapshot();
  });

  it('every objective is unchanged', () => {
    const out: Record<string, string> = {};
    for (const [n, objective] of OBJECTIVES.entries()) {
      for (const seed of SEEDS) {
        const index = INDEXES[(n + seed) % INDEXES.length];
        const elite = (n + seed) % 2 === 0;
        const plan: AreaPlan = {
          kind: elite ? 'elite' : 'combat',
          ahead: ['combat', 'camp'],
          sides: ['east', 'north'],
          objective,
          aheadFights: [{ objective: 'hunt', reward: 'gold', mutators: ['darkness'] }],
        };
        out[`${objective}/${seed}/${index}`] = hash(stageAt(seed, index, plan));
      }
    }
    expect(out).toMatchSnapshot();
  });

  it('mini-bosses, mutators, scale and biome are unchanged', () => {
    const out: Record<string, string> = {};
    for (const [n, miniBoss] of MINIS.entries()) {
      const seed = SEEDS[n % SEEDS.length];
      const index = INDEXES[n % INDEXES.length];
      const objective = OBJECTIVES[n % OBJECTIVES.length];
      const plan: AreaPlan = {
        kind: n % 2 === 0 ? 'elite' : 'combat',
        ahead: ['combat'],
        objective,
        miniBoss,
        mutators: n % 3 === 0 ? ['alarmed'] : [],
        scale: [0.7, 1, 1.3][n % 3],
        biome: (n + 1) % 4,
        endless: n % 2 === 1,
      };
      out[`${miniBoss}/${objective}/${seed}/${index}`] = hash(stageAt(seed, index, plan));
    }
    // Endless fields, which may hold a wandering merc
    for (const seed of SEEDS) {
      for (const index of [3, 13]) {
        const plan: AreaPlan = {
          kind: 'combat',
          ahead: ['combat', 'elite', 'event'],
          endless: true,
        };
        out[`endless/${seed}/${index}`] = hash(stageAt(seed, index, plan));
      }
    }
    expect(out).toMatchSnapshot();
  });

  it('small fields and the tomb are unchanged', () => {
    const out: Record<string, string> = {};
    for (const seed of SEEDS) {
      for (const index of [1, 10, 26]) {
        const sides = ['east', 'south'] as const;
        const ahead = ['combat', 'elite'] as AreaPlan['ahead'];
        for (const kind of ['camp', 'town'] as const) {
          for (const endless of [false, true]) {
            const plan: AreaPlan = { kind, ahead, sides, endless };
            out[`${kind}/${endless}/${seed}/${index}`] = hash(stageAt(seed, index, plan));
          }
        }
        const scene: AreaPlan = { kind: 'event', ahead, scene: ['altar', 'candle', 'chest'] };
        out[`event/${seed}/${index}`] = hash(stageAt(seed, index, scene));
        const boss: AreaPlan = { kind: 'boss', ahead: ['down'] };
        out[`boss/${seed}/${index}`] = hash(stageAt(seed, index, boss));
        out[`waystation/${seed}/${index}`] = hash(
          generateWaystation(new RNG(seed + index), index, ahead, undefined, sides),
        );
      }
      out[`guild/${seed}`] = hash(generateGuild(new RNG(seed), ['combat', 'elite']));
      out[`tomb/${seed}`] = hash(generateTomb(new RNG(seed), 32));
    }
    expect(out).toMatchSnapshot();
  });

  it('boss hands and affixes are unchanged', () => {
    const out: Record<string, unknown> = {};
    for (const seed of SEEDS) {
      for (const spots of [0, 1, 3]) {
        for (const index of [0, 2, 9]) {
          out[`hand/${seed}/${spots}/${index}`] = [
            bossHand(new RNG(seed), spots, index, true, false),
            bossHand(new RNG(seed), spots, index, true, true),
            bossHand(new RNG(seed), spots, index, false, false),
          ];
        }
      }
      for (const layer of [0, 1, 3]) {
        out[`affixes/${seed}/${layer}`] = [
          rollAffixes(new RNG(seed), layer, 2),
          rollAffixes(new RNG(seed), layer, 5, true),
        ];
      }
    }
    expect(hash(out)).toMatchSnapshot();
  });
});
