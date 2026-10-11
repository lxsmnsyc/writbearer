/** What a layer's ground is made of. */
export type Ground = 'earth' | 'rock' | 'flagstone';

/** A layer of the Hollow: one phase of the run, as the lore lays them out. */
export interface Layer {
  name: string;
  ground: Ground;
}

export const LAYERS: readonly Layer[] = [
  // The surface near the rim: forest roads and burned villages
  { name: 'The Marches', ground: 'earth' },
  // Paths cut into the chasm walls
  { name: 'The Rift Road', ground: 'rock' },
  // Flooded caverns and old cellars under the city
  { name: 'The Drowned Undercroft', ground: 'flagstone' },
  // The ruins of the old capital
  { name: 'The Sunken Crown', ground: 'flagstone' },
];

/**
 * Areas in a layer, one per layer of the phase's stage graph. Areas in a
 * layer join side by side, by road. Only the last one leads down.
 */
export const AREAS_PER_LAYER = 8;

/** The layer an area is in, by its index in the run. */
export const layerOf = (index: number): Layer =>
  LAYERS[Math.min(LAYERS.length - 1, Math.floor(index / AREAS_PER_LAYER))];

/** An area's number within its layer, from 1. */
export const areaOf = (index: number): number => (index % AREAS_PER_LAYER) + 1;

/** Whether an area's exit goes down to the next layer, instead of on by road. */
export const leadsDown = (index: number): boolean =>
  index % AREAS_PER_LAYER === AREAS_PER_LAYER - 1;
