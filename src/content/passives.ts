import type { Lifecycle } from '../core/lifecycle';
import type { SimEventMap } from '../sim/events';
import type Sim from '../sim/sim';

// First numbers for passive skills. A starting point for balance.

// A listener that is added on start and removed on stop, so passives that
// are set up again at a new rank leave nothing behind.
export default function listen<K extends keyof SimEventMap>(
  sim: Sim,
  type: K,
  priority: SimEventMap[K][1],
  listener: (event: SimEventMap[K][0]) => void,
): Lifecycle {
  return {
    start: () => {
      sim.on(type, priority, listener);
    },
    stop: () => {
      sim.off(type, priority, listener);
    },
  };
}
