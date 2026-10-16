import { For, type JSX, Show, createSignal } from 'solid-js';
import type Game from '../game/game';
import type { Due } from '../game/wages';
import { itemName } from '../gen/loot';
import type { Item } from '../sim/item';
import { MORALE_NAME, moraleOf } from '../sim/morale';
import { iconOr } from './icons';
import { ItemSlot } from './items';
import { Button, Icon, Notice, Panel } from './kit';

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
  const free = (): number[] =>
    Array.from({ length: Math.max(0, props.game.vault.slots - vault().length) }, (_, i) => i);

  return (
    <Panel
      label="Waystation"
      title="The Guild’s Waystation"
      icon="waystation"
      class="w-[760px]"
      aside={
        <span class="flex h-8 items-center gap-1 text-sm font-semibold text-accent">
          <Icon name="gold" class="size-4" />
          {gold()}
        </span>
      }
      onClose={() => {
        props.onClose();
      }}
    >
      <section aria-label="Wages">
        <h3 class="eyebrow mb-1">Wages</h3>
        <p class="mb-3 text-xs text-neutral-400">
          The paymaster opens the ledger. Each merc asks its wage for the layer ahead.
        </p>
        <ul class="grid grid-cols-2 gap-2">
          <For each={dues()}>
            {(due) => (
              <li class="well flex items-center gap-3 p-2">
                <span class="grid size-10 place-items-center rounded-lg bg-white/5 text-neutral-200">
                  <Icon name={iconOr(due.merc.kind, 'vanguard')} class="size-6" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm text-neutral-100">{due.merc.name}</span>
                  <span class="block text-[11px] text-neutral-500">
                    {due.merc.job.name} · level {due.merc.level} · morale{' '}
                    {MORALE_NAME[moraleOf(due.merc)].toLowerCase()}
                  </span>
                </span>
                <Show
                  when={!due.paid}
                  fallback={
                    <span class="rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                      Paid
                    </span>
                  }
                >
                  <Button
                    size="sm"
                    tone="primary"
                    aria-label={`Pay ${due.merc.name}`}
                    onClick={() => {
                      setMessage(props.game.pay(due.merc));
                    }}
                  >
                    <Icon name="gold" class="size-3.5" />
                    {due.wage}
                  </Button>
                </Show>
              </li>
            )}
          </For>
        </ul>
        <Show when={dues().length === 0}>
          <p class="text-xs text-neutral-500">No living merc asks a wage. The dead draw none.</p>
        </Show>
        <Show when={unpaid().length > 0}>
          <p class="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200 ring-1 ring-red-400/20">
            Unpaid mercs lose heart and Discipline when you take the road on, and a merc whose
            morale breaks deserts:{' '}
            {unpaid()
              .map((d) => d.merc.name)
              .join(', ')}
            .
          </p>
        </Show>
        <Notice text={message()} />
      </section>

      <section class="mt-5 grid grid-cols-2 gap-5" aria-label="Vault">
        <div>
          <h3 class="eyebrow mb-2">Pack</h3>
          <ul class="flex flex-wrap gap-1.5" aria-label="Pack to store">
            <For each={pack()} fallback={<li class="text-xs text-neutral-600">Empty.</li>}>
              {(item) => (
                <li>
                  <ItemSlot
                    version={props.version}
                    item={item}
                    aria-label={`Store ${name(item)}`}
                    onClick={() => {
                      setMessage(props.game.store(item.uid));
                    }}
                    extra={<p class="text-neutral-500">Click to store it in the vault.</p>}
                  />
                </li>
              )}
            </For>
          </ul>
        </div>
        <div>
          <h3 class="eyebrow mb-2">
            Vault · {vault().length} / {props.game.vault.slots}
          </h3>
          <ul class="flex flex-wrap gap-1.5" aria-label="Vault">
            <For each={vault()}>
              {(item) => (
                <li>
                  <ItemSlot
                    version={props.version}
                    item={item}
                    aria-label={`Take ${name(item)}`}
                    onClick={() => {
                      setMessage(props.game.takeOut(item.uid));
                    }}
                    extra={<p class="text-neutral-500">Click to take it into the pack.</p>}
                  />
                </li>
              )}
            </For>
            <For each={free()}>
              {() => (
                <li aria-hidden="true" class="size-14 rounded-lg bg-black/25 ring-1 ring-white/3" />
              )}
            </For>
          </ul>
          <p class="mt-2 text-[11px] text-neutral-600">
            What you store here is safe, but it opens only at a Waystation.
          </p>
        </div>
      </section>
    </Panel>
  );
}
