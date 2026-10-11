import { For, type JSX, Show, createSignal, onCleanup, onMount } from 'solid-js';
import Game from '../game/game';
import type Unit from '../sim/unit';
import Inventory from './inventory';
import MercPanel from './merc-panel';

interface PartyEntry {
  unit: Unit;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  alive: boolean;
}

// How often the party bar reads health and mana from the game, in milliseconds.
const PARTY_REFRESH = 200;

export default function App(): JSX.Element {
  let canvas: HTMLCanvasElement | undefined;
  const [game, setGame] = createSignal<Game | null>(null);
  const [selected, setSelected] = createSignal<Unit | null>(null);
  const [party, setParty] = createSignal<PartyEntry[]>([]);
  const [inventory, setInventory] = createSignal(false);
  // Bumped whenever the pack or gear changes, so panels read it again.
  const [items, setItems] = createSignal(0);

  onMount(() => {
    if (!canvas) {
      return;
    }
    const g = new Game(canvas, {
      onSelect: (unit) => {
        setSelected(unit);
      },
      onInventory: (open) => {
        setInventory(open);
      },
      onItems: () => {
        setItems((v) => v + 1);
      },
    });
    g.start();
    setGame(g);
    const timer = setInterval(() => {
      setParty(
        g.mercs().map((unit) => ({
          unit,
          hp: unit.hp,
          maxHp: unit.derived.maxHp,
          mana: unit.mana,
          maxMana: unit.derived.maxMana,
          alive: unit.alive,
        })),
      );
    }, PARTY_REFRESH);
    onCleanup(() => {
      clearInterval(timer);
      g.stop();
    });
  });

  return (
    <main class="relative grid h-full place-items-center bg-black" data-ui="paper">
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
              data-part="card"
              aria-pressed={selected() === m.unit}
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
              <div data-part="bar" class="mt-1 h-1 bg-zinc-800">
                <div
                  data-part="bar-fill"
                  class="h-1 bg-amber-500"
                  style={{ width: `${Math.max(0, (100 * m.hp) / m.maxHp)}%` }}
                />
              </div>
              <div data-part="bar" class="mt-0.5 h-0.5 bg-zinc-800">
                <div
                  data-part="mana-fill"
                  class="h-0.5 bg-teal-600"
                  style={{ width: `${m.maxMana ? (100 * m.mana) / m.maxMana : 0}%` }}
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
      <Show when={inventory() && game()} keyed>
        {(g) => (
          <Inventory
            game={g}
            version={items()}
            onClose={() => {
              g.openInventory(false);
            }}
          />
        )}
      </Show>
    </main>
  );
}
