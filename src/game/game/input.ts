// The player's keys and mouse: what each key does, what a click walks the
// bearer to, and WASD steering.
import { EXIT_PLATE } from '../../render/renderer';
import { OBJECTIVE_NAME } from '../../gen/graph';
import { ALL_SHOUTS } from '../../sim/shout';
import type Game from '../game';
import type GameState from './state';
import { SHOUT_KEY } from './shouts';
import { FINALE_KEYS } from './tomb';
import { chestAt, pickItem } from './pickups';
import { recruitAt } from './recruits';

export function keyDown(game: Game, g: GameState, e: KeyboardEvent): void {
  const key = e.key.toLowerCase();
  if (key === 'escape') {
    game.select(null);
    game.openInventory(false);
    if (g.stationOpen) {
      game.closeStation();
    }
    if (g.mapOpen) {
      game.openMap(false);
    }
    if (g.townOpen) {
      game.closeTown();
    }
    if (g.eventOpen) {
      game.closeEvent();
    }
    if (g.compendiumOpen) {
      game.openCompendium(false);
    }
    return;
  }
  // Once the seal breaks, the player can only look at the mercs, or start
  // another run.
  if (g.finale && !FINALE_KEYS.has(key)) {
    return;
  }
  if (key === 'q' && !g.over && !g.paused) {
    game.drinkHealing();
    return;
  }
  const shout = ALL_SHOUTS.find((s) => SHOUT_KEY[s] === key);
  if (shout !== undefined) {
    game.shout(shout);
    return;
  }
  if (key === 'm' && !g.over && !g.title) {
    game.openMap(!g.mapOpen);
    return;
  }
  if (key === 'k') {
    game.openCompendium(!g.compendiumOpen);
    return;
  }
  if (key === 'i' && !g.over) {
    game.openInventory(!g.inventory);
    return;
  }
  // Number keys open a merc's orders.
  const index = Number(key) - 1;
  const merc = Number.isInteger(index) && index >= 0 ? g.mercs().at(index) : undefined;
  if (merc?.alive) {
    game.select(merc);
    return;
  }
  if (g.paused) {
    return;
  }
  g.keys.add(key);
  if (key === 'r') {
    game.reset();
  }
}

export function mouseMove(g: GameState, e: MouseEvent): void {
  g.pointer = { x: e.clientX, y: e.clientY };
  // What a click would do shows in the cursor and the exit's plate.
  const free = !g.paused && !g.over && !g.finale;
  g.hoverExit = free ? exitAt(g, e.clientX, e.clientY) : null;
  const clickable =
    free &&
    (g.hoverExit !== null ||
      recruitAt(g, e.clientX, e.clientY) !== null ||
      chestAt(g, e.clientX, e.clientY) !== null ||
      g.renderer.labelAt(e.clientX, e.clientY) !== null);
  g.canvas.style.cursor = clickable ? 'pointer' : '';
}

// The exit whose plate is under a point on the screen, if any.
function exitAt(g: GameState, clientX: number, clientY: number): number | null {
  const p = g.renderer.unproject(clientX, clientY);
  const i = g.stage.exits.findIndex(
    (e) =>
      e.taken !== true &&
      e.closed !== true &&
      Math.max(Math.abs(p.x - e.x), Math.abs(p.z - e.z)) <= EXIT_PLATE,
  );
  return i >= 0 && g.renderer.known(g.stage.exits[i].x, g.stage.exits[i].z) ? i : null;
}

export function mouseDown(g: GameState, e: MouseEvent): void {
  if (g.over) {
    return;
  }
  // A merc's orders open from its plate or its number key, never from a
  // click on the field, which only closes them or walks the bearer.
  if (g.finale) {
    g.select(null);
    return;
  }
  if (g.inventory) {
    return;
  }
  // An item's label comes first.
  const labelled = g.paused ? null : g.renderer.labelAt(e.clientX, e.clientY);
  if (labelled) {
    g.goFor({ fetching: labelled });
    g.bearer.order = { x: labelled.x, z: labelled.z };
    return;
  }
  if (g.paused) {
    g.select(null);
    return;
  }
  // Clicking an item walks the bearer over to pick it up.
  const item = pickItem(g, e.clientX, e.clientY);
  if (item) {
    g.goFor({ fetching: item });
    g.bearer.order = { x: item.x, z: item.z };
    return;
  }
  // Clicking a recruit walks the bearer over to talk to it.
  const recruit = recruitAt(g, e.clientX, e.clientY);
  if (recruit) {
    g.goFor({ seeking: recruit });
    g.bearer.order = { x: recruit.x - 0.8, z: recruit.z + 0.4 };
    return;
  }
  // Clicking an exit's plate walks the bearer to it, to leave by it.
  const exit = exitAt(g, e.clientX, e.clientY);
  if (exit !== null) {
    const e2 = g.stage.exits[exit];
    if (e2.ahead === 'down' && g.boss?.alive) {
      g.say(`The way down is shut while ${g.boss.name} lives.`);
      return;
    }
    const o = g.objective;
    if (o && !o.done && !o.hidden()) {
      g.say(`The way on opens once the ${OBJECTIVE_NAME[o.kind]} is done.`);
      return;
    }
    if (g.stage.kind === 'guild' && !g.hasFighter) {
      g.say('The Guild sends no Writ out without a sword: hire a Vanguard or a Ranger.');
      return;
    }
    g.goFor({ leaving: exit });
    g.bearer.order = { x: e2.x, z: e2.z };
    return;
  }
  // Clicking a chest walks the bearer to it, to open it.
  const chest = chestAt(g, e.clientX, e.clientY);
  if (chest) {
    g.goFor({ opening: chest });
    g.bearer.order = { x: chest.x - 0.6, z: chest.z };
    return;
  }
  g.goFor({});
  const spot = g.renderer.unproject(e.clientX, e.clientY);
  g.bearer.order = g.sim.clamp(spot);
}

// WASD moves along the screen: right is +x -z, down is +x +z.
export function steer(g: GameState): void {
  // Once the seal breaks, the player no longer moves anyone.
  if (g.finale) {
    return;
  }
  let mx = 0;
  let my = 0;
  if (g.keys.has('w') || g.keys.has('arrowup')) {
    my -= 1;
  }
  if (g.keys.has('s') || g.keys.has('arrowdown')) {
    my += 1;
  }
  if (g.keys.has('a') || g.keys.has('arrowleft')) {
    mx -= 1;
  }
  if (g.keys.has('d') || g.keys.has('arrowright')) {
    mx += 1;
  }
  if (mx === 0 && my === 0) {
    return;
  }
  g.goFor();
  const wx = mx + my;
  const wz = my - mx;
  const l = Math.hypot(wx, wz);
  g.bearer.order = { x: g.bearer.x + (wx / l) * 0.6, z: g.bearer.z + (wz / l) * 0.6 };
}
