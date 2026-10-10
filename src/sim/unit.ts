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

export interface UnitSpec {
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

  constructor(
    readonly sim: Sim,
    spec: UnitSpec,
  ) {
    this.name = spec.name;
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
    this.recalc();
    this.hp = this.derived.maxHp;
    this.mana = this.derived.maxMana;
  }

  get derived(): Derived {
    return this.stats.derived;
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
