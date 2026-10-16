import { Index, type JSX, Show, createSignal, onCleanup, onMount } from 'solid-js';
import Game, { type EventView, type GameOptions } from '../game/game';
import { type RunSave, describeSave, readSave } from '../game/save';
import { randomSeed } from '../core/seed';
import { OBJECTIVES } from '../gen/graph';
import { HIREABLE } from '../content/recruits';
import { MORALE_NAME, Morale, moraleOf } from '../sim/morale';
import type Unit from '../sim/unit';
import Inventory from './inventory';
import MercPanel from './merc-panel';
import Station from './station';
import ShoutBar, { type ShoutEntry } from './shouts';
import LayerMapPanel from './map';
import Town from './town';
import EventPanel from './event';
import CompendiumPanel from './compendium';
import { RecruitDialog, StartPicker } from './offer';
import type { Offer } from '../content/recruits';

interface PartyEntry {
  unit: Unit;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  alive: boolean;
  level: number;
  // Skill and stat points not yet spent
  points: number;
  morale: Morale;
}

// How often the party bar reads health and mana from the game, in milliseconds.
const PARTY_REFRESH = 200;

// Run options from the address: `?seed=ASHEN` fixes the run, and
// `?party=vanguard,ranger` skips the first pick, as browser tests do.
function runOptions(): GameOptions {
  const params = new URLSearchParams(location.search);
  const party = params
    .get('party')
    ?.split(',')
    .filter((k): k is Offer['kind'] => (HIREABLE as readonly string[]).includes(k));
  const area = Number(params.get('area'));
  return {
    seed: params.get('seed') ?? undefined,
    party,
    area: Number.isInteger(area) && area > 0 ? area : undefined,
    station: params.has('station'),
    tomb: params.has('tomb'),
    town: params.has('town'),
    event: params.get('event') ?? undefined,
    endless: params.has('endless'),
    objective: OBJECTIVES.find((o) => o === params.get('objective')),
  };
}

export default function App(): JSX.Element {
  let canvas: HTMLCanvasElement | undefined;
  const [game, setGame] = createSignal<Game | null>(null);
  const [selected, setSelected] = createSignal<Unit | null>(null);
  const [party, setParty] = createSignal<PartyEntry[]>([]);
  const [shouts, setShouts] = createSignal<ShoutEntry[]>([]);
  const [objective, setObjective] = createSignal<ReturnType<Game['objectiveStatus']>>(null);
  const [inventory, setInventory] = createSignal(false);
  const [offers, setOffers] = createSignal<Offer[] | null>(null);
  const [recruit, setRecruit] = createSignal<Offer | null>(null);
  const [station, setStation] = createSignal(false);
  const [map, setMap] = createSignal(false);
  const [town, setTown] = createSignal(false);
  const [event, setEvent] = createSignal<EventView | null>(null);
  // The suspended run, offered at the start of a new one
  const [saved, setSaved] = createSignal<RunSave | null>(null);
  const [compendium, setCompendium] = createSignal(false);
  // The seed of the run about to begin
  const [runSeed, setRunSeed] = createSignal('');
  const [endless, setEndless] = createSignal(runOptions().endless ?? false);
  // Bumped whenever the pack or gear changes, so panels read it again.
  const [items, setItems] = createSignal(0);

  onMount(() => {
    if (!canvas) {
      return;
    }
    const g = new Game(
      canvas,
      {
        onSelect: (unit) => {
          setSelected(unit);
        },
        onInventory: (open) => {
          setInventory(open);
        },
        onChange: () => {
          setItems((v) => v + 1);
        },
        onOffers: (o, seed) => {
          setOffers(o);
          setRunSeed(seed);
        },
        onRecruit: (o) => {
          setRecruit(o);
        },
        onStation: (open) => {
          setStation(open);
        },
        onMap: (open) => {
          setMap(open);
        },
        onTown: (open) => {
          setTown(open);
        },
        onEvent: (e) => {
          setEvent(e);
        },
        onCompendium: (open) => {
          setCompendium(open);
        },
      },
      runOptions(),
    );
    g.start();
    setGame(g);
    readSave()
      .then((save) => {
        setSaved(save);
      })
      .catch(() => null);
    // A kill count still waiting to be written goes in as the page closes.
    const flush = (): void => {
      g.compendium.flush();
    };
    addEventListener('pagehide', flush);
    g.compendium
      .load()
      .then(() => {
        g.changed();
      })
      .catch(() => null);
    const timer = setInterval(() => {
      setParty(
        g.mercs().map((unit) => ({
          unit,
          hp: unit.hp,
          maxHp: unit.derived.maxHp,
          mana: unit.mana,
          maxMana: unit.derived.maxMana,
          alive: unit.alive,
          level: unit.level,
          points: unit.skillPoints + unit.statPoints,
          morale: moraleOf(unit),
        })),
      );
      setShouts(g.shoutBar());
      setObjective(g.objectiveStatus());
    }, PARTY_REFRESH);
    onCleanup(() => {
      clearInterval(timer);
      removeEventListener('pagehide', flush);
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

      <Show when={game()} keyed>
        {(g) => (
          <ShoutBar
            shouts={shouts()}
            onShout={(shout) => {
              g.shout(shout);
            }}
          />
        )}
      </Show>
      <Show when={objective()} keyed>
        {(o) => (
          <section
            data-part="card"
            class="absolute right-4 bottom-4 w-56 border bg-zinc-950/90 px-3 py-2 text-xs"
            classList={{ 'border-amber-500': o.done, 'border-zinc-700': !o.done }}
            aria-label="Objective"
          >
            <h2 data-part="title" class="font-serif text-sm text-zinc-100">
              {o.title}
            </h2>
            <p data-part="note" class="text-zinc-400">
              {o.detail}
            </p>
          </section>
        )}
      </Show>
      <nav class="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" aria-label="Party">
        <Index each={party()}>
          {(entry, i) => (
            <button
              type="button"
              data-part="card"
              aria-pressed={selected() === entry().unit}
              class="w-40 border bg-zinc-950/90 px-3 py-2 text-left text-xs"
              classList={{
                'border-amber-500': selected() === entry().unit,
                'border-zinc-700 hover:border-zinc-500': selected() !== entry().unit,
                'opacity-50': !entry().alive,
              }}
              disabled={!entry().alive}
              onClick={() => game()?.select(entry().unit)}
            >
              <div class="flex justify-between text-zinc-300">
                <span>
                  {entry().unit.name}{' '}
                  <span class="text-zinc-500">
                    {entry().unit.name === entry().unit.job.name ? '' : `${entry().unit.job.name} `}
                    {entry().level}
                  </span>
                  <Show when={entry().points > 0}>
                    <span data-part="danger" class="text-amber-400" title="Points to spend">
                      {' '}
                      +
                    </span>
                  </Show>
                </span>
                <span class="text-zinc-600">{i + 1}</span>
              </div>
              <div data-part="bar" class="mt-1 h-1 bg-zinc-800">
                <div
                  data-part="bar-fill"
                  class="h-1 bg-amber-500"
                  style={{ width: `${Math.max(0, (100 * entry().hp) / entry().maxHp)}%` }}
                />
              </div>
              <div data-part="bar" class="mt-0.5 h-0.5 bg-zinc-800">
                <div
                  data-part="mana-fill"
                  class="h-0.5 bg-teal-600"
                  style={{
                    width: `${entry().maxMana ? (100 * entry().mana) / entry().maxMana : 0}%`,
                  }}
                />
              </div>
              <Show when={!entry().alive}>
                <div class="mt-1 text-red-500">Dead</div>
              </Show>
              <Show when={entry().alive && entry().morale <= Morale.Low}>
                <div data-part="danger" class="mt-1 text-red-500">
                  {MORALE_NAME[entry().morale]} morale
                </div>
              </Show>
            </button>
          )}
        </Index>
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
              onGear={() => {
                g.openInventory(true, unit);
              }}
              onChange={() => {
                g.changed();
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
      <Show when={town() && game()} keyed>
        {(g) => (
          <Town
            game={g}
            version={items()}
            onClose={() => {
              g.closeTown();
            }}
          />
        )}
      </Show>
      <Show when={game() && event()} keyed>
        {(e) => {
          const g = game();
          return g ? (
            <EventPanel
              event={e}
              onChoose={(i) => g.chooseEvent(i)}
              onClose={() => {
                g.closeEvent();
              }}
            />
          ) : null;
        }}
      </Show>
      <Show when={map() && game()} keyed>
        {(g) => (
          <LayerMapPanel
            game={g}
            onClose={() => {
              g.openMap(false);
            }}
          />
        )}
      </Show>
      <Show when={station() && game()} keyed>
        {(g) => (
          <Station
            game={g}
            version={items()}
            onClose={() => {
              g.closeStation();
            }}
          />
        )}
      </Show>
      <Show when={offers() && game()} keyed>
        {(g) => (
          <StartPicker
            seed={runSeed()}
            gold={g.pack.gold}
            offers={offers() ?? []}
            onPick={(index) => {
              g.choose(index);
              setSaved(null);
            }}
            saved={saved() && { seed: saved()!.seed, place: describeSave(saved()!) }}
            onCompendium={() => {
              g.openCompendium(true);
            }}
            endless={endless()}
            onMode={(on) => {
              setEndless(on);
              g.setEndless(on);
            }}
            onSeed={(seed) => {
              g.setSeed(seed ?? randomSeed());
            }}
            shareLink={() => g.shareLink()}
            onResume={() => {
              const save = saved();
              setSaved(null);
              if (save) {
                g.resume(save);
              }
            }}
          />
        )}
      </Show>

      <Show when={compendium() && game()} keyed>
        {(g) => (
          <CompendiumPanel
            game={g}
            version={items()}
            onClose={() => {
              g.openCompendium(false);
            }}
          />
        )}
      </Show>

      <Show when={recruit() && game()} keyed>
        {(g) => (
          <RecruitDialog
            offer={recruit()!}
            gold={items() >= 0 ? g.pack.gold : 0}
            onHire={() => g.hire()}
            onLeave={() => {
              g.endTalk();
            }}
          />
        )}
      </Show>
    </main>
  );
}
