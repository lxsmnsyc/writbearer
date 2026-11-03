// A fight area's objective, its bonus challenge, the level director's view
// of it, and what wakes or joins the fight as it goes.
import { TICK } from '../../sim/sim';
import { Side } from '../../sim/types';
import type { Item } from '../../sim/item';
import { type Stage, monsterLevel } from '../../gen/stage';
import {
  CHALLENGE_NAME,
  MUTATOR_NAME,
  MUTATOR_TEXT,
  OBJECTIVE_NAME,
  type Objective,
  REWARD_NAME,
} from '../../gen/graph';
import { MINI_BOSSES } from '../../content/minibosses';
import { MONSTERS } from '../../content/roster';
import { type BonusState, SWIFT_TIME } from '../bonus';
import { type AreaScore, PHASE_NAME, type Phase } from '../director';
import type GameState from './state';
import type { BonusStatus, ComingGroup } from './types';
import { BONUS_PAYS, REWARDS, layChest } from './rewards';
import { here } from './route';

// An objective's usual time, against its Swift bonus's, for the director;
// and how many levels above the depth's monsters mercs are expected to be
const USUAL_PER_SWIFT = 1.2;
const LEVEL_LEAD = 3;
// How many of an area's key points are of a kind
const spotsOf = (stage: Stage, kind: 'spawn' | 'boss' | 'relief'): number =>
  (stage.spots ?? []).filter((s) => s.kind === kind).length;

/** What this area asks of the party, and how far along it is, for the HUD. */
export function objectiveStatus(g: GameState): {
  kind: Objective;
  title: string;
  detail: string;
  done: boolean;
  bonus: BonusStatus | null;
  coming: ComingGroup[];
  mutators: { name: string; text: string }[];
} | null {
  const o = g.objective;
  // An Ambush that has not sprung shows nothing: it is a Camp, as far as
  // anyone can tell.
  if (!o || o.hidden()) {
    return null;
  }
  const elite = g.stage.kind === 'elite' ? 'Elite ' : '';
  const title = `${elite}${OBJECTIVE_NAME[o.kind]}`;
  const b = g.bonus;
  let bonus: BonusStatus | null = null;
  if (b) {
    let state: BonusState = b.state;
    let detail = b.status(g.sim);
    if (g.bonusMet !== null) {
      state = g.bonusMet ? 'met' : 'failed';
      detail = g.bonusMet ? `Met. ${BONUS_PAYS[g.prize ?? 'gold']}` : 'Failed.';
    }
    bonus = { title: CHALLENGE_NAME[b.kind], detail, state };
  }
  // A Horde's next wave, by kind, for the badge
  const coming: ComingGroup[] = [];
  for (const kind of o.coming()) {
    const group = coming.find((c) => c.kind === kind);
    if (group) {
      group.count++;
    } else {
      coming.push({ kind, name: MONSTERS[kind].job.name, count: 1 });
    }
  }
  const mutators = (here(g)?.mutators ?? []).map((m) => ({
    name: MUTATOR_NAME[m],
    text: MUTATOR_TEXT[m],
  }));
  return {
    kind: o.kind,
    title,
    detail: o.status(g.sim),
    done: o.done,
    bonus,
    coming,
    mutators,
  };
}

// Whether the exits are open: once the objective is done, if there is one,
// and out of the Guild House once a fighter has been hired.
export function exitsOpen(g: GameState): boolean {
  if (g.stage.kind === 'guild') {
    return g.hasFighter;
  }
  return g.objective?.done ?? true;
}

// Finishes the objective once its condition is met: the exits open, and
// its spoils appear before them.
export function checkObjective(g: GameState): void {
  const o = g.objective;
  if (o && !o.done) {
    g.bonus?.tick(TICK);
  }
  const hidden = o?.hidden() === true;
  const done = o?.update(g.sim, TICK, monsterLevel(g.stageIndex), g.director) === true;
  if (hidden && !o.hidden()) {
    g.shake = Math.max(g.shake, 3);
    g.say('It was no camp. They close in from every side!');
  }
  if (!o || !g.bearer.alive || !done) {
    return;
  }
  g.views.snap(g.sim);
  if (o.failed) {
    // A failed Escort opens the way on, and pays nothing.
    g.bonusMet = g.bonus ? false : null;
    reportArea(g, o.kind, false);
    g.say('Too many refugees were lost. The way on is open, but nothing is owed.');
    return;
  }
  if (o.kind === 'escort') {
    g.say('The refugees go on their way, thankful.');
  }
  const better = g.bonus?.met(g.sim) ?? false;
  g.bonusMet = g.bonus ? better : null;
  reportArea(g, o.kind, g.bonusMet);
  const chest = g.prize ? `the ${REWARD_NAME[g.prize]} chest` : 'the spoils';
  g.say(`${OBJECTIVE_NAME[o.kind]} done. The way on is open, and ${chest} lies before it.`);
  if (g.prize) {
    REWARDS[g.prize].done?.(g, better);
  }
  if (g.bonus) {
    const name = CHALLENGE_NAME[g.bonus.kind];
    g.say(better ? `${name}: met. The reward is better for it.` : `${name}: failed.`);
  }
  layChest(g, o.kind, better);
}

// Horn-Bearers run for their posts; a horn blown calls a fresh pack.
export function soundAlarms(g: GameState): void {
  const blown = g.alarms.update(
    g.sim,
    TICK,
    monsterLevel(g.stageIndex),
    g.stage.hornPack,
    g.director,
  );
  if (blown > 0) {
    g.bonus?.blown();
    g.shake = Math.max(g.shake, 2);
    g.say('A horn sounds. A fresh pack marches in.');
  }
}

// After a hard stretch, the director may grow a blossom out of sight.
export function relieve(g: GameState): void {
  const at = g.director.takeRelief();
  if (at) {
    g.stage.props.push({ kind: 'blossom', x: at.x, z: at.z, seed: 0.5 });
  }
}

// Tells the director how the area went, once its objective is done.
function reportArea(g: GameState, kind: Objective, bonus: boolean | null): void {
  const party = g.sim.living(Side.Party);
  const hp = party.reduce((n, u) => n + u.hp, 0);
  const max = party.reduce((n, u) => n + u.derived.maxHp, 0);
  const potion = (i: Item | null): number => (i?.base.potion ? i.quantity : 0);
  const potions =
    g.pack.items.reduce((n, i) => n + potion(i), 0) +
    g.mercs().reduce((n, m) => n + m.belt.reduce((k, i) => k + potion(i), 0), 0);
  const mercs = g.mercs().filter((m) => m.alive);
  const level = mercs.reduce((n, m) => n + m.level, 0) / Math.max(1, mercs.length);
  g.director.endArea({
    health: max > 0 ? hp / max : 0,
    potions,
    usual: SWIFT_TIME[kind] * USUAL_PER_SWIFT,
    bonus,
    levelAhead: mercs.length > 0 ? level - (monsterLevel(g.stageIndex) + LEVEL_LEAD) : 0,
  });
}

/** What the level director is reading, for its debug overlay. */
export function directorStatus(g: GameState): {
  phase: Phase;
  phaseName: string;
  left: number | null;
  pacing: number;
  standing: number;
  progress: number;
  scale: number;
  spots: { spawn: number; boss: number; relief: number };
  bosses: readonly string[];
  intensity: { name: string; value: number }[];
  last: AreaScore | null;
} {
  const d = g.director;
  return {
    phase: d.phase,
    phaseName: PHASE_NAME[d.phase],
    left: d.phaseLeft(),
    pacing: d.pacing(),
    standing: d.standing,
    progress: g.flow?.progress(g.bearer) ?? 0,
    scale: g.stage.scale ?? 1,
    spots: {
      spawn: spotsOf(g.stage, 'spawn'),
      boss: spotsOf(g.stage, 'boss'),
      relief: spotsOf(g.stage, 'relief'),
    },
    bosses: g.stage.bossCards ?? [],
    intensity: g.sim.living(Side.Party).map((u) => ({ name: u.name, value: d.intensityOf(u) })),
    last: d.last,
  };
}

// Monsters awake are seen, for the compendium.
export function noteMonsters(g: GameState): void {
  for (const m of g.sim.units) {
    if (m.side === Side.Monster && m.aware && m.alive) {
      g.compendium.see(m.kind);
      // A mini-boss is named as it joins the fight.
      if (m.named && !g.announced.has(m)) {
        g.announced.add(m);
        const def = Object.values(MINI_BOSSES).find((d) => d.name === m.name);
        g.say(def ? `${def.name}: ${def.text}` : `${m.name} joins the fight.`);
      }
    }
  }
}
