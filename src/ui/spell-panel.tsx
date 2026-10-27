import { For, type JSX, Show, createSignal } from 'solid-js';
import { MAX_RANK, cannotRaise, raise, rankCap, spellOf, upgradeOf } from '../sim/builds';
import { SkillMode } from '../sim/skill';
import type Unit from '../sim/unit';
import { isIconName } from './icons';
import { Icon, Notice, Segmented, Tip } from './kit';

const SKILL_MODES: { value: SkillMode; name: string }[] = [
  { value: SkillMode.Auto, name: 'Auto' },
  { value: SkillMode.Elites, name: 'Elites' },
  { value: SkillMode.Off, name: 'Off' },
];

interface Props {
  unit: Unit;
  // Bumped after each shard spent, so ranks are read again
  version: number;
  onSpend: () => void;
  // The order the merc follows for a spell, and a way to change it
  mode: (id: string) => SkillMode;
  onMode: (id: string, mode: SkillMode) => void;
}

/**
 * A merc's 4 spells, in the order it casts them: rank and cap, a + to spend
 * a shard, the elite upgrade each holds, and the order for each.
 */
export default function SpellPanel(props: Props): JSX.Element {
  const [message, setMessage] = createSignal<string | null>(null);
  const v = (): boolean => props.version >= 0;
  const shards = (): number => (v() ? props.unit.shards : 0);
  const cap = (): number => (v() ? rankCap(props.unit.level) : 0);
  const rank = (id: string): number => (v() ? props.unit.skillRank(id) : 0);

  return (
    <section aria-label="Spells">
      <div class="mb-3 flex items-center gap-3">
        <span
          class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1"
          classList={{
            'bg-accent-soft text-accent ring-accent/40': shards() > 0,
            'text-neutral-500 ring-white/10': shards() === 0,
          }}
        >
          <Icon name="points" class="size-3.5" />
          {shards()} {shards() === 1 ? 'shard' : 'shards'}
        </span>
        <span class="text-[11px] text-neutral-500">
          Ranks up to {cap()} at level {v() ? props.unit.level : 0}, {MAX_RANK} at most.
        </span>
      </div>

      <ol class="space-y-2">
        <For each={props.unit.spells}>
          {(base, i) => {
            const spell = (): typeof base => (v() ? spellOf(props.unit, base) : base);
            const upgrade = (): ReturnType<typeof upgradeOf> =>
              v() ? upgradeOf(props.unit, base.id) : undefined;
            const why = (): string | null => (v() ? cannotRaise(props.unit, base.id) : null);
            return (
              <li class="well flex items-center gap-3 p-2">
                <span class="w-3 text-center text-[11px] text-neutral-500">{i() + 1}</span>
                <Tip text={spell().describe(rank(base.id))}>
                  {(anchor) => (
                    <span
                      {...anchor}
                      class="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
                    >
                      <Icon name={isIconName(base.id) ? base.id : 'points'} class="size-6" />
                    </span>
                  )}
                </Tip>
                <div class="min-w-0 flex-1">
                  <div class="mb-1 flex items-baseline justify-between gap-2">
                    <span class="truncate text-sm text-neutral-100">{base.name}</span>
                    <span class="text-[11px] text-neutral-500">
                      Rank {rank(base.id)}/{cap()} · {spell().cost} mana
                    </span>
                  </div>
                  <Show
                    when={upgrade()}
                    fallback={
                      <p class="mb-1 text-[11px] text-neutral-600">No elite upgrade yet.</p>
                    }
                  >
                    {(u) => (
                      <Tip text={u().describe(rank(base.id))}>
                        {(anchor) => (
                          <p {...anchor} class="mb-1 truncate text-[11px] text-accent">
                            {u().name}
                          </p>
                        )}
                      </Tip>
                    )}
                  </Show>
                  <Segmented
                    label={`Use ${base.name}`}
                    size="sm"
                    options={SKILL_MODES}
                    value={props.mode(base.id)}
                    onChange={(mode) => {
                      props.onMode(base.id, mode);
                    }}
                  />
                </div>
                <Tip text={why() ?? 'Spend a shard on the next rank.'}>
                  {(anchor) => (
                    <button
                      type="button"
                      {...anchor}
                      aria-label={`Raise ${base.name}`}
                      class="grid size-8 shrink-0 place-items-center rounded-lg text-lg ring-1 transition"
                      classList={{
                        'bg-accent-soft text-accent ring-accent/60 hover:bg-accent/30':
                          why() === null,
                        'text-neutral-600 ring-white/10': why() !== null,
                      }}
                      onClick={() => {
                        setMessage(raise(props.unit, base.id));
                        props.onSpend();
                      }}
                    >
                      +
                    </button>
                  )}
                </Tip>
              </li>
            );
          }}
        </For>
      </ol>
      <Notice text={message()} />
    </section>
  );
}
