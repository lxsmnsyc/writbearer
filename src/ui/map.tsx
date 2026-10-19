import { For, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type Game from '../game/game';
import {
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

// Where each area sits on the drawing, by column and row.
const COLUMN = 84;
const ROW = 72;
const LEFT = 104;
const MIDDLE = 116;
const R = 17;

/**
 * The layer's map: its areas column by column, the roads between them, the
 * way the party came and where it is now. The game is paused while it is
 * open.
 */
export default function LayerMapPanel(props: Props): JSX.Element {
  const state = props.game.layerMap();
  const { columns } = state.map;
  const at = (column: number, row: number): { x: number; y: number } => ({
    x: LEFT + column * COLUMN,
    y: MIDDLE + (row - (columns[column].length - 1) / 2) * ROW,
  });
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
  const width = LEFT + (columns.length - 1) * COLUMN + 60;

  return (
    <Panel
      label="Map"
      title={state.title}
      icon="map"
      onClose={() => {
        props.onClose();
      }}
    >
      <svg width={width} height={240} role="img" aria-label="The layer's areas and roads">
        <g>
          <circle cx={44} cy={MIDDLE} r={R} fill="#ffffff0d" stroke="#ffffff33" />
          <Dynamic
            component={ICONS[state.layer === 0 ? 'start' : 'waystation']}
            x={44 - 10}
            y={MIDDLE - 10}
            width={20}
            height={20}
            fill="#d4d4d4"
          />
          <text
            x={44}
            y={MIDDLE + R + 14}
            text-anchor="middle"
            class="fill-neutral-500 text-[10px]"
          >
            {state.layer === 0 ? 'Start' : 'Waystation'}
          </text>
        </g>
        <For each={columns[0]}>
          {(_, row) => (
            <line
              x1={44 + R}
              y1={MIDDLE}
              x2={at(0, row()).x}
              y2={at(0, row()).y}
              stroke={crossed(0, row()) ? '#e8b04a' : '#ffffff22'}
              stroke-width={crossed(0, row()) ? 2.5 : 1.5}
            />
          )}
        </For>
        <For each={columns}>
          {(column, c) => (
            <For each={column}>
              {(node, r) => (
                <For each={node.next}>
                  {(next) => (
                    <line
                      x1={at(c(), r()).x}
                      y1={at(c(), r()).y}
                      x2={at(c() + 1, next).x}
                      y2={at(c() + 1, next).y}
                      stroke={taken(c(), r(), next) ? '#e8b04a' : '#ffffff22'}
                      stroke-width={taken(c(), r(), next) ? 2.5 : 1.5}
                      stroke-dasharray={ahead(c() + 1, next) && here(c(), r()) ? '4 3' : undefined}
                    />
                  )}
                </For>
              )}
            </For>
          )}
        </For>
        <For each={columns}>
          {(column, c) => (
            <For each={column}>
              {(node, r) => {
                const p = (): { x: number; y: number } => at(c(), r());
                const size = node.kind === 'boss' ? 26 : 20;
                const radius = node.kind === 'boss' ? R + 5 : R;
                return (
                  <g
                    aria-label={`Area ${c() + 1}: ${nameOf(node)}${node.reward ? `, pays ${REWARD_NAME[node.reward].toLowerCase()}` : ''}${mutatorsOf(node) === '' ? '' : `, ${mutatorsOf(node)}`}`}
                  >
                    <Show when={ahead(c(), r())}>
                      <circle
                        cx={p().x}
                        cy={p().y}
                        r={radius + 5}
                        fill="none"
                        stroke={KIND_COLOR[node.kind]}
                        stroke-opacity={0.35}
                        stroke-width={2}
                      />
                    </Show>
                    <circle
                      cx={p().x}
                      cy={p().y}
                      r={radius}
                      fill={crossed(c(), r()) ? '#2a2a2a' : '#0d0f14'}
                      stroke={crossed(c(), r()) ? '#e8b04a' : KIND_COLOR[node.kind]}
                      stroke-width={here(c(), r()) ? 3 : 1.5}
                    />
                    <Dynamic
                      component={ICONS[iconOf(node)]}
                      x={p().x - size / 2}
                      y={p().y - size / 2}
                      width={size}
                      height={size}
                      fill={crossed(c(), r()) ? '#737373' : KIND_COLOR[node.kind]}
                    />
                    <Show when={node.reward}>
                      {(reward) => (
                        <g>
                          <title>{REWARD_NAME[reward()]}</title>
                          <circle
                            cx={p().x + radius * 0.75}
                            cy={p().y - radius * 0.75}
                            r={8}
                            fill="#0d0f14"
                            stroke="#e8b04a"
                            stroke-width={1}
                          />
                          <Dynamic
                            component={ICONS[REWARD_ICON[reward()]]}
                            x={p().x + radius * 0.75 - 5.5}
                            y={p().y - radius * 0.75 - 5.5}
                            width={11}
                            height={11}
                            fill={crossed(c(), r()) ? '#737373' : '#e8b04a'}
                          />
                        </g>
                      )}
                    </Show>
                    <text
                      x={p().x}
                      y={p().y + radius + 14}
                      text-anchor="middle"
                      class="text-[10px]"
                      fill={here(c(), r()) ? '#e8b04a' : '#a3a3a3'}
                    >
                      {nameOf(node)}
                    </text>
                    <Show when={mutatorsOf(node) !== ''}>
                      <text
                        x={p().x}
                        y={p().y + radius + 26}
                        text-anchor="middle"
                        class="text-[9px]"
                        fill="#f87171"
                      >
                        {mutatorsOf(node)}
                      </text>
                    </Show>
                  </g>
                );
              }}
            </For>
          )}
        </For>
      </svg>
      <p class="mt-2 max-w-[640px] text-xs leading-relaxed text-neutral-500">
        A Hunt opens once its marked monsters are slain, a Horde once its waves are beaten, a
        Labyrinth once the way through is found. The small mark beside a fight is what its chest
        pays: gold, arms for the party, a card, materials, or a respite that heals the party and
        keeps its dead whole. A fight's mutators, in red under its name, make it harder and add an
        item to its chest. Elites are harder, always have one, and pay better. At a Camp the party
        rests back to full. A Town has a smith, a bench, a temple and a market. The roads not taken
        collapse behind the bearer. <span class="kbd">M</span> or <span class="kbd">Esc</span> to
        close.
      </p>
    </Panel>
  );
}
