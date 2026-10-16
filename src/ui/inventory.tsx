import { For, type JSX, Show, createSignal } from 'solid-js';
import { MATERIAL_NAME } from '../content/materials';
import type Game from '../game/game';
import { socketFor } from '../game/inventory';
import { itemName } from '../gen/loot';
import { EquipSlot, type Item, isCard, isPotion, slotFor, usableBy } from '../sim/item';
import type Unit from '../sim/unit';
import { type IconName, isIconName } from './icons';
import { EmptySlot, ItemSlot } from './items';
import { CloseMark, Icon, Meter, Notice, Tabs, Tip } from './kit';

// What handing an item over does: wear it, belt it, or socket it.
const action = (item: Item): string => {
  if (isPotion(item)) {
    return 'belt it';
  }
  return isCard(item) ? 'socket it' : 'equip it';
};

interface Place {
  slot: EquipSlot;
  name: string;
  icon: IconName;
}

// The gear around the merc, as Diablo 2's: the head above, the hands at the
// sides, the body in the middle, the boots below.
const DOLL: (Place | null)[] = [
  { slot: EquipSlot.Cloak, name: 'Cloak', icon: 'shroud' },
  { slot: EquipSlot.Head, name: 'Head', icon: 'kettleHelm' },
  { slot: EquipSlot.Accessory1, name: 'Accessory', icon: 'amulet' },
  { slot: EquipSlot.Weapon, name: 'Weapon', icon: 'armingSword' },
  { slot: EquipSlot.Body, name: 'Body', icon: 'jerkin' },
  { slot: EquipSlot.Offhand, name: 'Offhand', icon: 'buckler' },
  null,
  { slot: EquipSlot.Boots, name: 'Boots', icon: 'boots' },
  { slot: EquipSlot.Accessory2, name: 'Accessory', icon: 'ring' },
];

// The pack shows at least this many slots, so it reads as a grid.
const PACK_SLOTS = 40;
const BELT_SLOTS = [0, 1, 2];

// What is being dragged: an item from the pack, or one worn.
type Drag = { from: 'pack'; uid: number } | { from: 'worn'; slot: EquipSlot };

interface Props {
  game: Game;
  // Bumped by the game whenever items change, so the panel reads them again
  version: number;
  onClose: () => void;
}

/**
 * The bearer's pack and the party's gear. The game is paused while it is
 * open. Click an item in the pack to hand it to the chosen merc, and a worn
 * item to take it back; or drag them.
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
  const [drag, setDrag] = createSignal<Drag | null>(null);

  // Read through `version`, so Solid reads the game's state again on each change.
  const v = (): boolean => props.version >= 0;
  const mercs = (): Unit[] => (v() ? props.game.mercs() : []);
  const merc = (): Unit | undefined => mercs()[mercIndex()];
  const pack = (): Item[] => (v() ? [...props.game.pack.items] : []);
  const gold = (): number => (v() ? props.game.pack.gold : 0);
  const weight = (): number => (v() ? props.game.pack.weight : 0);
  const materials = (): [string, number][] => (v() ? [...props.game.pack.materials] : []);
  const worn = (slot: EquipSlot): Item | undefined =>
    v() ? merc()?.equipment.get(slot) : undefined;
  const belt = (slot: number): Item | null => (v() ? (merc()?.belt[slot] ?? null) : null);
  const fillers = (): number[] =>
    Array.from({ length: Math.max(0, PACK_SLOTS - pack().length) }, (_, i) => i);

  const fits = (item: Item): boolean => {
    const m = merc();
    if (!m) {
      return false;
    }
    return isCard(item) ? socketFor(m, item) !== null : usableBy(item, m.job.name);
  };
  const nobody = (item: Item): boolean =>
    !isCard(item) && !mercs().some((m) => usableBy(item, m.job.name));
  // What the item would replace on the chosen merc
  const replaces = (item: Item): Item | undefined => {
    const slot = isPotion(item) || isCard(item) ? null : slotFor(item);
    return slot === null ? undefined : worn(slot);
  };

  const equip = (uid: number): void => {
    const m = merc();
    if (m) {
      setMessage(props.game.equip(m, uid));
    }
  };
  const unequip = (slot: EquipSlot): void => {
    const m = merc();
    if (m) {
      setMessage(props.game.unequip(m, slot));
    }
  };
  const dropOnGear = (): void => {
    const d = drag();
    if (d?.from === 'pack') {
      equip(d.uid);
    }
    setDrag(null);
  };
  const dropOnPack = (): void => {
    const d = drag();
    if (d?.from === 'worn') {
      unequip(d.slot);
    }
    setDrag(null);
  };
  const dropOnBin = (): void => {
    const d = drag();
    if (d?.from === 'pack') {
      props.game.drop(d.uid);
      setMessage(null);
    }
    setDrag(null);
  };
  const accept = (e: DragEvent): void => {
    e.preventDefault();
  };

  const stats = (): { name: string; value: string; icon: IconName }[] => {
    const m = merc();
    if (!m || !v()) {
      return [];
    }
    const d = m.derived;
    return [
      { name: 'Attack', value: `${d.atkMin}–${d.atkMax}`, icon: 'armingSword' },
      { name: 'Armor', value: `${d.armor}`, icon: 'guard' },
      { name: 'Block', value: `${d.blockChance}%`, icon: 'buckler' },
      { name: 'Health', value: `${d.maxHp}`, icon: 'vit' },
    ];
  };

  return (
    <aside
      class="panel absolute top-6 left-1/2 flex max-h-[calc(100%-9rem)] w-[880px] -translate-x-1/2 gap-6 p-5"
      aria-label="Inventory"
    >
      <section class="w-[330px] shrink-0" aria-label="Party gear">
        <header class="mb-3 flex items-center justify-between">
          <h2 class="font-display text-xl font-semibold text-neutral-50">Gear</h2>
        </header>
        <Tabs
          label="Mercs"
          value={mercIndex()}
          onChange={(i) => {
            setMercIndex(i);
            setMessage(null);
          }}
          tabs={mercs().map((m, i) => ({
            value: i,
            name: m.name,
            icon: isIconName(m.kind) ? m.kind : undefined,
          }))}
        />
        <ul
          class="grid grid-cols-3 justify-items-center gap-3 rounded-xl bg-black/20 p-4 ring-1 ring-white/5"
          aria-label="Equipment"
          onDragOver={accept}
          onDrop={dropOnGear}
        >
          <For each={DOLL}>
            {(place) => (
              <li class="flex flex-col items-center gap-1">
                <Show when={place} fallback={<div class="size-16" />}>
                  {(p) => (
                    <>
                      <Show
                        when={worn(p().slot)}
                        keyed
                        fallback={
                          <EmptySlot icon={p().icon} label={`${p().name}: empty`} size="lg" />
                        }
                      >
                        {(item) => (
                          <ItemSlot
                            version={props.version}
                            item={item}
                            size="lg"
                            draggable="true"
                            onDragStart={() => {
                              setDrag({ from: 'worn', slot: p().slot });
                            }}
                            onClick={() => {
                              unequip(p().slot);
                            }}
                            extra={
                              <p class="text-neutral-500">Click to put it back in the pack.</p>
                            }
                          />
                        )}
                      </Show>
                      <span class="text-[10px] tracking-wider text-neutral-600 uppercase">
                        {p().name}
                      </span>
                    </>
                  )}
                </Show>
              </li>
            )}
          </For>
        </ul>

        <h3 class="eyebrow mt-4 mb-2">Belt</h3>
        <ul class="flex gap-2" aria-label="Belt">
          <For each={BELT_SLOTS}>
            {(slot) => (
              <li>
                <Show when={belt(slot)} keyed fallback={<EmptySlot icon="healingDraught" />}>
                  {(p) => (
                    <ItemSlot
                      version={props.version}
                      item={p}
                      aria-label={v() ? `Take back ${itemName(p)}` : ''}
                      onClick={() => {
                        const m = merc();
                        if (m) {
                          setMessage(props.game.unbelt(m, slot));
                        }
                      }}
                      extra={<p class="text-neutral-500">Click to take it back.</p>}
                    />
                  )}
                </Show>
              </li>
            )}
          </For>
        </ul>

        <dl class="mt-4 grid grid-cols-4 gap-2">
          <For each={stats()}>
            {(s) => (
              <div class="well px-2 py-1.5">
                <dt class="flex items-center gap-1 text-[10px] text-neutral-500 uppercase">
                  <Icon name={s.icon} class="size-3" />
                  {s.name}
                </dt>
                <dd class="text-sm font-semibold text-neutral-100">{s.value}</dd>
              </div>
            )}
          </For>
        </dl>
        <Notice text={message()} />
      </section>

      <section class="flex min-w-0 flex-1 flex-col">
        <header class="mb-3 flex items-center gap-4">
          <h2 class="font-display text-xl font-semibold text-neutral-50">Pack</h2>
          <span class="flex items-center gap-1 text-sm font-semibold text-accent">
            <Icon name="gold" class="size-4" />
            {gold()}
          </span>
          <div class="flex flex-1 items-center gap-2 text-xs text-neutral-500">
            <Icon name="weight" class="size-4" />
            <Meter
              class="h-1.5 flex-1"
              value={weight()}
              max={props.game.pack.maxWeight}
              color={weight() > props.game.pack.maxWeight * 0.8 ? '#d9474f' : '#8a8f9c'}
            />
            <span>
              {weight()} / {props.game.pack.maxWeight}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close"
            class="grid size-8 place-items-center rounded-lg text-neutral-500 transition hover:bg-white/10 hover:text-neutral-100"
            onClick={() => {
              props.onClose();
            }}
          >
            <CloseMark class="size-4" />
          </button>
        </header>

        <ul
          class="grid grid-cols-8 content-start gap-1.5 overflow-y-auto rounded-xl bg-black/20 p-3 ring-1 ring-white/5"
          aria-label="Pack"
          onDragOver={accept}
          onDrop={dropOnPack}
        >
          <For each={pack()}>
            {(item) => (
              <li>
                <ItemSlot
                  version={props.version}
                  item={item}
                  dim={!fits(item)}
                  draggable="true"
                  onDragStart={() => {
                    setDrag({ from: 'pack', uid: item.uid });
                  }}
                  onClick={() => {
                    equip(item.uid);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      props.game.drop(item.uid);
                    }
                  }}
                  extra={
                    <>
                      <Show when={replaces(item)} keyed>
                        {(old) => (
                          <p class="mb-1 text-neutral-400">
                            Replaces {merc()?.name}'s {itemName(old)}.
                          </p>
                        )}
                      </Show>
                      <Show when={nobody(item)}>
                        <p class="mb-1 text-red-300">No one in the party can use this.</p>
                      </Show>
                      <p class="text-neutral-500">
                        <Show when={fits(item)} fallback={<>{merc()?.name} cannot use this.</>}>
                          Click to {action(item)} on {merc()?.name}.
                        </Show>{' '}
                        Drag it to the bin to drop it.
                      </p>
                    </>
                  }
                />
              </li>
            )}
          </For>
          <For each={fillers()}>
            {() => (
              <li aria-hidden="true" class="size-14 rounded-lg bg-black/25 ring-1 ring-white/3" />
            )}
          </For>
        </ul>

        <footer class="mt-3 flex items-center gap-3">
          <ul class="flex flex-1 flex-wrap gap-1.5" aria-label="Pouch">
            <For
              each={materials()}
              fallback={<li class="text-xs text-neutral-600">No materials yet.</li>}
            >
              {([id, n]) => (
                <Tip text={MATERIAL_NAME.get(id) ?? id}>
                  {(anchor) => (
                    <li
                      {...anchor}
                      class="flex h-7 items-center gap-1 rounded-md bg-white/4 px-2 text-xs text-neutral-300 ring-1 ring-white/6"
                    >
                      <Icon name={isIconName(id) ? id : 'bone'} class="size-4 text-neutral-400" />
                      {n}
                      <span class="sr-only">{MATERIAL_NAME.get(id) ?? id}</span>
                    </li>
                  )}
                </Tip>
              )}
            </For>
          </ul>
          <Tip text="Drag an item from the pack here to drop it at the bearer's feet.">
            {(anchor) => (
              <div
                {...anchor}
                aria-label="Drop"
                class="grid size-10 place-items-center rounded-lg text-neutral-500 ring-1 ring-white/10 transition"
                classList={{
                  'bg-red-500/20 text-red-200 ring-red-400/40': drag()?.from === 'pack',
                }}
                onDragOver={accept}
                onDrop={dropOnBin}
              >
                <Icon name="drop" class="size-5" />
              </div>
            )}
          </Tip>
        </footer>
        <p class="mt-2 text-[11px] text-neutral-600">
          Click or drag an item onto the gear to hand it over: gear is worn, potions go on the belt,
          cards into a socket. <span class="kbd">I</span> or <span class="kbd">Esc</span> to close.
        </p>
      </section>
    </aside>
  );
}
