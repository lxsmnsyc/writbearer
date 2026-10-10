import type Sim from '../sim';
import setupDamageMechanics from './damage';
import setupDeathMechanics from './death';
import setupHealMechanics from './heal';
import setupHitMechanics from './hit';

/**
 * Registers the base mechanics. They come before any skill or item, so they
 * run first among listeners of the same priority.
 */
export default function setupMechanics(sim: Sim): void {
  setupHitMechanics(sim);
  setupDamageMechanics(sim);
  setupHealMechanics(sim);
  setupDeathMechanics(sim);
}
