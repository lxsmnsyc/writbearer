import { For, type JSX } from 'solid-js';
import type { Shout } from '../sim/shout';
import type { IconName } from './icons';
import { Icon, Tooltip } from './kit';

export interface ShoutEntry {
  shout: Shout;
  key: string;
  name: string;
  // Seconds until it is ready, and its whole cooldown
  left: number;
  cooldown: number;
}

interface Props {
  shouts: ShoutEntry[];
  onShout: (shout: Shout) => void;
}

// What each shout does, and its icon.
const WHAT: Partial<Record<string, { text: string; icon: IconName }>> = {
  Rally: {
    text: 'Every merc gathers on the bearer and fights only what comes near it.',
    icon: 'rally',
  },
  Focus: {
    text: 'Every merc goes for the enemy under the mouse. Press F while pointing at it.',
    icon: 'focus',
  },
  'Fall back': { text: 'Every merc breaks off and runs behind the bearer.', icon: 'fallBack' },
  Hold: { text: 'Every merc stands where it is.', icon: 'hold' },
};

/** The bearer's shouts, with their keys and cooldowns. */
export default function ShoutBar(props: Props): JSX.Element {
  return (
    <nav
      class="absolute bottom-6 left-6 flex gap-1.5 rounded-2xl bg-surface/80 p-1.5 ring-1 ring-line backdrop-blur-md"
      aria-label="Shouts"
    >
      <For each={props.shouts}>
        {(s) => {
          const cooling = (): number => (s.cooldown > 0 ? s.left / s.cooldown : 0);
          return (
            <Tooltip
              content={() => (
                <>
                  <p class="text-sm font-semibold text-neutral-50">
                    {s.name} <span class="kbd ml-1">{s.key.toUpperCase()}</span>
                  </p>
                  <p class="mt-1">{WHAT[s.name]?.text}</p>
                </>
              )}
            >
              {(anchor) => (
                <button
                  type="button"
                  {...anchor}
                  aria-label={`${s.name} (${s.key.toUpperCase()})`}
                  disabled={s.left > 0}
                  class="relative grid size-12 place-items-center overflow-hidden rounded-xl bg-white/5 text-neutral-200 ring-1 ring-white/10 transition hover:bg-white/10 disabled:text-neutral-600"
                  onMouseDown={(e) => {
                    // Keep the click from reaching the canvas under the bar.
                    e.stopPropagation();
                  }}
                  onClick={() => {
                    props.onShout(s.shout);
                  }}
                >
                  <Icon name={WHAT[s.name]?.icon ?? 'rally'} class="size-6" />
                  <span
                    aria-hidden="true"
                    class="absolute inset-0 bg-black/60"
                    style={{
                      'clip-path': `inset(${(1 - cooling()) * 100}% 0 0 0)`,
                    }}
                  />
                  <span class="absolute top-0.5 left-1 text-[9px] font-bold text-neutral-400">
                    {s.key.toUpperCase()}
                  </span>
                </button>
              )}
            </Tooltip>
          );
        }}
      </For>
    </nav>
  );
}
