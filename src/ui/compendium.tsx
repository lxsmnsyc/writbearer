import { For, type JSX, Show, createSignal } from 'solid-js';
import { type Section, compendiumView } from '../game/compendium';
import type Game from '../game/game';
import { type IconName, iconOr } from './icons';
import { Icon, Panel, Tabs } from './kit';

interface Props {
  game: Game;
  // Bumped by the game whenever something is found
  version: number;
  onClose: () => void;
}

// Each section's icon, for entries that have none of their own
const SECTION_ICON: Record<string, IconName> = {
  Monsters: 'hollowSoldier',
  Mercs: 'vanguard',
  Uniques: 'amulet',
  Sets: 'hauberk',
  Cards: 'card',
  Gear: 'armingSword',
  Runs: 'bearer',
};

/**
 * The compendium: what the player has found over every run. What has not
 * been found shows as "?". The game is paused while it is open.
 */
export default function CompendiumPanel(props: Props): JSX.Element {
  const [tab, setTab] = createSignal(0);
  const sections = (): Section[] =>
    props.version >= 0 ? compendiumView(props.game.compendium.data) : [];
  const section = (): Section | undefined => sections()[tab()];
  return (
    <Panel
      label="Compendium"
      title="The Compendium"
      subtitle={
        <>
          What every run has found. <span class="kbd">K</span> to close.
        </>
      }
      icon="compendium"
      class="w-[820px]"
      onClose={() => {
        props.onClose();
      }}
    >
      <Tabs
        label="Compendium"
        value={tab()}
        onChange={(t) => {
          setTab(t);
        }}
        tabs={sections().map((s, i) => ({ value: i, name: s.title, note: s.found }))}
      />
      <Show when={section()} keyed>
        {(s) => (
          <ul class="grid grid-cols-3 gap-2" aria-label={s.title}>
            <For each={s.entries}>
              {(entry) => (
                <li class="well flex gap-3 p-2.5" classList={{ 'opacity-70': !entry.known }}>
                  <span
                    class="relative grid size-11 shrink-0 place-items-center rounded-lg"
                    classList={{
                      'bg-accent-soft text-accent': entry.known,
                      'bg-black/40 text-neutral-800': !entry.known,
                    }}
                  >
                    <Icon
                      name={iconOr(entry.icon ?? '', SECTION_ICON[s.title] ?? 'compendium')}
                      class="size-7"
                    />
                    <Show when={entry.name === '?'}>
                      <span class="absolute inset-0 grid place-items-center text-lg font-bold text-neutral-500">
                        ?
                      </span>
                    </Show>
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-neutral-100">{entry.name}</p>
                    <For each={entry.lines}>
                      {(line) => <p class="text-[11px] leading-snug text-neutral-400">{line}</p>}
                    </For>
                  </div>
                </li>
              )}
            </For>
            <Show when={s.entries.length === 0}>
              <li class="text-xs text-neutral-500">Nothing yet.</li>
            </Show>
          </ul>
        )}
      </Show>
    </Panel>
  );
}
