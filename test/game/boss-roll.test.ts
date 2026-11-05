import { describe, expect, it } from 'vitest';
import { BOSS_ROLL, rollBoss } from '../../src/content/bosses/index';
import RNG from '../../src/core/rng';
import { RunStreams, Stream } from '../../src/core/seed';
import { enterStage } from '../../src/game/stage';
import { generateLayerMap } from '../../src/gen/graph';
import { AREAS_PER_LAYER } from '../../src/gen/layers';
import { generateStage } from '../../src/gen/stage';
import Sim from '../../src/sim/sim';

const LAST = AREAS_PER_LAYER - 1;

describe('boss roll on the map', () => {
  it('leaves the layer map and the saved streams as they were', () => {
    for (let layer = 0; layer < 4; layer++) {
      const streams = new RunStreams(`map-${layer}`);
      const plain = generateLayerMap(streams.area(1, Stream.Map, layer), 2, false, layer);
      const before = streams.save();
      const boss = rollBoss(streams.area(1, Stream.Map, BOSS_ROLL + layer), layer, false);
      const again = generateLayerMap(streams.area(1, Stream.Map, layer), 2, false, layer);
      expect(again).toEqual(plain);
      expect(streams.save()).toEqual(before);
      expect(boss.length).toBeGreaterThan(0);
    }
  });

  it('puts the boss id on the arena stage and spawns that boss', () => {
    const stage = generateStage(new RNG(3), LAST, {
      kind: 'boss',
      ahead: ['down'],
      biome: 2,
      boss: 'abbess',
    });
    expect(stage.bossId).toBe('abbess');
    expect(enterStage(new Sim(1), stage)?.kind).toBe('abbess');
  });

  it('gives an old stage with no boss id the layer boss', () => {
    const stage = generateStage(new RNG(3), LAST, { kind: 'boss', ahead: ['down'], biome: 1 });
    expect(stage.bossId).toBeUndefined();
    expect(enterStage(new Sim(1), stage)?.kind).toBe('gatekeeper');
  });
});
