import { For, type JSX, Show, createSignal } from 'solid-js';
import type { EventView } from '../game/game';
import { Button, Icon, Notice } from './kit';

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
      class="panel absolute top-1/2 left-1/2 w-[480px] -translate-x-1/2 -translate-y-1/2 p-6"
      aria-label={props.event.title}
    >
      <div class="mb-3 flex items-center gap-3">
        <span class="grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
          <Icon name="event" class="size-6" />
        </span>
        <h2 class="font-display text-2xl font-semibold text-neutral-50">{props.event.title}</h2>
      </div>
      <p class="mb-5 text-sm leading-relaxed text-neutral-300">{props.event.text}</p>
      <Show
        when={props.event.outcome}
        fallback={
          <div class="flex flex-col gap-2">
            <For each={props.event.choices}>
              {(choice, i) => (
                <button
                  type="button"
                  disabled={choice.why !== null}
                  class="group flex items-start gap-3 rounded-xl bg-white/4 px-4 py-3 text-left ring-1 ring-white/8 transition hover:bg-white/8 hover:ring-accent/50 disabled:opacity-40 disabled:hover:bg-white/4 disabled:hover:ring-white/8"
                  onClick={() => {
                    setMessage(props.onChoose(i()));
                  }}
                >
                  <span class="grid size-5 shrink-0 place-items-center rounded bg-white/10 text-[10px] font-bold text-neutral-400 group-hover:text-accent">
                    {i() + 1}
                  </span>
                  <span class="text-sm text-neutral-100">
                    {choice.label}
                    <Show when={choice.why}>
                      <span class="block text-xs text-neutral-500">{choice.why}</span>
                    </Show>
                  </span>
                </button>
              )}
            </For>
          </div>
        }
      >
        {(outcome) => (
          <>
            <p
              class="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-neutral-100 italic"
              role="status"
            >
              {outcome()}
            </p>
            <Button
              tone="primary"
              class="w-full"
              onClick={() => {
                props.onClose();
              }}
            >
              Go on
            </Button>
          </>
        )}
      </Show>
      <Notice text={message()} />
    </aside>
  );
}
