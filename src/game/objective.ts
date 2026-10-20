import { type MonsterKind, spawnMonster } from '../content/roster';
import type { Objective } from '../gen/graph';
import { RITE_REACH, RITE_TIME, type Stage, type Wave, floorOf, rectOf } from '../gen/stage';
import type Sim from '../sim/sim';
import type Unit from '../sim/unit';
import { type Rect, inRect } from '../sim/nav';
import { DamageFlags, DamageKind, Side } from '../sim/types';
import { warn } from '../sim/warning';

// A fight area's objective as it plays out, from the stages design: the
// exits stay shut until it is done.
//
// - A Hunt is done once every marked monster is dead.
// - A Labyrinth is done once the bearer reaches the hall at its far end.
// - A Horde begins once the bearer leaves the entrance. Each wave comes
//   when its time is up, or as soon as the wave before it is beaten. Where
//   it comes shows on the ground a few seconds first. It is done once the
//   last wave is dead.
// - An Escort is done once the bearer brings at least half its refugees to
//   an exit. It fails once fewer than half are left alive: the exits open,
//   but nothing is paid.
// - A Vault is done once the bearer brings the key, which the lair's leader
//   holds, to the vault's door. The vault opens on its spoils.
// - A Collapse's floor falls away from the entrance's edge once the bearer
//   moves on, toward the exits. It is done once the bearer reaches an exit.
//   Whoever the floor falls under falls: a monster is lost, and one of the
//   party is hurt and scrambles back onto the ground still standing.
// - An Ambush looks like a Camp until the bearer comes near its fire or an
//   exit. Then its groups close in from all round, shown on the ground a
//   moment first. It is done once every one of them is dead.
// - A Ritual is done once the bearer has stood on each of its three sigils
//   in turn for long enough. A wave comes as it steps onto each, and
//   another halfway through. Stepping off pauses the sigil, but keeps what
//   was done of it.

// How far the bearer walks from the entrance before a Horde begins
const HORDE_START = 6;
// The least time between waves, even when one is beaten at once
const WAVE_MIN_GAP = 2;
// How long a wave's spawn point shows on the ground before it comes, and how wide
export const WAVE_WARNING = 3;
const WAVE_MARK = 2;
// How near an exit the bearer brings the refugees, and how near the bearer
// they must be to count as brought
const ESCORT_EXIT = 4;
const ESCORT_NEAR = 7;
// How long a Collapse waits once the bearer moves on, and what a fall costs
// one of the party, as a share of its health
const COLLAPSE_GRACE = 3;
const FALL_SHARE = 0.2;
// How far onto standing ground one of the party scrambles
const SCRAMBLE = 1.5;

// How near the fire, or an exit, the bearer comes before an Ambush springs,
// and how long the ground shows where its groups come
const AMBUSH_FIRE = 6;
const AMBUSH_EXIT = 5;
const AMBUSH_WARNING = 1.2;

// How near the vault's door the bearer comes with the key to open it
const VAULT_REACH = 1.6;

export default class ObjectiveRun {
  done = false;
  // An Escort that lost too many of its refugees: done, but owed nothing
  failed = false;
  // An Escort's refugees, as they were when it began
  private wards: Unit[] | null = null;
  // How many of a Ritual's or an Ambush's waves have come
  private arrived = 0;
  // A Horde's clock since the last wave, the next wave and who came so far
  private started = false;
  private clock = 0;
  private next = 0;
  // Whether the next wave's spawn point is showing
  private warned = false;
  private readonly came: Unit[] = [];

  constructor(
    readonly kind: Objective,
    private readonly stage: Stage,
  ) {}

  /**
   * Plays the objective on for a tick: a Horde's waves come. Returns true on
   * the tick it is done.
   */
  update(sim: Sim, dt: number, level: number): boolean {
    if (this.done) {
      return false;
    }
    if (this.kind === 'horde') {
      this.horde(sim, dt, level);
    }
    if (this.kind === 'ritual') {
      this.ritual(sim, dt, level);
    }
    if (this.kind === 'collapse') {
      this.collapse(sim, dt);
    }
    if (this.kind === 'ambush') {
      this.ambush(sim, level);
    }
    if (this.kind === 'escort') {
      this.wards ??= sim.living(Side.Ward);
      this.failed = this.wards.filter((u) => u.alive).length < this.needed();
    }
    this.done = this.failed || this.met(sim);
    if (this.done && this.kind === 'escort') {
      // The refugees go on their way, or scatter.
      for (const u of this.wards ?? []) {
        sim.units.delete(u);
      }
    }
    return this.done;
  }

  // How many refugees an Escort must bring through: half, rounded up
  private needed(): number {
    return Math.ceil((this.wards?.length ?? 0) / 2);
  }

  private met(sim: Sim): boolean {
    if (this.kind === 'ambush') {
      const waves = this.stage.waves ?? [];
      return this.started && this.arrived >= waves.length && this.came.every((u) => !u.alive);
    }
    if (this.kind === 'collapse') {
      const bearer = sim.bearer;
      return (
        bearer?.alive === true &&
        this.stage.exits.some((e) => Math.hypot(e.x - bearer.x, e.z - bearer.z) <= ESCORT_EXIT)
      );
    }
    if (this.kind === 'ritual') {
      return (this.stage.rites ?? []).every((r) => r.broken === true);
    }
    if (this.kind === 'vault') {
      const vault = this.stage.vault;
      const bearer = sim.bearer;
      if (!vault?.key || !bearer?.alive) {
        return false;
      }
      if (Math.hypot(vault.door.x - bearer.x, vault.door.z - bearer.z) > VAULT_REACH) {
        return false;
      }
      vault.open = true;
      for (const p of this.stage.props) {
        if (p.kind === 'vault') {
          p.open = true;
        }
      }
      return true;
    }
    if (this.kind === 'escort') {
      const bearer = sim.bearer;
      if (!bearer?.alive) {
        return false;
      }
      const atExit = this.stage.exits.some(
        (e) => Math.hypot(e.x - bearer.x, e.z - bearer.z) <= ESCORT_EXIT,
      );
      const brought = (this.wards ?? []).filter(
        (u) => u.alive && u.distanceTo(bearer) <= ESCORT_NEAR,
      );
      return atExit && brought.length >= this.needed();
    }
    if (this.kind === 'hunt') {
      return ![...sim.units].some((u) => u.marked && u.alive);
    }
    if (this.kind === 'horde') {
      const waves = this.stage.waves ?? [];
      return this.next >= waves.length && this.came.every((u) => !u.alive);
    }
    // A Labyrinth is done once the bearer reaches the hall at its far end.
    const bearer = sim.bearer;
    const goal = this.stage.goal;
    return goal !== undefined && bearer !== null && bearer.alive && inRect(goal, bearer);
  }

  /** Whether this is an Ambush that has not sprung: it still passes for a Camp. */
  hidden(): boolean {
    return this.kind === 'ambush' && !this.started;
  }

  // The bearer comes near the fire or an exit, and the Ambush springs.
  private ambush(sim: Sim, level: number): void {
    const bearer = sim.bearer;
    if (this.started || !bearer?.alive) {
      return;
    }
    const fire = this.stage.rest;
    const nearFire = fire !== undefined && bearer.distanceTo(fire) <= AMBUSH_FIRE;
    const nearExit = this.stage.exits.some((e) => bearer.distanceTo(e) <= AMBUSH_EXIT);
    if (!nearFire && !nearExit) {
      return;
    }
    this.started = true;
    for (const wave of this.stage.waves ?? []) {
      this.summon(sim, wave, level, AMBUSH_WARNING);
    }
  }

  // The floor falls a little further, a tile at a time, once the bearer
  // has moved on from the entrance.
  private collapse(sim: Sim, dt: number): void {
    const c = this.stage.collapse;
    const bearer = sim.bearer;
    if (!c || !bearer) {
      return;
    }
    if (!this.started) {
      const e = this.stage.entrance;
      if (Math.hypot(bearer.x - e.x, bearer.z - e.z) < HORDE_START) {
        return;
      }
      this.started = true;
    }
    this.clock += dt;
    if (this.clock < COLLAPSE_GRACE) {
      return;
    }
    const was = Math.floor(c.front);
    c.front = Math.min(c.stop, c.front + c.speed * dt);
    if (Math.floor(c.front) === was) {
      return;
    }
    // The area's floor in the world shrinks to what still stands.
    const all = rectOf(this.stage);
    const within = (r: Rect): boolean =>
      r.x0 >= all.x0 - 0.01 &&
      r.z0 >= all.z0 - 0.01 &&
      r.x1 <= all.x1 + 0.01 &&
      r.z1 <= all.z1 + 0.01;
    const standing = floorOf(this.stage);
    sim.setWorld(sim.floor.map((r) => (within(r) ? standing : r)));
    for (const u of sim.units) {
      if (!inRect(all, u) || inRect(standing, u)) {
        continue;
      }
      if (u.side === Side.Monster) {
        sim.units.delete(u);
        continue;
      }
      // The party's dead are carried along, and the living hurt by the fall.
      if (u.alive) {
        u.hit(u, {
          kind: DamageKind.True,
          fixed: Math.max(1, Math.round(u.derived.maxHp * FALL_SHARE)),
          flags: DamageFlags.Redirected,
        });
      }
      const across = { x: u.x, z: u.z };
      if (c.dir.x === 0) {
        across.z = c.dir.z > 0 ? standing.z0 + SCRAMBLE : standing.z1 - SCRAMBLE;
      } else {
        across.x = c.dir.x > 0 ? standing.x0 + SCRAMBLE : standing.x1 - SCRAMBLE;
      }
      const to = sim.nav?.free(across.x, across.z) ?? across;
      u.x = to.x;
      u.z = to.z;
      u.order = null;
    }
  }

  // The bearer stands on the next sigil, and the waves come for it.
  private ritual(sim: Sim, dt: number, level: number): void {
    const rites = this.stage.rites ?? [];
    const rite = rites.find((r) => r.broken !== true);
    const bearer = sim.bearer;
    if (!rite || !bearer?.alive || bearer.distanceTo(rite) > RITE_REACH) {
      return;
    }
    const before = rite.held;
    rite.held = Math.min(RITE_TIME, rite.held + dt);
    const waves = this.stage.waves ?? [];
    const i = rites.indexOf(rite);
    for (const [k, at] of [0, RITE_TIME / 2].entries()) {
      const wave = waves.at(i * 2 + k);
      if (wave && before <= at && rite.held > at) {
        this.summon(sim, wave, level);
      }
    }
    if (rite.held >= RITE_TIME) {
      rite.broken = true;
    }
  }

  private horde(sim: Sim, dt: number, level: number): void {
    const bearer = sim.bearer;
    const waves = this.stage.waves ?? [];
    if (!this.started) {
      const e = this.stage.entrance;
      if (!bearer || Math.hypot(bearer.x - e.x, bearer.z - e.z) < HORDE_START) {
        return;
      }
      this.started = true;
    }
    this.clock += dt;
    const wave = waves.at(this.next);
    if (!wave || this.warned) {
      return;
    }
    const beaten = this.next > 0 && this.came.every((u) => !u.alive);
    const due = this.clock >= wave.delay - WAVE_WARNING;
    if (!due && !(beaten && this.clock >= WAVE_MIN_GAP)) {
      return;
    }
    // Its spawn point shows first. It harms no one.
    this.warned = true;
    warn(sim, {
      x: wave.from.x,
      z: wave.from.z,
      shape: { kind: 'circle', r: WAVE_MARK },
      windup: WAVE_WARNING,
      spare: Side.Party,
      strike: () => undefined,
      source: null,
      done: () => {
        this.spawn(sim, wave, level);
      },
    });
  }

  // A Ritual's wave: where it comes shows first, then it comes for the bearer.
  private summon(sim: Sim, wave: Wave, level: number, windup = WAVE_WARNING): void {
    warn(sim, {
      x: wave.from.x,
      z: wave.from.z,
      shape: { kind: 'circle', r: WAVE_MARK },
      windup,
      spare: Side.Party,
      strike: () => undefined,
      source: null,
      done: () => {
        this.arrived++;
        this.bring(sim, wave, level);
      },
    });
  }

  private spawn(sim: Sim, wave: Wave, level: number): void {
    this.bring(sim, wave, level);
    this.next++;
    this.clock = 0;
    this.warned = false;
  }

  // A wave's monsters, already in the fight
  private bring(sim: Sim, wave: Wave, level: number): void {
    wave.kinds.forEach((kind, i) => {
      const a = (i / wave.kinds.length) * Math.PI * 2;
      const u = spawnMonster(
        sim,
        kind,
        level,
        wave.from.x + Math.cos(a) * 1.2,
        wave.from.z + Math.sin(a) * 1.2,
        { elite: i === wave.elite },
      );
      u.aware = true;
      this.came.push(u);
    });
  }

  /** The monsters of a Horde's next wave, or none once the last has come. */
  coming(): readonly MonsterKind[] {
    if (this.kind !== 'horde' || this.done) {
      return [];
    }
    return this.stage.waves?.at(this.next)?.kinds ?? [];
  }

  /** How far along it is, in a line. */
  status(sim: Sim): string {
    if (this.failed) {
      return 'Too many refugees were lost. The way on is open, but nothing is owed.';
    }
    if (this.done) {
      return 'Done. The way on is open.';
    }
    if (this.kind === 'ambush') {
      const left = this.came.filter((u) => u.alive).length;
      return `It was no camp. Kill every one of them: ${left} left.`;
    }
    if (this.kind === 'collapse') {
      if (!this.started) {
        return 'Reach an exit before the floor gives way. It falls once the bearer moves on.';
      }
      return 'Run for an exit. The floor is falling away behind.';
    }
    if (this.kind === 'ritual') {
      const rites = this.stage.rites ?? [];
      const rite = rites.find((r) => r.broken !== true);
      const broken = rites.length - rites.filter((r) => r.broken !== true).length;
      const left = rite ? Math.ceil(RITE_TIME - rite.held) : 0;
      return `Break the sigils: ${broken} of ${rites.length} · stand on the next for ${left}s`;
    }
    if (this.kind === 'vault') {
      return this.stage.vault?.key === true
        ? 'Bring the key to the vault’s door.'
        : 'The lair’s leader holds the vault’s key. Take it.';
    }
    if (this.kind === 'escort') {
      const all = this.wards ?? sim.living(Side.Ward);
      const alive = all.filter((u) => u.alive).length;
      const need = Math.ceil(all.length / 2);
      return `Bring the refugees to an exit: ${alive} of ${all.length} alive, ${need} needed`;
    }
    if (this.kind === 'hunt') {
      const marked = [...sim.units].filter((u) => u.marked);
      return `Slay the marked: ${marked.filter((u) => !u.alive).length} of ${marked.length}`;
    }
    if (this.kind === 'horde') {
      const waves = this.stage.waves ?? [];
      if (!this.started) {
        return `Hold out against ${waves.length} waves. They come once the bearer moves on.`;
      }
      const left = this.came.filter((u) => u.alive).length;
      const wave = waves.at(this.next);
      if (!wave) {
        return `Last wave: ${left} left`;
      }
      if (this.warned) {
        return `Wave ${this.next} of ${waves.length} · next is coming · ${left} left`;
      }
      const soon = Math.max(0, Math.ceil(wave.delay - this.clock));
      return `Wave ${this.next} of ${waves.length} · next in ${soon}s · ${left} left`;
    }
    const locked = (this.stage.gates ?? []).some((g) => !g.lever && g.open !== true);
    if (locked) {
      return 'The hall is locked. One of the maze’s monsters carries the key.';
    }
    return 'Find the way through to the hall at the far end.';
  }
}
