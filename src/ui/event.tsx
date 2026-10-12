import { For, type JSX, Show, createSignal } from 'solid-js';
import type { EventView } from '../game/game';

interface Props {
  event: EventView;
  onChoose: (index: number) => string | null;
  onClose: () => void;
}

/**
 * An Event: what waits by the road, and the choices it offers. Once a
 * choice is made, it says what came of it. The game is paused while it is
 * open.
 */
export default function EventPanel(props: Props): JSX.Element {
  const [message, setMessage] = createSignal<string | null>(null);
  return (
    <aside
      data-part="panel"
      class="absolute top-1/2 left-1/2 w-[460px] -translate-x-1/2 -translate-y-1/2 border border-zinc-700 bg-zinc-950/95 p-5 text-sm text-zinc-300"
      aria-label={props.event.title}
    >
      <h2 data-part="title" class="mb-2 font-serif text-xl text-zinc-100">
        {props.event.title}
      </h2>
      <p class="mb-4">{props.event.text}</p>
      <Show
        when={props.event.outcome}
        fallback={
          <div class="flex flex-col gap-1">
            <For each={props.event.choices}>
              {(choice, i) => (
                <button
                  type="button"
                  data-part="choice"
                  disabled={choice.why !== null}
                  title={choice.why ?? undefined}
                  class="border border-zinc-600 px-2 py-1 text-left hover:border-zinc-300 disabled:opacity-40"
                  onClick={() => {
                    setMessage(props.onChoose(i()));
                  }}
                >
                  {choice.label}
                  <Show when={choice.why}>
                    <span data-part="note" class="block text-xs text-zinc-500">
                      {choice.why}
                    </span>
                  </Show>
                </button>
              )}
            </For>
          </div>
        }
      >
        {(outcome) => (
          <>
            <p data-part="note" class="mb-3 text-zinc-200 italic" role="status">
              {outcome()}
            </p>
            <button
              type="button"
              data-part="choice"
              class="border border-zinc-600 px-2 py-1 hover:border-zinc-300"
              onClick={() => {
                props.onClose();
              }}
            >
              Go on
            </button>
          </>
        )}
      </Show>
      <Show when={message()}>
        <p data-part="danger" class="mt-2 text-xs text-red-400" role="alert">
          {message()}
        </p>
      </Show>
    </aside>
  );
}
