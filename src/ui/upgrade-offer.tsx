import { For, type JSX, Show, createSignal } from 'solid-js';
import type Game from '../game/game';
import { SHARD_CARD, type UpgradeOffer as UpgradeOfferData } from '../game/mastery';
import { type Upgrade, buildFor, upgradeById } from '../sim/builds';
import type { Skill } from '../sim/skill';
import type Unit from '../sim/unit';
import { iconOr } from './icons';
import { Icon, Notice, Panel } from './kit';

interface Props {
  game: Game;
  // Bumped by the game whenever an offer opens or is taken, so the panel reads it again
  version: number;
}

/**
 * Elite upgrade offer: 3 cards, the player takes 1. The game is paused until
 * a card is taken, so the panel has no close button.
 */
export default function UpgradeOffer(props: Props): JSX.Element {
  const [message, setMessage] = createSignal<string | null>(null);
  const offer = (): UpgradeOfferData | null => (props.version >= 0 ? props.game.offer : null);

  return (
    <Show when={offer()} keyed>
      {(open) => (
        <Panel
          label="Elite upgrade"
          title={open.title}
          icon="mastery"
          place="center"
          class="w-[640px]"
        >
          <Show when={open.bonus}>
            <p class="mb-3 text-xs text-neutral-400">Bonus met: the merc you pick gains a shard.</p>
          </Show>
          <ul class="grid grid-cols-3 gap-3">
            <For each={open.cards}>
              {(card, i) => {
                const merc = (): Unit => props.game.mercsOf()[card.merc];
                const upgrade = (): Upgrade | undefined =>
                  card.upgrade === null ? undefined : upgradeById(card.upgrade);
                const spell = (): Skill | undefined =>
                  buildFor(merc().kind)?.spells.find((s) => s.id === upgrade()?.spell);
                return (
                  <li>
                    <button
                      type="button"
                      aria-label={`Take ${upgrade()?.name ?? `${SHARD_CARD} shards`} for ${merc().name}`}
                      class="well flex h-full w-full flex-col gap-2 p-3 text-left transition hover:bg-white/10"
                      onClick={() => {
                        setMessage(props.game.pickCard(i()));
                      }}
                    >
                      <span class="flex items-center gap-2 text-neutral-200">
                        <Icon name={iconOr(merc().kind, 'vanguard')} class="size-6" />
                        <span class="min-w-0 truncate text-sm">{merc().name}</span>
                      </span>
                      <Show
                        when={upgrade()}
                        fallback={
                          <span class="text-sm font-semibold text-accent">
                            +{SHARD_CARD} shards
                          </span>
                        }
                      >
                        {(u) => (
                          <>
                            <span class="text-sm font-semibold text-accent">{u().name}</span>
                            <span class="text-[11px] text-neutral-500">{spell()?.name}</span>
                            <span class="text-xs text-neutral-300">
                              {u().describe(merc().skillRank(u().spell))}
                            </span>
                          </>
                        )}
                      </Show>
                    </button>
                  </li>
                );
              }}
            </For>
          </ul>
          <Notice text={message()} />
        </Panel>
      )}
    </Show>
  );
}
