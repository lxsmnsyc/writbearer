// An Ambush: a Camp's small field with groups waiting round the fire.
import type RNG from '../../core/rng';
import { edgeTrees, smallField } from './havens';
import { navFor } from './reach';
import type { KeyPoint } from './spots';
import type { AreaPlan, Stage } from './types';
import { buildWaves } from './waves';

// An Ambush's groups: how many, one more in an Elite area, how far from the
// fire they wait, and the share of an area's threat they hold between them
const AMBUSH_GROUPS = 3;
const AMBUSH_RING = 9;
const AMBUSH_SHARE = 0.8;

/**
 * An Ambush: laid out as a Camp, its fire in the middle, but with groups
 * waiting unseen all round it. They close in once the bearer comes near
 * the fire or an exit. Once they are dead, the fire is a real Camp's.
 */
export default function generateAmbush(
  rng: RNG,
  index: number,
  plan: AreaPlan,
  biome: number,
): Stage {
  const { stage, add } = smallField(rng, index, plan.kind, plan.ahead, biome, plan.sides);
  stage.scale = plan.scale;
  const fire = { x: stage.width / 2, z: stage.depth / 2 };
  add('campfire', fire.x, fire.z);
  stage.rest = fire;
  edgeTrees(stage, add, rng, fire);
  stage.objective = 'ambush';
  const elite = plan.kind === 'elite';
  const count = AMBUSH_GROUPS + (elite ? 1 : 0);
  // The groups share most of a fight's threat, from all round the fire.
  const waves = buildWaves(stage, rng, elite, count);
  const nav = navFor(stage);
  const turn = rng.range(0, Math.PI * 2);
  waves.forEach((w, i) => {
    const a = turn + (i / count) * Math.PI * 2;
    const want = {
      x: Math.max(2, Math.min(stage.width - 2, fire.x + Math.cos(a) * AMBUSH_RING)),
      z: Math.max(2, Math.min(stage.depth - 2, fire.z + Math.sin(a) * AMBUSH_RING)),
    };
    w.from = nav.free(want.x, want.z);
    w.kinds = w.kinds.slice(0, Math.max(3, Math.round(w.kinds.length * AMBUSH_SHARE)));
  });
  stage.waves = waves;
  stage.reward = { x: fire.x + 2.5, z: fire.z };
  // Its groups wait at its spawn spots; relief may come by the fire.
  stage.spots = [
    ...waves.map((w): KeyPoint => ({ kind: 'spawn', ...w.from })),
    ...[-1, 1].map((k): KeyPoint => ({ kind: 'relief', ...nav.free(fire.x, fire.z + k * 3) })),
  ];
  return stage;
}
