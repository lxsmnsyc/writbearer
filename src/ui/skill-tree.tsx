import { For, type JSX, Show, createSignal } from 'solid-js';
import { TIER_LEVEL, type TreeNode, cannotLearn, learn, maxRank, treeFor } from '../content/trees';
import type Unit from '../sim/unit';

interface Props {
  unit: Unit;
  // Bumped after each point spent, so ranks are read again
  version: number;
  onSpend: () => void;
}

/** A merc's three branches. Click a skill to spend a point on it. */
export default function SkillTree(props: Props): JSX.Element {
  const [message, setMessage] = createSignal<string | null>(null);
  const rank = (node: TreeNode): number =>
    props.version >= 0 ? (props.unit.skillRanks.get(node.id) ?? 0) : 0;
  const points = (): number => (props.version >= 0 ? props.unit.skillPoints : 0);
  const text = (node: TreeNode): string => {
    const shown = Math.max(1, rank(node));
    return node.skill?.describe(shown) ?? node.describe?.(shown) ?? node.summary;
  };

  return (
    <section aria-label="Skill tree">
      <p data-part="note" class="mb-2 text-xs text-zinc-500">
        {points()} skill points. Tiers open at levels {TIER_LEVEL.join(', ')}.
      </p>
      <div class="grid grid-cols-3 gap-2">
        <For each={treeFor(props.unit)}>
          {(branch) => (
            <div>
              <h3 data-part="heading" class="mb-1 text-xs tracking-widest text-zinc-500 uppercase">
                {branch.name}
              </h3>
              <ol class="space-y-1" aria-label={branch.name}>
                <For each={branch.nodes}>
                  {(node) => {
                    const why = (): string | null =>
                      props.version >= 0 ? cannotLearn(props.unit, branch, node) : null;
                    const planned = !node.skill && !node.effect;
                    return (
                      <li>
                        <button
                          type="button"
                          data-part="row"
                          class="w-full border border-zinc-800 px-2 py-1 text-left"
                          classList={{
                            'opacity-40': planned,
                            'border-amber-500': why() === null,
                          }}
                          title={why() ?? 'Spend a point'}
                          aria-label={`${node.name}, rank ${rank(node)} of ${maxRank(node)}`}
                          onClick={() => {
                            setMessage(learn(props.unit, branch, node));
                            props.onSpend();
                          }}
                        >
                          <span class="flex justify-between text-xs">
                            <span>
                              {node.name}
                              <span data-part="note" class="text-zinc-500">
                                {node.passive ? ' · passive' : ''}
                              </span>
                            </span>
                            <span data-part="note">
                              {rank(node)}/{maxRank(node)}
                            </span>
                          </span>
                          <span
                            data-part="note"
                            class="block text-[11px] leading-tight text-zinc-500"
                          >
                            {planned ? `${node.summary} Not in the game yet.` : text(node)}
                          </span>
                        </button>
                      </li>
                    );
                  }}
                </For>
              </ol>
            </div>
          )}
        </For>
      </div>
      <Show when={message()}>
        <p data-part="danger" class="mt-2 text-xs text-red-400" role="alert">
          {message()}
        </p>
      </Show>
    </section>
  );
}
