import { For, type JSX, Show, createSignal } from 'solid-js';
import { type Section, compendiumView } from '../game/compendium';
import type Game from '../game/game';

interface Props {
  game: Game;
  // Bumped by the game whenever something is found
  version: number;
  onClose: () => void;
}

/**
 * The compendium: what the player has found over every run. What has not
 * been found shows as "?". The game is paused while it is open.
 */
export default function CompendiumPanel(props: Props): JSX.Element {
  const [tab, setTab] = createSignal(0);
  const sections = (): Section[] =>
    props.version >= 0 ? compendiumView(props.game.compendium.data) : [];
  const section = (): Section | undefined => sections()[tab()];
  return (
    <aside
      data-part="panel"
      class="absolute top-6 left-1/2 w-[760px] -translate-x-1/2 border border-zinc-700 bg-zinc-950/95 p-4 text-sm text-zinc-300 shadow-xl"
      aria-label="Compendium"
    >
      <header class="mb-3 flex items-baseline justify-between">
        <h2 data-part="title" class="font-serif text-lg text-zinc-100">
          The Compendium
        </h2>
        <span data-part="note" class="text-xs text-zinc-500">
          What every run has found. K to close.
        </span>
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
      <div class="mb-3 grid grid-cols-7 gap-1" role="tablist" aria-label="Compendium">
        <For each={sections()}>
          {(s, i) => (
            <button
              type="button"
              role="tab"
              data-part="choice"
              aria-selected={tab() === i()}
              aria-checked={tab() === i()}
              class="border px-2 py-1 text-xs"
              onClick={() => {
                setTab(i());
              }}
            >
              {s.title}
              <span data-part="note" class="block text-zinc-500">
                {s.found}
              </span>
            </button>
          )}
        </For>
      </div>
      <Show when={section()} keyed>
        {(s) => (
          <ul class="grid max-h-96 grid-cols-2 gap-1 overflow-y-auto" aria-label={s.title}>
            <For each={s.entries}>
              {(entry) => (
                <li
                  data-part="row"
                  class="border border-zinc-800 px-2 py-1"
                  classList={{ 'opacity-60': !entry.known }}
                >
                  <span class="text-zinc-100">{entry.name}</span>
                  <For each={entry.lines}>
                    {(line) => (
                      <p data-part="note" class="text-xs text-zinc-400">
                        {line}
                      </p>
                    )}
                  </For>
                </li>
              )}
            </For>
            <Show when={s.entries.length === 0}>
              <li data-part="note" class="text-xs text-zinc-500">
                Nothing yet.
              </li>
            </Show>
          </ul>
        )}
      </Show>
    </aside>
  );
}
