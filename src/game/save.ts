import { CARDS } from '../content/cards';
import { BASE_BY_ID } from '../content/items';
import { HIREABLE } from '../content/recruits';
import { type MercKind, spawnMerc } from '../content/roster';
import { findNode } from '../content/trees';
import { UNIQUE_BY_ID } from '../content/uniques';
import { AREAS_PER_LAYER, areaOf, layerOf } from '../gen/layers';
import { freshUid } from '../gen/loot';
import type { Stage } from '../gen/stage';
import { type Toggles, copyToggles } from '../sim/ai';
import type { AffixRoll, EquipSlot, Item, ItemBase, Quality } from '../sim/item';
import type Sim from '../sim/sim';
import type { BaseStats, Modifier } from '../sim/stats';
import type Unit from '../sim/unit';
import type { Pack, Vault } from './inventory';
import { Store, deleteRecord, readRecord, writeRecord } from './store';

// The suspended run, from the tech-stack design: one slot in IndexedDB,
// written as the party crosses into an area, holding a snapshot of the run
// and the position of each random stream. Loading it resumes at the area's
// entrance. It is deleted when the run ends.

/** Bumped when the shape of a save changes. Older saves are not loaded. */
export const SAVE_VERSION = 2;

export interface ItemSave {
  base: string;
  itemLevel: number;
  quality: Quality;
  rolls: Item['rolls'];
  affixes: AffixRoll[];
  bonuses: Modifier[];
  sockets: number;
  cards: string[];
  refine: number;
  unique?: string;
  uniqueValues?: number[];
  name?: string;
  quantity: number;
}

export interface MercSave {
  kind: Exclude<MercKind, 'bearer'>;
  name: string;
  level: number;
  xp: number;
  skillPoints: number;
  statPoints: number;
  base: BaseStats;
  traits: string[];
  morale: number;
  discipline: number;
  hp: number;
  mana: number;
  alive: boolean;
  torn: boolean;
  toggles: Toggles | null;
  // Skill-tree ranks, in the order they were first learned
  ranks: [string, number][];
  equipment: [EquipSlot, ItemSave][];
  belt: (ItemSave | null)[];
}

export interface RunSave {
  version: number;
  seed: string;
  // Whether it is an endless run
  endless: boolean;
  // The state of each random stream drawn from so far
  streams: Record<string, number>;
  stageIndex: number;
  // Where on the layer's map the party is, and the areas it crossed
  node: { column: number; row: number } | null;
  path: { column: number; row: number }[];
  stage: Stage;
  // The area's Event, by id, and its stream as it stood before it began
  event: { id: string; state: number } | null;
  eventsSeen: string[];
  souls: number;
  slain: number;
  bearer: { hp: number; mana: number };
  mercs: MercSave[];
  gold: number;
  pack: ItemSave[];
  materials: [string, number][];
  vault: ItemSave[];
}

// Every base an item can be made on, cards and gems included.
const ALL_BASES: ReadonlyMap<string, ItemBase> = new Map([
  ...BASE_BY_ID,
  ...CARDS.map((c): [string, ItemBase] => [c.id, c]),
]);

export function saveItem(item: Item): ItemSave {
  return {
    base: item.base.id,
    itemLevel: item.itemLevel,
    quality: item.quality,
    rolls: { ...item.rolls },
    affixes: item.affixes.map((a) => ({ id: a.id, values: [...a.values] })),
    bonuses: item.bonuses.map((b) => ({ ...b })),
    sockets: item.sockets,
    cards: item.cards.map((c) => c.id),
    refine: item.refine,
    unique: item.unique,
    uniqueValues: item.uniqueValues && [...item.uniqueValues],
    name: item.name,
    quantity: item.quantity,
  };
}

/** An item from a save, with a new id. Null if its base no longer exists. */
export function loadItem(s: ItemSave): Item | null {
  const base = ALL_BASES.get(s.base);
  if (!base) {
    return null;
  }
  const def = s.unique === undefined ? undefined : UNIQUE_BY_ID.get(s.unique);
  return {
    uid: freshUid(),
    base,
    itemLevel: s.itemLevel,
    quality: s.quality,
    rolls: { ...s.rolls },
    affixes: s.affixes,
    bonuses: s.bonuses,
    sockets: s.sockets,
    cards: s.cards.map((id) => ALL_BASES.get(id)).filter((c) => c !== undefined),
    refine: s.refine,
    unique: s.unique,
    uniqueValues: s.uniqueValues,
    effect: def && s.uniqueValues ? def.effect?.(s.uniqueValues) : undefined,
    name: s.name,
    quantity: s.quantity,
  };
}

const loadItems = (saves: readonly ItemSave[]): Item[] =>
  saves.map((s) => loadItem(s)).filter((i) => i !== null);

export function saveMerc(unit: Unit): MercSave {
  return {
    kind: HIREABLE.find((k) => k === unit.kind) ?? 'vanguard',
    name: unit.name,
    level: unit.level,
    xp: unit.xp,
    skillPoints: unit.skillPoints,
    statPoints: unit.statPoints,
    base: { ...unit.base },
    traits: [...unit.traits],
    morale: unit.morale,
    discipline: unit.discipline,
    hp: unit.hp,
    mana: unit.mana,
    alive: unit.alive,
    torn: unit.torn,
    toggles: unit.toggles ? copyToggles(unit.toggles) : null,
    ranks: [...unit.skillRanks],
    equipment: [...unit.equipment].map(([slot, item]) => [slot, saveItem(item)]),
    belt: unit.belt.map((stack) => stack && saveItem(stack)),
  };
}

/** A merc as it was saved, standing at a spot. */
export function loadMerc(sim: Sim, s: MercSave, x: number, z: number): Unit {
  const unit = spawnMerc(sim, s.kind, s.level, x, z, s.toggles ?? undefined, {
    name: s.name,
    traits: s.traits,
  });
  // What it arrived with gives way to what it had.
  for (const slot of unit.equipment.keys()) {
    unit.unequip(slot);
  }
  for (const [slot, saved] of s.equipment) {
    const item = loadItem(saved);
    if (item) {
      unit.equip(slot, item);
    }
  }
  s.belt.forEach((saved, i) => {
    unit.belt[i] = saved && loadItem(saved);
  });
  unit.base = { ...s.base };
  unit.xp = s.xp;
  unit.skillPoints = s.skillPoints;
  unit.statPoints = s.statPoints;
  unit.morale = s.morale;
  unit.discipline = s.discipline;
  // Its skills and passives, at the ranks it learned them to
  for (const [id, rank] of s.ranks) {
    const found = findNode(unit, id);
    if (!found) {
      continue;
    }
    const { node } = found;
    unit.skillRanks.set(id, rank);
    if (node.skill) {
      unit.skills.push(node.skill);
    }
    if (node.effect) {
      const life = node.effect.setup(unit, rank);
      unit.passives.set(id, life);
      life.start();
    }
  }
  unit.recalc();
  unit.hp = s.hp;
  unit.mana = s.mana;
  unit.alive = s.alive;
  unit.torn = s.torn;
  return unit;
}

/** Fills a pack and the vault from a save. */
export function loadPack(s: RunSave, pack: Pack, vault: Vault): void {
  pack.gold = s.gold;
  pack.items.push(...loadItems(s.pack));
  for (const [id, n] of s.materials) {
    pack.materials.set(id, n);
  }
  vault.items.push(...loadItems(s.vault));
}

const KEY = 'suspended';

/** Writes the suspended run, over any before it, in the background. */
export function writeSave(save: RunSave): void {
  writeRecord(Store.Run, KEY, save);
}

// Whether what the store holds is a save this version of the game reads.
const isSave = (value: unknown): value is RunSave =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  value.version === SAVE_VERSION;

/** The suspended run, if there is one of this version. */
export async function readSave(): Promise<RunSave | null> {
  const save = await readRecord(Store.Run, KEY);
  return isSave(save) ? save : null;
}

/** Deletes the suspended run, as the run ends, in the background. */
export function deleteSave(): void {
  deleteRecord(Store.Run, KEY);
}

/** Where a saved run stands, for the player to recognise it. */
export function describeSave(save: RunSave): string {
  const phase = Math.floor(save.stageIndex / AREAS_PER_LAYER) + 1;
  const layer = save.endless ? `Endless, phase ${phase}` : layerOf(save.stageIndex).name;
  if (save.stage.kind === 'waystation') {
    return `${layer}, the Waystation`;
  }
  if (save.stage.kind === 'tomb') {
    return 'The Tomb';
  }
  return `${layer}, area ${areaOf(save.stageIndex)}`;
}
