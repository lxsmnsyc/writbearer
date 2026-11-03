// The end of the run at the Creditor's tomb: the seal breaks, the bearer
// becomes the Creditor, and the last fight ends sealed or risen.
import { Side } from '../../sim/types';
import { monsterLevel } from '../../gen/stage';
import { reveal } from '../../content/creditor';
import type GameState from './state';
import { names } from './areas';
import { endRun } from './saving';

// The keys left to the player once the seal breaks: a merc's sheet, and restart
export const FINALE_KEYS = new Set(['1', '2', '3', '4', 'escape', 'r']);
// How near the sarcophagus the bearer comes before the seal breaks, and
// below what share of health the Creditor drinks from the bearer's pack
const TOMB_REACH = 2.4;
const CREDITOR_DRINKS = 0.4;

// At the tomb the seal breaks, and the bearer becomes the Creditor.
export function breakSeal(g: GameState): void {
  const tomb = g.stage.tomb;
  if (
    !tomb ||
    g.finale ||
    !g.bearer.alive ||
    Math.hypot(g.bearer.x - tomb.x, g.bearer.z - tomb.z) > TOMB_REACH
  ) {
    return;
  }
  const level = monsterLevel(g.stageIndex) + 2;
  const r = reveal(g.sim, g.bearer, level, g.souls);
  g.finale = { creditor: r.creditor, ending: null };
  g.boss = r.creditor;
  g.select(null);
  g.openInventory(false);
  g.keys.clear();
  g.shake = Math.max(g.shake, 6);
  const lines = ['The seal breaks. The Writ was never a letter.'];
  if (r.raised.length > 0) {
    lines.push(`${names(r.raised)} ${r.raised.length > 1 ? 'rise' : 'rises'} for it.`);
  }
  if (r.fled.length > 0) {
    lines.push(`${names(r.fled)} ${r.fled.length > 1 ? 'run' : 'runs'}.`);
  }
  g.say(lines.join(' '));
  g.views.snap(g.sim);
  g.hooks.onChange?.();
}

// The Creditor drinks what the bearer carried, and the fight ends when it
// or the last merc falls.
export function endFinale(g: GameState): void {
  const f = g.finale;
  if (!f || f.ending) {
    return;
  }
  const c = f.creditor;
  if (c.alive && c.hp < c.derived.maxHp * CREDITOR_DRINKS) {
    const potion = g.pack.healingPotion();
    if (potion && c.drink(potion)) {
      g.pack.tidy();
      g.itemsChanged();
    }
  }
  if (!c.alive) {
    f.ending = 'sealed';
  } else if (g.sim.living(Side.Party).length === 0) {
    f.ending = 'risen';
  }
  if (f.ending) {
    g.over = true;
    endRun(g, f.ending);
  }
}
