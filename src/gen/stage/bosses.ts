// The boss deck dealt to a fight's boss spots, and mini-bosses.
import { MINI_BOSSES, type MiniBossId } from '../../content/minibosses';
import type RNG from '../../core/rng';
import type { Spot } from '../../sim/nav';
import { MIXED, type Pack, THREAT, factionPool, packOf, rollAffixes, shoots } from './packs';
import type { Stage } from './types';

/** A card from the boss deck: an elite's pack, the mini-boss, or nothing. */
export type BossCard = 'elite' | 'mini' | 'none';

// Boss spots get elites from this stage on, and nothing before
const BOSS_ELITE_FROM = 2;
// How far round a dealt boss the wandering packs are cleared
const DEALT_CLEAR = 6;
// How many times the deck is shuffled to keep a kind from coming twice in a row
const SHUFFLES = 12;

// A Horde's last wave is led by its mini-boss.
export function leadLastWave(stage: Stage, id: MiniBossId): void {
  const last = stage.waves?.at(-1);
  if (last) {
    last.mini = id;
    last.elite = -1;
    last.affixes = undefined;
  }
}

/**
 * The cards dealt to a fight's boss spots, in order along the flow, as Left
 * 4 Dead deals its Tanks, Witches and nothing. No kind comes twice in a row.
 * An Elite fight's mini-boss stands at its farthest spot, so it ends on it.
 */
export function bossHand(
  rng: RNG,
  spots: number,
  index: number,
  mini: boolean,
  elite: boolean,
): BossCard[] {
  if (spots === 0) {
    return [];
  }
  const last: BossCard[] = mini && elite ? ['mini'] : [];
  const deck: BossCard[] = [];
  if (mini && !elite) {
    deck.push('mini');
  }
  if (index >= BOSS_ELITE_FROM || elite) {
    deck.push('elite');
  }
  while (deck.length < spots - last.length) {
    deck.push('none');
  }
  const twice = (hand: BossCard[]): boolean => hand.some((c, i) => i > 0 && c === hand[i - 1]);
  let hand = [...deck.slice(0, spots - last.length), ...last];
  for (let i = 0; i < SHUFFLES; i++) {
    const tried = [...rng.shuffle([...deck]).slice(0, spots - last.length), ...last];
    hand = tried;
    if (!twice(tried)) {
      break;
    }
  }
  return hand;
}

/**
 * Deals a fight's boss spots their cards. An elite card stands a pack of the
 * layer's, led by an elite, at its spot. The mini-boss card stands the
 * mini-boss and its escort. Wandering packs too near either are cleared, so
 * the area holds about the same threat. An Elite Hunt's first quarry is its
 * mini-boss.
 */
export function dealBosses(
  stage: Stage,
  rng: RNG,
  id: MiniBossId | undefined,
  elite: boolean,
): void {
  const spots = (stage.spots ?? []).filter((s) => s.kind === 'boss');
  const lair = stage.packs.at(1);
  // Without boss spots, the mini-boss stands by the lair.
  if (spots.length === 0) {
    if (id) {
      const at = lair ? { x: lair.x + 4, z: lair.z } : { x: stage.width * 0.7, z: stage.depth / 2 };
      standMiniBoss(stage, id, at, elite);
    }
    return;
  }
  const hand = bossHand(rng, spots.length, stage.index, id !== undefined, elite);
  stage.bossCards = hand;
  const pool = factionPool(stage);
  hand.forEach((card, i) => {
    const at = spots[i];
    if (card === 'none' || (card === 'elite' && pool.length === 0)) {
      return;
    }
    clearAround(stage, at);
    if (card === 'mini' && id) {
      standMiniBoss(stage, id, at, elite);
      return;
    }
    const kinds = packOf(rng, rng.pick(pool), MIXED[1]);
    const lead = kinds.reduce((best, k, j) => (THREAT[k] > THREAT[kinds[best]] ? j : best), 0);
    stage.packs.push({
      kinds,
      x: at.x,
      z: at.z,
      elite: lead,
      affixes: rollAffixes(rng, stage.biome, kinds.length, shoots(kinds[lead])),
    });
  });
}

// Clears the wandering packs near a boss spot. The site's keepers, the lair,
// the watch on the way and anything marked stay.
function clearAround(stage: Stage, at: Spot): void {
  stage.packs = stage.packs.filter(
    (p, i) =>
      i < 3 ||
      p.elite >= 0 ||
      p.marked !== undefined ||
      Math.hypot(p.x - at.x, p.z - at.z) >= DEALT_CLEAR,
  );
}

// The mini-boss and its escort at a spot.
function standMiniBoss(stage: Stage, id: MiniBossId, at: Spot, elite: boolean): void {
  const def = MINI_BOSSES[id];
  const pack: Pack = { kinds: [def.kind, ...def.escort], x: at.x, z: at.z, elite: 0, mini: id };
  if (elite && stage.objective === 'hunt') {
    pack.marked = 0;
  }
  stage.packs.push(pack);
}
