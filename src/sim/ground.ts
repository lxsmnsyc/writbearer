// What the ground answers about a point, for systems that read it (Hide,
// night, rain, the Lamplighter, dark bosses). The terrain contract
// (docs/roadmaps/writbearer/contracts/terrain.md) lists the answers; this
// stub gives the neutral ones until the terrain nodes fill them in.

/* eslint-disable class-methods-use-this -- the stub reads no state yet */

/** What stands on a point and hides or lowers noticing: tall grass. */
export type Cover = 'grass';

export class Ground {
  /** The cover at a point, or null for open ground. */
  coverAt(_x: number, _z: number): Cover | null {
    return null;
  }

  /** How high the ground is: 0 below, 1 on a plateau, between on a ramp. */
  heightAt(_x: number, _z: number): number {
    return 0;
  }

  /** Whether a point lies inside any light source. */
  litAt(_x: number, _z: number): boolean {
    return false;
  }
}

export default Ground;
