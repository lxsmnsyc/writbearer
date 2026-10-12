import type RNG from '../core/rng';
import type { Pack } from '../game/inventory';
import { rollGold, rollItem } from '../gen/loot';
import type { PropKind } from '../gen/stage';
import type { Item } from '../sim/item';
import { shiftDiscipline, shiftMorale } from '../sim/morale';
import type Sim from '../sim/sim';
import { Rank, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { gather } from './materials';
import { type Offer, rollOffer } from './recruits';
import { MERCS, type MonsterKind, spawnMonster } from './roster';

// Events, from the overview: a text choice with consequences, in a small
// safe area on the layer's map. Each rolls what it offers from the `events`
// stream, so a seed always meets the same people on the road.

/** What an Event can see and change, as the game hands it over. */
export interface EventScene {
  rng: RNG;
  sim: Sim;
  pack: Pack;
  // The level of the area's monsters, and of a merc met here
  level: number;
  mercLevel: number;
  // Where it happens
  at: { x: number; z: number };
  // Throws items onto the floor where it happens
  give: (items: Item[]) => void;
  // Why a merc could not join for a wage, or null; and takes it in
  cannotHire: (wage: number) => string | null;
  hire: (offer: Offer, wage: number) => void;
}

export interface EventChoice {
  label: string;
  // Why it cannot be chosen now, or null
  why?: () => string | null;
  // Makes the choice, and says what came of it
  pick: () => string;
}

/** An Event as it plays out, once rolled. */
export interface EventPlay {
  // Who waits there, drawn as that kind, and whether it lies dead
  figure: string | null;
  fallen?: boolean;
  text: string;
  choices: EventChoice[];
}

export interface EventDef {
  id: string;
  title: string;
  // The layers it can happen in, from 0
  layers: readonly number[];
  // Scenery laid in an arc round it
  props: readonly PropKind[];
  begin: (scene: EventScene) => EventPlay;
}

const mercsOf = (sim: Sim): Unit[] => sim.living(Side.Party).filter((u) => u !== sim.bearer);

const ALL_LAYERS = [0, 1, 2, 3];

// Monsters that come out of an Event, awake, round where it happens.
function ambush(scene: EventScene, kinds: MonsterKind[]): Unit[] {
  return kinds.map((kind, i) => {
    const a = (i / kinds.length) * Math.PI * 2;
    const u = spawnMonster(
      scene.sim,
      kind,
      scene.level,
      scene.at.x + 1.5 + Math.cos(a) * 1.2,
      scene.at.z + Math.sin(a) * 1.2,
    );
    u.aware = true;
    return u;
  });
}

const goldWhy = (scene: EventScene, cost: number) => (): string | null =>
  scene.pack.gold < cost ? `It costs ${cost} gold. You have ${scene.pack.gold}.` : null;

const goOn = (text: string): EventChoice => ({ label: 'Go on', pick: () => text });

export const EVENTS: readonly EventDef[] = [
  {
    id: 'toll',
    title: 'The toll',
    layers: [0, 1, 2],
    props: ['banner', 'pike', 'pike'],
    begin: (scene) => {
      const toll = 20 + 10 * scene.level;
      return {
        figure: 'hollowSoldier',
        text: `Three of the Old King’s guard bar the road, as they barred it before the city fell. They ask a toll of ${toll} gold, in a voice like a door.`,
        choices: [
          {
            label: `Pay the toll (${toll} gold)`,
            why: goldWhy(scene, toll),
            pick: () => {
              scene.pack.gold -= toll;
              return 'They step aside without a word, and watch the Writ go by.';
            },
          },
          {
            label: 'Refuse',
            pick: () => {
              ambush(scene, ['hollowSoldier', 'hollowSoldier', 'hollowSoldier']);
              return 'They draw. The toll is paid one way or the other.';
            },
          },
        ],
      };
    },
  },
  {
    id: 'deadBearer',
    title: 'Another bearer',
    layers: ALL_LAYERS,
    props: ['gibbet', 'rubble'],
    begin: (scene) => ({
      figure: 'bearer',
      fallen: true,
      text: 'A bearer lies by the road, a Guild lantern still in its hand. A Writ is folded in its coat. Its escort is nowhere to be seen.',
      choices: [
        {
          label: 'Search the body',
          pick: () => {
            scene.give([
              rollItem(scene.rng, scene.level + 2, Rank.Elite),
              rollGold(scene.rng, scene.level + 2),
            ]);
            for (const m of mercsOf(scene.sim)) {
              shiftMorale(m, -5);
            }
            return 'Its gear is good, and the mercs do not like how easily it came off.';
          },
        },
        {
          label: 'Bury it',
          pick: () => {
            for (const m of mercsOf(scene.sim)) {
              shiftMorale(m, 6);
            }
            return 'The mercs dig without being told. Someone will do the same for them, they say.';
          },
        },
        {
          label: 'Read its Writ',
          pick: () =>
            'It is the bearer’s own Writ, word for word, in the same hand. Only the name is different. The words make no more sense than they did at the Guild.',
        },
      ],
    }),
  },
  {
    id: 'refugees',
    title: 'Refugees',
    layers: [0, 1],
    props: ['campfire', 'rubble'],
    begin: (scene) => {
      // One of them is not what it seems.
      const assassin = scene.rng.chance(1 / 3);
      const found = 10 + 4 * scene.level;
      return {
        figure: 'bearer',
        text: 'A family from a burned village huddles round a fire. They have walked a long way, and have nothing left to walk on.',
        choices: [
          {
            label: 'Give them two Healing Draughts',
            why: () =>
              (scene.pack.healingPotion()?.quantity ?? 0) < 2
                ? 'You need two Healing Draughts.'
                : null,
            pick: () => {
              const potion = scene.pack.healingPotion();
              if (potion) {
                potion.quantity -= 2;
                scene.pack.tidy();
              }
              for (const m of mercsOf(scene.sim)) {
                shiftMorale(m, 8);
              }
              return 'They weep, and bless the Writ. The mercs stand a little straighter.';
            },
          },
          {
            label: 'Share their fire',
            pick: () => {
              if (assassin) {
                ambush(scene, ['hollowed']);
                return 'The youngest has been watching the Writ. It is not a child. It goes for the bearer.';
              }
              scene.pack.gold += found;
              return `They tell of the road ahead, and press ${found} gold on the bearer for the Guild’s kindness.`;
            },
          },
          goOn('The bearer walks on. Behind it, the fire gutters.'),
        ],
      };
    },
  },
  {
    id: 'sergeant',
    title: 'The old sergeant',
    layers: [0, 1, 2],
    props: ['banner', 'pike'],
    begin: (scene) => {
      const fee = 15 * scene.level;
      return {
        figure: 'vanguard',
        text: 'A grey sergeant of the Old King’s army sits on a shield by the road. For a price, he says, he can teach the bearer’s rabble to stand in a line.',
        choices: [
          {
            label: `Pay him to drill the mercs (${fee} gold)`,
            why: goldWhy(scene, fee),
            pick: () => {
              scene.pack.gold -= fee;
              for (const m of mercsOf(scene.sim)) {
                shiftDiscipline(m, 5);
              }
              return 'An hour of shouting. The mercs come back sore, and a little more obedient.';
            },
          },
          goOn('He spits, and goes back to his shield.'),
        ],
      };
    },
  },
  {
    id: 'penitents',
    title: 'The Penitents’ blessing',
    layers: ALL_LAYERS,
    props: ['altar', 'candle', 'candle', 'banner'],
    begin: (scene) => {
      const alms = 8 * scene.level;
      return {
        figure: 'penitent',
        text: 'Penitents kneel at a roadside altar under the eye of the Church. They do not draw their knives. Their Cantor offers the bearer the Church’s blessing. The Writ grows warm.',
        choices: [
          {
            label: 'Take the blessing',
            pick: () => {
              for (const u of scene.sim.living(Side.Party)) {
                u.hp = u.derived.maxHp;
                u.mana = u.derived.maxMana;
                if (u !== scene.sim.bearer) {
                  shiftMorale(u, u.traits.includes('devout') ? 10 : -6);
                }
              }
              return 'The party rises whole. The Penitents watch the bearer go, too closely, and the mercs notice.';
            },
          },
          {
            label: `Leave alms (${alms} gold)`,
            why: goldWhy(scene, alms),
            pick: () => {
              scene.pack.gold -= alms;
              gather(scene.pack.materials, new Map([['blessing', 1]]));
              return 'The Cantor presses a smith’s blessing into the bearer’s hand. It goes in the pouch.';
            },
          },
          goOn('The bearer passes by. The Penitents do not look up.'),
        ],
      };
    },
  },
  {
    id: 'dice',
    title: 'Dice by the fire',
    layers: [0, 1, 2],
    props: ['campfire', 'stall'],
    begin: (scene) => {
      const stake = 10 * scene.level;
      return {
        figure: 'ranger',
        text: `A smiling stranger shakes bone dice in a cup. Double or nothing, ${stake} gold a throw, and the bearer may throw first.`,
        choices: [
          {
            label: `Wager ${stake} gold`,
            why: goldWhy(scene, stake),
            pick: () => {
              if (scene.rng.chance(0.45)) {
                scene.pack.gold += stake;
                return `Sixes. The stranger pays ${stake * 2} gold, still smiling.`;
              }
              scene.pack.gold -= stake;
              return 'Ones. The stranger takes the stake, still smiling.';
            },
          },
          goOn('The stranger shrugs, and throws alone.'),
        ],
      };
    },
  },
  {
    id: 'cellar',
    title: 'A fallen cellar',
    layers: [1, 2, 3],
    props: ['rubble', 'rubble', 'pillar'],
    begin: (scene) => ({
      figure: null,
      text: 'A house has fallen into its own cellar. Something glints under the rubble, and the rubble shifts when touched.',
      choices: [
        {
          label: 'Dig it out',
          why: () => (mercsOf(scene.sim).length === 0 ? 'No merc is left to dig.' : null),
          pick: () => {
            for (const m of mercsOf(scene.sim)) {
              m.hp = Math.max(1, m.hp - m.derived.maxHp * 0.25);
            }
            scene.give([
              rollItem(scene.rng, scene.level + 1, Rank.Elite),
              rollItem(scene.rng, scene.level + 1, Rank.Elite),
            ]);
            gather(scene.pack.materials, new Map([['iron', 2]]));
            return 'The rubble falls on the diggers twice before it gives. What it hid lies on the floor.';
          },
        },
        goOn('The bearer leaves it to the rats.'),
      ],
    }),
  },
  {
    id: 'deserter',
    title: 'A deserter',
    layers: [0, 1],
    props: ['campfire'],
    begin: (scene) => {
      const offer = rollOffer(scene.rng, scene.mercLevel);
      // Deserters come cheap, for a reason.
      const flaw = scene.rng.pick(['cowardly', 'greedy']);
      offer.traits = [flaw, ...offer.traits.filter((t) => t !== 'brave' && t !== flaw)].slice(0, 2);
      const wage = Math.round(offer.wage / 2);
      const job = MERCS[offer.kind].job.name;
      return {
        figure: offer.kind,
        text: `${offer.name}, a ${job} who left another escort in the night, asks to walk with the bearer. Half the usual wage, ${wage} gold, and no questions. The Guild would call it ${flaw === 'cowardly' ? 'cowardice' : 'greed'}.`,
        choices: [
          {
            label: `Take ${offer.name} on (${wage} gold)`,
            why: () => scene.cannotHire(wage),
            pick: () => {
              scene.hire(offer, wage);
              return `${offer.name} falls in behind the bearer, eyes down.`;
            },
          },
          goOn(`${offer.name} watches the party go, then goes the other way.`),
        ],
      };
    },
  },
];

export const EVENT_BY_ID: ReadonlyMap<string, EventDef> = new Map(EVENTS.map((e) => [e.id, e]));

/**
 * Picks the Event of an area: one of the layer's, not yet met on this run
 * while any are left.
 */
export function pickEvent(rng: RNG, layer: number, seen: ReadonlySet<string>): EventDef {
  const here = EVENTS.filter((e) => e.layers.includes(layer));
  const fresh = here.filter((e) => !seen.has(e.id));
  return rng.pick(fresh.length > 0 ? fresh : here);
}
