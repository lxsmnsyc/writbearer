import { For, type JSX } from 'solid-js';
import { xpToNext } from '../sim/progress';
import type { BaseStat } from '../sim/stats';
import type Unit from '../sim/unit';

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
  const xpShare = (): number => {
    const unit = u();
    return unit ? Math.min(100, (100 * unit.xp) / xpToNext(unit.level)) : 0;
  };

  return (
    <section aria-label="Stats">
      <p data-part="note" class="mb-1 text-xs text-zinc-500">
        Level {u()?.level} · {Math.floor(u()?.xp ?? 0)} / {xpToNext(u()?.level ?? 1)} experience
      </p>
      <div data-part="bar" class="mb-3 h-1 bg-zinc-800">
        <div data-part="bar-fill" class="h-1 bg-amber-500" style={{ width: `${xpShare()}%` }} />
      </div>
      <p data-part="note" class="mb-2 text-xs text-zinc-500">
        {u()?.statPoints} stat points
      </p>
      <ul class="space-y-1">
        <For each={STATS}>
          {(s) => (
            <li data-part="row" class="flex items-center gap-2 border border-zinc-800 px-2 py-1">
              <span class="w-10">{s.name}</span>
              <span class="w-8 text-right">{u()?.base[s.stat]}</span>
              <span data-part="note" class="flex-1 text-xs text-zinc-500">
                {s.note}
              </span>
              <button
                type="button"
                data-part="add"
                aria-label={`Raise ${s.name}`}
                class="border border-dashed border-zinc-700 px-2 text-xs"
                disabled={(u()?.statPoints ?? 0) <= 0}
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
      <p data-part="note" class="mt-3 text-xs text-zinc-500">
        Attack {u()?.derived.atkMin} to {u()?.derived.atkMax} · Armor {u()?.derived.armor} ·
        Accuracy {u()?.derived.accuracy} · Evasion {u()?.derived.evasion} · Health{' '}
        {u()?.derived.maxHp} · Mana {u()?.derived.maxMana}
      </p>
    </section>
  );
}
