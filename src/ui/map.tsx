import { For, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type Game from '../game/game';
import {
  type Cell,
  MUTATOR_NAME,
  type MapNode,
  type NodeKind,
  OBJECTIVE_NAME,
  REWARD_NAME,
  type Reward,
} from '../gen/graph';
import { ICONS, type IconName } from './icons';
import { Panel } from './kit';

interface Props {
  game: Game;
  onClose: () => void;
}

const NAME: Record<NodeKind, string> = {
  combat: 'Fight',
  elite: 'Elite',
  camp: 'Camp',
  event: 'Event',
  town: 'Town',
  boss: 'Boss',
};

// Elites and the boss in red, Camps in gold, Events in violet, Towns in
// teal, fights in grey.
const KIND_COLOR: Record<NodeKind, string> = {
  combat: '#a3a3a3',
  elite: '#f87171',
  camp: '#e8b04a',
  event: '#a78bfa',
  town: '#2dd4bf',
  boss: '#ef4444',
};

// A fight by its objective, the rest by their kind
const iconOf = (node: MapNode): IconName => node.objective ?? node.kind;

// What a fight pays, by a small icon beside it
const REWARD_ICON: Record<Reward, IconName> = {
  gold: 'gold',
  arms: 'armingSword',
  cards: 'card',
  materials: 'iron',
  respite: 'heal',
};

// An area's name on the map: a fight by its objective.
const nameOf = (node: MapNode): string => {
  if (!node.objective) {
    return NAME[node.kind];
  }
  const objective = OBJECTIVE_NAME[node.objective];
  return node.kind === 'elite' ? `Elite ${objective.toLowerCase()}` : objective;
};

// A fight's mutators, as a line under its name
const mutatorsOf = (node: MapNode): string =>
  (node.mutators ?? []).map((m) => MUTATOR_NAME[m]).join(' · ');

// A road taken in gold, one that can be taken now in faint gold, the rest grey
function roadColor(road: { took: boolean; open: boolean }): string {
  if (road.took) {
    return '#e8b04a';
  }
  return road.open ? '#e8b04a99' : '#ffffff26';
}

// A room's edge: thickest where the party is, thicker where it can go next
function edgeOf(here: boolean, next: boolean): number {
  if (here) {
    return 3;
  }
  return next ? 2 : 1.2;
}

// Half a room across and down on the drawing: rooms are drawn as the game
// sees the ground, from its corner, so east runs down to the right.
const HW = 58;
const HH = 29;
// How much of its cell a room fills, and the room kept round the plan
const ROOM = 0.66;
const PAD = 26;

/**
 * The layer's map: its areas as rooms where they lie, the roads between
 * them as doors, the way the party came and where it is now. A road that
 * leaves a room north on the map leaves it north in the world. The game is
 * paused while it is open.
 */
export default function LayerMapPanel(props: Props): JSX.Element {
  const state = props.game.layerMap();
  const { columns, start } = state.map;
  const cells = [start, ...columns.flat().map((n) => n.cell)];
  const sx = (c: Cell): number => (c.x - c.y) * HW;
  const sy = (c: Cell): number => (c.x + c.y) * HH;
  const left = Math.min(...cells.map(sx)) - HW - PAD;
  const top = Math.min(...cells.map(sy)) - HH - PAD;
  const width = Math.max(...cells.map(sx)) + HW + PAD - left;
  const height = Math.max(...cells.map(sy)) + HH + PAD - top;
  const at = (c: Cell): { x: number; y: number } => ({ x: sx(c) - left, y: sy(c) - top });
  const diamond = (c: Cell, k = ROOM): string => {
    const p = at(c);
    return [
      [p.x, p.y - HH * k],
      [p.x + HW * k, p.y],
      [p.x, p.y + HH * k],
      [p.x - HW * k, p.y],
    ]
      .map(([x, y]) => `${x},${y}`)
      .join(' ');
  };
  const crossed = (column: number, row: number): boolean =>
    state.path.some((p) => p.column === column && p.row === row);
  const here = (column: number, row: number): boolean =>
    state.at?.column === column && state.at.row === row;
  // Roads the party took, between two crossed areas in a row.
  const taken = (column: number, row: number, next: number): boolean =>
    state.path.some(
      (p, i) =>
        p.column === column &&
        p.row === row &&
        state.path[i + 1]?.column === column + 1 &&
        state.path[i + 1]?.row === next,
    );
  // The areas the party can go to next.
  const ahead = (column: number, row: number): boolean => {
    if (!state.at) {
      return column === 0;
    }
    return (
      column === state.at.column + 1 &&
      (columns[state.at.column]?.[state.at.row]?.next.includes(row) ?? false)
    );
  };
  // Every road, from the start's room or an area to the next
  const roads = [
    ...columns[0].map((n, row) => ({
      a: start,
      b: n.cell,
      took: crossed(0, row),
      open: !state.at,
    })),
    ...columns.flatMap((column, c) =>
      column.flatMap((n, r) =>
        n.next.map((j) => ({
          a: n.cell,
          b: columns[c + 1][j].cell,
          took: taken(c, r, j),
          open: here(c, r),
        })),
      ),
    ),
  ];

  return (
    <Panel
      label="Map"
      title={state.title}
      icon="map"
      onClose={() => {
        props.onClose();
      }}
    >
      <svg width={width} height={height} role="img" aria-label="The layer's areas and roads">
        <For each={roads}>
          {(road) => (
            <line
              x1={at(road.a).x}
              y1={at(road.a).y}
              x2={at(road.b).x}
              y2={at(road.b).y}
              stroke={roadColor(road)}
              stroke-width={road.took ? 7 : 5}
              stroke-dasharray={road.open && !road.took ? '5 3' : undefined}
            />
          )}
        </For>
        <g aria-label={state.layer === 0 ? 'Start' : 'Waystation'}>
          <polygon points={diamond(start)} fill="#1b1d22" stroke="#ffffff40" />
          <Dynamic
            component={ICONS[state.layer === 0 ? 'start' : 'waystation']}
            x={at(start).x - 10}
            y={at(start).y - 10}
            width={20}
            height={20}
            fill="#d4d4d4"
          />
        </g>
        <For each={columns}>
          {(column, c) => (
            <For each={column}>
              {(node, r) => {
                const p = at(node.cell);
                const boss = node.kind === 'boss';
                const size = boss ? 24 : 18;
                const label = `Area ${c() + 1}: ${nameOf(node)}${node.reward ? `, pays ${REWARD_NAME[node.reward].toLowerCase()}` : ''}${mutatorsOf(node) === '' ? '' : `, ${mutatorsOf(node)}`}`;
                return (
                  <g aria-label={label}>
                    <title>{label}</title>
                    <polygon
                      points={diamond(node.cell)}
                      fill={crossed(c(), r()) ? '#2a2a2a' : '#0d0f14'}
                      stroke={crossed(c(), r()) ? '#e8b04a' : KIND_COLOR[node.kind]}
                      stroke-width={edgeOf(here(c(), r()), ahead(c(), r()))}
                      stroke-dasharray={mutatorsOf(node) === '' ? undefined : '6 2'}
                    />
                    <Show when={here(c(), r())}>
                      <polygon
                        points={diamond(node.cell, ROOM * 0.72)}
                        fill="none"
                        stroke="#e8b04a"
                        stroke-opacity={0.5}
                      />
                    </Show>
                    <Dynamic
                      component={ICONS[iconOf(node)]}
                      x={p.x - size / 2}
                      y={p.y - size / 2}
                      width={size}
                      height={size}
                      fill={crossed(c(), r()) ? '#737373' : KIND_COLOR[node.kind]}
                    />
                    <Show when={node.reward}>
                      {(reward) => (
                        <Dynamic
                          component={ICONS[REWARD_ICON[reward()]]}
                          x={p.x + HW * 0.38}
                          y={p.y - 6}
                          width={12}
                          height={12}
                          fill={crossed(c(), r()) ? '#737373' : '#e8b04a'}
                        />
                      )}
                    </Show>
                  </g>
                );
              }}
            </For>
          )}
        </For>
      </svg>
      <p class="mt-2 max-w-[640px] text-xs leading-relaxed text-neutral-500">
        The layer’s areas as rooms, where they lie in the world, and its roads as doors between
        them: a road that leaves a room north here leaves it north on the ground. A Hunt opens once
        its marked monsters are slain, a Horde once its waves are beaten, a Labyrinth once the way
        through is found. The small gold mark is what a fight’s chest pays; a dashed edge means
        mutators, which make it harder and add an item. Hover a room for its name. At a Camp the
        party rests back to full. A Town has a smith, a bench, a temple and a market. The roads not
        taken collapse behind the bearer. <span class="kbd">M</span> or <span class="kbd">Esc</span>{' '}
        to close.
      </p>
    </Panel>
  );
}
