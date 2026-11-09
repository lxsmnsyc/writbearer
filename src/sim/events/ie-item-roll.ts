import type { BaseEvent } from '../../core/event-emitter';
import type { ItemBase, Quality } from '../item';
import type { ValuePriority } from '../types';
import type { SimEvents } from '../events';

/**
 * An item is being rolled, after its quality is picked and before its
 * values are drawn. Listeners change `scale` (the multiplier on the base
 * rolls, which starts at the quality's) and `affixCount` (a Rare's affix
 * total; null rolls it as usual). The draws are the same either way.
 */
export interface CheckItemRollEvent extends BaseEvent {
  base: ItemBase;
  itemLevel: number;
  quality: Quality;
  scale: number;
  affixCount: number | null;
}

export interface ItemRollEventMap {
  [SimEvents.CheckItemRoll]: [CheckItemRollEvent, ValuePriority];
}
