import { For, type JSX, Show, createSignal } from 'solid-js';
import type Game from '../game/game';
import type { Due } from '../game/wages';
import { itemName } from '../gen/loot';
import type { Item } from '../sim/item';
import { MORALE_NAME, moraleOf } from '../sim/morale';

interface Props {
  game: Game;
  // Bumped by the game whenever items or gold change, so the panel reads them again
  version: number;
  onClose: () => void;
}

/**
 * The Guild's post at a Waystation: each merc's wage, and the vault. The
 * game is paused while it is open.
 */
export default function Station(props: Props): JSX.Element {
  const [message, setMessage] = createSignal<string | null>(null);
  const dues = (): Due[] => (props.version >= 0 ? props.game.dues() : []);
  const gold = (): number => (props.version >= 0 ? props.game.pack.gold : 0);
  const pack = (): Item[] => (props.version >= 0 ? [...props.game.pack.items] : []);
  const vault = (): Item[] => (props.version >= 0 ? [...props.game.vault.items] : []);
  const name = (item: Item): string => (props.version >= 0 ? itemName(item) : '');
  const unpaid = (): Due[] => dues().filter((d) => !d.paid);

  return (
    <aside
      data-part="panel"
      class="absolute top-6 left-1/2 w-[720px] -translate-x-1/2 border border-zinc-700 bg-zinc-950/95 p-4 text-sm text-zinc-300 shadow-xl"
      aria-label="Waystation"
    >
      <header class="mb-3 flex items-baseline justify-between">
        <h2 data-part="title" class="font-serif text-lg text-zinc-100">
          The Guild’s Waystation
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

      <section aria-label="Wages">
        <p data-part="note" class="mb-2 text-xs text-zinc-400">
          The paymaster opens the ledger. Each merc asks its wage for the layer ahead. You have{' '}
          {gold()} gold.
        </p>
        <ul class="space-y-1">
          <For each={dues()}>
            {(due) => (
              <li data-part="row" class="flex items-center gap-2 border border-zinc-800 px-2 py-1">
                <span class="flex-1">
                  {due.merc.name}
                  <span data-part="note" class="text-xs text-zinc-500">
                    {' '}
                    · {due.merc.job.name} · level {due.merc.level} · morale{' '}
                    {MORALE_NAME[moraleOf(due.merc)].toLowerCase()}
                  </span>
                </span>
                <span class="w-20 text-right">{due.wage} gold</span>
                <Show
                  when={!due.paid}
                  fallback={
                    <span data-part="note" class="w-16 text-center text-xs text-zinc-500">
                      Paid
                    </span>
                  }
                >
                  <button
                    type="button"
                    data-part="choice"
                    aria-label={`Pay ${due.merc.name}`}
                    class="w-16 border border-zinc-600 px-2 hover:border-zinc-300"
                    onClick={() => {
                      setMessage(props.game.pay(due.merc));
                    }}
                  >
                    Pay
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
        <Show when={dues().length === 0}>
          <p data-part="note" class="text-xs text-zinc-500">
            No living merc asks a wage. The dead draw none.
          </p>
        </Show>
        <Show when={unpaid().length > 0}>
          <p data-part="danger" class="mt-2 text-xs text-red-400">
            Unpaid mercs lose heart and Discipline when you take the road on, and a merc whose
            morale breaks deserts:{' '}
            {unpaid()
              .map((d) => d.merc.name)
              .join(', ')}
            .
          </p>
        </Show>
        <Show when={message()}>
          <p data-part="danger" class="mt-2 text-xs text-red-400" role="alert">
            {message()}
          </p>
        </Show>
      </section>

      <section class="mt-4 flex gap-4" aria-label="Vault">
        <div class="w-1/2">
          <h3 data-part="title" class="mb-1 font-serif text-zinc-100">
            Pack
          </h3>
          <ul class="max-h-56 space-y-1 overflow-y-auto" aria-label="Pack to store">
            <For each={pack()}>
              {(item) => (
                <li
                  data-part="row"
                  class="flex items-center gap-2 border border-zinc-800 px-2 py-1"
                >
                  <span class="flex-1" data-quality={item.quality}>
                    {name(item)}
                  </span>
                  <button
                    type="button"
                    data-part="choice"
                    aria-label={`Store ${name(item)}`}
                    class="border border-zinc-700 px-1.5 text-xs text-zinc-400 hover:border-zinc-300 hover:text-zinc-100"
                    onClick={() => {
                      setMessage(props.game.store(item.uid));
                    }}
                  >
                    Store
                  </button>
                </li>
              )}
            </For>
          </ul>
        </div>
        <div class="w-1/2">
          <h3 data-part="title" class="mb-1 font-serif text-zinc-100">
            Vault
            <span data-part="note" class="text-xs text-zinc-500">
              {' '}
              · {vault().length} / {props.game.vault.slots}
            </span>
          </h3>
          <ul class="max-h-56 space-y-1 overflow-y-auto" aria-label="Vault">
            <For each={vault()}>
              {(item) => (
                <li
                  data-part="row"
                  class="flex items-center gap-2 border border-zinc-800 px-2 py-1"
                >
                  <span class="flex-1" data-quality={item.quality}>
                    {name(item)}
                  </span>
                  <button
                    type="button"
                    data-part="choice"
                    aria-label={`Take ${name(item)}`}
                    class="border border-zinc-700 px-1.5 text-xs text-zinc-400 hover:border-zinc-300 hover:text-zinc-100"
                    onClick={() => {
                      setMessage(props.game.takeOut(item.uid));
                    }}
                  >
                    Take
                  </button>
                </li>
              )}
            </For>
          </ul>
          <Show when={vault().length === 0}>
            <p data-part="note" class="text-xs text-zinc-500">
              Empty. What you store here is safe, but it opens only at a Waystation.
            </p>
          </Show>
        </div>
      </section>
    </aside>
  );
}
