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
import { itemName, socketLimit } from '../gen/loot';
import { type Item, MAX_REFINE } from '../sim/item';
import type Unit from '../sim/unit';
import { iconOr } from './icons';
import { ItemSlot, qualityColor } from './items';
import { Button, Icon, Notice, Panel, type TabSpec, Tabs, Tip } from './kit';

type Tab = 'smith' | 'bench' | 'temple' | 'market';

const TABS: TabSpec<Tab>[] = [
  { value: 'smith', name: 'Smith', icon: 'smith' },
  { value: 'bench', name: 'Bench', icon: 'bench' },
  { value: 'temple', name: 'Temple', icon: 'temple' },
  { value: 'market', name: 'Market', icon: 'market' },
];

interface Props {
  game: Game;
  // Bumped by the game whenever items or gold change
  version: number;
  onClose: () => void;
}

// A material and how many, as an icon chip
function MaterialChip(props: { id: string; count: number; have?: number }): JSX.Element {
  const short = (): boolean => props.have !== undefined && props.have < props.count;
  return (
    <Tip text={MATERIAL_NAME.get(props.id) ?? props.id}>
      {(anchor) => (
        <span
          {...anchor}
          class="inline-flex h-6 items-center gap-1 rounded-md bg-white/5 px-1.5 text-[11px] ring-1 ring-white/8"
          classList={{ 'text-red-300': short(), 'text-neutral-300': !short() }}
        >
          <Icon name={iconOr(props.id, 'bone')} class="size-3.5" />
          {props.count}
          <span class="sr-only">{MATERIAL_NAME.get(props.id) ?? props.id}</span>
        </span>
      )}
    </Tip>
  );
}

/**
 * A Town: the Blacksmith refines and adds sockets, the Synthesis bench
 * crafts and salvages, the Temple raises the dead, the Market buys and
 * sells. The game is paused while it is open.
 */
export default function Town(props: Props): JSX.Element {
  const [tab, setTab] = createSignal<Tab>('smith');
  const [message, setMessage] = createSignal<string | null>(null);
  const [bless, setBless] = createSignal(true);
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
    <Panel
      label="Town"
      title="The Town"
      icon="town"
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
      <Tabs
        label="Town"
        tabs={TABS}
        value={tab()}
        onChange={(t) => {
          setTab(t);
          setMessage(null);
        }}
      />

      <Show when={tab() === 'smith'}>
        <p class="mb-3 text-xs leading-relaxed text-neutral-400">
          Refining to +{SAFE_REFINE} always works. Past it, a failure breaks the item and every card
          in it, unless a Smith’s Blessing takes the blow: then it loses a level instead. A new
          socket can break the item too.
        </p>
        <label class="mb-3 flex items-center gap-2 text-xs text-neutral-300">
          <input
            type="checkbox"
            class="accent-accent"
            checked={bless()}
            onChange={(e) => {
              setBless(e.currentTarget.checked);
            }}
          />
          Use a Smith’s Blessing on a failure
          <MaterialChip id="blessing" count={blessings()} />
        </label>
        <ul class="grid grid-cols-2 gap-2" aria-label="Smith">
          <For each={smithable()}>
            {({ item, merc }) => (
              <li class="well flex items-center gap-3 p-2">
                <ItemSlot item={item} version={props.version} tabIndex={-1} aria-hidden="true" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm" style={{ color: qualityColor(item) }}>
                    {name(item)}
                  </p>
                  <p class="mb-1.5 text-[11px] text-neutral-500">{merc ? merc.name : 'Pack'}</p>
                  <div class="flex flex-wrap gap-1">
                    <Show when={item.refine < MAX_REFINE}>
                      <Button
                        size="sm"
                        aria-label={`Refine ${name(item)}`}
                        onClick={() => {
                          say(props.game.refineItem(item, bless()));
                        }}
                      >
                        +{item.refine + 1} · {refineCost(item)}g ·{' '}
                        {Math.round(refineChance(item) * 100)}%
                      </Button>
                    </Show>
                    <Show when={item.sockets < socketLimit(item)}>
                      <Button
                        size="sm"
                        aria-label={`Add a socket to ${name(item)}`}
                        onClick={() => {
                          say(props.game.socketItem(item));
                        }}
                      >
                        Socket · {socketCost(item)}g
                      </Button>
                    </Show>
                  </div>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={tab() === 'bench'}>
        <div class="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <span class="eyebrow mr-1">Pouch</span>
          <For
            each={pouch()}
            fallback={<span>Empty. Monsters leave materials when they die.</span>}
          >
            {([id, n]) => <MaterialChip id={id} count={n} />}
          </For>
        </div>
        <ul class="space-y-1.5" aria-label="Recipes">
          <For each={RECIPES}>
            {(recipe: Recipe) => (
              <li class="well flex items-center gap-3 px-3 py-2">
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-neutral-100">{recipe.name}</p>
                  <p class="text-xs text-neutral-500">{recipe.describe}</p>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  <For each={recipe.materials}>
                    {([id, n]) => (
                      <MaterialChip
                        id={id}
                        count={n}
                        have={props.game.pack.materials.get(id) ?? 0}
                      />
                    )}
                  </For>
                  <span class="ml-1 flex items-center gap-0.5 text-[11px] text-accent">
                    <Icon name="gold" class="size-3.5" />
                    {recipe.gold}
                  </span>
                </div>
                <Button
                  size="sm"
                  tone="primary"
                  aria-label={`Make ${recipe.name}`}
                  disabled={v() && cannotCraft(props.game.pack, recipe) !== null}
                  onClick={() => {
                    say(props.game.craft(recipe) ?? `Made: ${recipe.name}.`);
                  }}
                >
                  Make
                </Button>
              </li>
            )}
          </For>
        </ul>
        <h3 class="eyebrow mt-5 mb-2">Salvage</h3>
        <ul class="flex flex-wrap gap-1.5" aria-label="Salvage">
          <For
            each={pack().filter((i) => salvage(i).size > 0)}
            fallback={<li class="text-xs text-neutral-600">Nothing in the pack to salvage.</li>}
          >
            {(item) => (
              <li>
                <ItemSlot
                  version={props.version}
                  item={item}
                  aria-label={`Salvage ${name(item)}`}
                  onClick={() => {
                    say(props.game.salvage(item.uid) ?? `Salvaged ${name(item)}.`);
                  }}
                  extra={
                    <div class="flex flex-wrap items-center gap-1 text-neutral-400">
                      Click to break it down into
                      <For each={[...salvage(item)]}>
                        {([id, n]) => <MaterialChip id={id} count={n} />}
                      </For>
                    </div>
                  }
                />
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={tab() === 'temple'}>
        <p class="mb-3 text-xs leading-relaxed text-neutral-400">
          The priests of the old faith raise the dead, for an offering. They cannot raise a body
          that was torn apart.
        </p>
        <ul class="space-y-1.5" aria-label="The dead">
          <For each={dead()}>
            {(merc) => (
              <li class="well flex items-center gap-3 px-3 py-2">
                <span class="grid size-9 place-items-center rounded-lg bg-white/5 text-neutral-500 grayscale">
                  <Icon name={iconOr(merc.kind, 'vanguard')} class="size-6" />
                </span>
                <span class="flex-1 text-sm text-neutral-100">
                  {merc.name}
                  <span class="block text-xs text-neutral-500">
                    {merc.torn ? 'Torn apart' : `Level ${merc.level}`}
                  </span>
                </span>
                <Show when={!merc.torn}>
                  <Button
                    size="sm"
                    tone="primary"
                    aria-label={`Raise ${merc.name}`}
                    onClick={() => {
                      say(props.game.raise(merc) ?? `${merc.name} rises.`);
                    }}
                  >
                    Raise · {raiseCost(merc)}g
                  </Button>
                </Show>
              </li>
            )}
          </For>
        </ul>
        <Show when={dead().length === 0}>
          <p class="text-xs text-neutral-500">No merc lies dead.</p>
        </Show>
      </Show>

      <Show when={tab() === 'market'}>
        <h3 class="eyebrow mb-2">Wares</h3>
        <ul class="mb-5 grid grid-cols-3 gap-2" aria-label="Wares">
          <For each={WARES}>
            {(ware) => (
              <li class="well flex items-center gap-3 p-2">
                <span class="grid size-11 place-items-center rounded-lg bg-black/30 text-neutral-200">
                  <Icon name={iconOr(ware.id, 'healingDraught')} class="size-7" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-neutral-100">{BASE_BY_ID.get(ware.id)?.name}</p>
                  <Button
                    size="sm"
                    tone="primary"
                    class="mt-1"
                    aria-label={`Buy ${BASE_BY_ID.get(ware.id)?.name ?? ware.id}`}
                    onClick={() => {
                      say(props.game.buy(ware.id) ?? 'Bought.');
                    }}
                  >
                    <Icon name="gold" class="size-3.5" />
                    {ware.price}
                  </Button>
                </div>
              </li>
            )}
          </For>
        </ul>
        <h3 class="eyebrow mb-2">Sell from the pack</h3>
        <ul class="flex flex-wrap gap-1.5" aria-label="Sell">
          <For
            each={pack()}
            fallback={<li class="text-xs text-neutral-600">The pack is empty.</li>}
          >
            {(item) => (
              <li class="flex flex-col items-center gap-0.5">
                <ItemSlot
                  version={props.version}
                  item={item}
                  aria-label={`Sell ${name(item)}`}
                  onClick={() => {
                    say(props.game.sell(item.uid) ?? `Sold ${name(item)}.`);
                  }}
                  extra={<p class="text-neutral-400">Click to sell for {sellValue(item)} gold.</p>}
                />
                <span class="text-[10px] text-accent">{sellValue(item)}g</span>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Notice text={message()} tone="info" />
    </Panel>
  );
}
