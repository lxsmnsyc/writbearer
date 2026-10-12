import { For, type JSX, Show, createSignal } from 'solid-js';
import type { Offer } from '../content/recruits';
import { MERCS } from '../content/roster';
import { TRAIT_BY_ID } from '../content/traits';
import { TREES } from '../content/trees';

// What each job does, in a line, for players choosing between them.
const ROLE: Record<Offer['kind'], string> = {
  vanguard: 'Tank. Holds the line with a tower shield and taunts.',
  ranger: 'Ranged damage. Picks off threats with a bow and sets snares.',
  cleric: 'Healer. Mends the party, raises its dead, smites the Undead.',
};

interface CardProps {
  offer: Offer;
  // The button's label, such as "Take" or "Hire for 90 gold"
  action: string;
  onPick: () => void;
}

/** One merc offered for hire: its job, name, traits and wage. */
export function OfferCard(props: CardProps): JSX.Element {
  const job = (): string => MERCS[props.offer.kind].job.name;
  return (
    <article
      data-part="card"
      class="flex w-56 flex-col border border-zinc-700 bg-zinc-950/95 p-3 text-sm text-zinc-300"
      aria-label={`${props.offer.name}, ${job()}`}
    >
      <h3 data-part="title" class="font-serif text-lg text-zinc-100">
        {props.offer.name}
      </h3>
      <p data-part="note" class="text-xs text-zinc-500">
        {job()} · level {props.offer.level}
      </p>
      <p class="mt-2 text-xs">{ROLE[props.offer.kind]}</p>
      <p data-part="note" class="mt-2 text-xs text-zinc-500">
        Branches: {(TREES[job()] ?? []).map((b) => b.name).join(', ')}
      </p>
      <ul class="mt-2 space-y-1 text-xs">
        <For each={props.offer.traits}>
          {(id) => (
            <li>
              <span>{TRAIT_BY_ID.get(id)?.name}</span>
              <span data-part="note" class="text-zinc-500">
                {' '}
                · {TRAIT_BY_ID.get(id)?.description}
              </span>
            </li>
          )}
        </For>
      </ul>
      <button
        type="button"
        data-part="choice"
        class="mt-auto border border-zinc-600 px-2 py-1 pt-1 hover:border-zinc-300"
        onClick={() => {
          props.onPick();
        }}
      >
        {props.action}
      </button>
    </article>
  );
}

interface StartProps {
  seed: string;
  gold: number;
  offers: Offer[];
  onPick: (index: number) => void;
  // A suspended run, where it stands, and how to take it up again
  saved: { seed: string; place: string } | null;
  onResume: () => void;
  onCompendium: () => void;
  // Endless mode, and switching to and from it
  endless: boolean;
  onMode: (endless: boolean) => void;
}

const MODES = [
  { endless: false, name: 'Story' },
  { endless: true, name: 'Endless' },
];

/** The start of a run: the bearer picks its first merc from three. */
export function StartPicker(props: StartProps): JSX.Element {
  return (
    <aside
      data-part="panel"
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-zinc-700 bg-zinc-950/95 p-5 text-zinc-300"
      aria-label="Choose your first merc"
    >
      <h2 data-part="title" class="font-serif text-xl text-zinc-100">
        Choose your first merc
      </h2>
      <div class="my-2 flex gap-1" role="radiogroup" aria-label="Mode">
        <For each={MODES}>
          {(mode) => (
            <button
              type="button"
              role="radio"
              data-part="choice"
              aria-checked={props.endless === mode.endless}
              class="border px-3 py-1 text-xs"
              onClick={() => {
                props.onMode(mode.endless);
              }}
            >
              {mode.name}
            </button>
          )}
        </For>
      </div>
      <p data-part="note" class="mb-4 text-xs text-zinc-500">
        <Show
          when={props.endless}
          fallback={
            <>
              The Writ sets out for the Hollow with one sword at its side. The Guild's purse holds{' '}
              {props.gold} gold, enough to hire three more by the fires of wandering mercs on the
              way.
            </>
          }
        >
          No Writ and no ending: the Guild sends the party down, phase after phase, each deeper and
          harder, until the bearer falls. Mercs can be hired in every phase. The purse holds{' '}
          {props.gold} gold.
        </Show>{' '}
        Seed {props.seed}.
      </p>
      <Show when={props.saved} keyed>
        {(saved) => (
          <button
            type="button"
            data-part="choice"
            class="mb-4 w-full border border-amber-700 px-3 py-2 text-left hover:border-amber-400"
            onClick={() => {
              props.onResume();
            }}
          >
            Continue the last run
            <span data-part="note" class="block text-xs text-zinc-500">
              Seed {saved.seed} · {saved.place}. Taking a new merc instead starts over.
            </span>
          </button>
        )}
      </Show>
      <div class="flex gap-3">
        <For each={props.offers}>
          {(offer, i) => (
            <OfferCard
              offer={offer}
              action="Take"
              onPick={() => {
                props.onPick(i());
              }}
            />
          )}
        </For>
      </div>
      <button
        type="button"
        class="mt-3 text-xs text-zinc-500 hover:text-zinc-200"
        onClick={() => {
          props.onCompendium();
        }}
      >
        The Compendium (K)
      </button>
    </aside>
  );
}

interface RecruitProps {
  offer: Offer;
  gold: number;
  onHire: () => string | null;
  onLeave: () => void;
}

/** A wandering merc by its fire, asking its wage. */
export function RecruitDialog(props: RecruitProps): JSX.Element {
  const [message, setMessage] = createSignal<string | null>(null);
  return (
    <aside
      data-part="panel"
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-zinc-700 bg-zinc-950/95 p-5 text-zinc-300"
      aria-label="A merc for hire"
    >
      <p data-part="note" class="mb-3 text-xs text-zinc-500">
        A merc sits by the fire, and looks the bearer over. You have {props.gold} gold.
      </p>
      <div class="flex gap-3">
        <OfferCard
          offer={props.offer}
          action={`Hire for ${props.offer.wage} gold`}
          onPick={() => {
            setMessage(props.onHire());
          }}
        />
      </div>
      <Show when={message()}>
        <p data-part="danger" class="mt-2 text-xs text-red-400" role="alert">
          {message()}
        </p>
      </Show>
      <button
        type="button"
        class="mt-3 text-xs text-zinc-500 hover:text-zinc-200"
        onClick={() => {
          props.onLeave();
        }}
      >
        Leave it by the fire
      </button>
    </aside>
  );
}
