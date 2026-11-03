// The Creditor's tomb, the run's last room.
import type RNG from '../../core/rng';
import { LAYERS } from '../layers';
import { adder } from './props';
import type { Stage } from './types';

/**
 * The Creditor's tomb, below the Sunken Crown: a closed chamber with no way
 * out, the Church's sigils and candles round a sarcophagus. The bearer
 * walks the Writ to it. `index` is the index after the last layer's arena.
 */
export default function generateTomb(rng: RNG, index: number): Stage {
  const width = 30;
  const depth = 24;
  const entrance = { x: 2.5, z: depth / 2 };
  const tomb = { x: width * 0.62, z: depth / 2 };
  const stage: Stage = {
    index,
    kind: 'tomb',
    biome: LAYERS.length - 1,
    width,
    depth,
    entrance,
    exit: entrance,
    exits: [],
    props: [],
    sigils: [tomb],
    stains: [],
    packs: [],
    roads: [],
    down: false,
    tomb,
  };
  const add = adder(stage, rng);
  add('sarcophagus', tomb.x, tomb.z);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add('candle', tomb.x + Math.cos(a) * 3, tomb.z + Math.sin(a) * 3);
  }
  // The Church's eye watches from every side, as it has the whole way down.
  for (const dz of [-6, 6]) {
    add('banner', tomb.x - 2, tomb.z + dz);
    add('banner', tomb.x + 4, tomb.z + dz);
  }
  // Pillars round the chamber's edge.
  for (let x = 4; x < width - 2; x += 3.2) {
    add('pillar', x, 2);
    add('pillar', x, depth - 2);
  }
  for (let i = 0; i < 12; i++) {
    stage.stains.push({
      x: tomb.x + rng.range(-5, 5),
      z: tomb.z + rng.range(-5, 5),
      r: rng.range(0.4, 1),
    });
  }
  return stage;
}
