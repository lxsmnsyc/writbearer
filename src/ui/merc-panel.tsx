import { For, type JSX, Show, createSignal } from 'solid-js';
import {
  DEFAULT_TOGGLES,
  Priority,
  Stance,
  type Toggles,
  setToggles as applyToggles,
} from '../sim/ai';
import type Unit from '../sim/unit';

// How many target priorities a merc follows. Discipline will set this later.
const MAX_PRIORITIES = 3;
const MIN_CHASE = 3;
const MAX_CHASE = 12;

const STANCES: { value: Stance; name: string; note: string }[] = [
  { value: Stance.Guard, name: 'Guard', note: 'Stays beside the bearer.' },
  { value: Stance.Advance, name: 'Advance', note: 'Walks ahead and clears the way.' },
  { value: Stance.Hold, name: 'Hold', note: 'Stands its ground. Fights only what comes close.' },
];

const PRIORITIES: { value: Priority; name: string }[] = [
  { value: Priority.AttackingBearer, name: 'Enemies going for the bearer' },
  { value: Priority.Nearest, name: 'Nearest enemy' },
  { value: Priority.LowestHealth, name: 'Weakest enemy' },
  { value: Priority.Elites, name: 'Elites and bosses' },
];

const priorityName = (p: Priority): string => PRIORITIES.find((x) => x.value === p)?.name ?? '';

interface Props {
  unit: Unit;
  onClose: () => void;
}

/** One merc's standing orders. The game is paused while this is open. */
export default function MercPanel(props: Props): JSX.Element {
  const start = props.unit.toggles ?? DEFAULT_TOGGLES;
  const [toggles, setToggles] = createSignal<Toggles>({
    ...start,
    priorities: [...start.priorities],
  });

  const update = (next: Toggles): void => {
    setToggles(next);
    applyToggles(props.unit, next);
  };

  const move = (index: number, by: number): void => {
    const list = [...toggles().priorities];
    const to = index + by;
    if (to < 0 || to >= list.length) {
      return;
    }
    [list[index], list[to]] = [list[to], list[index]];
    update({ ...toggles(), priorities: list });
  };

  const remove = (index: number): void => {
    update({ ...toggles(), priorities: toggles().priorities.filter((_, i) => i !== index) });
  };

  const add = (p: Priority): void => {
    update({ ...toggles(), priorities: [...toggles().priorities, p] });
  };

  const unused = (): Priority[] =>
    PRIORITIES.map((p) => p.value).filter((p) => !toggles().priorities.includes(p));

  const hp = (): string => `${Math.max(0, Math.ceil(props.unit.hp))} / ${props.unit.derived.maxHp}`;

  return (
    <aside
      class="absolute top-6 right-6 w-80 border border-zinc-700 bg-zinc-950/95 p-4 text-sm text-zinc-300 shadow-xl"
      aria-label={`Orders for ${props.unit.name}`}
    >
      <header class="mb-4 flex items-baseline justify-between">
        <div>
          <h2 class="font-serif text-lg text-zinc-100">{props.unit.name}</h2>
          <p class="text-xs text-zinc-500">
            Level {props.unit.level} · {hp()} health
          </p>
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

      <section class="mb-4">
        <h3 class="mb-2 text-xs tracking-widest text-zinc-500 uppercase">Stance</h3>
        <div class="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Stance">
          <For each={STANCES}>
            {(s) => (
              <button
                type="button"
                role="radio"
                aria-checked={toggles().stance === s.value}
                class="border px-2 py-1"
                classList={{
                  'border-amber-500 text-amber-400': toggles().stance === s.value,
                  'border-zinc-700 text-zinc-400 hover:border-zinc-500':
                    toggles().stance !== s.value,
                }}
                onClick={() => {
                  update({ ...toggles(), stance: s.value });
                }}
              >
                {s.name}
              </button>
            )}
          </For>
        </div>
        <p class="mt-2 text-xs text-zinc-500">
          {STANCES.find((s) => s.value === toggles().stance)?.note}
        </p>
      </section>

      <section class="mb-4">
        <h3 class="mb-2 text-xs tracking-widest text-zinc-500 uppercase">Targets, in order</h3>
        <ol class="space-y-1" aria-label="Target priorities">
          <For each={toggles().priorities}>
            {(p, i) => (
              <li class="flex items-center gap-2 border border-zinc-800 px-2 py-1">
                <span class="w-4 text-zinc-600">{i() + 1}</span>
                <span class="flex-1">{priorityName(p)}</span>
                <button
                  type="button"
                  aria-label="Move up"
                  class="px-1 text-zinc-500 hover:text-zinc-200"
                  onClick={() => {
                    move(i(), -1);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  class="px-1 text-zinc-500 hover:text-zinc-200"
                  onClick={() => {
                    move(i(), 1);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  class="px-1 text-zinc-500 hover:text-red-400"
                  onClick={() => {
                    remove(i());
                  }}
                >
                  ×
                </button>
              </li>
            )}
          </For>
        </ol>
        <Show when={toggles().priorities.length === 0}>
          <p class="text-xs text-zinc-500">No priorities: the merc fights whatever is nearest.</p>
        </Show>
        <Show when={toggles().priorities.length < MAX_PRIORITIES && unused().length > 0}>
          <div class="mt-2 flex flex-wrap gap-1">
            <For each={unused()}>
              {(p) => (
                <button
                  type="button"
                  class="border border-dashed border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 hover:border-zinc-500"
                  onClick={() => {
                    add(p);
                  }}
                >
                  + {priorityName(p)}
                </button>
              )}
            </For>
          </div>
        </Show>
      </section>

      <section>
        <h3 class="mb-2 text-xs tracking-widest text-zinc-500 uppercase">Chase</h3>
        <input
          type="range"
          aria-label="Chase distance"
          class="w-full accent-amber-500"
          min={MIN_CHASE}
          max={MAX_CHASE}
          value={toggles().chase}
          onInput={(e) => {
            update({ ...toggles(), chase: Number(e.currentTarget.value) });
          }}
        />
        <p class="text-xs text-zinc-500">
          Chases enemies up to {toggles().chase} tiles from the bearer.
        </p>
      </section>

      <footer class="mt-4 text-xs text-zinc-600">
        Paused while orders are open. Esc to close.
      </footer>
    </aside>
  );
}
