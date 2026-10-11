import { For, type JSX } from 'solid-js';
import type { Shout } from '../sim/shout';

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

// What each shout does, for its button's title.
const WHAT: Record<string, string> = {
  Rally: 'Every merc gathers on the bearer and fights only what comes near it.',
  Focus: 'Every merc goes for the enemy under the mouse. Press F while pointing at it.',
  'Fall back': 'Every merc breaks off and runs behind the bearer.',
  Hold: 'Every merc stands where it is.',
};

/** The bearer's shouts, with their keys and cooldowns. */
export default function ShoutBar(props: Props): JSX.Element {
  return (
    <nav class="absolute bottom-4 left-4 flex gap-1" aria-label="Shouts">
      <For each={props.shouts}>
        {(s) => (
          <button
            type="button"
            data-part="card"
            title={WHAT[s.name]}
            aria-label={`${s.name} (${s.key.toUpperCase()})`}
            disabled={s.left > 0}
            class="relative w-20 overflow-hidden border border-zinc-700 bg-zinc-950/90 px-2 py-1 text-left text-xs text-zinc-300 disabled:text-zinc-600"
            onMouseDown={(e) => {
              // Keep the click from reaching the canvas under the bar.
              e.stopPropagation();
            }}
            onClick={() => {
              props.onShout(s.shout);
            }}
          >
            <span class="text-zinc-500">{s.key.toUpperCase()}</span> {s.name}
            <span
              data-part="cooldown"
              class="absolute bottom-0 left-0 h-0.5 bg-amber-600"
              style={{ width: `${s.cooldown ? (100 * (s.cooldown - s.left)) / s.cooldown : 100}%` }}
            />
          </button>
        )}
      </For>
    </nav>
  );
}
