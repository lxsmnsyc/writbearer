import { For, type JSX, Show, createSignal, onCleanup, onMount } from 'solid-js';
import Game from '../game/game';
import type Unit from '../sim/unit';
import MercPanel from './merc-panel';

interface PartyEntry {
  unit: Unit;
  hp: number;
  maxHp: number;
  alive: boolean;
}

// How often the party bar reads health from the game, in milliseconds.
const PARTY_REFRESH = 200;

export default function App(): JSX.Element {
  let canvas: HTMLCanvasElement | undefined;
  const [game, setGame] = createSignal<Game | null>(null);
  const [selected, setSelected] = createSignal<Unit | null>(null);
  const [party, setParty] = createSignal<PartyEntry[]>([]);

  onMount(() => {
    if (!canvas) {
      return;
    }
    const g = new Game(canvas, {
      onSelect: (unit) => {
        setSelected(unit);
      },
    });
    g.start();
    setGame(g);
    const timer = setInterval(() => {
      setParty(
        g
          .mercs()
          .map((unit) => ({ unit, hp: unit.hp, maxHp: unit.derived.maxHp, alive: unit.alive })),
      );
    }, PARTY_REFRESH);
    onCleanup(() => {
      clearInterval(timer);
      g.stop();
    });
  });

  return (
    <main class="relative grid h-full place-items-center bg-black">
      <canvas
        ref={(el) => {
          canvas = el;
        }}
        class="max-h-full max-w-full cursor-crosshair [image-rendering:pixelated]"
      />

      <nav class="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" aria-label="Party">
        <For each={party()}>
          {(m, i) => (
            <button
              type="button"
              class="w-40 border bg-zinc-950/90 px-3 py-2 text-left text-xs"
              classList={{
                'border-amber-500': selected() === m.unit,
                'border-zinc-700 hover:border-zinc-500': selected() !== m.unit,
                'opacity-50': !m.alive,
              }}
              disabled={!m.alive}
              onClick={() => game()?.select(m.unit)}
            >
              <div class="flex justify-between text-zinc-300">
                <span>{m.unit.name}</span>
                <span class="text-zinc-600">{i() + 1}</span>
              </div>
              <div class="mt-1 h-1 bg-zinc-800">
                <div
                  class="h-1 bg-amber-500"
                  style={{ width: `${Math.max(0, (100 * m.hp) / m.maxHp)}%` }}
                />
              </div>
              <Show when={!m.alive}>
                <div class="mt-1 text-red-500">Dead</div>
              </Show>
            </button>
          )}
        </For>
      </nav>

      <Show when={game() && selected()} keyed>
        {(unit) => {
          const g = game();
          return g ? (
            <MercPanel
              unit={unit}
              onClose={() => {
                g.select(null);
              }}
            />
          ) : null;
        }}
      </Show>
    </main>
  );
}
