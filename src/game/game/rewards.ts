// A fight's reward: what its chest holds, what it pays once the objective
// is done, and the chest laid before the exits.
//
// A new kind of `Reward` adds an entry to `REWARDS` (and to `BONUS_PAYS`);
// `Record<Reward, ...>` makes the compiler ask for both.
import { Stream } from '../../core/seed';
import type RNG from '../../core/rng';
import { Rank, Side } from '../../sim/types';
import { type Item, type ItemBase, Quality } from '../../sim/item';
import type { Objective, Reward } from '../../gen/graph';
import { AREAS_PER_LAYER } from '../../gen/layers';
import { plainItem, rollGold, rollItem, rollPotion } from '../../gen/loot';
import { CARD_OF, GEMS } from '../../content/cards';
import { MATERIAL_NAME, type Materials, gather } from '../../content/materials';
import { OFFER_CARDS, masteryOffer } from '../mastery';
import type GameState from './state';
import { here } from './route';

// The items a Vault adds to its chest, beyond what the area pays
const VAULT_EXTRA = 2;
// A fight's chest holds one, and an Arms chest this many more, Magic or better.
const ARMS_ITEMS = 2;
// A Gold chest's pile is this many times a monster's.
const GOLD_PILE = 4;
// What a Materials chest puts in the pouch, and a Smith's Blessing from this layer down
const MATERIALS_PAID: readonly [string, number][] = [
  ['iron', 2],
  ['chitin', 1],
  ['bone', 1],
  ['rag', 1],
];
const ESSENCES = ['venomEssence', 'occultEssence', 'radiantEssence'];
const BLESSING_FROM_LAYER = 2;
// Area stream ids for a Mastery offer, apart from the Waystations'
const MASTERY_STREAM = 3000;
// How far a chest blocks bodies, as the stage's chests do
const CHEST_SOLID = 0.35;

/** What meeting a bonus challenge adds, by the reward, for the badge. */
export const BONUS_PAYS: Record<Reward, string> = {
  gold: 'Twice the gold.',
  arms: 'One item is Rare or better.',
  cards: 'A second card.',
  materials: 'Twice the materials.',
  respite: 'The dead rise too.',
  mastery: 'A fourth card.',
};

/** What a reward's chest is filled with, as it opens. */
export interface ChestFill {
  g: GameState;
  rng: RNG;
  level: number;
  // Whether the bonus challenge was met, and 2 if so, else 1
  better: boolean;
  more: number;
  // The chest's gold pile, and everything it holds so far
  gold: Item;
  out: Item[];
}

/** One kind of reward. */
export interface RewardDef {
  // Adds what the chest holds beyond an item, gold and potions.
  fill(c: ChestFill): void;
  // What the reward does the moment the objective is done, before the
  // chest is laid, if anything.
  done?(g: GameState, better: boolean): void;
}

/** Every reward kind, by its `Reward` id. */
export const REWARDS: Record<Reward, RewardDef> = {
  gold: {
    fill({ gold, more }) {
      gold.quantity *= GOLD_PILE * more;
    },
  },
  arms: {
    fill({ g, rng, level, better, out }) {
      const jobs = g
        .mercs()
        .filter((m) => m.alive)
        .map((m) => m.job.name);
      for (let i = 0; i < ARMS_ITEMS; i++) {
        const job = jobs.length > 0 ? rng.pick(jobs) : undefined;
        const atLeast = better && i === 0 ? Quality.Rare : Quality.Magic;
        out.push(rollItem(rng, level, Rank.Elite, { atLeast, job }));
      }
    },
  },
  cards: {
    fill({ g, rng, more, out }) {
      for (let i = 0; i < more; i++) {
        out.push(plainItem(cardHere(g, rng)));
      }
    },
  },
  materials: {
    fill({ g, rng, more }) {
      const found: Materials = new Map(MATERIALS_PAID.map(([id, n]) => [id, n * more]));
      found.set(rng.pick(ESSENCES), 2 * more);
      if (Math.floor(g.stageIndex / AREAS_PER_LAYER) >= BLESSING_FROM_LAYER) {
        found.set('blessing', 1);
      }
      gather(g.pack.materials, found);
      g.say(`The chest holds ${materialList(found)}. They go in the pouch.`);
    },
  },
  respite: {
    fill() {},
    done(g, better) {
      for (const m of g.sim.units) {
        if (m.side === Side.Party && m.alive) {
          m.hp = m.derived.maxHp;
          m.mana = m.derived.maxMana;
        }
      }
      if (better) {
        for (const m of g.mercs()) {
          m.revive(1);
        }
      }
      g.say('A respite: the party is whole again.');
    },
  },
  // One offer when the fight is won: a card for each of 3 different mercs,
  // 4 if the bonus challenge was met.
  mastery: {
    fill() {},
    done(g, better) {
      const rng = g.streams.area(1, Stream.Loot, MASTERY_STREAM + g.stageIndex);
      const offer = masteryOffer(g.mercs(), rng, OFFER_CARDS + (better ? 1 : 0));
      if (offer) {
        g.offers.push(offer);
        g.say('Mastery: a merc may take an elite upgrade.');
        g.itemsChanged();
      }
    },
  },
};

// What a fight's chest holds: an item, gold and potions, and its reward,
// upgraded if the bonus challenge was met.
export function spoilsOf(
  g: GameState,
  reward: Reward,
  rng: RNG,
  level: number,
  better: boolean,
): Item[] {
  const gold = rollGold(rng, level);
  const out = [rollItem(rng, level, Rank.Elite), gold, rollPotion(rng, level, 2)];
  const more = better ? 2 : 1;
  REWARDS[reward].fill({ g, rng, level, better, more, gold, out });
  return out;
}

// The card of a monster of this area, or a gem if none has one.
function cardHere(g: GameState, rng: RNG): ItemBase {
  const kinds = [
    ...g.stage.packs.flatMap((p) => p.kinds),
    ...(g.stage.waves ?? []).flatMap((w) => w.kinds),
  ];
  const cards = kinds.map((k) => CARD_OF.get(k)).filter((c) => c !== undefined);
  return cards.length > 0 ? rng.pick(cards) : rng.pick(GEMS);
}

// Lays the fight's chest at its reward spot, with gold beside it, once the
// objective is done.
export function layChest(g: GameState, kind: Objective, better: boolean): void {
  const at = g.stage.reward;
  if (!at) {
    return;
  }
  const holds = g.prize ?? undefined;
  g.stage.props.push({
    kind: 'chest',
    x: at.x,
    z: at.z,
    r: CHEST_SOLID,
    seed: 0.5,
    holds,
    better,
    extra: (here(g)?.mutators?.length ?? 0) + (kind === 'vault' ? VAULT_EXTRA : 0),
  });
  g.sim.obstacles.push({ x: at.x, z: at.z, r: CHEST_SOLID });
  // The floor stays as it is, with this area and any joined to it.
  g.sim.setWorld(g.sim.floor);
  const loot = g.streams.get(1, Stream.Loot);
  const gold = Array.from({ length: kind === 'vault' ? 2 : 1 }, () =>
    rollGold(loot, 6 + g.stageIndex),
  );
  g.scatter(gold, { x: at.x - 1, z: at.z });
}

// Materials as a reader would list them, such as "2 Iron and 1 Bone".
function materialList(found: Materials): string {
  const parts = [...found].map(([id, n]) => `${n} ${MATERIAL_NAME.get(id) ?? id}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts.join('');
}
