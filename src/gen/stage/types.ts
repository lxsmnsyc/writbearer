// The stage and the plan it is built from.
import type { MiniBossId } from '../../content/minibosses';
import type { MonsterKind } from '../../content/roster';
import type { Rect, Spot } from '../../sim/nav';
import type { Mutator, NodeKind, Objective } from '../graph';
import type { Plan } from '../fields';
import type { BossCard } from './bosses';
import type { Collapse } from './collapse';
import type { Ahead, Exit, ExitSide, Fight } from './exits';
import type { Patch } from './ground';
import type { Hazard } from './hazards';
import type { Gate } from './maze';
import type { Rite } from './objectives';
import type { Pack } from './packs';
import type { Prop, PropKind } from './props';
import type { KeyPoint } from './spots';
import type { Vault } from './vault';
import type { Mob, Wave } from './waves';

/** What an area is, and where each of its exits leads, north first. */
export interface AreaPlan {
  kind: NodeKind | 'waystation' | 'tomb' | 'guild';
  ahead: Ahead[];
  // An Event's scenery, laid round where it happens
  scene?: readonly PropKind[];
  // The layer whose ground and monsters it has, when not its own, as an
  // endless phase rolls; and whether merc are offered whatever the depth
  biome?: number;
  endless?: boolean;
  // A fight's objective, and the objective and reward of each fight its
  // exits lead to
  objective?: Objective;
  aheadFights?: readonly (Fight | undefined)[];
  // The edge each exit leaves by, in the order of `ahead`. East if absent.
  sides?: readonly ExitSide[];
  // How much of its usual threat a fight holds, as the level director sets
  // it from the party's standing. 1 if absent.
  scale?: number;
  // The mini-boss it holds, if any
  miniBoss?: MiniBossId;
  // Its own mutators, for those that change how it is laid out
  mutators?: readonly Mutator[];
  // The boss of a layer's last area
  boss?: string;
}

/**
 * One generated stage: an open field the bearer crosses from the entrance
 * on the west edge to an exit on the east edge. An exit is a road on to an
 * area of the layer's map, or, in a layer's last area, the way down.
 */
export interface Stage {
  // 0 for the first stage of a run, counting up
  index: number;
  kind: AreaPlan['kind'];
  // The layer whose ground and monsters it has, from 0
  biome: number;
  width: number;
  depth: number;
  // Where its near corner lies once placed among other areas. 0 as built.
  x0?: number;
  z0?: number;
  entrance: Spot;
  // The first of `exits`
  exit: Spot;
  exits: Exit[];
  props: Prop[];
  // Blood sigils painted on the floor
  sigils: Spot[];
  // Old blood already on the floor
  stains: { x: number; z: number; r: number }[];
  packs: Pack[];
  // The roads from the entrance, through the wall's breach, to each exit
  // and off the east edge
  roads: Spot[][];
  // Whether the exit goes down to the next layer
  down: boolean;
  // Where the boss stands, and which boss it is
  boss?: Spot;
  bossId?: string;
  // A Waystation's paymaster's post, where wages are paid and the vault opens
  station?: Spot;
  // Where a wandering merc waits by its fire, on stages that have one
  recruit?: Spot;
  // Where the Guild House's recruits wait, one spot each
  recruits?: Spot[];
  // A Camp's fire, where the party rests
  rest?: Spot;
  // The Creditor's sarcophagus, where the seal breaks
  tomb?: Spot;
  // A Town's well, where its smith, bench, temple and market are dealt with
  town?: Spot;
  // Where an Event happens: the bearer walks up to it to see what waits
  event?: Spot;
  // What the party must do before the exits open, and where the spoils
  // appear once it is done
  objective?: Objective;
  reward?: Spot;
  // A Horde's waves, in the order they come
  waves?: Wave[];
  // A Labyrinth's traps, and its hall at the far end, which is its goal
  hazards?: Hazard[];
  goal?: Rect;
  // A Labyrinth's gates: across corridors, opened by levers, and into the
  // hall, opened by the key
  gates?: Gate[];
  // An open field's ground plan, and its chasm: floor cells, one tile each,
  // that cannot be crossed but can be seen across
  layout?: Plan;
  chasm?: Spot[];
  // An open field's pools of water and patches of embers
  patches?: Patch[];
  // Where an Escort's refugees wait at the start, one spot each
  refugees?: Spot[];
  // A Vault's strongroom: where its door is, whether the bearer holds its
  // key, and whether it is open
  vault?: Vault;
  // A Ritual's sigils, in the order the bearer breaks them
  rites?: Rite[];
  // A Collapse's falling floor
  collapse?: Collapse;
  // The level director's key points: where waves may come from, where an
  // elite or mini-boss may stand, and where relief may appear
  spots?: KeyPoint[];
  // The boss deck's cards, one for each boss spot in order along the flow
  bossCards?: BossCard[];
  // Mobs the director sends in a Hunt or an Escort, in turn
  mobs?: Mob[];
  // Horn posts, and the fresh pack a horn blown there calls
  posts?: Spot[];
  hornPack?: MonsterKind[];
  // How much of its usual threat it holds, as the level director set it
  scale?: number;
}
