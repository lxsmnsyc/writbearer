// An area's Event: rolling what waits there, opening it when the bearer
// walks up, and making its choices.
import { monsterLevel } from '../../gen/stage';
import type { Frame } from '../../render/renderer';
import { JOBS } from '../../content/jobs';
import { START_LEVEL } from '../stage';
import type GameState from './state';
import { LEAVE_REACH, MEET_REACH, PARTY_SIZE } from './state';
import type { EventView } from './types';
import { join } from './recruits';

// Rolls what waits at this area's Event, if it has one.
export function beginEvent(g: GameState): void {
  const pending = g.pendingEvent;
  const at = g.stage.event;
  g.encounter = null;
  g.pendingEvent = null;
  if (!pending || !at) {
    return;
  }
  const play = pending.def.begin({
    rng: pending.rng,
    sim: g.sim,
    pack: g.pack,
    level: monsterLevel(g.stageIndex),
    mercLevel: START_LEVEL + Math.floor(g.stageIndex / 2),
    at,
    give: (items) => {
      g.scatter(items, { x: at.x + 1, z: at.z });
    },
    cannotHire: (wage) => {
      if (g.mercs().length >= PARTY_SIZE) {
        return `The party is full: ${PARTY_SIZE} mercs at most.`;
      }
      return g.pack.gold < wage ? `It costs ${wage} gold. You have ${g.pack.gold}.` : null;
    },
    hire: (offer, wage) => {
      g.pack.gold -= wage;
      join(g, offer, at.x + 1, at.z);
    },
  });
  g.encounter = {
    def: pending.def,
    play,
    at,
    outcome: null,
    met: false,
    state: pending.state,
  };
}

// Who stands in the area out of the fight: recruits for hire, and
// whoever waits at the Event until a choice is made, or lies dead there.
export function figures(g: GameState): Frame['figures'] {
  const out: Frame['figures'] = g.wanderers.map((w) => ({
    kind: w.offer.kind,
    x: w.x,
    z: w.z,
    label: `${w.offer.name}, ${JOBS[w.offer.kind].template.job.name}`,
    fallen: false,
  }));
  const e = g.encounter;
  const kind = e?.play.figure;
  if (e && kind && (e.outcome === null || e.play.fallen)) {
    out.push({
      kind,
      x: e.at.x,
      z: e.at.z,
      label: e.outcome === null ? e.def.title : null,
      fallen: e.play.fallen ?? false,
    });
  }
  return out;
}

// The Event as the interface shows it.
function eventView(g: GameState): EventView | null {
  const e = g.encounter;
  return e
    ? {
        title: e.def.title,
        text: e.play.text,
        choices: e.play.choices.map((c) => ({ label: c.label, why: c.why?.() ?? null })),
        outcome: e.outcome,
      }
    : null;
}

// Opens the Event when the bearer walks up to it, until a choice is made.
export function visitEvent(g: GameState): void {
  const e = g.encounter;
  if (e?.outcome !== null || g.eventOpen) {
    return;
  }
  const d = Math.hypot(g.bearer.x - e.at.x, g.bearer.z - e.at.z);
  if (d > LEAVE_REACH) {
    e.met = false;
  } else if (d <= MEET_REACH && !e.met && g.bearer.alive) {
    e.met = true;
    g.eventOpen = true;
    g.keys.clear();
    g.bearer.order = null;
    g.hooks.onEvent?.(eventView(g));
  }
}

/** Makes one of the Event's choices. Returns why it could not, or null. */
export function chooseEvent(g: GameState, index: number): string | null {
  const e = g.encounter;
  const choice = e?.play.choices[index];
  if (!e || !choice || e.outcome !== null) {
    return null;
  }
  const why = choice.why?.() ?? null;
  if (why) {
    return why;
  }
  e.outcome = choice.pick();
  g.views.snap(g.sim);
  g.itemsChanged();
  g.hooks.onEvent?.(eventView(g));
  return null;
}

/** Closes the Event. Before a choice is made, walking back opens it again. */
export function closeEvent(g: GameState): void {
  g.eventOpen = false;
  g.hooks.onEvent?.(null);
}
