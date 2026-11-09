// What the run hears from the simulation: heavy hits, deaths and kills.
import { EventPriority } from '../../core/event-emitter';
import { Stream } from '../../core/seed';
import { fellTurned } from '../../sim/control';
import { SimEvents } from '../../sim/events';
import { DamageFlags, DamagePriority, Side } from '../../sim/types';
import type Unit from '../../sim/unit';
import { gainXp, killXp } from '../../sim/progress';
import { rollCards, rollDrops, rollSetPiece, rollUnique } from '../../gen/loot';
import { gather, materialsFrom } from '../../content/materials';
import { countWeaponUse, survivePhase } from '../../content/jobs/sellsword/upgrades';
import { AREAS_PER_LAYER } from '../../gen/layers';
import { applySets } from '../../content/sets';
import type GameState from './state';
import { endRun } from './saving';
import watchTheft from './theft';

// Impact: hits at least this heavy freeze the world briefly and shake it.
const HEAVY_HIT = 14;
const HIT_STOP = 0.06;
const MAX_SHAKE = 3;

// Hangs the run's listeners on a fresh sim.
export default function watchSim(g: GameState): void {
  // Spells that cost gold, such as Bribe, pay from the pack.
  g.sim.purse = {
    get gold() {
      return g.pack.gold;
    },
    set gold(value: number) {
      g.pack.gold = value;
    },
  };
  watchTheft(g);
  // Run-long counts: the phases each Sellsword survives, and how long it
  // fights with each kind of weapon.
  let phase: number | null = null;
  g.sim.on(SimEvents.Tick, EventPriority.Post, (event) => {
    const now = Math.floor(g.stageIndex / AREAS_PER_LAYER);
    if (phase !== null && now > phase) {
      survivePhase(g.sim);
    }
    phase = now;
    countWeaponUse(g.sim, event.dt);
  });
  g.sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (event.target === g.bearer && event.value > 0) {
      g.bonus?.hurt();
    }
    if (event.value < HEAVY_HIT || event.flags & DamageFlags.DoT) {
      return;
    }
    g.hitStop = Math.max(g.hitStop, HIT_STOP);
    g.shake = Math.max(g.shake, Math.min(MAX_SHAKE, event.value / 12));
  });
  // A merc that rises puts its set pieces back into the count.
  g.sim.on(SimEvents.UnitRevived, EventPriority.Post, () => {
    applySets(g.sim);
  });
  g.sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
    // The key to a Labyrinth's hall falls where its bearer dies.
    if (event.source.bearsKey) {
      const { x, z } = event.source;
      g.stage.props.push({ kind: 'key', x, z, seed: 0.5 });
      g.say(
        g.stage.vault
          ? 'The vault’s key falls from the dead.'
          : 'The key to the hall falls from the dead.',
      );
    }
    // A broken horn post is no kill: it pays nothing and drops nothing.
    if (event.source.side === Side.Monster && !event.source.still && !fellTurned(event.source)) {
      g.slain++;
      g.compendium.beat(event.source.kind);
      shareXp(g, event.source);
      g.scatter(
        [
          ...rollDrops(
            g.streams.get(1, Stream.Loot),
            event.source.level,
            event.source.rank,
            event.source.bounty,
            g.sim,
          ),
          ...rollCards(g.streams.get(1, Stream.Loot), event.source.kind, event.source.rank),
          ...[
            rollUnique(g.streams.get(1, Stream.Loot), event.source.level, event.source.rank),
            rollSetPiece(g.streams.get(1, Stream.Loot), event.source.level, event.source.rank),
          ].filter((i) => i !== null),
        ],
        event.source,
      );
      gather(g.pack.materials, materialsFrom(g.streams.get(1, Stream.Loot), event.source));
    }
    // A merc's death takes its set pieces out of the count.
    if (event.source.side === Side.Party) {
      applySets(g.sim);
    }
    if (event.source === g.bearer) {
      g.over = true;
      endRun(g, 'fallen');
    } else if (event.source.side === Side.Party) {
      g.souls++;
      g.bonus?.lost();
    } else if (event.source.side === Side.Ward) {
      const left = g.sim.living(Side.Ward).length;
      g.say(`A refugee falls. ${left} ${left === 1 ? 'is' : 'are'} left.`);
    }
  });
}

// A kill's experience, shared evenly by the living mercs.
function shareXp(g: GameState, monster: Unit): void {
  const mercs = g.mercs().filter((m) => m.alive);
  const each = Math.round(killXp(monster) / Math.max(1, mercs.length));
  for (const m of mercs) {
    if (gainXp(m, each) > 0) {
      g.effects.levelUp(m);
      g.hooks.onChange?.();
    }
  }
}
