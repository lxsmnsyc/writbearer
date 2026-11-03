import type RNG from '../core/rng';
import { layerIndexOf, leadsDown } from './layers';
import generateAmbush from './stage/ambush';
import generateArena from './stage/arena';
import { withFightsAhead } from './stage/exits';
import { generateField } from './stage/field';
import { generateCamp, generateEvent, generateTown } from './stage/havens';
import { generateMaze } from './stage/maze';
import type { AreaPlan, Stage } from './stage/types';

// The generator lives by feature under ./stage/. This file is its entry
// point: it picks the generator for an area's plan and re-exports what the
// rest of the game uses.
export { type BossCard, bossHand } from './stage/bosses';
export { type Collapse, floorOf } from './stage/collapse';
export {
  type Ahead,
  type Exit,
  type ExitSide,
  type Fight,
  beyond,
  withFightsAhead,
} from './stage/exits';
export type { Patch } from './stage/ground';
export { GUILD_RECRUITS, generateGuild, generateWaystation } from './stage/havens';
export type { Hazard, HazardKind } from './stage/hazards';
export { type Gate, openGate } from './stage/maze';
export { RITE_REACH, RITE_TIME, type Rite } from './stage/objectives';
export { type Pack, THREAT, areaBudget, monsterLevel, rollAffixes } from './stage/packs';
export type { Prop, PropKind } from './stage/props';
export { holesOf, navFor, rectOf, solidsOf } from './stage/reach';
export type { KeyPoint } from './stage/spots';
export { default as generateTomb } from './stage/tomb';
export type { AreaPlan, Stage } from './stage/types';
export type { Vault } from './stage/vault';
export type { Mob, Wave } from './stage/waves';

// The plan of an area with one road on to a Combat area, as tests use.
const PLAIN: AreaPlan = { kind: 'combat', ahead: ['combat'] };

/**
 * Builds a stage from a random stream, following the steps in the stages
 * design: size, entrance and exit, places, terrain from noise, a check that
 * everything can be reached, then packs from a threat budget.
 */
export function generateStage(rng: RNG, index: number, plan: AreaPlan = PLAIN): Stage {
  return withFightsAhead(buildArea(rng, index, plan), plan.aheadFights);
}

function buildArea(rng: RNG, index: number, plan: AreaPlan): Stage {
  const biome = plan.biome ?? layerIndexOf(index);
  // Mercs wait by the fires only in endless mode.
  const hires = plan.endless === true;
  if (leadsDown(index) || plan.kind === 'boss') {
    return generateArena(rng, index, biome);
  }
  if (plan.kind === 'camp') {
    return generateCamp(rng, index, plan.ahead, biome, hires, plan.sides);
  }
  if (plan.kind === 'town') {
    return generateTown(rng, index, plan.ahead, biome, hires, plan.sides);
  }
  if (plan.kind === 'event') {
    return generateEvent(rng, index, plan.ahead, plan.scene ?? [], biome, plan.sides);
  }
  if (plan.objective === 'ambush') {
    return generateAmbush(rng, index, plan, biome);
  }
  if (plan.objective === 'maze') {
    return generateMaze(rng, index, plan, biome);
  }
  return generateField(rng, index, plan, biome, hires);
}
