// Moving between areas: entering one, joining the next beyond an exit,
// crossing into it, the collapse of the one behind, and the way down.
import { Stream } from '../../core/seed';
import { TICK } from '../../sim/sim';
import { Side } from '../../sim/types';
import {
  type Exit,
  type Prop,
  type Stage,
  floorOf,
  generateTomb,
  generateWaystation,
  rectOf,
  withFightsAhead,
} from '../../gen/stage';
import { CHALLENGES, type Objective } from '../../gen/graph';
import { LAYERS, layerIndexOf } from '../../gen/layers';
import { rollOffer } from '../../content/recruits';
import { placeBeyond } from '../../gen/place';
import Flow from '../../sim/flow';
import { type Rect, inRect } from '../../sim/nav';
import { Payroll, desert } from '../wages';
import ObjectiveRun from '../objective';
import { BLOSSOM_REACH } from '../footing';
import Hazards from '../hazards';
import Bonus from '../bonus';
import { START_LEVEL, carryParty, dropStage, enterStage, joinStage } from '../stage';
import type GameState from './state';
import { aheadOf, biome, buildStage, fightsAhead, goTo, here, rollMap, sidesAhead } from './route';
import { beginEvent } from './encounter';
import { restoreAll } from '../../sim/strip';
import { persist } from './saving';

// Each Waystation lays out from its own stream, apart from the areas'.
const WAYSTATION_STREAM = 1000;
export const TOMB_STREAM = 2000;
export const GUILD_STREAM = 3000;
// How long the area behind waits for the party before it collapses, and
// how long its floor takes to fade, in seconds
const COLLAPSE_WAIT = 4;
export const COLLAPSE_FADE = 1.5;
// The objectives where the party holds its ground, so the director's lulls
// are short
const HOLDING: ReadonlySet<Objective> = new Set(['horde', 'ritual', 'ambush']);
// A rectangle a tile in from each edge, so crossing means being well inside
const inner = (r: Rect): Rect => ({ x0: r.x0 + 1, z0: r.z0 + 1, x1: r.x1 - 1, z1: r.z1 - 1 });
// Names joined for a notice: "Odo", "Odo and Maren".
export const names = (units: { name: string }[]): string => units.map((u) => u.name).join(' and ');

// Lays out the current stage around the party. An area joined ahead was
// laid out and filled when it was joined.
export function enter(g: GameState, joined = false): void {
  if (!joined) {
    g.boss = enterStage(g.sim, g.stage);
  }
  const nav = g.sim.nav;
  g.flow = nav ? new Flow(rectOf(g.stage), g.stage.entrance, (x, z) => nav.walkable(x, z)) : null;
  const o = g.stage.objective;
  g.director.beginArea(g.stage.spots, g.flow, o !== undefined && HOLDING.has(o));
  g.objective = g.stage.objective ? new ObjectiveRun(g.stage.objective, g.stage) : null;
  const stage = g.stage;
  g.hazards = stage.hazards
    ? new Hazards(stage, (h) => {
        // A floor that gave way stays a pit.
        const pit: Prop = { kind: 'pit', x: h.x, z: h.z, r: 1, seed: 0.5 };
        stage.props.push(pit);
        g.sim.obstacles.push({ x: pit.x, z: pit.z, r: 1 });
        g.sim.setWorld(g.sim.floor);
      })
    : null;
  const node = g.stage.objective ? here(g) : null;
  g.prize = node?.reward ?? null;
  g.sim.spared = g.prize === 'respite';
  g.bonus =
    g.stage.objective &&
    node?.challenge &&
    // A test's forced objective may not have the node's challenge.
    CHALLENGES[g.stage.objective].includes(node.challenge)
      ? new Bonus(node.challenge, g.stage.objective, rectOf(g.stage))
      : null;
  g.bonusMet = null;
  g.mutators.set(node?.mutators ?? []);
  const camp = g.stage.recruit;
  const guild = g.stage.recruits ?? [];
  g.wanderers = guild.map((at, i) => ({ offer: g.starting[i], ...at, met: false }));
  if (camp) {
    g.wanderers.push({
      offer: rollOffer(
        g.streams.area(1, Stream.Recruits, g.stageIndex),
        START_LEVEL + Math.floor(g.stageIndex / 2),
      ),
      ...camp,
      met: false,
    });
  }
  for (const s of g.stage.stains) {
    g.effects.stain(s.x, s.z, s.r, '#560b0b');
  }
  beginEvent(g);
}

// The party sets out by an exit. A road on joins the next area beyond it,
// to walk into. The way down to the next layer is taken at once.
export function leave(g: GameState, exit: number): void {
  // Mercs whose morale broke stay behind.
  const gone = desert(g.sim);
  if (gone.length > 0) {
    g.say(`${names(gone)} ${gone.length > 1 ? 'desert' : 'deserts'} the party.`);
    g.hooks.onChange?.();
  }
  if (g.stage.exits[exit]?.ahead === 'down') {
    descend(g, exit);
  } else {
    joinArea(g, exit);
  }
}

// Joins the area beyond an exit to the world: the other roads collapse,
// and the bearer walks on into it.
function joinArea(g: GameState, exit: number): void {
  const way = g.stage.exits[exit];
  if (g.stage.kind === 'guild') {
    // From the Guild House, the road leads into the first phase.
    goTo(g, 0, exit);
  } else if (g.stage.station) {
    // The unpaid lose heart as the party takes the road on.
    const unpaid = g.payroll?.settle(g.sim) ?? [];
    if (unpaid.length > 0) {
      g.say(`${names(unpaid)} ${unpaid.length > 1 ? 'go' : 'goes'} on unpaid, and sullen.`);
    }
    g.payroll = null;
    goTo(g, 0, exit);
  } else {
    const node = here(g);
    goTo(g, (g.node?.column ?? -1) + 1, node?.next[exit] ?? 0);
  }
  // Anything still behind is gone first: only two areas stand at once.
  collapse(g);
  const next = placeBeyond(buildStage(g), way);
  way.taken = true;
  g.stage.exits.forEach((e, k) => {
    if (k !== exit) {
      e.closed = true;
      blockRoad(g, e);
    }
  });
  seam(g, next, way);
  const boss = joinStage(g.sim, next, [floorOf(g.stage), rectOf(next)]);
  g.ahead = { stage: next, boss };
  // On into it, a few steps past its entrance
  g.bearer.order = {
    x: next.entrance.x + way.out.x * 2,
    z: next.entrance.z + way.out.z * 2,
  };
  g.goFor();
  g.views.snap(g.sim);
}

// The water, embers and blossoms of the areas standing.
export function workGround(g: GameState): void {
  const standing = g.ahead ? [g.stage, g.ahead.stage] : [g.stage];
  for (const b of g.footing.update(g.sim, TICK, standing)) {
    g.effects.bloom(b, BLOSSOM_REACH);
    g.say('A blossom bursts, and the party is mended.');
  }
}

// A road not taken falls in: rubble across it, where its exit was.
function blockRoad(g: GameState, e: Exit): void {
  const across = { x: -e.out.z, z: e.out.x };
  for (const k of [-1.2, 0, 1.2]) {
    const x = e.x + across.x * k;
    const z = e.z + across.z * k;
    g.stage.props.push({ kind: 'rubble', x, z, r: 0.6, seed: 0.3 + k * 0.1 });
    g.sim.obstacles.push({ x, z, r: 0.6 });
  }
}

// Rubble along the edge where two areas meet, but for the road across.
function seam(g: GameState, next: Stage, way: Exit): void {
  const a = rectOf(g.stage);
  const b = rectOf(next);
  const along = way.out.x !== 0;
  // The edge's line, and the stretch both areas share
  let line = way.out.z > 0 ? a.z1 : a.z0;
  if (along) {
    line = way.out.x > 0 ? a.x1 : a.x0;
  }
  const from = along ? Math.max(a.z0, b.z0) : Math.max(a.x0, b.x0);
  const to = along ? Math.min(a.z1, b.z1) : Math.min(a.x1, b.x1);
  const road = along ? way.z : way.x;
  for (let t = from + 0.5; t < to; t += 0.9) {
    if (Math.abs(t - road) < 2.5) {
      continue;
    }
    const x = along ? line : t;
    const z = along ? t : line;
    next.props.push({ kind: 'rubble', x, z, r: 0.45, seed: (t * 7.3) % 1 });
  }
}

// Once the bearer is well inside the area ahead, the party crosses into it;
// the area behind collapses when the party has left it, and its floor fades.
export function moveOn(g: GameState): void {
  if (g.ahead && g.bearer.alive && inRect(inner(rectOf(g.ahead.stage)), g.bearer)) {
    cross(g);
  }
  settleBehind(g);
  if (g.fading) {
    g.fading.t += TICK;
    if (g.fading.t >= COLLAPSE_FADE) {
      g.fading = null;
    }
  }
}

// The bearer has crossed into the area ahead: it becomes the area the
// party is in, and the one behind waits to collapse.
function cross(g: GameState): void {
  const ahead = g.ahead;
  if (!ahead) {
    return;
  }
  g.behind = { stage: g.stage, t: 0 };
  g.stage = ahead.stage;
  g.boss = ahead.boss;
  g.ahead = null;
  g.sim.area++;
  restoreAll(g.sim);
  g.rested = false;
  g.hoverExit = null;
  enter(g, true);
  persist(g);
}

// Waits for the party to follow the bearer out of the area behind, then
// lets it collapse.
function settleBehind(g: GameState): void {
  const behind = g.behind;
  if (!behind) {
    return;
  }
  behind.t += TICK;
  const r = rectOf(behind.stage);
  const now = rectOf(g.stage);
  const lagging = g.sim.living(Side.Party).some((u) => inRect(r, u) && !inRect(now, u));
  if (!lagging || behind.t >= COLLAPSE_WAIT) {
    collapse(g);
  }
}

// The area behind collapses: what is in it is lost, and the party's own
// still in it are brought to the entrance of the area they are in.
function collapse(g: GameState): void {
  const behind = g.behind;
  if (!behind) {
    return;
  }
  g.behind = null;
  dropStage(g.sim, behind.stage, [g.stage, ...(g.ahead ? [g.ahead.stage] : [])], g.stage.entrance);
  const r = rectOf(behind.stage);
  g.ground = g.ground.filter((item) => !inRect(r, item) || inRect(rectOf(g.stage), item));
  g.fading = { stage: behind.stage, t: 0 };
}

// The bearer took the way down: down to the next layer's Waystation, or
// the tomb. Party and all, and nothing else.
function descend(g: GameState, exit: number): void {
  if (
    g.stage.exits[exit]?.ahead === 'down' &&
    !g.endless &&
    layerIndexOf(g.stageIndex) === LAYERS.length - 1
  ) {
    // Below the Sunken Crown lies only the tomb.
    g.stageIndex++;
    g.node = null;
    g.stage = generateTomb(g.streams.area(1, Stream.Layout, TOMB_STREAM), g.stageIndex);
  } else {
    g.stageIndex++;
    rollMap(g);
    g.node = null;
    g.stage = buildWaystation(g);
  }
  g.ahead = null;
  g.behind = null;
  g.fading = null;
  g.rested = false;
  carryParty(g.sim, g.stage);
  g.effects.clear();
  // What was left on the old stage's floor is lost.
  g.ground = [];
  g.goFor();
  g.hoverExit = null;
  g.views.snap(g.sim);
  g.renderer.snapCamera();
  enter(g);
  persist(g);
}

// The Waystation before the current area, with this layer's wages owed.
export function buildWaystation(g: GameState): Stage {
  g.payroll = new Payroll();
  g.stationMet = false;
  return withFightsAhead(
    generateWaystation(
      g.streams.area(1, Stream.Layout, WAYSTATION_STREAM + g.stageIndex),
      g.stageIndex,
      aheadOf(g, null),
      biome(g),
      sidesAhead(g),
    ),
    fightsAhead(g, null),
  );
}
