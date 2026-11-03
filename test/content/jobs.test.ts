import { describe, expect, it } from 'vitest';
import { BASE_BY_ID } from '../../src/content/items';
import { JOBS, JOB_KINDS, isJobKind } from '../../src/content/jobs';
import { FIGHTERS, HIREABLE, rollStartingOffers } from '../../src/content/recruits';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { RunStreams, Stream } from '../../src/core/seed';
import { LOOKS } from '../../src/render/looks';
import { buildFor, isBuilt, upgradeById } from '../../src/sim/builds';
import Sim from '../../src/sim/sim';

describe('the job registry', () => {
  it('registers the seven starting jobs, each under its own kind', () => {
    expect(JOB_KINDS).toEqual([
      'vanguard',
      'ranger',
      'cleric',
      'sellsword',
      'warden',
      'duelist',
      'arcanist',
    ]);
    for (const kind of JOB_KINDS) {
      expect(JOBS[kind].kind).toBe(kind);
      expect(isJobKind(kind)).toBe(true);
    }
    expect(isJobKind('bearer')).toBe(false);
  });

  it('gives every job 4 spells, an innate and 12 upgrades, 3 for each spell', () => {
    for (const kind of JOB_KINDS) {
      const def = JOBS[kind];
      const spells = def.spells.map((s) => s.id);
      expect(new Set(spells).size, kind).toBe(4);
      expect(def.innate.name, kind).not.toBe('');
      expect(def.innate.describe(), kind).not.toBe('');
      expect(def.upgrades, kind).toHaveLength(12);
      for (const spell of spells) {
        expect(
          def.upgrades.filter((u) => u.spell === spell),
          `${kind} ${spell}`,
        ).toHaveLength(3);
      }
      expect(buildFor(kind)?.spells.map((s) => s.id)).toEqual(spells);
      // Its own icons are only for its own spells.
      for (const id of Object.keys(def.icons)) {
        expect(spells, `${kind} icon ${id}`).toContain(id);
      }
    }
  });

  it('finds every upgrade by its id, and offers none that only describes itself', () => {
    const ids = new Set<string>();
    for (const kind of JOB_KINDS) {
      for (const upgrade of JOBS[kind].upgrades) {
        expect(ids.has(upgrade.id), upgrade.id).toBe(false);
        ids.add(upgrade.id);
        expect(upgradeById(upgrade.id)).toBe(upgrade);
        expect(upgrade.describe(1)).not.toBe('');
      }
    }
    expect(ids.size).toBe(84);
    // Each upgrade node adds the line for its job when it builds the 12.
    for (const upgrade of JOBS.arcanist.upgrades) {
      expect(isBuilt(upgrade), upgrade.id).toBe(true);
    }
  });

  it('gives every job a look, and starter gear that resolves to bases it may wear', () => {
    for (const kind of JOB_KINDS) {
      const def = JOBS[kind];
      expect(LOOKS[kind], kind).toBeDefined();
      for (const id of def.starterGear) {
        const base = BASE_BY_ID.get(id);
        expect(base, `${kind} ${id}`).toBeDefined();
        expect(base!.jobs ?? [def.template.job.name], `${kind} ${id}`).toContain(
          def.template.job.name,
        );
      }
      for (const [id] of def.starterBelt) {
        expect(BASE_BY_ID.get(id), `${kind} ${id}`).toBeDefined();
      }
    }
  });

  it('offers only the hireable jobs at the Guild House', () => {
    const hireable = JOB_KINDS.filter((k) => JOBS[k].hireable);
    expect(HIREABLE).toEqual(hireable);
    expect(FIGHTERS).toEqual(hireable.filter((k) => JOBS[k].fighter));
    for (const seed of ['ASHEN', 'BRINE', 'COAL', 'DUSK', 'EMBER', 'WRIT']) {
      for (const offer of rollStartingOffers(new RunStreams(seed).get(1, Stream.Recruits), 5)) {
        expect(JOBS[offer.kind].hireable).toBe(true);
      }
    }
  });
});

describe('every job', () => {
  it('spawns knowing its 4 spells at rank 1 and its innate, wearing its gear', () => {
    for (const kind of JOB_KINDS) {
      const def = JOBS[kind];
      const m = spawnMerc(new Sim(1), kind, 5, 0, 0);
      expect(m.job.name).toBe(def.template.job.name);
      expect(m.skills.map((s) => s.id)).toEqual(def.spells.map((s) => s.id));
      expect(m.spells.map((s) => m.skillRank(s.id))).toEqual([1, 1, 1, 1]);
      expect(m.shards).toBe(4);
      expect(m.passives.has(def.innate.effect.id), kind).toBe(true);
      expect(m.equipment.size, kind).toBe(def.starterGear.length);
      expect(m.discipline).toBe(def.discipline + 5);
    }
  });

  it('fights in a headless fight, the placeholders with their basic attacks', () => {
    for (const kind of JOB_KINDS) {
      const sim = new Sim(1);
      spawnBearer(sim, 0, 0);
      const m = spawnMerc(sim, kind, 5, 1, 0);
      const husk = spawnMonster(sim, 'husk', 3, 4, 0);
      husk.aware = true;
      sim.run(60, () => !husk.alive || !m.alive);
      expect(husk.alive, kind).toBe(false);
      expect(m.alive, kind).toBe(true);
    }
  });
});
