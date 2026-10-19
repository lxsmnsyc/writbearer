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
import { iconOr } from './icons';
import { Icon, Meter } from './kit';

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
  const [title, setTitle] = createSignal(false);
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
        onTitle: (open, seed) => {
          setTitle(open);
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
    <main class="relative grid h-full place-items-center bg-black">
      <canvas
        ref={(el) => {
          canvas = el;
        }}
        class="max-h-full max-w-full cursor-crosshair [image-rendering:pixelated]"
      />

      <Show when={!title() && game()} keyed>
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
            class="absolute top-6 left-6 flex w-64 items-start gap-3 rounded-2xl bg-surface/80 p-3 ring-1 backdrop-blur-md"
            classList={{ 'ring-accent/60': o.done, 'ring-line': !o.done }}
            aria-label="Objective"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-lg"
              classList={{
                'bg-accent text-neutral-950': o.done,
                'bg-white/5 text-neutral-300': !o.done,
              }}
            >
              <Icon name={o.kind} class="size-5" />
            </span>
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-neutral-50">{o.title}</h2>
              <Show when={o.mutators.length > 0}>
                <ul class="mt-0.5 flex flex-wrap gap-1" aria-label="Mutators">
                  <Index each={o.mutators}>
                    {(m) => (
                      <li
                        class="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[11px] text-red-300"
                        title={m().text}
                      >
                        {m().name}
                      </li>
                    )}
                  </Index>
                </ul>
              </Show>
              <p class="text-xs text-neutral-400">{o.detail}</p>
              <Show when={o.coming.length > 0}>
                <ul class="mt-1.5 flex flex-wrap gap-1.5" aria-label="Next wave">
                  <Index each={o.coming}>
                    {(g) => (
                      <li
                        class="flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-xs text-neutral-300"
                        title={g().name}
                      >
                        <Icon name={iconOr(g().kind, 'combat')} class="size-3.5" />
                        <span aria-label={`${g().count} ${g().name}`}>×{g().count}</span>
                      </li>
                    )}
                  </Index>
                </ul>
              </Show>
              <Show when={o.bonus}>
                {(b) => (
                  <p
                    class="mt-1.5 border-t border-line pt-1.5 text-xs"
                    classList={{
                      'text-neutral-300': b().state === 'open',
                      'text-accent': b().state === 'met',
                      'text-neutral-500': b().state === 'failed',
                    }}
                    aria-label="Bonus challenge"
                  >
                    <span class="font-semibold">Bonus · {b().title}:</span> {b().detail}
                  </p>
                )}
              </Show>
            </div>
          </section>
        )}
      </Show>
      <nav class="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" aria-label="Party">
        <Index each={party()}>
          {(entry, i) => (
            <button
              type="button"
              aria-pressed={selected() === entry().unit}
              class="flex w-52 items-center gap-2.5 rounded-2xl bg-surface/80 p-2 text-left ring-1 backdrop-blur-md transition"
              classList={{
                'ring-accent': selected() === entry().unit,
                'ring-line hover:ring-white/25': selected() !== entry().unit,
                'opacity-50 grayscale': !entry().alive,
              }}
              disabled={!entry().alive}
              onClick={() => game()?.select(entry().unit)}
            >
              <span class="relative grid size-11 shrink-0 place-items-center rounded-xl bg-white/5 text-neutral-200 ring-1 ring-white/10">
                <Icon name={iconOr(entry().unit.kind, 'vanguard')} class="size-7" />
                <span class="absolute -bottom-1 -left-1 kbd">{i + 1}</span>
                <Show when={entry().points > 0}>
                  <span
                    class="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-neutral-950"
                    title="Points to spend"
                  >
                    +
                  </span>
                </Show>
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-baseline justify-between gap-1 text-xs">
                  <span class="truncate font-semibold text-neutral-100">{entry().unit.name}</span>
                  <span class="shrink-0 text-[10px] text-neutral-500">
                    {entry().unit.name === entry().unit.job.name ? '' : `${entry().unit.job.name} `}
                    Lv {entry().level}
                  </span>
                </span>
                <Meter
                  class="mt-1 h-1.5"
                  value={entry().hp}
                  max={entry().maxHp}
                  color="var(--color-health)"
                />
                <Meter
                  class="mt-0.5 h-1"
                  value={entry().mana}
                  max={entry().maxMana}
                  color="var(--color-mana)"
                />
                <Show when={!entry().alive}>
                  <span class="mt-0.5 block text-[10px] font-semibold text-red-400">Dead</span>
                </Show>
                <Show when={entry().alive && entry().morale <= Morale.Low}>
                  <span class="mt-0.5 block text-[10px] font-semibold text-red-400">
                    {MORALE_NAME[entry().morale]} morale
                  </span>
                </Show>
              </span>
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
      <Show when={title() && game()} keyed>
        {(g) => (
          <StartPicker
            seed={runSeed()}
            gold={g.pack.gold}
            onSetOut={() => {
              g.setOut();
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
            guild={g.atGuild}
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
