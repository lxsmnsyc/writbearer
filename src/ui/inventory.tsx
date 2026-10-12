import { For, type JSX, Show, createSignal } from 'solid-js';
import type Game from '../game/game';
import { itemLines, itemName } from '../gen/loot';
import { socketFor } from '../game/inventory';
import { EQUIP_SLOTS, EquipSlot, type Item, isCard, isPotion, usableBy } from '../sim/item';
import type Unit from '../sim/unit';

// What handing an item over does: wear it, belt it, or socket it.
const action = (item: Item): string => {
  if (isPotion(item)) {
    return 'Belt';
  }
  return isCard(item) ? 'Socket' : 'Give';
};

const SLOT_NAMES: Record<EquipSlot, string> = {
  [EquipSlot.Weapon]: 'Weapon',
  [EquipSlot.Offhand]: 'Offhand',
  [EquipSlot.Head]: 'Head',
  [EquipSlot.Body]: 'Body',
  [EquipSlot.Cloak]: 'Cloak',
  [EquipSlot.Boots]: 'Boots',
  [EquipSlot.Accessory1]: 'Accessory',
  [EquipSlot.Accessory2]: 'Accessory',
};

interface Props {
  game: Game;
  // Bumped by the game whenever items change, so the panel reads them again
  version: number;
  onClose: () => void;
}

/**
 * The bearer's pack and the party's gear. The game is paused while it is
 * open. Click an item in the pack to hand it to the chosen merc, and a worn
 * item to take it back.
 */
export default function Inventory(props: Props): JSX.Element {
  // Opens on the merc whose sheet asked for it, or the first.
  const [mercIndex, setMercIndex] = createSignal(
    Math.max(
      0,
      props.game.mercs().findIndex((m) => m === props.game.gearFor),
    ),
  );
  const [message, setMessage] = createSignal<string | null>(null);
  const [hovered, setHovered] = createSignal<Item | null>(null);

  // Read through `version`, so Solid reads the game's state again on each change.
  const mercs = (): Unit[] => (props.version >= 0 ? props.game.mercs() : []);
  const merc = (): Unit | undefined => mercs()[mercIndex()];
  const pack = (): Item[] => (props.version >= 0 ? [...props.game.pack.items] : []);
  const gold = (): number => (props.version >= 0 ? props.game.pack.gold : 0);
  const weight = (): number => (props.version >= 0 ? props.game.pack.weight : 0);

  // Stacks change in place, so names are read again on every change.
  const name = (item: Item): string => (props.version >= 0 ? itemName(item) : '');
  const fits = (item: Item): boolean => {
    const m = merc();
    if (!m) {
      return false;
    }
    return isCard(item) ? socketFor(m, item) !== null : usableBy(item, m.job.name);
  };
  const nobody = (item: Item): boolean => !mercs().some((m) => usableBy(item, m.job.name));

  const equip = (item: Item): void => {
    const m = merc();
    if (m) {
      setMessage(props.game.equip(m, item.uid));
    }
  };

  const unequip = (slot: EquipSlot): void => {
    const m = merc();
    if (m) {
      setMessage(props.game.unequip(m, slot));
    }
  };

  const stats = (): string => {
    const m = merc();
    if (!m || props.version < 0) {
      return '';
    }
    const d = m.derived;
    return `Attack ${d.atkMin} to ${d.atkMax} · Armor ${d.armor} · Block ${d.blockChance}% · Health ${d.maxHp}`;
  };

  return (
    <aside
      data-part="panel"
      class="absolute top-6 left-1/2 flex w-[720px] -translate-x-1/2 gap-4 border border-zinc-700 bg-zinc-950/95 p-4 text-sm text-zinc-300 shadow-xl"
      aria-label="Inventory"
    >
      <section class="w-1/2">
        <header class="mb-2 flex items-baseline justify-between">
          <h2 data-part="title" class="font-serif text-lg text-zinc-100">
            Pack
          </h2>
          <span data-part="note" class="text-xs text-zinc-500">
            {gold()} gold · weight {weight()} / {props.game.pack.maxWeight}
          </span>
        </header>
        <ul class="max-h-80 space-y-1 overflow-y-auto" aria-label="Pack">
          <For each={pack()}>
            {(item) => (
              <li data-part="row" class="flex items-center gap-2 border border-zinc-800 px-2 py-1">
                <button
                  type="button"
                  class="flex-1 text-left"
                  classList={{ 'opacity-50': !fits(item) }}
                  data-quality={item.quality}
                  onMouseEnter={() => {
                    setHovered(item);
                  }}
                  onMouseLeave={() => {
                    setHovered(null);
                  }}
                  onClick={() => {
                    equip(item);
                  }}
                >
                  {name(item)}
                </button>
                <Show when={fits(item)}>
                  <button
                    type="button"
                    aria-label={`Give ${name(item)} to ${merc()?.name ?? ''}`}
                    data-part="choice"
                    class="border border-zinc-700 px-1.5 text-xs text-zinc-400 hover:border-zinc-300 hover:text-zinc-100"
                    onClick={() => {
                      equip(item);
                    }}
                  >
                    {action(item)}
                  </button>
                </Show>
                <button
                  type="button"
                  aria-label={`Drop ${name(item)}`}
                  data-part="danger"
                  class="px-1 text-zinc-500 hover:text-red-400"
                  onClick={() => {
                    props.game.drop(item.uid);
                  }}
                >
                  ×
                </button>
              </li>
            )}
          </For>
        </ul>
        <Show when={pack().length === 0}>
          <p data-part="note" class="text-xs text-zinc-500">
            Empty. Click an item on the floor to pick it up.
          </p>
        </Show>
        <Show when={hovered()} keyed>
          {(item) => (
            <div data-part="row" class="mt-3 border border-zinc-800 p-2 text-xs">
              <p data-quality={item.quality} class="mb-1">
                {name(item)}
              </p>
              <For each={itemLines(item)}>{(line) => <p data-part="note">{line}</p>}</For>
              <Show when={nobody(item)}>
                <p data-part="danger" class="mt-1 text-red-400">
                  No one in the party can use this.
                </p>
              </Show>
            </div>
          )}
        </Show>
      </section>

      <section class="w-1/2">
        <header class="mb-2 flex items-baseline justify-between">
          <div class="flex gap-1" role="tablist" aria-label="Mercs">
            <For each={mercs()}>
              {(m, i) => (
                <button
                  type="button"
                  role="tab"
                  data-part="choice"
                  aria-checked={i() === mercIndex()}
                  aria-selected={i() === mercIndex()}
                  class="border px-2 py-0.5"
                  onClick={() => {
                    setMercIndex(i());
                    setMessage(null);
                  }}
                >
                  {m.name}
                </button>
              )}
            </For>
          </div>
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
        <p data-part="note" class="mb-2 text-xs text-zinc-400">
          Choose a merc above, then Give it gear from the pack. It wears it at once, and what it
          wore goes back in the pack.
        </p>
        <ul class="space-y-1" aria-label="Equipment">
          <For each={EQUIP_SLOTS}>
            {(slot) => {
              const item = (): Item | undefined =>
                props.version >= 0 ? merc()?.equipment.get(slot) : undefined;
              return (
                <li
                  data-part="row"
                  class="flex items-center gap-2 border border-zinc-800 px-2 py-1"
                >
                  <span data-part="note" class="w-20 text-xs text-zinc-500">
                    {SLOT_NAMES[slot]}
                  </span>
                  <Show
                    when={item()}
                    keyed
                    fallback={
                      <span data-part="note" class="text-xs text-zinc-600">
                        Empty
                      </span>
                    }
                  >
                    {(worn) => (
                      <button
                        type="button"
                        class="flex-1 text-left"
                        data-quality={worn.quality}
                        onMouseEnter={() => {
                          setHovered(worn);
                        }}
                        onMouseLeave={() => {
                          setHovered(null);
                        }}
                        onClick={() => {
                          unequip(slot);
                        }}
                      >
                        {name(worn)}
                      </button>
                    )}
                  </Show>
                </li>
              );
            }}
          </For>
        </ul>
        <ul class="mt-2 grid grid-cols-3 gap-1" aria-label="Belt">
          <For each={[0, 1, 2]}>
            {(slot) => {
              const potion = (): Item | null =>
                props.version >= 0 ? (merc()?.belt[slot] ?? null) : null;
              return (
                <li data-part="row" class="border border-zinc-800 px-1 py-1 text-center text-xs">
                  <Show
                    when={potion()}
                    keyed
                    fallback={
                      <span data-part="note" class="text-zinc-600">
                        Belt
                      </span>
                    }
                  >
                    {(p) => (
                      <button
                        type="button"
                        aria-label={`Take back ${name(p)}`}
                        onClick={() => {
                          const m = merc();
                          if (m) {
                            setMessage(props.game.unbelt(m, slot));
                          }
                        }}
                      >
                        {name(p)}
                      </button>
                    )}
                  </Show>
                </li>
              );
            }}
          </For>
        </ul>
        <p data-part="note" class="mt-2 text-xs text-zinc-500">
          {stats()}
        </p>
        <Show when={message()}>
          <p data-part="danger" class="mt-2 text-xs text-red-400" role="alert">
            {message()}
          </p>
        </Show>
        <p data-part="note" class="mt-3 text-xs text-zinc-600">
          Click an item's name in the pack to hand it over too: gear is worn, potions go on the
          belt. Click a worn item or a belt slot to take it back. I or Esc to close.
        </p>
      </section>
    </aside>
  );
}
