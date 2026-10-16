import { For, type JSX } from 'solid-js';
import { xpToNext } from '../sim/progress';
import type { BaseStat } from '../sim/stats';
import type Unit from '../sim/unit';
import { Icon, Meter } from './kit';

const STATS: { stat: BaseStat; name: string; note: string }[] = [
  { stat: 'str', name: 'STR', note: 'Melee attack.' },
  { stat: 'agi', name: 'AGI', note: 'Evasion.' },
  { stat: 'vit', name: 'VIT', note: 'Health. Resists stun.' },
  { stat: 'int', name: 'INT', note: 'Mana. Magic.' },
  { stat: 'dex', name: 'DEX', note: 'Accuracy. Ranged attack. Crits.' },
  { stat: 'wil', name: 'WIL', note: 'Mana regeneration. Resists dread.' },
];

interface Props {
  unit: Unit;
  version: number;
  onSpend: () => void;
}

/** A merc's level, experience and stats, with stat points to spend. */
export default function StatSheet(props: Props): JSX.Element {
  const u = (): Unit | null => (props.version >= 0 ? props.unit : null);
  const points = (): number => u()?.statPoints ?? 0;
  const derived = (): { name: string; value: string }[] => {
    const d = u()?.derived;
    if (!d) {
      return [];
    }
    return [
      { name: 'Attack', value: `${d.atkMin}–${d.atkMax}` },
      { name: 'Armor', value: `${d.armor}` },
      { name: 'Accuracy', value: `${d.accuracy}` },
      { name: 'Evasion', value: `${d.evasion}` },
      { name: 'Health', value: `${d.maxHp}` },
      { name: 'Mana', value: `${d.maxMana}` },
    ];
  };

  return (
    <section aria-label="Stats">
      <div class="mb-1 flex justify-between text-xs text-neutral-400">
        <span>Level {u()?.level}</span>
        <span>
          {Math.floor(u()?.xp ?? 0)} / {xpToNext(u()?.level ?? 1)} experience
        </span>
      </div>
      <Meter
        class="mb-4 h-1.5"
        value={u()?.xp ?? 0}
        max={xpToNext(u()?.level ?? 1)}
        color="var(--color-xp)"
      />
      <p
        class="mb-2 text-xs"
        classList={{ 'text-accent': points() > 0, 'text-neutral-500': points() === 0 }}
      >
        {points()} stat {points() === 1 ? 'point' : 'points'}
      </p>
      <ul class="space-y-1">
        <For each={STATS}>
          {(s) => (
            <li class="well flex h-10 items-center gap-3 px-2">
              <Icon name={s.stat} class="size-5 text-neutral-400" />
              <span class="w-9 text-xs font-semibold text-neutral-300">{s.name}</span>
              <span class="w-8 text-right text-base font-semibold text-neutral-50">
                {u()?.base[s.stat]}
              </span>
              <span class="flex-1 text-xs text-neutral-500">{s.note}</span>
              <button
                type="button"
                aria-label={`Raise ${s.name}`}
                class="grid size-7 place-items-center rounded-md bg-accent-soft text-accent ring-1 ring-accent/40 transition hover:bg-accent hover:text-neutral-950 disabled:bg-transparent disabled:text-neutral-700 disabled:ring-white/10"
                disabled={points() <= 0}
                onClick={() => {
                  props.unit.raiseStat(s.stat);
                  props.onSpend();
                }}
              >
                +
              </button>
            </li>
          )}
        </For>
      </ul>
      <dl class="mt-4 grid grid-cols-3 gap-2">
        <For each={derived()}>
          {(d) => (
            <div class="well px-2 py-1.5">
              <dt class="text-[10px] text-neutral-500 uppercase">{d.name}</dt>
              <dd class="text-sm font-semibold text-neutral-100">{d.value}</dd>
            </div>
          )}
        </For>
      </dl>
    </section>
  );
}
