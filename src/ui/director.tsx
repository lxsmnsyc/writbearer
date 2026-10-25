import { For, type JSX, Show } from 'solid-js';
import type Game from '../game/game';

export type DirectorStatus = ReturnType<Game['directorStatus']>;

// A share from 0 to 1, or -1 to 1, as a bar and a number
function Meter(props: { label: string; value: number; signed?: boolean }): JSX.Element {
  const width = (): number =>
    props.signed ? Math.abs(props.value) * 50 : Math.max(0, Math.min(1, props.value)) * 100;
  // A signed bar grows from the middle, left when below zero.
  const left = (): number => {
    if (!props.signed) {
      return 0;
    }
    return props.value < 0 ? 50 - width() : 50;
  };
  return (
    <div class="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2">
      <span class="truncate">{props.label}</span>
      <span class="relative h-1.5 rounded bg-white/10">
        <span
          class="absolute top-0 h-1.5 rounded bg-accent"
          style={{ left: `${left()}%`, width: `${width()}%` }}
        />
      </span>
      <span class="text-right tabular-nums">{props.value.toFixed(2)}</span>
    </div>
  );
}

/**
 * The level director's reading, for tuning it: its phase, the intensity it
 * paces by and each party member's, the run's standing, and what the last
 * area said. Shown with `?director` in the address.
 */
export default function DirectorOverlay(props: { status: DirectorStatus }): JSX.Element {
  const s = (): DirectorStatus => props.status;
  return (
    <section
      aria-label="Level director"
      class="absolute top-6 right-6 w-64 space-y-2 rounded-2xl bg-surface/80 p-3 font-mono text-xs ring-1 backdrop-blur-md"
    >
      <h2 class="font-sans text-sm font-semibold">
        Director · {s().phaseName}
        <Show when={s().left} keyed>
          {(left) => <span class="text-neutral-500"> · {Math.ceil(left)}s</span>}
        </Show>
      </h2>
      <Meter label="Pacing" value={s().pacing} />
      <Meter label="Standing" value={s().standing} signed />
      <Meter label="Progress" value={s().progress} />
      <p class="text-neutral-500">
        Spots: {s().spots.spawn} spawn · {s().spots.boss} boss · {s().spots.relief} relief
      </p>
      <div class="space-y-1 border-t border-line pt-2">
        <For each={s().intensity}>{(i) => <Meter label={i.name} value={i.value} />}</For>
      </div>
      <Show when={s().last} keyed>
        {(last) => (
          <div class="space-y-1 border-t border-line pt-2">
            <Meter label="Last area" value={last.score} signed />
            <Meter label="Health" value={last.health} signed />
            <Meter label="Losses" value={last.losses} signed />
            <Meter label="Potions" value={last.potions} signed />
            <Show when={last.pace !== null}>
              <Meter label="Pace" value={last.pace ?? 0} signed />
            </Show>
            <Show when={last.bonus !== null}>
              <Meter label="Bonus" value={last.bonus ?? 0} signed />
            </Show>
            <Meter label="Strength" value={last.strength} signed />
          </div>
        )}
      </Show>
    </section>
  );
}
