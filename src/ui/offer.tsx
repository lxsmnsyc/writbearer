import { For, type JSX, Show, createSignal } from 'solid-js';
import type { Offer } from '../content/recruits';
import { MERCS } from '../content/roster';
import { TRAIT_BY_ID } from '../content/traits';
import { TREES } from '../content/trees';
import { Button, Icon, Notice, Segmented, Tip } from './kit';

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
      class="flex w-72 flex-col rounded-xl bg-white/3 p-4 ring-1 ring-white/8"
      aria-label={`${props.offer.name}, ${job()}`}
    >
      <div class="flex items-center gap-3">
        <span class="grid size-14 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name={props.offer.kind} class="size-9" />
        </span>
        <div>
          <h3 class="font-display text-lg leading-tight font-semibold text-neutral-50">
            {props.offer.name}
          </h3>
          <p class="text-xs text-neutral-400">
            {job()} · level {props.offer.level}
          </p>
        </div>
      </div>
      <p class="mt-3 text-sm text-neutral-300">{ROLE[props.offer.kind]}</p>
      <p class="mt-2 text-xs text-neutral-500">
        Branches: {(TREES[job()] ?? []).map((b) => b.name).join(', ')}
      </p>
      <Show when={props.offer.traits.length > 0}>
        <ul class="mt-3 space-y-1.5 text-xs">
          <For each={props.offer.traits}>
            {(id) => (
              <li class="rounded-lg bg-black/20 px-2.5 py-1.5">
                <span class="font-semibold text-accent">{TRAIT_BY_ID.get(id)?.name}</span>
                <span class="block text-neutral-400">{TRAIT_BY_ID.get(id)?.description}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Button
        tone="primary"
        class="mt-4"
        onClick={() => {
          props.onPick();
        }}
      >
        <Icon name="gold" class="size-4" />
        {props.action}
      </Button>
    </article>
  );
}

interface StartProps {
  seed: string;
  gold: number;
  // Into the Guild House, to hire the party
  onSetOut: () => void;
  // A suspended run, where it stands, and how to take it up again
  saved: { seed: string; place: string } | null;
  onResume: () => void;
  onCompendium: () => void;
  // Endless mode, and switching to and from it
  endless: boolean;
  onMode: (endless: boolean) => void;
  // Starting on a seed typed in, or a new random one, and copying a link
  // to this one
  onSeed: (seed: string | null) => void;
  shareLink: () => string;
}

const MODES = [
  { value: false, name: 'Story', note: 'Down the Hollow to the Tomb, and an ending.' },
  { value: true, name: 'Endless', note: 'Phase after phase, until the bearer falls.' },
];

/**
 * The start of a run: its mode and seed, a suspended run to continue, and
 * the way into the Guild House, where the party is hired.
 */
export function StartPicker(props: StartProps): JSX.Element {
  return (
    <aside
      class="panel absolute top-1/2 left-1/2 w-[520px] -translate-x-1/2 -translate-y-1/2 p-7"
      aria-label="A new run"
    >
      <div class="mb-6 text-center">
        <span class="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon name="bearer" class="size-9" />
        </span>
        <h2 class="font-display text-4xl font-bold tracking-wide text-neutral-50">Writbearer</h2>
        <p class="mt-1 text-xs tracking-[0.2em] text-neutral-500 uppercase">A new run</p>
      </div>
      <Segmented
        label="Mode"
        options={MODES}
        value={props.endless}
        onChange={(endless) => {
          props.onMode(endless);
        }}
      />
      <p class="mt-3 mb-5 text-sm leading-relaxed text-neutral-400">
        <Show
          when={props.endless}
          fallback={
            <>
              The Guild sends the Writ down into the Hollow. Four recruits wait at the Guild House:
              the Guild pays the first, and its purse holds{' '}
              <span class="font-semibold text-accent">{props.gold} gold</span> for the others. No
              one is left to hire below.
            </>
          }
        >
          No Writ and no ending: the Guild sends the party down, phase after phase, each deeper and
          harder, until the bearer falls. Mercs can be hired in every phase. The purse holds{' '}
          <span class="font-semibold text-accent">{props.gold} gold</span>.
        </Show>
      </p>
      <SeedBar seed={props.seed} onSeed={props.onSeed} shareLink={props.shareLink} />
      <div class="mt-5 flex flex-col gap-2">
        <Show when={props.saved} keyed>
          {(saved) => (
            <button
              type="button"
              class="rounded-xl bg-white/5 px-4 py-3 text-left ring-1 ring-accent/40 transition hover:bg-accent-soft"
              onClick={() => {
                props.onResume();
              }}
            >
              <span class="font-semibold text-neutral-50">Continue the last run</span>
              <span class="block text-xs text-neutral-400">
                Seed {saved.seed} · {saved.place}. Setting out instead starts over.
              </span>
            </button>
          )}
        </Show>
        <Button
          tone="primary"
          size="lg"
          onClick={() => {
            props.onSetOut();
          }}
        >
          Enter the Guild House
        </Button>
        <Button
          tone="ghost"
          aria-label="The Compendium (K)"
          onClick={() => {
            props.onCompendium();
          }}
        >
          <Icon name="compendium" class="size-4" />
          The Compendium <span class="kbd">K</span>
        </Button>
      </div>
      <p class="mt-5 text-center text-[10px] text-neutral-600">
        Icons by Lorc, Delapouite and others at game-icons.net, under CC BY 3.0.
      </p>
    </aside>
  );
}

interface SeedProps {
  seed: string;
  onSeed: (seed: string | null) => void;
  shareLink: () => string;
}

/**
 * The run's seed: typed in to play a run someone shared, drawn anew, or
 * copied as a link to share this one.
 */
function SeedBar(props: SeedProps): JSX.Element {
  const [typed, setTyped] = createSignal('');
  const [copied, setCopied] = createSignal<string | null>(null);
  const copy = async (): Promise<void> => {
    const link = props.shareLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied('Link copied.');
    } catch {
      // No clipboard, as over plain HTTP: show the link to copy by hand.
      setCopied(link);
    }
  };
  return (
    <form
      class="well p-3"
      aria-label="Seed"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSeed(typed());
        setTyped('');
        setCopied(null);
      }}
    >
      <div class="mb-2 flex items-center gap-2">
        <Icon name="seed" class="size-4 text-neutral-500" />
        <span class="eyebrow">Seed</span>{' '}
        <span class="font-mono text-sm font-semibold text-neutral-100">{props.seed}</span>
        <span class="flex-1" />
        <Button
          size="sm"
          tone="ghost"
          onClick={() => {
            props.onSeed(null);
            setCopied(null);
          }}
        >
          New seed
        </Button>
        <Button
          size="sm"
          tone="ghost"
          onClick={() => {
            copy().catch(() => null);
          }}
        >
          Copy link
        </Button>
      </div>
      <div class="flex gap-2">
        <input
          type="text"
          aria-label="Play a seed"
          placeholder="Play a seed"
          maxLength={32}
          class="h-8 flex-1 rounded-lg bg-black/40 px-3 font-mono text-sm text-neutral-100 uppercase ring-1 ring-white/10 outline-none placeholder:text-neutral-600 placeholder:normal-case focus:ring-accent/60"
          value={typed()}
          onInput={(e) => {
            setTyped(e.currentTarget.value);
          }}
        />
        <Button type="submit" size="sm" class="h-8">
          Play
        </Button>
      </div>
      <Show when={copied()}>
        <p class="mt-2 text-xs break-all text-neutral-400 select-all" role="status">
          {copied()}
        </p>
      </Show>
    </form>
  );
}

interface RecruitProps {
  offer: Offer;
  gold: number;
  // Whether it waits at the Guild House, and not by a fire
  guild: boolean;
  onHire: () => string | null;
  onLeave: () => void;
}

/** A merc for hire, at the Guild House or by its fire, asking its wage. */
export function RecruitDialog(props: RecruitProps): JSX.Element {
  const [message, setMessage] = createSignal<string | null>(null);
  return (
    <aside
      class="panel absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-5"
      aria-label="A merc for hire"
    >
      <p class="mb-3 flex items-center justify-between gap-6 text-xs text-neutral-400">
        <span>
          {props.guild
            ? 'A recruit of the Guild looks the bearer over.'
            : 'A merc sits by the fire, and looks the bearer over.'}
        </span>
        <Tip text="The purse">
          {(anchor) => (
            <span {...anchor} class="flex items-center gap-1 font-semibold text-accent">
              <Icon name="gold" class="size-4" />
              {props.gold}
            </span>
          )}
        </Tip>
      </p>
      <OfferCard
        offer={props.offer}
        action={
          props.offer.wage === 0 ? 'Take: the Guild pays' : `Hire for ${props.offer.wage} gold`
        }
        onPick={() => {
          setMessage(props.onHire());
        }}
      />
      <Notice text={message()} />
      <Button
        tone="ghost"
        size="sm"
        class="mt-3 w-full"
        onClick={() => {
          props.onLeave();
        }}
      >
        {props.guild ? 'Not now' : 'Leave it by the fire'}
      </Button>
    </aside>
  );
}
