import { For, type JSX, Show, onMount } from 'solid-js';
import type { Automap } from '../game/game';
import { MUTATOR_NAME, type NodeKind, OBJECTIVE_NAME, REWARD_NAME } from '../gen/graph';
import { type Exit, type Prop, rectOf } from '../gen/stage';
import { type IconName, iconOr } from './icons';
import { Icon, Tooltip } from './kit';

// The map's drawing, in CSS pixels, and the room kept round the world in it
const WIDTH = 680;
const HEIGHT = 420;
const MARGIN = 36;

// Ground the party has seen, by what stands on it
const FLOOR = '#3b3832';
const HERE = '#4a463e';
const SOLID: Partial<Record<Prop['kind'], string>> = {
  wall: '#8d877c',
  pillar: '#8d877c',
  tree: '#55603f',
  rubble: '#6b665d',
  gate: '#b8b2a6',
  chest: '#c9973a',
  altar: '#8e1414',
};
const BEARER = '#e8b04a';

const AHEAD_NAME: Record<NodeKind | 'down', string> = {
  combat: 'Fight',
  elite: 'Elite',
  camp: 'Camp',
  event: 'Event',
  town: 'Town',
  boss: 'Boss',
  down: 'The way down',
};

// What lies beyond an exit, as its chip shows it: a fight by its objective
const iconOf = (e: Exit): IconName =>
  e.objective ? iconOr(e.objective, 'combat') : iconOr(e.ahead, 'combat');

function nameOf(e: Exit): string {
  const elite = e.ahead === 'elite' ? 'Elite ' : '';
  const what = e.objective ? `${elite}${OBJECTIVE_NAME[e.objective]}` : AHEAD_NAME[e.ahead];
  const pays = e.reward ? ` · pays ${REWARD_NAME[e.reward].toLowerCase()}` : '';
  const mutators = (e.mutators ?? []).map((m) => MUTATOR_NAME[m]).join(', ');
  return `${what}${pays}${mutators === '' ? '' : ` · ${mutators}`}`;
}

/**
 * The automap, as Diablo 2's: the areas walked in this layer drawn where
 * they lie, seen from the same corner as the game, with only the ground the
 * party has seen. Each exit of the area the party is in points the way it
 * leaves, with what lies beyond.
 */
export default function WorldMap(props: { map: Automap }): JSX.Element {
  const m = props.map;
  // The world's corners on the drawing, as the game projects them, before scaling
  const project = (x: number, z: number): { x: number; y: number } => ({
    x: x - z,
    y: (x + z) / 2,
  });
  const corners = m.areas.flatMap((a) => {
    const r = rectOf(a);
    return [project(r.x0, r.z0), project(r.x1, r.z0), project(r.x1, r.z1), project(r.x0, r.z1)];
  });
  const minX = Math.min(...corners.map((p) => p.x));
  const maxX = Math.max(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y));
  const maxY = Math.max(...corners.map((p) => p.y));
  const k = Math.min(
    (WIDTH - MARGIN * 2) / Math.max(1, maxX - minX),
    (HEIGHT - MARGIN * 2) / Math.max(1, maxY - minY),
  );
  const offX = (WIDTH - (maxX - minX) * k) / 2;
  const offY = (HEIGHT - (maxY - minY) * k) / 2;
  const at = (x: number, z: number): { x: number; y: number } => {
    const p = project(x, z);
    return { x: offX + (p.x - minX) * k, y: offY + (p.y - minY) * k };
  };

  let canvas: HTMLCanvasElement | undefined;
  onMount(() => {
    if (!canvas) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const diamond = (x: number, z: number, s: number, color: string): void => {
      const a = at(x - s, z - s);
      const b = at(x + s, z - s);
      const c = at(x + s, z + s);
      const d = at(x - s, z + s);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    for (const area of m.areas) {
      const r = rectOf(area);
      const chasm = new Set((area.chasm ?? []).map((c) => `${c.x},${c.z}`));
      const floor = area === m.here ? HERE : FLOOR;
      for (let x = r.x0; x < r.x1; x++) {
        for (let z = r.z0; z < r.z1; z++) {
          const cx = x + 0.5;
          const cz = z + 0.5;
          if (!chasm.has(`${cx},${cz}`) && m.known(area, cx, cz)) {
            diamond(cx, cz, 0.52, floor);
          }
        }
      }
      for (const p of area.props) {
        const color = SOLID[p.kind];
        if (color && p.open !== true && m.known(area, p.x, p.z)) {
          diamond(p.x, p.z, p.kind === 'wall' ? 0.45 : 0.4, color);
        }
      }
    }
    // The area the party is in, outlined
    const r = rectOf(m.here);
    const outline = [at(r.x0, r.z0), at(r.x1, r.z0), at(r.x1, r.z1), at(r.x0, r.z1)];
    ctx.strokeStyle = 'rgba(232,176,74,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    outline.forEach((p, i) => {
      if (i) {
        ctx.lineTo(p.x, p.y);
      } else {
        ctx.moveTo(p.x, p.y);
      }
    });
    ctx.closePath();
    ctx.stroke();
    // The bearer
    const b = at(m.bearer.x, m.bearer.z);
    ctx.fillStyle = BEARER;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d0f14';
    ctx.stroke();
  });

  // Each exit's chip stands a few tiles past it, the way it leaves.
  const chipAt = (e: Exit): { x: number; y: number } => at(e.x + e.out.x * 4, e.z + e.out.z * 4);

  return (
    <div class="relative" style={{ width: `${WIDTH}px`, height: `${HEIGHT}px` }}>
      <canvas
        ref={(el) => {
          canvas = el;
        }}
        class="rounded-xl bg-black/40"
        style={{ width: `${WIDTH}px`, height: `${HEIGHT}px` }}
        role="img"
        aria-label="The areas walked in this layer, as far as they have been seen"
      />
      <For each={m.exits}>
        {({ exit, shut }) => (
          <Tooltip content={() => <span>{nameOf(exit)}</span>}>
            {(anchor) => (
              <span
                {...anchor}
                tabindex="0"
                aria-label={`Exit: ${nameOf(exit)}${shut ? ', shut' : ''}`}
                class="absolute grid size-8 -translate-1/2 place-items-center rounded-full bg-surface ring-1"
                classList={{
                  'text-accent ring-accent/70': !shut && exit.taken !== true,
                  'text-neutral-500 ring-white/15': shut,
                  'text-neutral-200 ring-white/40': exit.taken === true,
                }}
                style={{ left: `${chipAt(exit).x}px`, top: `${chipAt(exit).y}px` }}
              >
                <Icon name={iconOf(exit)} class="size-4" />
                <Show when={shut}>
                  <span class="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-neutral-900 ring-1 ring-white/10">
                    <Icon name="locked" class="size-2.5" />
                  </span>
                </Show>
              </span>
            )}
          </Tooltip>
        )}
      </For>
    </div>
  );
}
