import type Unit from '../../sim/unit';
import type { MonsterKind } from '../../content/roster';
import type { Offer } from '../../content/recruits';
import type { Objective } from '../../gen/graph';
import type { BonusState } from '../bonus';

/** Monsters of one kind in a Horde's next wave, as the HUD shows them. */
export interface ComingGroup {
  kind: MonsterKind;
  name: string;
  count: number;
}

/** A fight's bonus challenge as the HUD shows it. */
export interface BonusStatus {
  title: string;
  detail: string;
  state: BonusState;
}

export interface GameHooks {
  // Called when the player selects a merc, or clears the selection with null.
  onSelect?: (unit: Unit | null) => void;
  // Called when the inventory opens or closes.
  onInventory?: (open: boolean) => void;
  // Called whenever the pack, anyone's gear, levels or skills change.
  onChange?: () => void;
  // Called when the title panel opens at the start of a run, with the run's
  // seed, and when the bearer sets out into the Guild House.
  onTitle?: (open: boolean, seed: string) => void;
  // Called when the bearer meets a wandering merc, then null.
  onRecruit?: (offer: Offer | null) => void;
  // Called when the bearer reaches a Waystation's post, and when it closes.
  onStation?: (open: boolean) => void;
  // Called when the layer's map opens or closes.
  onMap?: (open: boolean) => void;
  // Called when the bearer reaches a Town's well, and when its panel closes.
  onTown?: (open: boolean) => void;
  // Called when the bearer walks up to an Event, as it changes, and with
  // null when it closes.
  onEvent?: (event: EventView | null) => void;
  // Called when the compendium opens or closes.
  onCompendium?: (open: boolean) => void;
}

/** An Event as the interface shows it. */
export interface EventView {
  title: string;
  text: string;
  // Each choice, and why it cannot be made now, if it cannot
  choices: { label: string; why: string | null }[];
  // What came of the choice made, once made
  outcome: string | null;
}

export interface GameOptions {
  // The run seed. Random when absent.
  seed?: string;
  // Starts with these mercs instead of a pick from three offers, as tests do.
  party?: Offer['kind'][];
  // Starts in this area of the run, from 1, for tests and playtesting
  area?: number;
  // Starts at the Waystation before that area instead
  station?: boolean;
  // Starts in the Creditor's tomb, at the end of the run
  tomb?: boolean;
  // Starts in a Town, in the area given by `area`
  town?: boolean;
  // Starts at this Event, by its id, in the area given by `area`
  event?: string;
  // Plays endless mode: numbered phases without end, and no Writ
  endless?: boolean;
  // Gives the first fight this objective, for tests and playtesting
  objective?: Objective;
  // Shows the level director's key points on the ground, for tuning it
  director?: boolean;
}
