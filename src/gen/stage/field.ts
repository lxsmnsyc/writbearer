// An open fight field: the generator's main build, step by step.
import type RNG from '../../core/rng';
import type { Spot } from '../../sim/nav';
import { type Keep, layOut, planFor } from '../fields';
import { dealBosses, leadLastWave } from './bosses';
import { collapseFor } from './collapse';
import { beyond, placeExits } from './exits';
import { layGround } from './ground';
import { markHunt, placeHorns, refugeesAt } from './objectives';
import { placePacks } from './packs';
import { adder, tallFor } from './props';
import { ensureReachable, navFor } from './reach';
import { laySpots } from './spots';
import type { AreaPlan, Stage } from './types';
import { layVault } from './vault';
import { buildMobs, buildWaves } from './waves';

// An open field's side, in tiles: it is square
const FIELD_SIZE: [number, number] = [46, 54];

// Ground kept clear around each place, in tiles.
export const KEEP_ENTRANCE = 5;
export const KEEP_EXIT = 3.5;
const KEEP_PLACE = 3;
// Wandering mercs wait by fires only in endless mode. In the story, the
// party is hired at the Guild House before the first phase.
const RECRUIT_CHANCE = 0.6;

/**
 * An open fight field: the Church's site and the lair on opposite halves,
 * the places its objective needs, roads to each exit, ground, the
 * director's key points, then packs or waves.
 */
export function generateField(
  rng: RNG,
  index: number,
  plan: AreaPlan,
  biome: number,
  hires: boolean,
): Stage {
  // A square field, entered near a corner of its west edge and left by the
  // far side, so the way crosses it.
  const size = rng.int(FIELD_SIZE[0], FIELD_SIZE[1]);
  const width = size;
  const depth = size;
  const entrance = { x: 2.5, z: depth * (rng.chance(0.5) ? 0.22 : 0.78) };
  const exitZ = depth / 2 + rng.range(-depth / 6, depth / 6);
  const stage: Stage = {
    index,
    kind: plan.kind,
    biome,
    width,
    depth,
    entrance,
    exit: entrance,
    exits: [],
    props: [],
    sigils: [],
    stains: [],
    packs: [],
    roads: [],
    down: false,
    scale: plan.scale,
  };
  const add = adder(stage, rng);
  placeExits(stage, add, plan.ahead, exitZ, plan.sides, width * 0.78);
  stage.down = stage.exits.some((e) => e.ahead === 'down');

  // The ground plan: islands of trees, walled chambers or halls, or islands
  // over the chasm. See fields.ts.
  stage.layout = planFor(rng, biome);
  const keep: Keep[] = [
    { ...entrance, r: KEEP_ENTRANCE },
    ...stage.exits.map((e) => ({ x: e.x, z: e.z, r: KEEP_EXIT })),
  ];
  const ground = layOut(rng, stage.layout, size, keep);
  const tall = tallFor(biome);
  for (const t of ground.trees) {
    add(tall, t.x, t.z);
  }
  for (const w of ground.walls) {
    add('wall', w.x, w.z).seed = stage.layout === 'halls' ? rng.random() * 0.3 + 0.5 : rng.random();
  }
  for (const p of ground.pillars) {
    add(stage.layout === 'halls' ? 'pillar' : 'rubble', p.x, p.z);
  }
  stage.chasm = ground.chasm;

  // Places stand on open ground, with room around them.
  let nav = navFor(stage);
  const roomFor = (p: Spot, r: number): boolean =>
    nav.roomy(p.x, p.z) &&
    Array.from({ length: 8 }, (_, k) => (k / 8) * Math.PI * 2).every((a) =>
      nav.walkable(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r),
    );
  const spot = (x0: number, x1: number, r: number, gap: number): Spot => {
    for (let i = 0; i < 120; i++) {
      const p = { x: rng.range(x0, x1), z: rng.range(4, depth - 4) };
      if (roomFor(p, r) && !keep.some((k) => Math.hypot(k.x - p.x, k.z - p.z) < k.r + gap)) {
        return p;
      }
    }
    return nav.free((x0 + x1) / 2, depth / 2, size);
  };
  // The Church's site and the lair stand on opposite halves of the field.
  const half = width / 2;
  const siteFirst = rng.chance(0.5);
  const site = siteFirst ? spot(12, half - 3, 3, 4) : spot(half + 3, width - 8, 3, 4);
  keep.push({ ...site, r: 5 });
  stage.sigils.push(site);
  add('altar', site.x, site.z);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    add('candle', site.x + Math.cos(a) * 2.4, site.z + Math.sin(a) * 2.4);
  }
  add('banner', site.x - 2, site.z - 2.8);

  const lair = siteFirst ? spot(half + 3, width - 8, 3, 3) : spot(12, half - 3, 3, 3);
  keep.push({ ...lair, r: 4 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(i % 2 ? 'gibbet' : 'pike', lair.x + Math.cos(a) * 3.2, lair.z + Math.sin(a) * 3.2);
  }

  // A Vault's strongroom stands on the site's half, away from the lair
  // whose leader holds its key, ringed by traps.
  if (plan.objective === 'vault') {
    const at = siteFirst ? spot(12, half - 3, 4, 4) : spot(half + 3, width - 8, 4, 4);
    layVault(stage, add, at, keep);
  }

  // A Ritual's sigils stand across the field, one in each third, west to east.
  if (plan.objective === 'ritual') {
    stage.rites = [0, 1, 2].map((k) => {
      const at = spot(Math.max(10, (width * k) / 3), (width * (k + 1)) / 3 - 4, 3, 3);
      keep.push({ ...at, r: KEEP_PLACE + 1 });
      stage.sigils.push(at);
      return { ...at, held: 0 };
    });
  }

  const cache = spot(10, width - 8, 1, 1);
  keep.push({ ...cache, r: KEEP_PLACE });
  add('chest', cache.x, cache.z);

  // A wandering merc by its fire, only while there is still anyone to hire.
  if (index >= 1 && hires && rng.chance(RECRUIT_CHANCE)) {
    const camp = spot(10, half, 2, 2);
    keep.push({ ...camp, r: 5 });
    add('campfire', camp.x, camp.z);
    stage.recruit = { x: camp.x + 1, z: camp.z };
  }
  // Pikes and gibbets along the way: the Church's offerings.
  for (let i = 0; i < 6; i++) {
    const s = spot(8, width - 6, 0.5, 0.5);
    add(rng.chance(0.6) ? 'pike' : 'gibbet', s.x, s.z);
  }

  ensureReachable(stage, [
    ...stage.exits,
    site,
    lair,
    cache,
    ...(stage.vault ? [stage.vault.door] : []),
    ...(stage.rites ?? []),
  ]);

  // The roads follow the way a body walks from the entrance to each exit.
  nav = navFor(stage);
  stage.roads = stage.exits.map((e) => {
    const path = nav.path(entrance, e).filter((_, k, all) => k % 3 === 0 || k === all.length - 1);
    return [entrance, ...path, e, beyond(e)];
  });
  layGround(stage, rng, nav, keep);
  stage.spots = laySpots(stage, rng, nav, keep);
  const road = stage.roads[0];
  // A pack watches the narrowest point of the way, halfway along the road.
  const choke = road[Math.floor(road.length / 2)];

  for (let i = 0; i < 10; i++) {
    stage.stains.push({
      x: rng.range(3, width - 3),
      z: rng.range(3, depth - 3),
      r: rng.range(0.4, 0.9),
    });
  }

  // A Horde's field stands empty: its monsters come in waves.
  if (plan.objective === 'horde') {
    stage.waves = buildWaves(stage, rng, plan.kind === 'elite');
  } else if (plan.objective === 'ritual') {
    // Two waves for each sigil: as the bearer steps onto it, and halfway through
    stage.waves = buildWaves(stage, rng, plan.kind === 'elite', (stage.rites?.length ?? 0) * 2);
  } else {
    placePacks(stage, rng, { site, lair, breach: choke }, plan.kind === 'elite');
  }
  if (plan.objective) {
    stage.objective = plan.objective;
    // The spoils of a finished objective appear before the exits.
    const mid = stage.exits.reduce((n, e) => n + e.z, 0) / Math.max(1, stage.exits.length);
    stage.reward = navFor(stage).free(width - 7, mid, size);
  }
  if (plan.objective === 'hunt') {
    markHunt(stage, rng, plan.kind === 'elite');
  }
  if (plan.objective === 'escort') {
    stage.refugees = refugeesAt(stage, plan.kind === 'elite');
  }
  if (plan.objective === 'hunt' || plan.objective === 'escort') {
    stage.mobs = buildMobs(stage, rng, plan.kind === 'elite');
  }
  if (plan.objective === 'collapse') {
    // The floor falls from the entrance's edge, and stops short of the exits.
    stage.collapse = collapseFor(width, plan.kind === 'elite');
  }
  if (stage.waves) {
    if (plan.miniBoss) {
      leadLastWave(stage, plan.miniBoss);
    }
  } else if (plan.objective) {
    dealBosses(stage, rng, plan.miniBoss, plan.kind === 'elite');
  }
  placeHorns(stage, rng, plan);
  if (plan.objective === 'vault') {
    // A mini-boss holds the key, or else the lair's leader. The spoils wait
    // at the vault's door.
    (stage.packs.find((p) => p.mini) ?? stage.packs[1]).key = 0;
    stage.reward = { ...stage.vault!.door };
  }
  return stage;
}
