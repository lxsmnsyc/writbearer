import { describe, expect, it } from 'vitest';
import { EventPriority } from '../../src/core/event-emitter';
import { JOBS, JOB_KINDS, type JobKind } from '../../src/content/jobs';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { DEFAULT_TOGGLES } from '../../src/sim/ai';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { SkillMode } from '../../src/sim/skill';
import { DamagePriority, HealPriority, Side } from '../../src/sim/types';
import spendAll, { withUpgrade } from '../support/build';

// What a job's spells add over its basic attacks (docs/design/16-builds.md,
// "Clearing groups"). A level 10 merc beside the bearer fights a pack of 4
// level 6 monsters twice, with its spells and with basic attacks only. The
// bearer stands still. Neither it nor the merc can die, so every fight runs
// to the last kill.

const LEVEL = 10;
const PACK_LEVEL = 6;
// Two Crawlers go for whoever is nearest, two Hollowed run for the bearer.
const PACK = ['crawler', 'crawler', 'hollowed', 'hollowed'] as const;
const LIMIT = 180;
const SEEDS = [1, 2, 3, 4];

interface Fight {
  // Seconds to the last kill, LIMIT if the pack outlasts it
  time: number;
  // Damage the bearer took, and that less what healed it
  taken: number;
  lost: number;
}

function fight(seed: number, kind: JobKind, spells: boolean, upgrade?: string): Fight {
  const sim = new Sim(seed);
  sim.setFloor(30, 20);
  const bearer = spawnBearer(sim, 6, 10);
  const skills: Record<string, SkillMode> = {};
  if (!spells) {
    for (const spell of JOBS[kind].spells) {
      skills[spell.id] = SkillMode.Off;
    }
  }
  const merc = spawnMerc(sim, kind, LEVEL, 7, 10, { ...DEFAULT_TOGGLES, skills });
  spendAll(merc);
  if (upgrade) {
    withUpgrade(
      merc,
      JOBS[kind].upgrades.find((u) => u.id === upgrade)!,
    );
  }
  const pack = [0, 1, 2, 3].map((i) => {
    const m = spawnMonster(sim, PACK[i], PACK_LEVEL, 15 + (i % 2), 8.5 + i);
    m.aware = true;
    return m;
  });
  // The bearer and the merc are spared death, so a fight is always timed
  // to its last kill.
  sim.on(SimEvents.UnitDies, EventPriority.Pre, (event) => {
    if (event.source === bearer || event.source === merc) {
      event.disabled = true;
      event.source.hp = 1;
    }
  });
  let taken = 0;
  let healed = 0;
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (event.target === bearer) {
      taken += event.value;
    }
  });
  sim.on(SimEvents.UnitHeal, HealPriority.Post, (event) => {
    if (event.target === bearer) {
      healed += event.value;
    }
  });
  let t = 0;
  for (; t < LIMIT && pack.some((m) => m.alive) && merc.alive; t += 0.05) {
    bearer.order = { x: 6, z: 10 };
    sim.tick();
  }
  if (sim.living(Side.Monster).length > 0) {
    t = LIMIT;
  }
  return { time: t, taken, lost: taken - healed };
}

// The mean over the seeds
function measure(kind: JobKind, spells: boolean, upgrade?: string): Fight {
  const sum = { time: 0, taken: 0, lost: 0 };
  for (const seed of SEEDS) {
    const f = fight(seed, kind, spells, upgrade);
    sum.time += f.time / SEEDS.length;
    sum.taken += f.taken / SEEDS.length;
    sum.lost += f.lost / SEEDS.length;
  }
  return sum;
}

// `SPELL_IMPACT=1 pnpm vitest run test/sim/spell-impact.test.ts` prints the table.
function report(line: string): void {
  if (process.env.SPELL_IMPACT) {
    process.stdout.write(`${line}\n`);
  }
}

const round = (f: Fight): string =>
  `${f.time.toFixed(1)} s, bearer lost ${Math.round(f.lost)} (took ${Math.round(f.taken)})`;

describe('spell impact', () => {
  const results = new Map<JobKind, { spells: Fight; basic: Fight }>();
  for (const kind of JOB_KINDS) {
    results.set(kind, { spells: measure(kind, true), basic: measure(kind, false) });
  }
  for (const [kind, r] of results) {
    const speed = (r.basic.time / r.spells.time).toFixed(2);
    report(`impact ${kind}: spells ${round(r.spells)}; basic ${round(r.basic)}; x${speed}`);
  }

  it('lets the Arcanist and the Ranger clear a pack at least 1.5 times as fast', () => {
    for (const kind of ['arcanist', 'ranger'] as const) {
      const r = results.get(kind)!;
      expect(r.basic.time / r.spells.time, kind).toBeGreaterThanOrEqual(1.5);
    }
  });

  it("shortens every job's fight, or spares the bearer", () => {
    for (const [kind, r] of results) {
      const faster = r.spells.time < r.basic.time;
      const safer = r.spells.lost < r.basic.lost;
      expect(faster || safer, kind).toBe(true);
    }
  });

  it('spares the bearer with the guards and the Cleric', () => {
    for (const kind of ['vanguard', 'warden', 'cleric'] as const) {
      const r = results.get(kind)!;
      expect(r.spells.lost, kind).toBeLessThan(r.basic.lost);
    }
  });

  it('clears faster with the pack upgrade of the Duelist (Whirlwind) and the Warden (Trap Field)', () => {
    for (const [kind, upgrade] of [
      ['duelist', 'whirlwind'],
      ['warden', 'trapField'],
    ] as const) {
      const up = measure(kind, true, upgrade);
      const r = results.get(kind)!;
      report(`impact ${kind} + ${upgrade}: ${round(up)}`);
      expect(up.time, kind).toBeLessThan(r.basic.time);
    }
  });
});
