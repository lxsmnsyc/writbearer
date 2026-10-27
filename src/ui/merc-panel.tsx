import { For, type JSX, Show, createSignal } from 'solid-js';
import type { IconName } from './icons';
import {
  DEFAULT_TOGGLES,
  DRINK_AT,
  Priority,
  Stance,
  type Toggles,
  setToggles as applyToggles,
  copyToggles,
  skillMode,
} from '../sim/ai';
import { SkillMode } from '../sim/skill';
import { TRAIT_BY_ID } from '../content/traits';
import { itemName } from '../gen/loot';
import { MORALE_NAME, effectiveDiscipline, moraleOf, prioritiesFollowed } from '../sim/morale';
import type Unit from '../sim/unit';
import { isIconName } from './icons';
import { Button, CloseMark, Icon, Meter, Segmented, Tabs, Tip } from './kit';
import SkillTree from './skill-tree';
import SpellPanel from './spell-panel';
import StatSheet from './stat-sheet';

// How many target priorities a merc follows. Discipline will set this later.
const MAX_PRIORITIES = 3;
const MIN_CHASE = 3;
const MAX_CHASE = 12;

const STANCES: { value: Stance; name: string; note: string; icon: IconName }[] = [
  { value: Stance.Guard, name: 'Guard', note: 'Stays beside the bearer.', icon: 'guard' },
  {
    value: Stance.Advance,
    name: 'Advance',
    note: 'Walks ahead and clears the way.',
    icon: 'advance',
  },
  {
    value: Stance.Hold,
    name: 'Hold',
    note: 'Stands its ground. Fights only what comes close.',
    icon: 'hold',
  },
];

const PRIORITIES: { value: Priority; name: string }[] = [
  { value: Priority.AttackingBearer, name: 'Enemies going for the bearer' },
  { value: Priority.Nearest, name: 'Nearest enemy' },
  { value: Priority.LowestHealth, name: 'Weakest enemy' },
  { value: Priority.Elites, name: 'Elites and bosses' },
  { value: Priority.Casters, name: 'Casters and healers' },
  { value: Priority.Heralds, name: 'Heralds running for a horn' },
];

const SKILL_MODES: { value: SkillMode; name: string }[] = [
  { value: SkillMode.Auto, name: 'Auto' },
  { value: SkillMode.Elites, name: 'Elites' },
  { value: SkillMode.Off, name: 'Off' },
];

const DRINK_RULES: { value: number; name: string }[] = [
  { value: DRINK_AT.half, name: 'At 50%' },
  { value: DRINK_AT.low, name: 'At 30%' },
  { value: DRINK_AT.emergency, name: 'Emergency' },
];

const priorityName = (p: Priority): string => PRIORITIES.find((x) => x.value === p)?.name ?? '';

type Tab = 'orders' | 'skills' | 'stats';

interface Props {
  unit: Unit;
  onClose: () => void;
  // Opens the pack on this merc, to hand it gear
  onGear: () => void;
  // Called after a skill or stat point is spent
  onChange: () => void;
}

/**
 * One merc's sheet: standing orders, skill tree and stats. The game is
 * paused while it is open.
 */
export default function MercPanel(props: Props): JSX.Element {
  const [tab, setTab] = createSignal<Tab>('orders');
  // Bumped when a skill or stat point is spent, so the panel reads the merc again.
  const [version, setVersion] = createSignal(0);
  const spent = (): void => {
    setVersion((v) => v + 1);
    props.onChange();
  };
  const belt = (): string => {
    const potions = props.unit.belt.filter((p) => p !== null).map((p) => itemName(p));
    return potions.length > 0 ? potions.join(', ') : 'nothing';
  };
  // A Veteran follows one more target priority.
  const maxPriorities = (): number =>
    MAX_PRIORITIES + (props.unit.traits.includes('veteran') ? 1 : 0);
  const level = (): number => (version() >= 0 ? props.unit.level : 0);
  // Morale and Discipline, and how many target priorities they let it follow
  const moraleName = (): string =>
    version() >= 0 ? `${MORALE_NAME[moraleOf(props.unit)]} (${Math.round(props.unit.morale)})` : '';
  const discipline = (): string =>
    version() >= 0
      ? `${props.unit.discipline}${props.unit.disciplineBonus > 0 ? ` +${props.unit.disciplineBonus} from sets` : ''}, ${effectiveDiscipline(props.unit)} in a fight`
      : '';
  const followed = (): number => (version() >= 0 ? prioritiesFollowed(props.unit) : 0);
  // Points left to spend on a tab: skill points on Skills, stat points on Stats.
  const points = (t: Tab): number => {
    if (version() < 0) {
      return 0;
    }
    if (t === 'skills') {
      return props.unit.spells.length > 0 ? props.unit.shards : props.unit.skillPoints;
    }
    return t === 'stats' ? props.unit.statPoints : 0;
  };
  const [toggles, setToggles] = createSignal<Toggles>(
    copyToggles(props.unit.toggles ?? DEFAULT_TOGGLES),
  );

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

  // The skill tree needs room for three branches; the spell panel does not.
  const wide = (): boolean => tab() === 'skills' && props.unit.spells.length === 0;

  const setSkill = (id: string, mode: SkillMode): void => {
    update({ ...toggles(), skills: { ...toggles().skills, [id]: mode } });
  };

  const mana = (): string => `${Math.floor(props.unit.mana)} / ${props.unit.derived.maxMana}`;

  const hp = (): string => `${Math.max(0, Math.ceil(props.unit.hp))} / ${props.unit.derived.maxHp}`;

  const traits = (): { name: string; note: string }[] =>
    props.unit.traits.map((id) => ({
      name: TRAIT_BY_ID.get(id)?.name ?? id,
      note: TRAIT_BY_ID.get(id)?.description ?? '',
    }));

  return (
    <aside
      class="panel absolute top-6 right-6 flex max-h-[calc(100%-9rem)] flex-col p-5"
      classList={{ 'w-96': !wide(), 'w-[620px]': wide() }}
      aria-label={`Orders for ${props.unit.name}`}
    >
      <header class="mb-3 flex items-start gap-3">
        <span class="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name={isIconName(props.unit.kind) ? props.unit.kind : 'vanguard'} class="size-8" />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="font-display text-xl leading-tight font-semibold text-neutral-50">
            {props.unit.name}
          </h2>
          <p class="text-xs text-neutral-400">
            {props.unit.job.name === props.unit.name ? '' : `${props.unit.job.name} · `}Level{' '}
            {level()}
          </p>
        </div>
        <div class="flex shrink-0 gap-1">
          <Button
            tone="ghost"
            size="sm"
            onClick={() => {
              props.onGear();
            }}
          >
            <Icon name="pack" class="size-4" />
            Gear
          </Button>
          <button
            type="button"
            aria-label="Close"
            class="grid size-7 place-items-center rounded-lg text-neutral-500 transition hover:bg-white/10 hover:text-neutral-100"
            onClick={() => {
              props.onClose();
            }}
          >
            <CloseMark class="size-4" />
          </button>
        </div>
      </header>
      <div class="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-neutral-400">
        <div>
          <div class="flex justify-between">
            <span>Health</span>
            <span>{hp()}</span>
          </div>
          <Meter value={props.unit.hp} max={props.unit.derived.maxHp} color="var(--color-health)" />
        </div>
        <div>
          <div class="flex justify-between">
            <span>Mana</span>
            <span>{mana()}</span>
          </div>
          <Meter
            value={props.unit.mana}
            max={props.unit.derived.maxMana}
            color="var(--color-mana)"
          />
        </div>
      </div>

      <div class="mb-4 flex flex-wrap gap-1.5 text-[11px]">
        <span class="rounded-full bg-white/5 px-2 py-0.5 text-neutral-300 ring-1 ring-white/10">
          Morale {moraleName()}
        </span>
        <Tip text="Discipline sets how many target priorities it follows, and how fast it answers a shout.">
          {(anchor) => (
            <span
              {...anchor}
              class="rounded-full bg-white/5 px-2 py-0.5 text-neutral-300 ring-1 ring-white/10"
            >
              Discipline {discipline()}
            </span>
          )}
        </Tip>
        <For each={traits()}>
          {(t) => (
            <Tip text={t.note}>
              {(anchor) => (
                <span
                  {...anchor}
                  class="rounded-full bg-accent-soft px-2 py-0.5 text-accent ring-1 ring-accent/30"
                >
                  {t.name}
                </span>
              )}
            </Tip>
          )}
        </For>
      </div>

      <Tabs<Tab>
        label="Sheet"
        value={tab()}
        onChange={(t) => {
          setTab(t);
        }}
        tabs={[
          { value: 'orders', name: 'Orders', icon: 'hold' },
          {
            value: 'skills',
            name: 'Skills',
            icon: 'points',
            badge: () => points('skills') || null,
          },
          { value: 'stats', name: 'Stats', icon: 'str', badge: () => points('stats') || null },
        ]}
      />

      <div class="min-h-0 flex-1 overflow-y-auto pr-1">
        <Show when={tab() === 'orders'}>
          <section class="mb-5">
            <h3 class="eyebrow mb-2">Stance</h3>
            <Segmented
              label="Stance"
              options={STANCES}
              value={toggles().stance}
              onChange={(stance) => {
                update({ ...toggles(), stance });
              }}
            />
            <p class="mt-2 text-xs text-neutral-400">
              {STANCES.find((s) => s.value === toggles().stance)?.note}
            </p>
          </section>

          <section class="mb-5">
            <h3 class="eyebrow mb-2">Targets, in order</h3>
            <ol class="space-y-1" aria-label="Target priorities">
              <For each={toggles().priorities}>
                {(p, i) => (
                  <li class="well flex h-9 items-center gap-2 px-2">
                    <span class="grid size-5 place-items-center rounded bg-white/5 text-[10px] font-bold text-neutral-400">
                      {i() + 1}
                    </span>
                    <span class="flex-1 text-sm" classList={{ 'opacity-40': i() >= followed() }}>
                      {priorityName(p)}
                      <Show when={i() >= followed()}>
                        <span class="text-xs text-neutral-500"> · ignored</span>
                      </Show>
                    </span>
                    <button
                      type="button"
                      aria-label="Move up"
                      class="grid size-6 place-items-center rounded text-neutral-500 hover:bg-white/10 hover:text-neutral-100"
                      onClick={() => {
                        move(i(), -1);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      class="grid size-6 place-items-center rounded text-neutral-500 hover:bg-white/10 hover:text-neutral-100"
                      onClick={() => {
                        move(i(), 1);
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label="Remove"
                      class="grid size-6 place-items-center rounded text-neutral-500 hover:bg-red-500/15 hover:text-red-300"
                      onClick={() => {
                        remove(i());
                      }}
                    >
                      <CloseMark class="size-3" />
                    </button>
                  </li>
                )}
              </For>
            </ol>
            <Show when={toggles().priorities.length > followed()}>
              <p class="mt-1.5 text-xs text-neutral-500">
                {props.unit.name} follows only its first {followed()}: its Discipline is too low for
                more. Pay it, rest it and level it to raise it.
              </p>
            </Show>
            <Show when={toggles().priorities.length === 0}>
              <p class="text-xs text-neutral-500">
                No priorities: the merc fights whatever is nearest.
              </p>
            </Show>
            <Show when={toggles().priorities.length < maxPriorities() && unused().length > 0}>
              <div class="mt-2 flex flex-wrap gap-1">
                <For each={unused()}>
                  {(p) => (
                    <button
                      type="button"
                      class="h-7 rounded-md px-2 text-xs text-neutral-400 border border-dashed border-white/15 transition hover:bg-white/5 hover:text-neutral-100"
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

          <Show when={props.unit.skills.length > 0}>
            <section class="mb-5">
              <h3 class="eyebrow mb-2">Skills</h3>
              <ul class="space-y-2">
                <For each={props.unit.skills}>
                  {(skill) => (
                    <li class="well flex items-center gap-3 p-2">
                      <Tip text={skill.describe(props.unit.skillRank(skill.id))}>
                        {(anchor) => (
                          <span
                            {...anchor}
                            class="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
                          >
                            <Icon
                              name={isIconName(skill.id) ? skill.id : 'points'}
                              class="size-6"
                            />
                          </span>
                        )}
                      </Tip>
                      <div class="min-w-0 flex-1">
                        <div class="mb-1 flex items-baseline justify-between">
                          <span class="text-sm text-neutral-100">{skill.name}</span>
                          <span class="text-[11px] text-neutral-500">{skill.cost} mana</span>
                        </div>
                        <Segmented
                          label={`Use ${skill.name}`}
                          size="sm"
                          options={SKILL_MODES}
                          value={skillMode(toggles(), skill.id)}
                          onChange={(mode) => {
                            setSkill(skill.id, mode);
                          }}
                        />
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>

          <section class="mb-5">
            <h3 class="eyebrow mb-2">Potions</h3>
            <Segmented
              label="Drink potions"
              size="sm"
              options={DRINK_RULES}
              value={toggles().drinkAt}
              onChange={(drinkAt) => {
                update({ ...toggles(), drinkAt });
              }}
            />
            <p class="mt-1.5 text-xs text-neutral-500">
              Drinks a healing potion below {Math.round(toggles().drinkAt * 100)}% health. On the
              belt: {belt()}.
            </p>
          </section>

          <section>
            <h3 class="eyebrow mb-2">Chase</h3>
            <input
              type="range"
              aria-label="Chase distance"
              class="w-full accent-accent"
              min={MIN_CHASE}
              max={MAX_CHASE}
              value={toggles().chase}
              onInput={(e) => {
                update({ ...toggles(), chase: Number(e.currentTarget.value) });
              }}
            />
            <p class="text-xs text-neutral-500">
              Chases enemies up to {toggles().chase} tiles from the bearer.
            </p>
          </section>
        </Show>
        <Show when={tab() === 'skills'}>
          <Show
            when={props.unit.spells.length > 0}
            fallback={<SkillTree unit={props.unit} version={version()} onSpend={spent} />}
          >
            <SpellPanel
              unit={props.unit}
              version={version()}
              onSpend={spent}
              mode={(id) => skillMode(toggles(), id)}
              onMode={setSkill}
            />
          </Show>
        </Show>
        <Show when={tab() === 'stats'}>
          <StatSheet unit={props.unit} version={version()} onSpend={spent} />
        </Show>
      </div>

      <footer class="mt-3 text-[11px] text-neutral-600">
        Paused while the sheet is open. <span class="kbd">Esc</span> to close.
      </footer>
    </aside>
  );
}
