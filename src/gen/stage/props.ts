// Prop kinds, which of them block, and how a generator adds one.
import type RNG from '../../core/rng';
import type { Reward } from '../graph';
import { LAYERS } from '../layers';
import type { Stage } from './types';

export type PropKind =
  | 'pillar'
  | 'tree'
  | 'wall'
  | 'rubble'
  | 'gibbet'
  | 'pike'
  | 'banner'
  | 'altar'
  | 'candle'
  | 'chest'
  | 'stair'
  | 'brazier'
  | 'torch'
  | 'signpost'
  | 'post'
  | 'strongbox'
  | 'sarcophagus'
  | 'well'
  | 'anvil'
  | 'bench'
  | 'chapel'
  | 'stall'
  | 'campfire'
  | 'gate'
  | 'lever'
  | 'key'
  | 'pit'
  | 'blossom'
  | 'vault';

export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
  // How far it blocks bodies and sight, in tiles. Absent for props that do not.
  r?: number;
  // For drawing variations, such as a wall block's height
  seed: number;
  // A chest the bearer has opened, what a fight's chest holds, and whether
  // its bonus challenge was met
  open?: boolean;
  holds?: Reward;
  better?: boolean;
  // Items added for the fight's mutators
  extra?: number;
}

export type Add = (kind: PropKind, x: number, z: number) => Prop;

// Solid radius of each prop that blocks, in tiles.
export const SOLID: Partial<Record<PropKind, number>> = {
  pillar: 0.45,
  tree: 0.4,
  signpost: 0.15,
  wall: 0.5,
  altar: 0.8,
  gibbet: 0.3,
  pike: 0.2,
  banner: 0.2,
  chest: 0.35,
  campfire: 0.3,
  post: 1.1,
  sarcophagus: 0.9,
  well: 0.6,
  anvil: 0.4,
  bench: 0.5,
  chapel: 1.1,
  stall: 0.6,
  strongbox: 0.4,
  gate: 0.5,
  pit: 1,
  vault: 1.3,
};

// What stands tall on a layer's ground: dead trees on earth, pillars on stone.
export const tallFor = (biome: number): PropKind =>
  LAYERS[biome]?.ground === 'earth' ? 'tree' : 'pillar';

// Adds a prop to a stage, solid as its kind is, with a seed for its look.
export function adder(stage: Stage, rng: RNG): Add {
  return (kind, x, z) => {
    const prop: Prop = { kind, x, z, r: SOLID[kind], seed: rng.random() };
    stage.props.push(prop);
    return prop;
  };
}
