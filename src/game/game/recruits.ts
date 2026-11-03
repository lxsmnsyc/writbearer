// Recruits: meeting a merc by its fire or at the Guild House, hiring it,
// and finding one under the mouse.
import { look } from '../../render/rig';
import { JOBS } from '../../content/jobs';
import type { Offer } from '../../content/recruits';
import { spawnMerc } from '../../content/roster';
import type GameState from './state';
import { MEET_REACH, PARTY_SIZE, type Wanderer } from './state';

/** Hires the merc being talked to. Returns why it failed, or null. */
export function hire(g: GameState): string | null {
  const w = g.recruiting;
  if (!w) {
    return null;
  }
  const { offer } = w;
  if (g.mercs().length >= PARTY_SIZE) {
    return `The party is full: ${PARTY_SIZE} mercs at most.`;
  }
  const price = g.priceOf(offer);
  if (g.pack.gold < price) {
    return `${offer.name} wants ${price} gold. You have ${g.pack.gold}.`;
  }
  g.pack.gold -= price;
  join(g, offer, w.x, w.z);
  g.wanderers = g.wanderers.filter((x) => x !== w);
  endTalk(g);
  g.itemsChanged();
  return null;
}

/** Leaves the wandering merc where it is. Walking back to it asks again. */
export function endTalk(g: GameState): void {
  g.recruiting = null;
  g.hooks.onRecruit?.(null);
}

export function join(g: GameState, offer: Offer, x: number, z: number): void {
  const merc = spawnMerc(g.sim, offer.kind, offer.level, x, z, undefined, {
    name: offer.name,
    traits: offer.traits,
  });
  g.compendium.meet({
    name: merc.name,
    job: merc.job.name,
    traits: offer.traits,
    level: offer.level,
  });
  g.views.snap(g.sim);
  g.hooks.onChange?.();
}

// Meets a recruit when the bearer walks up to it.
export function meet(g: GameState): void {
  if (g.recruiting) {
    return;
  }
  // Only the recruit the bearer was sent to: walking past one asks nothing.
  for (const w of g.wanderers) {
    const d = Math.hypot(g.bearer.x - w.x, g.bearer.z - w.z);
    if (w === g.seeking && d <= MEET_REACH && g.bearer.alive) {
      g.seeking = null;
      w.met = true;
      g.compendium.meet({
        name: w.offer.name,
        job: JOBS[w.offer.kind].template.job.name,
        traits: w.offer.traits,
        level: w.offer.level,
      });
      g.recruiting = w;
      g.keys.clear();
      g.bearer.order = null;
      g.hooks.onRecruit?.({ ...w.offer, wage: g.priceOf(w.offer) });
      return;
    }
  }
}

// The recruit drawn under a point on the screen, if any.
export function recruitAt(g: GameState, clientX: number, clientY: number): Wanderer | null {
  const s = g.renderer.toSmall(clientX, clientY);
  const z = look.zoom;
  return (
    g.wanderers.find((w) => {
      const b = g.renderer.iso(w.x, w.z);
      return Math.abs(s.x - b.x) <= 9 * z && s.y >= b.y - 38 * z && s.y <= b.y + 6 * z;
    }) ?? null
  );
}
