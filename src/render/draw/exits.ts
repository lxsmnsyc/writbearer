import { MUTATOR_NAME, type Objective, type Reward } from '../../gen/graph';
import type { Ahead } from '../../gen/stage';
import { type Pt, fillPoly } from '../draw';
import type { Fogs } from '../fog';
import { C } from '../palette';
import type { Frame } from '../renderer';
import { look } from '../rig';
import { SCALE, type Scene } from './scene';

/** How far an exit's plate reaches from its middle, in tiles. Clicks within it choose it. */
export const EXIT_PLATE = 0.9;

// What lies beyond a road on, as its signpost reads.
const AHEAD_NAME: Record<Exclude<Ahead, 'down'>, string> = {
  combat: 'Fight',
  elite: 'Elite: a strong pack, better spoils',
  camp: 'Camp: rest by a fire',
  town: 'Town: smith, bench, temple, market',
  event: 'Event: someone on the road',
  boss: 'The walled ring',
};

// What a signpost says of the fight ahead, by its objective.
const OBJECTIVE_SIGN: Record<Objective, string> = {
  hunt: 'Hunt: slay the marked',
  horde: 'Horde: hold out against the waves',
  maze: 'Labyrinth: find the way through',
  escort: 'Escort: see the refugees through',
  vault: 'Vault: take the key, open the vault',
  ritual: 'Ritual: break the three sigils',
  collapse: 'Collapse: outrun the falling floor',
  ambush: 'Camp',
  silence: 'Silence: break the horn posts',
};

// What a signpost says the fight ahead pays.
const REWARD_SIGN: Record<Reward, string> = {
  gold: 'pays gold',
  arms: 'pays arms',
  cards: 'pays a card',
  materials: 'pays materials',
  respite: 'heals the party',
  mastery: 'offers an elite upgrade',
};

// Each way out is a plate on the ground the player clicks to leave by:
// brighter under the mouse or once chosen, dark red while the way down
// is shut.
export function drawExits(s: Scene, f: Frame, fog: Fogs): void {
  const { ctx, iso } = s;
  f.stage.exits.forEach((e, i) => {
    if (!fog.known(e.x, e.z) || e.closed === true || e.taken === true) {
      return;
    }
    const shut = f.exitsShut || (e.ahead === 'down' && (f.boss?.alive ?? false));
    const hot = !shut && (f.hoverExit === i || f.leaving === i);
    // A square on the floor, a diamond on screen, that breathes when idle.
    const r = EXIT_PLATE * (hot ? 1 : 0.92 + 0.08 * Math.sin(f.time * 3 + i));
    const square = (k: number): Pt[] => [
      iso(e.x - k, e.z - k),
      iso(e.x + k, e.z - k),
      iso(e.x + k, e.z + k),
      iso(e.x - k, e.z + k),
    ];
    const color = shut ? C.blood : C.gold;
    if (hot) {
      ctx.globalAlpha = 0.45;
      fillPoly(ctx, square(r), color, null);
      ctx.globalAlpha = 1;
    }
    fillPoly(ctx, square(r), 'rgba(0,0,0,0)', color);
    // An inner diamond, so it reads as a marked tile and not a stain
    fillPoly(ctx, square(r * 0.4), shut ? C.ink : color, null);
  });
}

// Each road on names what lies ahead, on its signpost. Drawn on the
// screen, in the font and alignment the caller set.
export function drawSigns(s: Scene, f: Frame, fog: Fogs): void {
  const { out } = s;
  for (const e of f.areas.flatMap((a) => a.stage.exits)) {
    if (e.ahead === 'down' || e.closed === true || !fog.known(e.sign.x, e.sign.z)) {
      continue;
    }
    const b = s.iso(e.sign.x, e.sign.z);
    const reward = e.reward ? ` · ${REWARD_SIGN[e.reward]}` : '';
    const text = e.objective
      ? `${e.ahead === 'elite' ? 'Elite ' : ''}${OBJECTIVE_SIGN[e.objective]}${reward}`
      : AHEAD_NAME[e.ahead];
    const x = b.x * SCALE - s.sub.x;
    const y = (b.y - 40 * look.zoom) * SCALE - s.sub.y;
    const width = out.measureText(text).width + 8;
    out.fillStyle = 'rgba(0,0,0,0.65)';
    out.fillRect(x - width / 2, y - 14, width, 18);
    out.fillStyle = e.ahead === 'elite' || e.ahead === 'boss' ? '#d47a6a' : '#d6d0c4';
    out.fillText(text, x, y);
    // Its mutators, on a line under it
    const mutators = (e.mutators ?? []).map((m) => MUTATOR_NAME[m]).join(' · ');
    if (mutators !== '') {
      const under = out.measureText(mutators).width + 8;
      out.fillStyle = 'rgba(0,0,0,0.65)';
      out.fillRect(x - under / 2, y + 4, under, 18);
      out.fillStyle = '#d47a6a';
      out.fillText(mutators, x, y + 18);
    }
  }
}
