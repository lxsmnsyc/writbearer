import type { Hunt, Toggles } from './ai';
import { type CheckHitEvent, SimEvents, type UnitDamageEvent, type UnitHealEvent } from './events';
import type Sim from './sim';
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
}

const DEFAULT_KIT: Kit = { reach: 1, interval: 1, hitAt: 0.5, moveSpeed: 2.5, sight: 7 };

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
}

export interface HitOptions {
  kind?: DamageKind;
  range?: Range;
  element?: Element;
  ratio?: number;
  flat?: number;
  fixed?: number;
  flags?: number;
}

/**
 * A merc, a monster or the bearer. Its state only changes through the
 * events its methods emit, so mechanics, skills and items can answer or
 * veto each change.
 */
export default class Unit {
  readonly kind: string;
  readonly name: string;
  readonly side: Side;
  readonly job: Job;
  level: number;
  base: BaseStats;
  weapon: Weapon;
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
  toggles: Toggles | undefined;
  hunt: Hunt | undefined;
  // Where the bearer was told to walk.
  order: { x: number; z: number } | null = null;

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
    const step = Math.min(d - stop, this.kit.moveSpeed * dt);
    this.x += (dx / d) * step;
    this.z += (dz / d) * step;
    this.angle = Math.atan2(dz, dx);
    return d - step <= stop;
  }

  /** Starts a basic attack. The blow lands later, on the hit frame. */
  startAttack(target: Unit): boolean {
    if (this.swing >= 0 || this.cooldown > 0 || this.kit.interval <= 0) {
      return false;
    }
    this.swing = 0;
    this.swingTarget = target;
    this.cooldown = this.kit.interval;
    this.face(target);
    return true;
  }

  /**
   * Computes the stats again from their inputs. Call it after any input
   * changes: level, raised stats, gear or a bonus starting or ending.
   */
  recalc(): void {
    this.stats = deriveStats({
      job: this.job,
      level: this.level,
      base: this.base,
      weapon: this.weapon,
      modifiers: this.modifiers,
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

  die(killer: Unit | null): void {
    this.sim.emit(SimEvents.UnitDies, { id: 'UnitDies', disabled: false, source: this, killer });
  }
}
