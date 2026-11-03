// Props the bearer works by walking up to them: a Labyrinth's or a Vault's
// key, and the Labyrinth's levers.
//
// A new walk-up prop (a brazier to light, a plate to step on) adds its
// function to `WALK_UPS`. Each runs once a tick, in order, while the bearer
// lives, after the Events and before the monsters are noted.
import type { Gate } from '../../gen/stage';
import { openGate } from '../../gen/stage';
import type GameState from './state';
import { PICK_REACH } from './pickups';

// The bearer pulls a lever from this close.
const LEVER_REACH = 1.3;

/** One kind of walk-up prop: checks the bearer's reach and acts on it. */
export type WalkUp = (g: GameState) => void;

// The bearer picks up the key a slain monster dropped. In a Labyrinth it
// opens the hall's gates; in a Vault it opens the vault at its door.
function takeKey(g: GameState): void {
  const b = g.bearer;
  const gates = g.stage.gates;
  const vault = g.stage.vault;
  const key = g.stage.props.find(
    (p) => p.kind === 'key' && !p.open && b.distanceTo(p) <= PICK_REACH + 0.4,
  );
  if (key) {
    key.open = true;
    g.stage.props.splice(g.stage.props.indexOf(key), 1);
    if (gates) {
      openGates(
        g,
        gates.filter((gate) => !gate.lever),
      );
      g.say('The bearer takes the key. The gates of the hall open.');
    } else if (vault) {
      vault.key = true;
      g.say('The bearer takes the key. Bring it to the vault.');
    }
  }
}

// In a Labyrinth, the bearer pulls the levers it walks up to.
function pullLevers(g: GameState): void {
  const b = g.bearer;
  for (const gate of g.stage.gates ?? []) {
    if (gate.lever && !gate.open && b.distanceTo(gate.lever) <= LEVER_REACH) {
      openGates(g, [gate]);
      g.say('The bearer pulls the lever. A gate in the maze grinds open.');
    }
  }
}

/** Every walk-up prop, in the order they are worked each tick. */
export const WALK_UPS: WalkUp[] = [takeKey, pullLevers];

// Works every walk-up prop the living bearer stands at.
export function workWalkUps(g: GameState): void {
  if (!g.bearer.alive) {
    return;
  }
  for (const walkUp of WALK_UPS) {
    walkUp(g);
  }
}

// Opens gates, and takes their bars out of the way.
export function openGates(g: GameState, list: Gate[]): void {
  const gone = list.flatMap((gate) => openGate(gate));
  if (gone.length === 0) {
    return;
  }
  const obstacles = g.sim.obstacles;
  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (gone.some((o) => o.x === obstacles[i].x && o.z === obstacles[i].z)) {
      obstacles.splice(i, 1);
    }
  }
  g.sim.setWorld(g.sim.floor);
}
