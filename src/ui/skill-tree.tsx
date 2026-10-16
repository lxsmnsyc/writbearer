import { For, type JSX, Show, createSignal } from 'solid-js';
import {
  type Branch,
  TIER_LEVEL,
  type TreeNode,
  cannotLearn,
  learn,
  maxRank,
  treeFor,
} from '../content/trees';
import type Unit from '../sim/unit';
import { isIconName } from './icons';
import { Icon, Notice, Tooltip } from './kit';

interface Props {
  unit: Unit;
  // Bumped after each point spent, so ranks are read again
  version: number;
  onSpend: () => void;
}

// What a node shows as: learned, ready to learn, shut, or not made yet.
type State = 'learned' | 'ready' | 'shut' | 'planned';

const TIERS = [1, 2, 3, 4, 5];

/**
 * A merc's skill tree, as Diablo 2's: three branches side by side, a tier
 * per row, each skill opening the one below it. Squares are active skills,
 * circles passives. Click a skill to spend a point on it.
 */
export default function SkillTree(props: Props): JSX.Element {
  const [message, setMessage] = createSignal<string | null>(null);
  const v = (): boolean => props.version >= 0;
  const rank = (node: TreeNode): number => (v() ? (props.unit.skillRanks.get(node.id) ?? 0) : 0);
  const points = (): number => (v() ? props.unit.skillPoints : 0);
  const level = (): number => (v() ? props.unit.level : 0);
  const why = (branch: Branch, node: TreeNode): string | null =>
    v() ? cannotLearn(props.unit, branch, node) : null;
  const state = (branch: Branch, node: TreeNode): State => {
    if (!node.skill && !node.effect) {
      return 'planned';
    }
    if (rank(node) > 0) {
      return 'learned';
    }
    return why(branch, node) === null ? 'ready' : 'shut';
  };
  const text = (node: TreeNode, at: number): string =>
    node.skill?.describe(at) ?? node.describe?.(at) ?? node.summary;

  return (
    <section aria-label="Skill tree">
      <div class="mb-3 flex items-center gap-3">
        <span
          class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1"
          classList={{
            'bg-accent-soft text-accent ring-accent/40': points() > 0,
            'text-neutral-500 ring-white/10': points() === 0,
          }}
        >
          <Icon name="points" class="size-3.5" />
          {points()} skill {points() === 1 ? 'point' : 'points'}
        </span>
        <span class="flex items-center gap-3 text-[11px] text-neutral-500">
          <span class="flex items-center gap-1">
            <span class="size-2.5 rounded-sm ring-1 ring-neutral-500" /> Active
          </span>
          <span class="flex items-center gap-1">
            <span class="size-2.5 rounded-full ring-1 ring-neutral-500" /> Passive
          </span>
          <span class="flex items-center gap-1">
            <span class="size-2.5 rounded-sm ring-1 ring-accent" /> Ready to learn
          </span>
        </span>
      </div>

      <div class="grid grid-cols-[2.5rem_repeat(3,1fr)] gap-x-3">
        <div />
        <For each={treeFor(props.unit)}>
          {(branch) => (
            <div class="mb-3 text-center">
              <h3 class="text-sm font-semibold text-neutral-100">{branch.name}</h3>
              <p class="text-[11px] text-neutral-500">{branch.summary}</p>
            </div>
          )}
        </For>

        <For each={TIERS}>
          {(tier) => (
            <>
              <div
                class="flex flex-col items-center justify-center text-[10px] leading-tight"
                classList={{
                  'text-neutral-300': level() >= TIER_LEVEL[tier - 1],
                  'text-neutral-600': level() < TIER_LEVEL[tier - 1],
                }}
              >
                <span class="uppercase">Lv</span>
                <span class="text-sm font-semibold">{TIER_LEVEL[tier - 1]}</span>
              </div>
              <For each={treeFor(props.unit)}>
                {(branch) => (
                  <Show when={branch.nodes.find((n) => n.tier === tier)} keyed fallback={<div />}>
                    {(node) => {
                      const s = (): State => state(branch, node);
                      // The line down from the node above, lit once that one is learned
                      const above = branch.nodes.find((n) => n.tier === tier - 1);
                      return (
                        <div class="relative flex flex-col items-center pb-5">
                          <Show when={above}>
                            {(a) => (
                              <span
                                aria-hidden="true"
                                class="absolute -top-5 h-5 w-0.5"
                                classList={{
                                  'bg-accent/70': rank(a()) > 0,
                                  'bg-white/10': rank(a()) === 0,
                                }}
                              />
                            )}
                          </Show>
                          <Tooltip
                            placement="right"
                            content={() => (
                              <NodeCard
                                node={node}
                                rank={rank(node)}
                                why={why(branch, node)}
                                text={text}
                              />
                            )}
                          >
                            {(anchor) => (
                              <button
                                type="button"
                                {...anchor}
                                aria-label={`${node.name}, rank ${rank(node)} of ${maxRank(node)}`}
                                class="relative grid size-14 place-items-center ring-1 transition outline-none focus-visible:ring-2"
                                classList={{
                                  'rounded-full': node.passive,
                                  'rounded-xl': !node.passive,
                                  'bg-accent-soft text-accent ring-accent/70': s() === 'learned',
                                  'animate-ready bg-white/5 text-neutral-100 ring-accent hover:bg-accent-soft':
                                    s() === 'ready',
                                  'bg-black/30 text-neutral-500 ring-white/10': s() === 'shut',
                                  'border border-dashed border-white/20 text-neutral-700 ring-transparent':
                                    s() === 'planned',
                                }}
                                onClick={() => {
                                  setMessage(learn(props.unit, branch, node));
                                  props.onSpend();
                                }}
                              >
                                <Icon
                                  name={isIconName(node.id) ? node.id : 'points'}
                                  class="size-8"
                                />
                                <Show when={s() === 'shut' && level() < TIER_LEVEL[tier - 1]}>
                                  <span class="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-neutral-900 text-neutral-500 ring-1 ring-white/10">
                                    <Icon name="locked" class="size-2.5" />
                                  </span>
                                </Show>
                              </button>
                            )}
                          </Tooltip>
                          <span
                            class="mt-1 max-w-full truncate text-[11px]"
                            classList={{
                              'text-neutral-200': s() === 'learned' || s() === 'ready',
                              'text-neutral-500': s() === 'shut',
                              'text-neutral-700': s() === 'planned',
                            }}
                          >
                            {node.name}
                          </span>
                          <Show when={s() !== 'planned'}>
                            <span class="flex gap-0.5">
                              <For each={Array.from({ length: maxRank(node) }, (_, i) => i)}>
                                {(i) => (
                                  <span
                                    class="h-1 w-2.5 rounded-full"
                                    classList={{
                                      'bg-accent': i < rank(node),
                                      'bg-white/10': i >= rank(node),
                                    }}
                                  />
                                )}
                              </For>
                            </span>
                          </Show>
                        </div>
                      );
                    }}
                  </Show>
                )}
              </For>
            </>
          )}
        </For>
      </div>
      <Notice text={message()} />
    </section>
  );
}

interface CardProps {
  node: TreeNode;
  rank: number;
  why: string | null;
  text: (node: TreeNode, rank: number) => string;
}

// A skill's card: what it is, what it does now and at the next rank, and
// what stands in the way of learning it.
function NodeCard(props: CardProps): JSX.Element {
  const planned = (): boolean => !props.node.skill && !props.node.effect;
  const max = (): number => maxRank(props.node);
  const kind = (): string => {
    const s = props.node.skill;
    if (!s) {
      return props.node.passive ? 'Passive' : 'Active';
    }
    return [
      'Active',
      s.cost > 0 ? `${s.cost} mana` : null,
      s.cooldown > 0 ? `${s.cooldown}s cooldown` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  };
  return (
    <div class="w-64">
      <p class="text-sm font-semibold text-neutral-50">{props.node.name}</p>
      <p class="mb-2 text-[11px] text-neutral-500">
        {kind()} · tier {props.node.tier}, level {TIER_LEVEL[props.node.tier - 1]}
        <Show when={!planned()}>
          {' '}
          · rank {props.rank}/{max()}
        </Show>
      </p>
      <Show
        when={!planned()}
        fallback={
          <>
            <p class="text-neutral-400">{props.node.summary}</p>
            <p class="mt-2 text-neutral-600">Not in the game yet.</p>
          </>
        }
      >
        <Show when={props.rank > 0}>
          <p class="text-neutral-300">{props.text(props.node, props.rank)}</p>
        </Show>
        <Show when={props.rank < max()}>
          <p class="eyebrow mt-2 mb-0.5">{props.rank === 0 ? 'First rank' : 'Next rank'}</p>
          <p class="text-neutral-400">{props.text(props.node, props.rank + 1)}</p>
        </Show>
        <p
          class="mt-2"
          classList={{ 'text-accent': props.why === null, 'text-red-300': props.why !== null }}
        >
          {props.why ?? 'Click to learn.'}
        </p>
      </Show>
    </div>
  );
}
