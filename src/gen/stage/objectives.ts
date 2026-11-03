// What some objectives lay on a field: Ritual sigils, horn posts, refugees, Hunt marks.
import type RNG from '../../core/rng';
import type { Spot } from '../../sim/nav';
import { AREAS_PER_LAYER } from '../layers';
import type { AreaPlan, Stage } from './types';
import { buildMobs } from './waves';

/** How long the bearer stands on a Ritual's sigil to break it, and how near its middle. */
export const RITE_TIME = 15;
export const RITE_REACH = 2.2;

/** A sigil a Ritual's bearer stands on to break: how long it has stood there so far. */
export interface Rite extends Spot {
  held: number;
  broken?: boolean;
}

// Horn posts: how many a Silence has, one more in an Elite area, and an
// Alarmed fight or one with the Horn of the Road
const SILENCE_POSTS = 3;
const ALARM_POSTS = 2;

// Horn posts: how far from the entrance and from each other they stand
const POST_FROM_ENTRANCE = 14;
const POST_APART = 12;

// Horn posts at spawn spots far from the entrance and apart, the farthest
// first; fewer if the field has no room for them.
function layPosts(stage: Stage, rng: RNG, n: number): Spot[] {
  const far = (p: Spot): number => Math.hypot(p.x - stage.entrance.x, p.z - stage.entrance.z);
  const spots = rng
    .shuffle((stage.spots ?? []).filter((s) => s.kind === 'spawn' && far(s) >= POST_FROM_ENTRANCE))
    .map((s) => ({ x: s.x, z: s.z }));
  const posts: Spot[] = [];
  for (const s of spots) {
    if (posts.length < n && posts.every((p) => Math.hypot(p.x - s.x, p.z - s.z) >= POST_APART)) {
      posts.push(s);
    }
  }
  return posts;
}

// How many refugees an Escort has, one more in an Elite area, and how far
// from the entrance they wait
const REFUGEES = 5;
const REFUGEE_RING = 1.4;

// An Escort's refugees wait in a ring just inside the entrance.
export function refugeesAt(stage: Stage, elite: boolean): Spot[] {
  const n = REFUGEES + (elite ? 1 : 0);
  const at = { x: stage.entrance.x + 2.5, z: stage.entrance.z };
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: at.x + Math.cos(a) * REFUGEE_RING, z: at.z + Math.sin(a) * REFUGEE_RING };
  });
}

// How many marked monsters a Hunt has: 3, one more in an Elite area and one
// more below the Marches.
const HUNT_MARKS = 3;

/**
 * Marks a Hunt's quarry: the lair's leader, then leaders of other packs
 * spread over the field. The exits open once every marked monster is dead.
 */
export function markHunt(stage: Stage, rng: RNG, elite: boolean): void {
  const want = HUNT_MARKS + (elite ? 1 : 0) + (stage.index >= AREAS_PER_LAYER ? 1 : 0);
  // The lair's pack is the second placed, after the Church's site.
  const lair = stage.packs[1];
  lair.marked = Math.max(0, lair.elite);
  // Of the packs farthest from the entrance, some at random, so the hunt
  // crosses the field.
  const far = stage.packs
    .filter((p) => p !== lair)
    .sort((a, b) => b.x - a.x)
    .slice(0, 2 * (want - 1));
  for (const p of rng.shuffle(far).slice(0, want - 1)) {
    p.marked = 0;
  }
}

/**
 * Horn posts: a Silence's, an Alarmed fight's, or those the Horn of the
 * Road runs between. In a Silence or an Alarmed fight, every pack has a
 * Horn-Bearer.
 */
export function placeHorns(stage: Stage, rng: RNG, plan: AreaPlan): void {
  const alarmed = plan.mutators?.includes('alarmed') === true;
  const silence = plan.objective === 'silence';
  if (silence || alarmed || plan.miniBoss === 'hornOfTheRoad') {
    const posts = silence ? SILENCE_POSTS + (plan.kind === 'elite' ? 1 : 0) : ALARM_POSTS;
    stage.posts = layPosts(stage, rng, posts);
    stage.hornPack = buildMobs(stage, rng, plan.kind === 'elite').at(0)?.kinds;
    if (silence || alarmed) {
      for (const pack of stage.packs.slice(1)) {
        if (!pack.mini) {
          pack.kinds.push('hornBearer');
        }
      }
    }
  }
}
