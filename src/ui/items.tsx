import type { Placement } from 'solid-floating-ui';
import { For, type JSX, Show, splitProps } from 'solid-js';
import { itemLines, itemName } from '../gen/loot';
import { LABEL_COLOR } from '../render/renderer';
import { type Item, type ItemBase, ItemType, Quality } from '../sim/item';
import { type IconName, isIconName } from './icons';
import { Icon, Tooltip } from './kit';

// Items as icons, as in Diablo 2: each in a square slot, framed in its
// quality's color, with its full card in a tooltip.

const TYPE_ICON: Record<ItemType, IconName> = {
  [ItemType.Weapon]: 'armingSword',
  [ItemType.Shield]: 'buckler',
  [ItemType.Head]: 'kettleHelm',
  [ItemType.Body]: 'jerkin',
  [ItemType.Cloak]: 'shroud',
  [ItemType.Boots]: 'boots',
  [ItemType.Accessory]: 'ring',
  [ItemType.Gold]: 'gold',
  [ItemType.Potion]: 'healingDraught',
  [ItemType.Card]: 'card',
};

const TYPE_NAME: Record<ItemType, string> = {
  [ItemType.Weapon]: 'Weapon',
  [ItemType.Shield]: 'Offhand',
  [ItemType.Head]: 'Head',
  [ItemType.Body]: 'Body armor',
  [ItemType.Cloak]: 'Cloak',
  [ItemType.Boots]: 'Boots',
  [ItemType.Accessory]: 'Accessory',
  [ItemType.Gold]: 'Gold',
  [ItemType.Potion]: 'Potion',
  [ItemType.Card]: 'Card',
};

const QUALITY_NAME: Record<Quality, string> = {
  [Quality.Inferior]: 'Crude',
  [Quality.Normal]: '',
  [Quality.Superior]: 'Fine',
  [Quality.Magic]: 'Magic',
  [Quality.Rare]: 'Rare',
  [Quality.Unique]: 'Unique',
  [Quality.Set]: 'Set',
};

/** The icon for a kind of item. */
export function baseIcon(base: ItemBase): IconName {
  if (isIconName(base.id)) {
    return base.id;
  }
  if (base.type === ItemType.Card) {
    return base.id.endsWith('Card') ? 'card' : 'gem';
  }
  return TYPE_ICON[base.type];
}

/** The color of an item's name and frame, as its floor label. */
export const qualityColor = (item: Item): string =>
  item.base.type === ItemType.Gold ? '#e8b04a' : LABEL_COLOR[item.quality];

/** An item's full card: name, kind, what it does. */
export function ItemCard(props: { item: Item; extra?: JSX.Element }): JSX.Element {
  const kind = (): string => {
    const q = QUALITY_NAME[props.item.quality];
    const type = props.item.base.weapon
      ? props.item.base.weapon[0].toUpperCase() + props.item.base.weapon.slice(1)
      : TYPE_NAME[props.item.base.type];
    return [q, type].filter(Boolean).join(' ');
  };
  return (
    <div class="w-60">
      <p class="text-sm font-semibold" style={{ color: qualityColor(props.item) }}>
        {itemName(props.item)}
      </p>
      <p class="mb-2 text-[11px] text-neutral-500">
        {kind()}
        <Show when={props.item.base.type !== ItemType.Gold}>
          {' '}
          · item level {props.item.itemLevel}
        </Show>
      </p>
      <ul class="space-y-0.5">
        <For each={itemLines(props.item)}>
          {(line) => (
            <li
              classList={{
                'pl-3 text-neutral-400': line.startsWith('  '),
                'text-neutral-500 italic': line.startsWith('“'),
              }}
            >
              {line.trim()}
            </li>
          )}
        </For>
      </ul>
      <Show when={props.extra}>
        <div class="mt-2 border-t border-white/10 pt-2">{props.extra}</div>
      </Show>
    </div>
  );
}

/** An item's icon in its quality's color, with stack, refine and sockets. */
export function ItemFace(props: { item: Item; class?: string; version?: number }): JSX.Element {
  // Stacks and refines change in place: read through `version` to see them.
  const item = (): Item => ((props.version ?? 0) >= 0 ? props.item : props.item);
  const filled = (): number => item().cards.length;
  return (
    <>
      <span style={{ color: qualityColor(item()) }}>
        <Icon name={baseIcon(item().base)} class={props.class ?? 'size-8'} />
      </span>
      <Show when={item().refine > 0}>
        <span class="absolute top-0.5 left-1 text-[10px] font-bold text-accent">
          +{item().refine}
        </span>
      </Show>
      <Show when={item().quantity > 1 && item().base.type !== ItemType.Gold}>
        <span class="absolute right-1 bottom-0.5 text-[10px] font-bold text-neutral-100">
          {item().quantity}
        </span>
      </Show>
      <Show when={item().sockets > 0}>
        <span class="absolute bottom-1 left-1 flex gap-0.5">
          <For each={Array.from({ length: item().sockets }, (_, i) => i < filled())}>
            {(full) => (
              <span
                class="size-1.5 rounded-full ring-1 ring-neutral-400/60"
                classList={{ 'bg-neutral-300': full }}
              />
            )}
          </For>
        </span>
      </Show>
      <span class="sr-only">{itemName(item())}</span>
    </>
  );
}

type SlotProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  item: Item;
  // Greyed out, such as gear no one in the party can wear
  dim?: boolean;
  // Below the card, such as what a click does
  extra?: JSX.Element;
  placement?: Placement;
  size?: 'md' | 'lg';
  // Bumped when items change in place, such as a stack drunk from
  version?: number;
};

/** An item in a square slot. Hover for its card. */
export function ItemSlot(props: SlotProps): JSX.Element {
  const [own, rest] = splitProps(props, [
    'item',
    'dim',
    'extra',
    'placement',
    'size',
    'class',
    'version',
  ]);
  const name = (): string => ((own.version ?? 0) >= 0 ? itemName(own.item) : '');
  return (
    <Tooltip
      placement={own.placement ?? 'right-start'}
      content={() => <ItemCard item={own.item} extra={own.extra} />}
    >
      {(anchor) => (
        <button
          type="button"
          aria-label={name()}
          {...rest}
          {...anchor}
          data-quality={own.item.quality}
          class={`relative grid place-items-center rounded-lg ring-1 transition outline-none hover:brightness-125 focus-visible:ring-2 focus-visible:ring-accent ${own.size === 'lg' ? 'size-16' : 'size-14'} ${own.class ?? ''}`}
          classList={{ 'opacity-40 grayscale': own.dim === true }}
          style={{
            background: `radial-gradient(circle at 50% 40%, ${qualityColor(own.item)}22, #00000066 75%)`,
            '--tw-ring-color': `${qualityColor(own.item)}55`,
          }}
        >
          <ItemFace
            item={own.item}
            version={own.version}
            class={own.size === 'lg' ? 'size-10' : 'size-8'}
          />
        </button>
      )}
    </Tooltip>
  );
}

/** An empty slot, showing what goes in it. */
export function EmptySlot(props: {
  icon?: IconName;
  label?: string;
  size?: 'md' | 'lg';
  onDrop?: (e: DragEvent) => void;
}): JSX.Element {
  return (
    <div
      aria-label={props.label}
      class={`grid place-items-center rounded-lg bg-black/30 text-neutral-700 ring-1 ring-white/5 ${props.size === 'lg' ? 'size-16' : 'size-14'}`}
      onDragOver={(e) => {
        if (props.onDrop) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        props.onDrop?.(e);
      }}
    >
      <Show when={props.icon}>{(icon) => <Icon name={icon()} class="size-7 opacity-60" />}</Show>
    </div>
  );
}
