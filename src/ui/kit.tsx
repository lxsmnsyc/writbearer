import {
  FloatingPortal,
  type Placement,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from 'solid-floating-ui';
import { For, type JSX, Show, createSignal, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { RadioGroup, RadioGroupOption, Tab, TabGroup, TabList } from 'terracotta';
import { ICONS, type IconName } from './icons';

// The interface's parts, shared by every panel: panels, tabs, choices,
// buttons, meters and tooltips.

/** One of the game-icons, by name. */
export function Icon(props: { name: IconName; class?: string; title?: string }): JSX.Element {
  return (
    <Dynamic
      component={ICONS[props.name]}
      class={props.class ?? 'size-5'}
      aria-hidden={props.title === undefined}
      aria-label={props.title}
    />
  );
}

/** A plain cross, for closing and removing. */
export function CloseMark(props: { class?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      class={props.class ?? 'size-4'}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

type Place = 'center' | 'top' | 'right';

const PLACE: Record<Place, string> = {
  center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  top: 'top-6 left-1/2 -translate-x-1/2',
  right: 'top-6 right-6',
};

interface PanelProps {
  // The panel's accessible name
  label: string;
  title: JSX.Element;
  subtitle?: JSX.Element;
  icon?: IconName;
  place?: Place;
  class?: string;
  // Beside the close button, such as gold carried
  aside?: JSX.Element;
  onClose?: () => void;
  children: JSX.Element;
}

/** A panel over the game, with its title and a close button. */
export function Panel(props: PanelProps): JSX.Element {
  return (
    <aside
      class={`panel absolute flex max-h-[calc(100%-9rem)] flex-col p-5 ${PLACE[props.place ?? 'top']} ${props.class ?? ''}`}
      aria-label={props.label}
    >
      <header class="mb-4 flex items-start gap-3">
        <Show when={props.icon}>
          {(icon) => (
            <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Icon name={icon()} class="size-6" />
            </span>
          )}
        </Show>
        <div class="min-w-0 flex-1">
          <h2 class="font-display text-xl leading-tight font-semibold text-neutral-50">
            {props.title}
          </h2>
          <Show when={props.subtitle}>
            <div class="mt-0.5 text-xs text-neutral-400">{props.subtitle}</div>
          </Show>
        </div>
        {props.aside}
        <Show when={props.onClose}>
          {(close) => (
            <button
              type="button"
              aria-label="Close"
              class="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-500 transition hover:bg-white/10 hover:text-neutral-100"
              onClick={() => {
                close()();
              }}
            >
              <CloseMark class="size-4" />
            </button>
          )}
        </Show>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto">{props.children}</div>
    </aside>
  );
}

type Tone = 'primary' | 'secondary' | 'ghost' | 'danger';

const TONE: Record<Tone, string> = {
  primary: 'bg-accent text-neutral-950 hover:brightness-110 font-semibold',
  secondary: 'bg-white/6 text-neutral-100 ring-1 ring-white/10 hover:bg-white/10',
  ghost: 'text-neutral-400 hover:bg-white/6 hover:text-neutral-100',
  danger: 'text-red-300 ring-1 ring-red-400/30 hover:bg-red-500/15',
};

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE = { sm: 'h-7 px-2.5 text-xs', md: 'h-9 px-3.5 text-sm', lg: 'h-11 px-5 text-sm' };

/** A button in one of the interface's tones. */
export function Button(props: ButtonProps): JSX.Element {
  const [own, rest] = splitProps(props, ['tone', 'size', 'class']);
  return (
    <button
      type="button"
      {...rest}
      class={`inline-flex items-center justify-center gap-1.5 rounded-lg transition disabled:pointer-events-none disabled:opacity-40 ${SIZE[own.size ?? 'md']} ${TONE[own.tone ?? 'secondary']} ${own.class ?? ''}`}
    />
  );
}

export interface Choice<V> {
  value: V;
  name: string;
  icon?: IconName;
  // Shown in a tooltip
  note?: string;
}

interface SegmentedProps<V> {
  label: string;
  options: readonly Choice<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: 'sm' | 'md';
}

/** A row of choices, one picked: a stance, a mode, a rule. */
export function Segmented<V>(props: SegmentedProps<V>): JSX.Element {
  return (
    <RadioGroup<V>
      value={props.value}
      onChange={(v) => {
        if (v !== undefined) {
          props.onChange(v);
        }
      }}
      aria-label={props.label}
      class="flex gap-1 rounded-lg bg-black/30 p-1 ring-1 ring-white/6"
    >
      <For each={props.options}>
        {(o) => (
          <Tip text={o.note}>
            {(anchor) => (
              <RadioGroupOption<V>
                {...anchor}
                value={o.value}
                class={`flex flex-1 items-center justify-center gap-1.5 rounded-md text-neutral-400 transition outline-none select-none hover:text-neutral-100 focus-visible:ring-2 focus-visible:ring-accent/60 aria-checked:bg-white/10 aria-checked:text-neutral-50 aria-checked:shadow ${props.size === 'sm' ? 'h-6 px-2 text-xs' : 'h-8 px-3 text-sm'}`}
              >
                <Show when={o.icon}>{(icon) => <Icon name={icon()} class="size-4" />}</Show>
                {o.name}
              </RadioGroupOption>
            )}
          </Tip>
        )}
      </For>
    </RadioGroup>
  );
}

export interface TabSpec<V> {
  value: V;
  name: string;
  icon?: IconName;
  // A dot or a count beside the name, such as points to spend
  badge?: () => string | number | null;
  // A small line after the name, such as how much has been found
  note?: string;
}

interface TabsProps<V> {
  label: string;
  tabs: readonly TabSpec<V>[];
  value: V;
  onChange: (value: V) => void;
}

/** A row of tabs. The panel shows what the chosen one holds. */
export function Tabs<V>(props: TabsProps<V>): JSX.Element {
  return (
    <TabGroup<V>
      horizontal
      value={props.value}
      onChange={(v) => {
        if (v !== undefined) {
          props.onChange(v);
        }
      }}
    >
      <TabList<V> aria-label={props.label} class="mb-4 flex gap-1 border-b border-white/6">
        <For each={props.tabs}>
          {(t) => (
            <Tab<V>
              value={t.value}
              class="-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 pt-1 pb-2 text-sm text-neutral-400 transition outline-none select-none hover:text-neutral-100 focus-visible:text-neutral-50 aria-selected:border-accent aria-selected:text-neutral-50"
            >
              <Show when={t.icon}>{(icon) => <Icon name={icon()} class="size-4" />}</Show>
              {t.name}
              <Show when={t.note}>
                <span class="text-[10px] text-neutral-500">{t.note}</span>
              </Show>
              <Show when={t.badge?.()}>
                {(badge) => (
                  <span class="rounded-full bg-accent px-1.5 text-[10px] leading-4 font-bold text-neutral-950">
                    {badge()}
                  </span>
                )}
              </Show>
            </Tab>
          )}
        </For>
      </TabList>
    </TabGroup>
  );
}

interface MeterProps {
  value: number;
  max: number;
  color: string;
  class?: string;
}

/** A thin bar: health, mana, experience. */
export function Meter(props: MeterProps): JSX.Element {
  const share = (): number =>
    props.max > 0 ? Math.max(0, Math.min(100, (100 * props.value) / props.max)) : 0;
  return (
    <div class={`overflow-hidden rounded-full bg-black/50 ${props.class ?? 'h-1.5'}`}>
      <div
        class="h-full rounded-full transition-[width] duration-200"
        style={{ width: `${share()}%`, background: props.color }}
      />
    </div>
  );
}

/** What a tooltip's anchor spreads onto itself. */
export type Anchor = Record<string, unknown> & { ref: (el: Element) => void };

interface TooltipProps {
  content: () => JSX.Element;
  placement?: Placement;
  disabled?: boolean;
  children: (anchor: Anchor) => JSX.Element;
}

/** A card that floats beside its anchor while it is hovered or focused. */
export function Tooltip(props: TooltipProps): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const floating = useFloating({
    get open() {
      return open() && props.disabled !== true;
    },
    onOpenChange: (value) => {
      setOpen(value);
    },
    get placement() {
      return props.placement ?? 'top';
    },
    middleware: [offset(10), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const interactions = useInteractions([
    useHover(floating.context, { delay: { open: 80, close: 0 } }),
    useFocus(floating.context),
    useRole(floating.context, { role: 'tooltip' }),
  ]);
  return (
    <>
      {props.children({
        ...interactions.getReferenceProps(),
        ref: (el: Element) => {
          floating.refs.setReference(el);
        },
      })}
      <Show when={open() && props.disabled !== true}>
        <FloatingPortal>
          <div
            {...interactions.getFloatingProps()}
            ref={(el) => {
              floating.refs.setFloating(el);
            }}
            style={floating.floatingStyles}
            class="pointer-events-none z-50 max-w-xs rounded-xl bg-raised/95 px-3 py-2.5 text-xs text-neutral-300 shadow-2xl ring-1 shadow-black/70 ring-white/10 backdrop-blur"
          >
            {props.content()}
          </div>
        </FloatingPortal>
      </Show>
    </>
  );
}

/** A plain line of text in a tooltip, or nothing when there is none. */
export function Tip(props: {
  text: string | undefined;
  placement?: Placement;
  children: (anchor: Anchor | Record<string, never>) => JSX.Element;
}): JSX.Element {
  return (
    <Show when={props.text} fallback={props.children({})}>
      {(text) => (
        <Tooltip placement={props.placement} content={() => text()}>
          {(anchor) => props.children(anchor)}
        </Tooltip>
      )}
    </Show>
  );
}

/** A short message after an action, such as why it could not be done. */
export function Notice(props: {
  text: string | null;
  tone?: 'bad' | 'good' | 'info';
}): JSX.Element {
  const tone = (): string => {
    if (props.tone === 'good') {
      return 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/20';
    }
    return props.tone === 'info'
      ? 'bg-white/5 text-neutral-200 ring-white/10'
      : 'bg-red-500/10 text-red-200 ring-red-400/20';
  };
  return (
    <Show when={props.text}>
      <p role="alert" class={`mt-3 rounded-lg px-3 py-2 text-xs ring-1 ${tone()}`}>
        {props.text}
      </p>
    </Show>
  );
}
