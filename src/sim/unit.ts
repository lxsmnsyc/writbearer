import type { Hunt, Toggles } from './ai';
import type { UnitDamageEvent, UnitHealEvent } from './events';
import type { EquipSlot, Item } from './item';
import { MORALE_START } from './morale';
import type { Heard } from './shout';
import type { Lifecycle } from '../core/lifecycle';
import type { Spot } from './nav';
import type Sim from './sim';
import type { Cast, Skill } from './skill';
import type { ActiveStatus, StatusDef } from './status';
import type { BaseStats, Derived, Job, Modifier, StatResult, Weapon } from './stats';
import { Element, Race, Rank, type Side } from './types';
import { canCast, skillCost, skillRank, startAttack, startCast } from './unit/casting';
import { type HitOptions, die, heal, hit, revive } from './unit/combat';
import {
  BELT_SLOTS,
  beltPotion,
  drink,
  equip,
  raiseStat,
  recalc,
  refreshCards,
  setBonus,
  unequip,
} from './unit/gear';
import { DEFAULT_KIT, type Kit, type UnitSpec } from './unit/kit';
import { face, isFlankedBy, speedOf, travel, walkTo } from './unit/movement';
import { addStatus, buildUp, clearStatuses, removeStatus, tickStatuses } from './unit/statuses';

export { BELT_SLOTS } from './unit/gear';
export type { HitOptions } from './unit/combat';
export type { Kit, UnitSpec } from './unit/kit';

/**
 * A merc, a monster or the bearer. Its state only changes through the
 * events its methods emit, so mechanics, skills and items can answer or
 * veto each change. The logic of each feature lives in src/sim/unit/.
 */
export default class Unit {
  readonly kind: string;
  // Renamed when a disguised unit is revealed
  name: string;
  // Changes only at the end: the Creditor raises the unresurrected dead.
  side: Side;
  readonly job: Job;
  level: number;
  base: BaseStats;
  // The bare-handed weapon, used when nothing is in the weapon slot
  weapon: Weapon;
  // Worn items, by slot
  readonly equipment = new Map<EquipSlot, Item>();
  // Potions on the belt, one stack per slot, drunk by the merc's own rules
  readonly belt: (Item | null)[] = Array.from({ length: BELT_SLOTS }, () => null);
  // Seconds before another potion can be drunk
  potionCooldown = 0;
  // Bonuses from passives and auras, by the id of what gives them
  readonly bonuses = new Map<string, Modifier[]>();
  race: Race;
  rank: Rank;
  element: Element;
  elementLevel: number;
  attackElement: Element;
  modifiers: Modifier[];

  stats!: StatResult;
  hp = 0;
  mana = 0;
  // A pool that absorbs magical damage first
  ward = 0;
  alive = true;
  // The blow that killed it, and whether it tore the body apart
  lastBlow: { value: number; flags: number } | null = null;
  torn = false;
  // How much more gold it drops when killed, such as 1.5 after a Pocket Change kill
  bounty = 1;
  // Counts that last the run and are saved with a merc, by key, such as the
  // phases a Sellsword survived (src/content/jobs/sellsword/upgrades.ts)
  readonly tally = new Map<string, number>();
  // Personality traits, rolled when recruited. They never change.
  traits: string[] = [];
  // How a merc feels about the job, and how well it follows orders, 0 to 100
  morale = MORALE_START;
  discipline = 0;
  // Discipline from what the party wears, such as a squad set's, on top
  disciplineBonus = 0;
  // The bearer's last shout as this merc heard it
  heard: Heard | null = null;
  // Effects of what it wears, uniques' and socketed cards', by item and socket
  // Used by src/sim/unit/gear.ts
  readonly cardEffects = new Map<string, Lifecycle>();

  // Position on the floor, in tiles, and facing in radians. 0 faces +x.
  x: number;
  z: number;
  angle = 0;
  readonly kit: Kit;

  // Seconds into the current basic attack, or -1 when not attacking.
  swing = -1;
  swingTarget: Unit | null = null;
  // Seconds until the next basic attack may start.
  cooldown = 0;
  // Whom the unit is fighting, chosen by its AI each tick.
  target: Unit | null = null;
  // Monsters stand idle until they notice the party.
  aware = false;
  // Hidden from the other side until revealed: it cannot be targeted or noticed
  hidden = false;
  // The kind it is drawn and listed as until revealed, or null
  disguise: string | null = null;
  // Seconds a disguised assassin walks with the party, counted from when it
  // joins, before it turns on the bearer. Infinity means never on its own.
  fuse = Infinity;
  // Runs when the unit is revealed, such as a disguised assassin changing sides
  onReveal: ((by: Unit | null) => void) | null = null;
  // A Hunt's quarry: the exits open once every marked monster is dead.
  // Badly hurt, it runs once to a pack still unaware, to wake it.
  marked = false;
  runningTo: { x: number; z: number } | null = null;
  ran = false;
  // A Labyrinth's monster that carries the key to its hall
  bearsKey = false;
  // A mini-boss: a named monster with its own gimmick, drawn larger
  named = false;
  // A herald's horn post, which it runs for to blow it, if it is running
  alarm: { x: number; z: number } | null = null;
  // Something that never acts, such as a horn post, there only to be broken
  still = false;
  // How many shots a ranged basic attack looses at once, as Multishot gives
  volley = 1;
  // A captain's followers: the kinds it calls to its side while it lives.
  // Empty for any other unit.
  calls: readonly string[] = [];
  // Where a monster last saw whom it was after, to look for it there
  lastSeen: { x: number; z: number } | null = null;
  toggles: Toggles | undefined;
  hunt: Hunt | undefined;
  // Move speed multiplier from what the unit carries, such as the bearer's pack
  burden = 1;
  // Where the bearer was told to walk.
  order: { x: number; z: number } | null = null;
  // The path being followed around obstacles, and the goal it was found for
  // Used by src/sim/unit/movement.ts
  route: { x: number; z: number; at: number; points: Spot[] } | null = null;

  readonly skills: Skill[];
  // Ranks learned in skill-tree nodes, by node id
  readonly skillRanks = new Map<string, number>();
  // Passive skills in effect, by node id, so a new rank can replace the old
  readonly passives = new Map<string, Lifecycle>();
  // The job's 4 spells in cast priority order, for jobs on the build model
  // (src/sim/builds.ts). Empty for jobs still on a skill tree.
  spells: Skill[] = [];
  // Shards not yet spent: each raises one spell a rank
  shards = 0;
  // The elite upgrade each spell holds: spell id to upgrade id
  readonly upgrades = new Map<string, string>();
  // Experience toward the next level, and points not yet spent
  xp = 0;
  skillPoints = 0;
  statPoints = 0;
  // Seconds until each skill may be used again, by skill id
  readonly skillCooldowns = new Map<string, number>();
  // The skill being used, or null
  cast: Cast | null = null;
  // Timed effects, by status id
  readonly statuses = new Map<string, ActiveStatus>();
  // Buildup toward each status, by status id, and when it last rose
  readonly buildup = new Map<string, number>();
  // Used by src/sim/unit/statuses.ts
  readonly buildupAt = new Map<string, number>();
  // Seconds left before each status can be gained again, by status id
  readonly immunity = new Map<string, number>();

  constructor(
    readonly sim: Sim,
    spec: UnitSpec,
  ) {
    this.name = spec.name;
    this.kind = spec.kind ?? spec.name;
    this.side = spec.side;
    this.job = spec.job;
    this.level = spec.level;
    this.base = { ...spec.base };
    this.weapon = { ...spec.weapon };
    this.race = spec.race ?? Race.Human;
    this.rank = spec.rank ?? Rank.Normal;
    this.element = spec.element ?? Element.Neutral;
    this.elementLevel = spec.elementLevel ?? 1;
    this.attackElement = spec.attackElement ?? Element.Neutral;
    this.modifiers = [...(spec.modifiers ?? [])];
    this.kit = { ...DEFAULT_KIT, ...spec.kit };
    this.x = spec.x ?? 0;
    this.z = spec.z ?? 0;
    this.toggles = spec.toggles;
    this.hunt = spec.hunt;
    this.skills = [...(spec.skills ?? [])];
    this.recalc();
    this.hp = this.derived.maxHp;
    this.mana = this.derived.maxMana;
  }

  get derived(): Derived {
    return this.stats.derived;
  }

  distanceTo(other: { x: number; z: number }): number {
    return Math.hypot(other.x - this.x, other.z - this.z);
  }

  face(other: { x: number; z: number }): void {
    face(this, other);
  }

  /**
   * Whether `attacker` stands outside this unit's front arc, about 110°
   * to each side. Shields only block from the front.
   */
  isFlankedBy(attacker: Unit): boolean {
    return isFlankedBy(this, attacker);
  }

  /** Walks toward a point. Returns true once it is within `stop` tiles of it. */
  walkTo(x: number, z: number, dt: number, stop = 0.05): boolean {
    return walkTo(this, x, z, dt, stop);
  }

  /** Whether a status stops the unit from acting, such as Stun. */
  get disabled(): boolean {
    for (const s of this.statuses.values()) {
      if (s.def.disables) {
        return true;
      }
    }
    return false;
  }

  /** Whom the unit is running from, if a status frightens it. */
  get fear(): Unit | null {
    for (const s of this.statuses.values()) {
      if (s.def.flees) {
        return s.source;
      }
    }
    return null;
  }

  /** Move speed after slows and the load carried. */
  get speed(): number {
    return speedOf(this);
  }

  /** Whether the unit is in the middle of an attack or a skill. */
  get busy(): boolean {
    return this.swing >= 0 || this.cast !== null;
  }

  /**
   * Walks toward a point, around obstacles when something is in the way.
   * Returns true once it is within `stop` tiles of it.
   */
  travel(x: number, z: number, dt: number, stop = 0.05): boolean {
    return travel(this, x, z, dt, stop);
  }

  /** Starts a basic attack. The blow lands later, on the hit frame. */
  startAttack(target: Unit): boolean {
    return startAttack(this, target);
  }

  /** The mana a skill costs this unit now, after passives and items. */
  skillCost(skill: Skill): number {
    return skillCost(this, skill);
  }

  /** Whether the unit is free, the skill is off cooldown and the mana is there. */
  canCast(skill: Skill): boolean {
    return canCast(this, skill);
  }

  /** Starts a skill's windup. Returns false if it cannot be used now. */
  startCast(skill: Skill, target: Unit | null): boolean {
    return startCast(this, skill, target);
  }

  /**
   * Gives the unit a status, or refreshes it. Returns null if the unit is
   * immune or dead.
   */
  addStatus(def: StatusDef, source: Unit, duration = def.duration, power = 1): ActiveStatus | null {
    return addStatus(this, def, source, duration, power);
  }

  /** Ends a status early or on time. The unit is then immune to it for a while. */
  removeStatus(id: string): void {
    removeStatus(this, id);
  }

  /**
   * Adds buildup toward a status. When it reaches the unit's threshold the
   * status triggers and the buildup resets.
   */
  buildUp(def: StatusDef, source: Unit, amount: number): void {
    buildUp(this, def, source, amount);
  }

  /** Runs statuses, immunity and buildup decay for one tick. */
  tickStatuses(dt: number): void {
    tickStatuses(this, dt);
  }

  /** Ends every status, as on death. No immunity follows. */
  clearStatuses(): void {
    clearStatuses(this);
  }

  /** The rank learned in a skill, or 0. Monster skills count as rank 1. */
  skillRank(id: string): number {
    return skillRank(this, id);
  }

  /** Spends a stat point on a base stat. Returns false if there is none to spend. */
  raiseStat(stat: keyof BaseStats): boolean {
    return raiseStat(this, stat);
  }

  /**
   * Drinks a potion: from a belt slot, or a given one such as the bearer's
   * from the pack. Returns false if it cannot drink now.
   */
  drink(potion: Item): boolean {
    return drink(this, potion);
  }

  /** The first potion on the belt that restores health, or mana. */
  beltPotion(kind: 'health' | 'mana'): Item | null {
    return beltPotion(this, kind);
  }

  /** Sets or clears a bonus from a passive or aura. The stats follow at once. */
  setBonus(id: string, modifiers: Modifier[] | null): void {
    setBonus(this, id, modifiers);
  }

  /**
   * Puts an item on, and returns what it replaced. The stats follow at once.
   */
  equip(slot: EquipSlot, item: Item): Item | null {
    return equip(this, slot, item);
  }

  /** Takes an item off, and returns it. */
  unequip(slot: EquipSlot): Item | null {
    return unequip(this, slot);
  }

  /**
   * Starts the effects of what the unit wears, a unique's or a socketed
   * card's, and stops those of what it no longer wears. Call it after gear
   * or sockets change.
   */
  refreshCards(): void {
    refreshCards(this);
  }

  /**
   * Computes the stats again from their inputs. Call it after any input
   * changes: level, raised stats, gear or a bonus starting or ending.
   */
  recalc(): void {
    recalc(this);
  }

  /**
   * One hit on `target`. Physical hits roll to hit first. Returns the
   * damage event, or null on a miss.
   */
  hit(target: Unit, options: HitOptions = {}): UnitDamageEvent | null {
    return hit(this, target, options);
  }

  heal(target: Unit, value: number, flags = 0): UnitHealEvent {
    return heal(this, target, value, flags);
  }

  /**
   * Brings a dead unit back from its corpse with a share of its health.
   * A torn body cannot come back. Returns whether it did.
   */
  revive(share: number): boolean {
    return revive(this, share);
  }

  die(killer: Unit | null): void {
    die(this, killer);
  }
}
