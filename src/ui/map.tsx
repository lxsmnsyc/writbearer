import { For, type JSX, Show } from 'solid-js';
import type Game from '../game/game';
import type { NodeKind } from '../gen/graph';
import { LAYERS } from '../gen/layers';

interface Props {
  game: Game;
  onClose: () => void;
}

const NAME: Record<NodeKind, string> = {
  combat: 'Fight',
  elite: 'Elite',
  camp: 'Camp',
  boss: 'Boss',
};

// Elites and the boss in red, Camps in gold, fights in grey.
const KIND_CLASS: Record<NodeKind, string> = {
  combat: 'fill-zinc-900 stroke-zinc-500',
  elite: 'fill-red-950 stroke-red-400',
  camp: 'fill-amber-950 stroke-amber-500',
  boss: 'fill-red-950 stroke-red-400',
};

// Where each area sits on the drawing, by column and row.
const COLUMN = 78;
const ROW = 64;
const LEFT = 96;
const MIDDLE = 104;

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
    <aside
      data-part="panel"
      class="absolute top-6 left-1/2 -translate-x-1/2 border border-zinc-700 bg-zinc-950/95 p-4 text-sm text-zinc-300 shadow-xl"
      aria-label="Map"
    >
      <header class="mb-2 flex items-baseline justify-between gap-8">
        <h2 data-part="title" class="font-serif text-lg text-zinc-100">
          {LAYERS[Math.min(state.layer, LAYERS.length - 1)].name}
        </h2>
        <button
          type="button"
          class="text-zinc-500 hover:text-zinc-200"
          onClick={() => {
            props.onClose();
          }}
        >
          Close
        </button>
      </header>
      <svg width={width} height={210} role="img" aria-label="The layer's areas and roads">
        <text x={24} y={MIDDLE + 4} class="fill-zinc-500 text-[11px]">
          {state.layer === 0 ? 'Start' : 'Waystation'}
        </text>
        <For each={columns[0]}>
          {(_, row) => (
            <line
              x1={60}
              y1={MIDDLE}
              x2={at(0, row()).x}
              y2={at(0, row()).y}
              class={crossed(0, row()) ? 'stroke-amber-500' : 'stroke-zinc-700'}
              stroke-width={crossed(0, row()) ? 2 : 1}
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
                      class={taken(c(), r(), next) ? 'stroke-amber-500' : 'stroke-zinc-700'}
                      stroke-width={taken(c(), r(), next) ? 2 : 1}
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
              {(node, r) => (
                <g aria-label={`Area ${c() + 1}: ${NAME[node.kind]}`}>
                  <circle
                    cx={at(c(), r()).x}
                    cy={at(c(), r()).y}
                    r={node.kind === 'boss' ? 14 : 10}
                    class={
                      crossed(c(), r()) ? 'fill-zinc-500 stroke-zinc-300' : KIND_CLASS[node.kind]
                    }
                    stroke-width={ahead(c(), r()) ? 2 : 1}
                  />
                  <Show when={here(c(), r())}>
                    <circle
                      cx={at(c(), r()).x}
                      cy={at(c(), r()).y}
                      r={15}
                      class="fill-none stroke-amber-400"
                      stroke-width={2}
                    />
                  </Show>
                  <text
                    x={at(c(), r()).x}
                    y={at(c(), r()).y + 26}
                    text-anchor="middle"
                    class="fill-zinc-400 text-[10px]"
                  >
                    {NAME[node.kind]}
                  </text>
                </g>
              )}
            </For>
          )}
        </For>
      </svg>
      <p data-part="note" class="mt-1 text-xs text-zinc-500">
        Fights give experience and loot. Elites hold a strong pack and better spoils. At a Camp the
        party rests back to full. The roads not taken collapse behind the bearer. M or Esc to close.
      </p>
    </aside>
  );
}
