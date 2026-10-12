import { For, type JSX, Show, createSignal } from 'solid-js';
import { MATERIAL_NAME, salvage } from '../content/materials';
import { RECIPES, type Recipe } from '../content/recipes';
import type Game from '../game/game';
import {
  SAFE_REFINE,
  WARES,
  cannotCraft,
  raiseCost,
  refineChance,
  refineCost,
  sellValue,
  socketCost,
} from '../game/town';
import { BASE_BY_ID } from '../content/items';
import { itemLines, itemName, socketLimit } from '../gen/loot';
import { type Item, MAX_REFINE } from '../sim/item';
import type Unit from '../sim/unit';

type Tab = 'smith' | 'bench' | 'temple' | 'market';

const TABS: { value: Tab; name: string }[] = [
  { value: 'smith', name: 'Smith' },
  { value: 'bench', name: 'Bench' },
  { value: 'temple', name: 'Temple' },
  { value: 'market', name: 'Market' },
];

interface Props {
  game: Game;
  // Bumped by the game whenever items or gold change
  version: number;
  onClose: () => void;
}

const BUTTON =
  'border border-zinc-700 px-1.5 text-xs text-zinc-400 hover:border-zinc-300 hover:text-zinc-100';

const materialsText = (cost: readonly [string, number][]): string =>
  cost.map(([id, n]) => `${n} ${MATERIAL_NAME.get(id) ?? id}`).join(', ');

/**
 * A Town: the Blacksmith refines and adds sockets, the Synthesis bench
 * crafts and salvages, the Temple raises the dead, the Market buys and
 * sells. The game is paused while it is open.
 */
export default function Town(props: Props): JSX.Element {
  const [tab, setTab] = createSignal<Tab>('smith');
  const [message, setMessage] = createSignal<string | null>(null);
  const [bless, setBless] = createSignal(true);
  const [hovered, setHovered] = createSignal<Item | null>(null);
  const v = (): boolean => props.version >= 0;
  const gold = (): number => (v() ? props.game.pack.gold : 0);
  const pouch = (): [string, number][] => (v() ? [...props.game.pack.materials] : []);
  const blessings = (): number => (v() ? (props.game.pack.materials.get('blessing') ?? 0) : 0);
  const smithable = (): { item: Item; merc: Unit | null }[] => (v() ? props.game.smithable() : []);
  const pack = (): Item[] => (v() ? [...props.game.pack.items] : []);
  const dead = (): Unit[] => (v() ? props.game.mercs().filter((m) => !m.alive) : []);
  const name = (item: Item): string => (v() ? itemName(item) : '');

  const say = (text: string | null): void => {
    setMessage(text);
  };

  return (
    <aside
      data-part="panel"
      class="absolute top-6 left-1/2 w-[760px] -translate-x-1/2 border border-zinc-700 bg-zinc-950/95 p-4 text-sm text-zinc-300 shadow-xl"
      aria-label="Town"
    >
      <header class="mb-3 flex items-baseline justify-between">
        <h2 data-part="title" class="font-serif text-lg text-zinc-100">
          The Town
        </h2>
        <span data-part="note" class="text-xs text-zinc-500">
          {gold()} gold
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
      <div class="mb-3 grid grid-cols-4 gap-1" role="tablist" aria-label="Town">
        <For each={TABS}>
          {(t) => (
            <button
              type="button"
              role="tab"
              data-part="choice"
              aria-selected={tab() === t.value}
              aria-checked={tab() === t.value}
              class="border px-2 py-1"
              onClick={() => {
                setTab(t.value);
                setMessage(null);
              }}
            >
              {t.name}
            </button>
          )}
        </For>
      </div>

      <Show when={tab() === 'smith'}>
        <p data-part="note" class="mb-2 text-xs text-zinc-400">
          Refining to +{SAFE_REFINE} always works. Past it, a failure breaks the item and every card
          in it, unless a Smith’s Blessing takes the blow: then it loses a level instead. A new
          socket can break the item too.
        </p>
        <label class="mb-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={bless()}
            onChange={(e) => {
              setBless(e.currentTarget.checked);
            }}
          />
          Use a Smith’s Blessing on a failure ({blessings()} in the pouch)
        </label>
        <ul class="max-h-80 space-y-1 overflow-y-auto" aria-label="Smith">
          <For each={smithable()}>
            {({ item, merc }) => (
              <li data-part="row" class="flex items-center gap-2 border border-zinc-800 px-2 py-1">
                <span
                  class="flex-1"
                  data-quality={item.quality}
                  onMouseEnter={() => {
                    setHovered(item);
                  }}
                  onMouseLeave={() => {
                    setHovered(null);
                  }}
                >
                  {name(item)}
                  <span data-part="note" class="text-xs text-zinc-500">
                    {' '}
                    · {merc ? merc.name : 'pack'}
                  </span>
                </span>
                <Show when={item.refine < MAX_REFINE}>
                  <button
                    type="button"
                    data-part="choice"
                    aria-label={`Refine ${name(item)}`}
                    class={BUTTON}
                    onClick={() => {
                      say(props.game.refineItem(item, bless()));
                    }}
                  >
                    +{item.refine + 1} · {refineCost(item)}g ·{' '}
                    {Math.round(refineChance(item) * 100)}%
                  </button>
                </Show>
                <Show when={item.sockets < socketLimit(item)}>
                  <button
                    type="button"
                    data-part="choice"
                    aria-label={`Add a socket to ${name(item)}`}
                    class={BUTTON}
                    onClick={() => {
                      say(props.game.socketItem(item));
                    }}
                  >
                    Socket · {socketCost(item)}g
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
        <Show when={hovered()} keyed>
          {(item) => (
            <div data-part="row" class="mt-2 border border-zinc-800 p-2 text-xs">
              <For each={itemLines(item)}>{(line) => <p data-part="note">{line}</p>}</For>
            </div>
          )}
        </Show>
      </Show>

      <Show when={tab() === 'bench'}>
        <p data-part="note" class="mb-2 text-xs text-zinc-400">
          The pouch:{' '}
          {pouch().length > 0
            ? pouch()
                .map(([id, n]) => `${n} ${MATERIAL_NAME.get(id) ?? id}`)
                .join(', ')
            : 'empty. Monsters leave materials when they die.'}
        </p>
        <ul class="space-y-1" aria-label="Recipes">
          <For each={RECIPES}>
            {(recipe: Recipe) => (
              <li data-part="row" class="flex items-center gap-2 border border-zinc-800 px-2 py-1">
                <span class="flex-1">
                  {recipe.name}
                  <span data-part="note" class="text-xs text-zinc-500">
                    {' '}
                    · {materialsText(recipe.materials)}, {recipe.gold} gold
                  </span>
                  <span data-part="note" class="block text-xs text-zinc-500">
                    {recipe.describe}
                  </span>
                </span>
                <button
                  type="button"
                  data-part="choice"
                  aria-label={`Make ${recipe.name}`}
                  disabled={v() && cannotCraft(props.game.pack, recipe) !== null}
                  class={`${BUTTON} disabled:opacity-40`}
                  onClick={() => {
                    say(props.game.craft(recipe) ?? `Made: ${recipe.name}.`);
                  }}
                >
                  Make
                </button>
              </li>
            )}
          </For>
        </ul>
        <h3 data-part="title" class="mt-3 mb-1 font-serif text-zinc-100">
          Salvage
        </h3>
        <ul class="max-h-40 space-y-1 overflow-y-auto" aria-label="Salvage">
          <For each={pack().filter((i) => salvage(i).size > 0)}>
            {(item) => (
              <li data-part="row" class="flex items-center gap-2 border border-zinc-800 px-2 py-1">
                <span class="flex-1" data-quality={item.quality}>
                  {name(item)}
                </span>
                <button
                  type="button"
                  data-part="choice"
                  aria-label={`Salvage ${name(item)}`}
                  class={BUTTON}
                  onClick={() => {
                    say(props.game.salvage(item.uid) ?? `Salvaged ${name(item)}.`);
                  }}
                >
                  Salvage
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={tab() === 'temple'}>
        <p data-part="note" class="mb-2 text-xs text-zinc-400">
          The priests of the old faith raise the dead, for an offering. They cannot raise a body
          that was torn apart.
        </p>
        <ul class="space-y-1" aria-label="The dead">
          <For each={dead()}>
            {(merc) => (
              <li data-part="row" class="flex items-center gap-2 border border-zinc-800 px-2 py-1">
                <span class="flex-1">
                  {merc.name}
                  <span data-part="note" class="text-xs text-zinc-500">
                    {' '}
                    · {merc.torn ? 'torn apart' : `level ${merc.level}`}
                  </span>
                </span>
                <Show when={!merc.torn}>
                  <button
                    type="button"
                    data-part="choice"
                    aria-label={`Raise ${merc.name}`}
                    class={BUTTON}
                    onClick={() => {
                      say(props.game.raise(merc) ?? `${merc.name} rises.`);
                    }}
                  >
                    Raise · {raiseCost(merc)}g
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
        <Show when={dead().length === 0}>
          <p data-part="note" class="text-xs text-zinc-500">
            No merc lies dead.
          </p>
        </Show>
      </Show>

      <Show when={tab() === 'market'}>
        <ul class="mb-3 space-y-1" aria-label="Wares">
          <For each={WARES}>
            {(ware) => (
              <li data-part="row" class="flex items-center gap-2 border border-zinc-800 px-2 py-1">
                <span class="flex-1">{BASE_BY_ID.get(ware.id)?.name}</span>
                <button
                  type="button"
                  data-part="choice"
                  aria-label={`Buy ${BASE_BY_ID.get(ware.id)?.name ?? ware.id}`}
                  class={BUTTON}
                  onClick={() => {
                    say(props.game.buy(ware.id) ?? 'Bought.');
                  }}
                >
                  Buy · {ware.price}g
                </button>
              </li>
            )}
          </For>
        </ul>
        <ul class="max-h-56 space-y-1 overflow-y-auto" aria-label="Sell">
          <For each={pack()}>
            {(item) => (
              <li data-part="row" class="flex items-center gap-2 border border-zinc-800 px-2 py-1">
                <span class="flex-1" data-quality={item.quality}>
                  {name(item)}
                </span>
                <button
                  type="button"
                  data-part="choice"
                  aria-label={`Sell ${name(item)}`}
                  class={BUTTON}
                  onClick={() => {
                    say(props.game.sell(item.uid) ?? `Sold ${name(item)}.`);
                  }}
                >
                  Sell · {sellValue(item)}g
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={message()}>
        <p data-part="danger" class="mt-2 text-xs text-amber-300" role="alert">
          {message()}
        </p>
      </Show>
    </aside>
  );
}
