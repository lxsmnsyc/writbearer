import { describe, expect, it } from 'vitest';
import RNG from '../../src/core/rng';
import ObjectiveRun, { WAVE_WARNING } from '../../src/game/objective';
import { enterStage, spawnParty } from '../../src/game/stage';
import { generateLayerMap } from '../../src/gen/graph';
import { type Stage, THREAT, generateStage, navFor, openGate } from '../../src/gen/stage';
import Hazards from '../../src/game/hazards';
import { spawnMonster } from '../../src/content/roster';
import { updateWarnings, warn } from '../../src/sim/warning';
import Sim from '../../src/sim/sim';
import { DamageKind, Side } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const killAll = (units: Unit[]): void => {
  for (const u of units) {
    if (u.alive) {
      u.hit(u, { kind: DamageKind.True, fixed: 1e6 });
    }
  }
};

describe('objectives on the map', () => {
  it('give every fight one, and open the run on a Hunt', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const { columns } = generateLayerMap(new RNG(seed), 1);
      expect(columns[0][0].objective).toBe('hunt');
      for (const node of columns.flat()) {
        const fight = node.kind === 'combat' || node.kind === 'elite';
        expect(node.objective !== undefined).toBe(fight);
        if (node.objective) {
          seen.add(node.objective);
        }
      }
    }
    expect([...seen].sort((a, b) => a.localeCompare(b))).toEqual([
      'ambush',
      'escort',
      'horde',
      'hunt',
      'maze',
      'vault',
    ]);
  });

  it('show on the signposts of the roads to them', () => {
    const stage = generateStage(new RNG(1), 2, {
      kind: 'combat',
      ahead: ['combat', 'elite'],
      aheadFights: [
        { objective: 'horde', reward: 'gold' },
        { objective: 'hunt', reward: 'respite' },
      ],
    });
    expect(stage.exits.map((e) => e.objective)).toEqual(['horde', 'hunt']);
    expect(stage.exits.map((e) => e.reward)).toEqual(['gold', 'respite']);
  });
});

describe('a Hunt', () => {
  it('marks 3 monsters, 4 in an Elite area, and is done once they are dead', () => {
    for (const [kind, want] of [
      ['combat', 3],
      ['elite', 4],
    ] as const) {
      const stage = generateStage(new RNG(7), 4, { kind, ahead: ['combat'], objective: 'hunt' });
      expect(stage.packs.filter((p) => p.marked !== undefined)).toHaveLength(want);
      const sim = new Sim(1);
      spawnParty(sim, stage, ['vanguard']);
      enterStage(sim, stage);
      const marked = [...sim.units].filter((u) => u.marked);
      expect(marked).toHaveLength(want);
      const run = new ObjectiveRun('hunt', stage);
      expect(run.update(sim, 0.05, 6)).toBe(false);
      expect(run.status(sim)).toBe(`Slay the marked: 0 of ${want}`);
      killAll(marked.slice(1));
      expect(run.update(sim, 0.05, 6)).toBe(false);
      killAll(marked);
      expect(run.update(sim, 0.05, 6)).toBe(true);
      expect(run.done).toBe(true);
      expect(stage.reward).toBeDefined();
    }
  });

  it('marks a quarry that runs, badly hurt, to wake the nearest pack', () => {
    const sim = new Sim(1);
    sim.setFloor(40, 20);
    const quarry = spawnMonster(sim, 'hollowSoldier', 4, 5, 10);
    quarry.marked = true;
    quarry.aware = true;
    const near = spawnMonster(sim, 'husk', 4, 20, 10);
    const far = spawnMonster(sim, 'husk', 4, 36, 10);
    quarry.hp = Math.floor(quarry.derived.maxHp * 0.4);
    sim.run(20, () => near.aware);
    expect(near.aware).toBe(true);
    expect(far.aware).toBe(false);
    expect(quarry.runningTo).toBeNull();
  });
});

describe('a Horde', () => {
  it('waits for the bearer to move on, then sends rising waves until all are beaten', () => {
    const stage = generateStage(new RNG(3), 5, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'horde',
    });
    expect(stage.packs).toHaveLength(0);
    const waves = stage.waves!;
    expect(waves).toHaveLength(4);
    const threat = (kinds: readonly (keyof typeof THREAT)[]): number =>
      kinds.reduce((n, k) => n + THREAT[k], 0);
    expect(threat(waves.at(-1)!.kinds)).toBeGreaterThanOrEqual(threat(waves[0].kinds));
    const sim = new Sim(1);
    const bearer = spawnParty(sim, stage, ['vanguard']);
    enterStage(sim, stage);
    const run = new ObjectiveRun('horde', stage);
    const monsters = (): Unit[] => sim.living(Side.Monster);
    for (let i = 0; i < 200; i++) {
      run.update(sim, 0.05, 7);
      updateWarnings(sim, 0.05);
    }
    expect(monsters()).toHaveLength(0);
    bearer.x += 8;
    let beaten = 0;
    for (let t = 0; t < 2000 && !run.done; t++) {
      run.update(sim, 0.05, 7);
      updateWarnings(sim, 0.05);
      if (monsters().length > 0) {
        expect(monsters().every((m) => m.aware)).toBe(true);
        killAll(monsters());
        beaten++;
      }
    }
    expect(run.done).toBe(true);
    expect(beaten).toBe(4);
  });

  it('sends the next wave when its time is up, even with the last one standing', () => {
    const stage = generateStage(new RNG(3), 5, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'horde',
    });
    const sim = new Sim(1);
    const bearer = spawnParty(sim, stage, ['vanguard']);
    const run = new ObjectiveRun('horde', stage);
    bearer.x += 8;
    for (let t = 0; t < 20 * 25; t++) {
      run.update(sim, 0.05, 7);
      updateWarnings(sim, 0.05);
    }
    const waves = stage.waves!;
    expect(sim.living(Side.Monster)).toHaveLength(waves[0].kinds.length + waves[1].kinds.length);
    expect(run.status(sim)).toMatch(/^Wave 2 of 4/);
  });

  it('shows where each wave comes on the ground first, and what it is in the badge', () => {
    const stage = generateStage(new RNG(3), 5, {
      kind: 'combat',
      ahead: ['combat'],
      objective: 'horde',
    });
    const sim = new Sim(1);
    const bearer = spawnParty(sim, stage, ['vanguard']);
    const run = new ObjectiveRun('horde', stage);
    const first = stage.waves![0];
    expect(run.coming()).toEqual(first.kinds);
    bearer.x += 8;
    let warnedAt = -1;
    let cameAt = -1;
    for (let t = 0; t < 60 * 20 && cameAt < 0; t++) {
      run.update(sim, 0.05, 7);
      updateWarnings(sim, 0.05);
      if (warnedAt < 0 && sim.warnings.length > 0) {
        warnedAt = t;
        expect(sim.warnings[0]).toMatchObject({ x: first.from.x, z: first.from.z });
        expect(sim.living(Side.Monster)).toHaveLength(0);
      }
      if (sim.living(Side.Monster).length > 0) {
        cameAt = t;
      }
    }
    expect(warnedAt).toBeGreaterThanOrEqual(0);
    expect((cameAt - warnedAt) * 0.05).toBeCloseTo(WAVE_WARNING, 1);
    expect(bearer.hp).toBe(bearer.derived.maxHp);
    expect(run.coming()).toEqual(stage.waves![1].kinds);
  });
});

describe('a Labyrinth', () => {
  const maze = (seed: number, kind: 'combat' | 'elite' = 'combat'): Stage =>
    generateStage(new RNG(seed), 5, { kind, ahead: ['combat', 'camp'], objective: 'maze' });

  it('is a maze of walls with a way through to the hall, traps and packs in dead ends', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const stage = maze(seed);
      expect(stage.props.filter((p) => p.kind === 'wall').length).toBeGreaterThan(150);
      expect(stage.hazards!.length).toBeGreaterThanOrEqual(10);
      expect(stage.packs.length).toBeGreaterThan(0);
      // Shut, the gates keep the party from the hall, but not from the levers.
      const shut = navFor(stage);
      for (const e of stage.exits) {
        const end = shut.path(stage.entrance, e).at(-1);
        expect(end === undefined || Math.hypot(end.x - e.x, end.z - e.z) > 1).toBe(true);
      }
      const levers = stage.gates!.filter((g) => g.lever);
      expect(levers.length).toBeGreaterThan(0);
      for (const g of levers) {
        const end = shut.path(stage.entrance, g.lever!).at(-1)!;
        expect(Math.hypot(end.x - g.lever!.x, end.z - g.lever!.z)).toBeLessThan(1.5);
      }
      expect(stage.packs.filter((p) => p.key !== undefined)).toHaveLength(1);
      // Even with every floor fallen in, the way through stays once the gates open.
      for (const h of stage.hazards!.filter((x) => x.kind === 'floor')) {
        stage.props.push({ kind: 'pit', x: h.x, z: h.z, r: 1, seed: 0 });
      }
      for (const g of stage.gates!) {
        openGate(g);
      }
      const nav = navFor(stage);
      for (const e of stage.exits) {
        const end = nav.path(stage.entrance, e).at(-1)!;
        expect(Math.hypot(end.x - e.x, end.z - e.z)).toBeLessThan(1);
      }
      for (const p of stage.packs) {
        const end = nav.path(stage.entrance, p).at(-1)!;
        expect(Math.hypot(end.x - p.x, end.z - p.z)).toBeLessThan(1);
      }
    }
  });

  it('is done once the bearer reaches the hall', () => {
    const stage = maze(2);
    const sim = new Sim(1);
    const bearer = spawnParty(sim, stage, []);
    const run = new ObjectiveRun('maze', stage);
    expect(run.update(sim, 0.05, 7)).toBe(false);
    bearer.x = stage.goal!.x0 + 0.5;
    expect(run.update(sim, 0.05, 7)).toBe(true);
  });

  it('springs its traps on their beat: a warning first, then a blow to all on it', () => {
    const stage = maze(3);
    const spikes = stage.hazards!.find((h) => h.kind === 'spikes')!;
    stage.hazards = [{ ...spikes, phase: 0 }];
    const sim = new Sim(1);
    const bearer = spawnParty(sim, stage, []);
    bearer.x = spikes.x;
    bearer.z = spikes.z;
    const mite = spawnMonster(sim, 'mite', 3, spikes.x + 0.5, spikes.z);
    const traps = new Hazards(stage);
    const hp = bearer.hp;
    for (let t = 0; t < 61 && sim.warnings.length === 0; t++) {
      traps.update(sim, 0.05);
    }
    expect(sim.warnings).toHaveLength(1);
    expect(bearer.hp).toBe(hp);
    for (let t = 0; t < 20; t++) {
      updateWarnings(sim, 0.05);
    }
    expect(sim.warnings).toHaveLength(0);
    expect(bearer.hp).toBe(hp - Math.round(bearer.derived.maxHp * 0.12));
    expect(mite.hp).toBeLessThan(mite.derived.maxHp);
  });
});

describe('a deep Labyrinth', () => {
  const deep = (seed: number): Stage =>
    generateStage(new RNG(seed), 12, { kind: 'combat', ahead: ['combat'], objective: 'maze' });

  it('holds the new traps, and two gates with levers', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const stage = deep(seed);
      for (const h of stage.hazards!) {
        kinds.add(h.kind);
      }
      expect(stage.gates!.filter((g) => g.lever).length).toBeLessThanOrEqual(2);
    }
    expect([...kinds].sort((a, b) => a.localeCompare(b))).toEqual([
      'arrows',
      'blade',
      'floor',
      'spikes',
      'vent',
    ]);
  });

  it('fires its arrows down the corridor, and swings its blade side to side', () => {
    const stage = deep(1);
    const arrows = { kind: 'arrows', x: 10, z: 10, period: 4, phase: 0, axis: 'x' } as const;
    const blade = { kind: 'blade', x: 30, z: 10, period: 2, phase: 0, axis: 'x' } as const;
    stage.hazards = [arrows, blade];
    const sim = new Sim(1);
    const traps = new Hazards(stage);
    traps.update(sim, 4.01);
    const shapes = sim.warnings.map((w) => w.shape);
    expect(shapes[0]).toMatchObject({ kind: 'line', z2: 10 });
    expect(sim.warnings[0].z).toBe(10);
    // The blade runs across the corridor, off to one side of the middle.
    expect(sim.warnings[1].x).not.toBe(30);
    expect(shapes[1].kind === 'line' && shapes[1].x2).toBe(sim.warnings[1].x);
  });

  it('drops a floor under the party, which stays a pit', () => {
    const stage = deep(1);
    stage.hazards = [{ kind: 'floor', x: 10, z: 10, period: 0, phase: 0 }];
    const sim = new Sim(1);
    const bearer = spawnParty(sim, stage, []);
    const pits: unknown[] = [];
    const traps = new Hazards(stage, (h) => {
      pits.push(h);
    });
    bearer.x = 30;
    traps.update(sim, 0.05);
    expect(sim.warnings).toHaveLength(0);
    bearer.x = 10;
    bearer.z = 10;
    traps.update(sim, 0.05);
    expect(sim.warnings).toHaveLength(1);
    const hp = bearer.hp;
    sim.run(1);
    expect(bearer.hp).toBeLessThan(hp);
    expect(pits).toHaveLength(1);
    traps.update(sim, 0.05);
    expect(sim.warnings).toHaveLength(0);
  });

  it('keeps the hall locked until the key is taken', () => {
    const stage = deep(2);
    const run = new ObjectiveRun('maze', stage);
    const sim = new Sim(1);
    expect(run.status(sim)).toMatch(/locked/);
    for (const g of stage.gates!.filter((x) => !x.lever)) {
      expect(openGate(g).length).toBeGreaterThan(0);
    }
    expect(run.status(sim)).toMatch(/far end/);
  });
});

describe('a warning on the ground', () => {
  it('strikes only what is inside its shape, and lifts if its source dies', () => {
    const sim = new Sim(1);
    const a = spawnMonster(sim, 'mite', 3, 5, 0);
    const b = spawnMonster(sim, 'mite', 3, 0, 5);
    const struck: Unit[] = [];
    const base = {
      x: 0,
      z: 0,
      windup: 0.1,
      spare: null,
      source: null,
      strike: (u: Unit) => struck.push(u),
    };
    warn(sim, { ...base, shape: { kind: 'cone', angle: 0, spread: 1, r: 6 } });
    warn(sim, { ...base, shape: { kind: 'line', x2: 0, z2: 8, width: 1 } });
    updateWarnings(sim, 0.2);
    expect(struck).toEqual([a, b]);
    const boss = spawnMonster(sim, 'husk', 3, 0, 0);
    struck.length = 0;
    warn(sim, { ...base, source: boss, shape: { kind: 'circle', r: 10 } });
    boss.alive = false;
    updateWarnings(sim, 0.2);
    expect(struck).toEqual([]);
  });
});
