import type { RigUnit } from '../rig';
import type { Attachment } from '../sprites';

/** A weapon a merc can hold, as the rig knows it. */
export type HeldWeapon = NonNullable<NonNullable<RigUnit['held']>['weapon']>;

/** The attack a sprite plays: a swing, a bowshot or a prayer. */
export type Attack = 'slash' | 'shoot' | 'cast';

/**
 * How a merc job is drawn: the shared body of src/render/sprites.ts with
 * its own attachments. One module per job under src/render/looks, registered
 * in LOOKS.
 */
export interface JobLook {
  // Where in its drawn attack (0 to 1) the blow lands or the arrow leaves
  hitFraction: number;
  // How big the figure is drawn
  size: number;
  // What it holds when its gear is not known
  bare: { weapon: HeldWeapon | null; shield: boolean };
  // What is drawn on the body, from what it holds
  attachments: (weapon: HeldWeapon | null, shield: boolean) => readonly Attachment[];
  // The attack it plays, from what it holds
  attack: (weapon: HeldWeapon | null) => Attack;
}
