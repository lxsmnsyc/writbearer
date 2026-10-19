import type { Hunt, Toggles } from './ai';
import {
  type Buildup,
  type CheckBuildupEvent,
  type CheckHitEvent,
  type CheckSkillCostEvent,
  type CheckStatusDurationEvent,
  SimEvents,
  type UnitDamageEvent,
  type UnitHealEvent,
} from './events';
import { EquipSlot, type Item, itemModifiers, weaponOf } from './item';
import { MENDING, REFRESHING } from './statuses';
import { MORALE_START } from './morale';
import type { Heard } from './shout';
import type { Lifecycle } from '../core/lifecycle';
import type { Spot } from './nav';
import type Sim from './sim';
import type { Cast, Skill } from './skill';
import type { ActiveStatus, StatusDef } from './status';
import {
  type BaseStats,
  type Derived,
  type Job,
  type Modifier,
  type StatResult,
  type Weapon,
  deriveStats,
} from './stats';
import { DamageFlags, DamageKind, Element, Race, type Range, Rank, type Side } from './types';

/**
 * How a unit moves and swings. Distances are in tiles, times in seconds.
 */
export interface Kit {
  // How close the unit must be to land a basic attack
  reach: number;
  // Time between the starts of two basic attacks
  interval: number;
  // When in the swing the blow lands, or the arrow leaves
  hitAt: number;
  moveSpeed: number;
  // How far the unit notices enemies
  sight: number;
  // How far a monster notices the bearer and its lantern. Mercs, unlit, are
  // noticed from three quarters of it.
  notice: number;
}

const DEFAULT_KIT: Kit = {
  reach: 1,
  interval: 1,
  hitAt: 0.5,
  moveSpeed: 2.5,
  sight: 7,
  notice: 5,
};

export interface UnitSpec {
  // The content entry the unit was made from, such as 'vanguard'
  kind?: string;
  name: string;
  side: Side;
  job: Job;
  level: number;
  base: BaseStats;
  weapon: Weapon;
  race?: Race;
  rank?: Rank;
  // Defense element and its level, 1 to 3
  element?: Element;
  elementLevel?: number;
  // The element of basic attacks
  attackElement?: Element;
  modifiers?: Modifier[];
  kit?: Partial<Kit>;
  x?: number;
  z?: number;
  // Mercs follow the player's toggles. Monsters follow their hunt.
  toggles?: Toggles;
  hunt?: Hunt;
  skills?: Skill[];
}

/** Belt slots each merc has. */
export const BELT_SLOTS = 3;
// Seconds between two potions.
const POTION_COOLDOWN = 1;

// A route is found again when its goal moves this far, or after this long.
const ROUTE_DRIFT = 0.75;
const ROUTE_AGE = 1;

// Buildup starts to fade this long after the last hit, then fades this fast.
const BUILDUP_HOLD = 2;
const BUILDUP_DECAY = 15;

export interface HitOptions {
  kind?: DamageKind;
  range?: Range;
  element?: Element;
  ratio?: number;
  flat?: number;
  fixed?: number;
  flags?: number;
  buildup?: Buildup[];
}

/**
 * A merc, a monster or the bearer. Its state only changes through the
 * events its methods emit, so mechanics, skills and items can answer or
 * veto each change.
 */
export default class Unit {
  readonly kind: string;
  readonly name: string;
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
  private readonly cardEffects = new Map<string, Lifecycle>();

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
  // A Hunt's quarry: the exits open once every marked monster is dead.
  // Badly hurt, it runs once to a pack still unaware, to wake it.
  marked = false;
  runningTo: { x: number; z: number } | null = null;
  ran = false;
  // A Labyrinth's monster that carries the key to its hall
  bearsKey = false;
  // Where a monster last saw whom it was after, to look for it there
  lastSeen: { x: number; z: number } | null = null;
  toggles: Toggles | undefined;
  hunt: Hunt | undefined;
  // Move speed multiplier from what the unit carries, such as the bearer's pack
  burden = 1;
  // Where the bearer was told to walk.
  order: { x: number; z: number } | null = null;
  // The path being followed around obstacles, and the goal it was found for
  private route: { x: number; z: number; at: number; points: Spot[] } | null = null;

  readonly skills: Skill[];
  // Ranks learned in skill-tree nodes, by node id
  readonly skillRanks = new Map<string, number>();
  // Passive skills in effect, by node id, so a new rank can replace the old
  readonly passives = new Map<string, Lifecycle>();
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
  private readonly buildupAt = new Map<string, number>();
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
    if (other.x !== this.x || other.z !== this.z) {
      this.angle = Math.atan2(other.z - this.z, other.x - this.x);
    }
  }

  /**
   * Whether `attacker` stands outside this unit's front arc, about 110°
   * to each side. Shields only block from the front.
   */
  isFlankedBy(attacker: Unit): boolean {
    const dx = attacker.x - this.x;
    const dz = attacker.z - this.z;
    const d = Math.hypot(dx, dz) || 1;
    return (Math.cos(this.angle) * dx + Math.sin(this.angle) * dz) / d < -0.35;
  }

  /** Walks toward a point. Returns true once it is within `stop` tiles of it. */
  walkTo(x: number, z: number, dt: number, stop = 0.05): boolean {
    const dx = x - this.x;
    const dz = z - this.z;
    const d = Math.hypot(dx, dz);
    if (d <= stop) {
      return true;
    }
    const step = Math.min(d - stop, this.speed * dt);
    this.x += (dx / d) * step;
    this.z += (dz / d) * step;
    this.angle = Math.atan2(dz, dx);
    return d - step <= stop;
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
    let speed = this.kit.moveSpeed * this.burden;
    for (const s of this.statuses.values()) {
      speed *= s.def.slow ?? 1;
    }
    return speed;
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
    const { nav } = this.sim;
    if (!nav || nav.clear(this.x, this.z, x, z)) {
      this.route = null;
      return this.walkTo(x, z, dt, stop);
    }
    let route = this.route;
    // A route is found again when the goal moves or it grows old.
    if (
      !route ||
      Math.hypot(route.x - x, route.z - z) > ROUTE_DRIFT ||
      this.sim.time - route.at > ROUTE_AGE
    ) {
      route = { x, z, at: this.sim.time, points: nav.path(this, { x, z }) };
      this.route = route;
    }
    // Skip ahead to the furthest waypoint in a straight line.
    while (
      route.points.length > 1 &&
      nav.clear(this.x, this.z, route.points[1].x, route.points[1].z)
    ) {
      route.points.shift();
    }
    const next = route.points.at(0);
    if (!next) {
      return this.walkTo(x, z, dt, stop);
    }
    if (this.walkTo(next.x, next.z, dt, 0.05)) {
      route.points.shift();
    }
    return Math.hypot(x - this.x, z - this.z) <= stop;
  }

  /** Starts a basic attack. The blow lands later, on the hit frame. */
  startAttack(target: Unit): boolean {
    if (this.busy || this.cooldown > 0 || this.kit.interval <= 0) {
      return false;
    }
    this.swing = 0;
    this.swingTarget = target;
    this.cooldown = this.kit.interval;
    this.face(target);
    return true;
  }

  /** The mana a skill costs this unit now, after passives and items. */
  skillCost(skill: Skill): number {
    const event: CheckSkillCostEvent = {
      id: 'CheckSkillCost',
      disabled: false,
      source: this,
      skill,
      value: skill.cost,
    };
    this.sim.emit(SimEvents.CheckSkillCost, event);
    return Math.max(0, Math.round(event.value));
  }

  /** Whether the unit is free, the skill is off cooldown and the mana is there. */
  canCast(skill: Skill): boolean {
    return (
      this.alive &&
      !this.busy &&
      (this.skillCooldowns.get(skill.id) ?? 0) <= 0 &&
      this.mana >= this.skillCost(skill)
    );
  }

  /** Starts a skill's windup. Returns false if it cannot be used now. */
  startCast(skill: Skill, target: Unit | null): boolean {
    if (!this.canCast(skill)) {
      return false;
    }
    const event = {
      id: 'UnitSkillWindup',
      disabled: false,
      source: this,
      skill,
      target,
    };
    this.sim.emit(SimEvents.UnitSkillWindup, event);
    return !event.disabled;
  }

  /**
   * Gives the unit a status, or refreshes it. Returns null if the unit is
   * immune or dead.
   */
  addStatus(def: StatusDef, source: Unit, duration = def.duration, power = 1): ActiveStatus | null {
    if (!this.alive || (this.immunity.get(def.id) ?? 0) > 0) {
      return null;
    }
    const check: CheckStatusDurationEvent = {
      id: 'CheckStatusDuration',
      disabled: false,
      source,
      target: this,
      status: def,
      value: duration,
    };
    this.sim.emit(SimEvents.CheckStatusDuration, check);
    if (check.disabled || check.value <= 0) {
      return null;
    }
    const current = this.statuses.get(def.id);
    if (current) {
      current.remaining = Math.max(current.remaining, check.value);
      current.source = source;
      current.power = Math.max(current.power, power);
      if (current.stacks < (def.maxStacks ?? 1)) {
        current.stacks++;
        if (def.modifiers) {
          this.recalc();
        }
      }
      return current;
    }
    const status: ActiveStatus = {
      def,
      unit: this,
      source,
      remaining: check.value,
      elapsed: 0,
      stacks: 1,
      power,
      lifecycle: null,
    };
    this.statuses.set(def.id, status);
    if (def.modifiers) {
      this.recalc();
    }
    status.lifecycle = def.setup?.(status) ?? null;
    status.lifecycle?.start();
    if (def.disables) {
      // A stunned unit loses the blow or skill it was winding up.
      this.swing = -1;
      this.swingTarget = null;
      this.cast = null;
    }
    this.sim.emit(SimEvents.StatusApplied, { id: 'StatusApplied', disabled: false, status });
    return status;
  }

  /** Ends a status early or on time. The unit is then immune to it for a while. */
  removeStatus(id: string): void {
    const status = this.statuses.get(id);
    if (!status) {
      return;
    }
    this.statuses.delete(id);
    if (status.def.modifiers) {
      this.recalc();
    }
    status.lifecycle?.stop();
    if (status.def.immunity > 0) {
      this.immunity.set(id, status.def.immunity);
    }
    this.sim.emit(SimEvents.StatusRemoved, { id: 'StatusRemoved', disabled: false, status });
  }

  /**
   * Adds buildup toward a status. When it reaches the unit's threshold the
   * status triggers and the buildup resets.
   */
  buildUp(def: StatusDef, source: Unit, amount: number): void {
    const limit = def.threshold?.(this);
    if (!this.alive || limit === undefined || (this.immunity.get(def.id) ?? 0) > 0) {
      return;
    }
    // A status in effect cannot build up again, unless it escalates.
    if (this.statuses.has(def.id) && !def.escalate) {
      return;
    }
    const check: CheckBuildupEvent = {
      id: 'CheckBuildup',
      disabled: false,
      source,
      target: this,
      status: def,
      value: amount,
    };
    this.sim.emit(SimEvents.CheckBuildup, check);
    if (check.disabled || check.value <= 0) {
      return;
    }
    const total = (this.buildup.get(def.id) ?? 0) + check.value;
    this.buildupAt.set(def.id, this.sim.time);
    if (total < limit) {
      this.buildup.set(def.id, total);
      return;
    }
    this.buildup.delete(def.id);
    if (def.escalate && this.statuses.has(def.id)) {
      this.removeStatus(def.id);
      this.addStatus(def.escalate, source);
    } else {
      this.addStatus(def, source);
    }
  }

  /** Runs statuses, immunity and buildup decay for one tick. */
  tickStatuses(dt: number): void {
    for (const [id, s] of this.statuses) {
      s.elapsed += dt;
      s.def.tick?.(s, dt);
      s.remaining -= dt;
      if (s.remaining <= 0 || (s.def.endsWithSource && !s.source.alive)) {
        this.removeStatus(id);
      }
    }
    for (const [id, left] of this.immunity) {
      if (left <= dt) {
        this.immunity.delete(id);
      } else {
        this.immunity.set(id, left - dt);
      }
    }
    for (const [id, value] of this.buildup) {
      if (this.sim.time - (this.buildupAt.get(id) ?? 0) < BUILDUP_HOLD) {
        continue;
      }
      const next = value - BUILDUP_DECAY * dt;
      if (next <= 0) {
        this.buildup.delete(id);
      } else {
        this.buildup.set(id, next);
      }
    }
  }

  /** Ends every status, as on death. No immunity follows. */
  clearStatuses(): void {
    for (const s of this.statuses.values()) {
      s.lifecycle?.stop();
    }
    this.statuses.clear();
    this.buildup.clear();
    this.immunity.clear();
    this.recalc();
  }

  /** The rank learned in a skill, or 0. Monster skills count as rank 1. */
  skillRank(id: string): number {
    return this.skillRanks.get(id) ?? (this.skills.some((s) => s.id === id) ? 1 : 0);
  }

  /** Spends a stat point on a base stat. Returns false if there is none to spend. */
  raiseStat(stat: keyof BaseStats): boolean {
    if (this.statPoints <= 0) {
      return false;
    }
    this.statPoints--;
    this.base[stat]++;
    this.recalc();
    return true;
  }

  /**
   * Drinks a potion: from a belt slot, or a given one such as the bearer's
   * from the pack. Returns false if it cannot drink now.
   */
  drink(potion: Item): boolean {
    const effect = potion.base.potion;
    if (!this.alive || !effect || this.potionCooldown > 0 || potion.quantity <= 0) {
      return false;
    }
    potion.quantity--;
    this.potionCooldown = POTION_COOLDOWN;
    if (effect.health) {
      this.addStatus(MENDING, this, undefined, effect.health);
    }
    if (effect.mana) {
      this.addStatus(REFRESHING, this, undefined, effect.mana);
    }
    // An empty stack leaves its belt slot.
    const slot = this.belt.indexOf(potion);
    if (slot >= 0 && potion.quantity <= 0) {
      this.belt[slot] = null;
    }
    return true;
  }

  /** The first potion on the belt that restores health, or mana. */
  beltPotion(kind: 'health' | 'mana'): Item | null {
    return this.belt.find((p) => p !== null && (p.base.potion?.[kind] ?? 0) > 0) ?? null;
  }

  /** Sets or clears a bonus from a passive or aura. The stats follow at once. */
  setBonus(id: string, modifiers: Modifier[] | null): void {
    if (modifiers) {
      this.bonuses.set(id, modifiers);
    } else if (!this.bonuses.delete(id)) {
      return;
    }
    this.recalc();
  }

  /**
   * Puts an item on, and returns what it replaced. The stats follow at once.
   */
  equip(slot: EquipSlot, item: Item): Item | null {
    const before = this.equipment.get(slot) ?? null;
    this.equipment.set(slot, item);
    this.recalc();
    this.refreshCards();
    return before;
  }

  /** Takes an item off, and returns it. */
  unequip(slot: EquipSlot): Item | null {
    const item = this.equipment.get(slot) ?? null;
    this.equipment.delete(slot);
    this.recalc();
    this.refreshCards();
    return item;
  }

  /**
   * Starts the effects of what the unit wears, a unique's or a socketed
   * card's, and stops those of what it no longer wears. Call it after gear
   * or sockets change.
   */
  refreshCards(): void {
    const worn = new Map<string, (unit: Unit) => Lifecycle>();
    for (const item of this.equipment.values()) {
      if (item.effect) {
        worn.set(`${item.uid}:unique`, item.effect);
      }
      item.cards.forEach((card, i) => {
        if (card.socket?.setup) {
          worn.set(`${item.uid}:${i}`, card.socket.setup);
        }
      });
    }
    for (const [key, life] of this.cardEffects) {
      if (!worn.has(key)) {
        life.stop();
        this.cardEffects.delete(key);
      }
    }
    for (const [key, setup] of worn) {
      if (!this.cardEffects.has(key)) {
        const life = setup(this);
        this.cardEffects.set(key, life);
        life.start();
      }
    }
  }

  /**
   * Computes the stats again from their inputs. Call it after any input
   * changes: level, raised stats, gear or a bonus starting or ending.
   */
  recalc(): void {
    const held = this.equipment.get(EquipSlot.Weapon);
    const fromItems = [...this.equipment.values()].flatMap(itemModifiers);
    const fromStatuses = [...this.statuses.values()].flatMap((st) => st.def.modifiers?.(st) ?? []);
    this.stats = deriveStats({
      job: this.job,
      level: this.level,
      base: this.base,
      weapon: (held && weaponOf(held)) ?? this.weapon,
      modifiers: [
        ...this.modifiers,
        ...fromItems,
        ...fromStatuses,
        ...[...this.bonuses.values()].flat(),
      ],
    });
    this.hp = Math.min(this.hp, this.derived.maxHp);
    this.mana = Math.min(this.mana, this.derived.maxMana);
  }

  /**
   * One hit on `target`. Physical hits roll to hit first. Returns the
   * damage event, or null on a miss.
   */
  hit(target: Unit, options: HitOptions = {}): UnitDamageEvent | null {
    const kind = options.kind ?? DamageKind.Physical;
    const range = options.range ?? this.job.range;
    let flags = options.flags ?? 0;

    if (kind === DamageKind.Physical) {
      const check: CheckHitEvent = {
        id: 'CheckHit',
        disabled: false,
        source: this,
        target,
        range,
        flags,
        critRate: 0,
        hitChance: 0,
        critical: false,
        hit: false,
      };
      this.sim.emit(SimEvents.CheckHit, check);
      if (!check.hit) {
        this.sim.emit(SimEvents.UnitMiss, {
          id: 'UnitMiss',
          disabled: false,
          source: this,
          target,
          flags,
        });
        return null;
      }
      if (check.critical) {
        flags |= DamageFlags.Critical;
      }
    }

    const event: UnitDamageEvent = {
      id: 'UnitDamage',
      disabled: false,
      source: this,
      target,
      kind,
      range,
      element: options.element ?? this.attackElement,
      ratio: options.ratio ?? 100,
      flat: options.flat ?? 0,
      fixed: options.fixed,
      flags,
      buildup: options.buildup ?? [],
      value: 0,
    };
    this.sim.emit(SimEvents.UnitDamage, event);
    return event;
  }

  heal(target: Unit, value: number, flags = 0): UnitHealEvent {
    const event: UnitHealEvent = {
      id: 'UnitHeal',
      disabled: false,
      source: this,
      target,
      flags,
      value,
    };
    this.sim.emit(SimEvents.UnitHeal, event);
    return event;
  }

  /**
   * Brings a dead unit back from its corpse with a share of its health.
   * A torn body cannot come back. Returns whether it did.
   */
  revive(share: number): boolean {
    if (this.alive || this.torn) {
      return false;
    }
    this.alive = true;
    this.lastBlow = null;
    this.hp = Math.max(1, Math.floor(this.derived.maxHp * share));
    this.target = null;
    this.sim.emit(SimEvents.UnitRevived, { id: 'UnitRevived', disabled: false, source: this });
    return true;
  }

  die(killer: Unit | null): void {
    this.sim.emit(SimEvents.UnitDies, { id: 'UnitDies', disabled: false, source: this, killer });
  }
}
