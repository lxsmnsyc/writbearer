import { C } from './palette';
import { VoxelModel } from './voxel';

// Every model faces +z and stands on y = 0.

// The bearer: small, hooded, carrying a lantern and the Writ.
export function citizen(): VoxelModel {
  const m = new VoxelModel();
  // Legs and boots
  m.fill(-2, 0, -1, -1, 1, 0, C.shadow).fill(1, 0, -1, 2, 1, 0, C.shadow);
  m.fill(-2, 2, -1, -1, 3, 0, C.stoneDeep).fill(1, 2, -1, 2, 3, 0, C.stoneDeep);
  // Cloak, wider at the hem
  m.fill(-3, 3, -2, 3, 4, 1, C.leather);
  m.fill(-2, 5, -2, 2, 9, 1, C.leather);
  m.fill(-1, 5, 2, 1, 8, 2, C.rust); // shirt showing through
  // Hood and face
  m.fill(-2, 10, -2, 2, 12, 1, 0x3d2b22);
  m.fill(-2, 13, -1, 2, 13, 0, 0x3d2b22);
  m.fill(-1, 10, 2, 1, 11, 2, C.skin);
  m.set(-1, 11, 2, C.void).set(1, 11, 2, C.void);
  // The Writ on the back, with a red seal
  m.fill(-1, 6, -3, 1, 9, -3, C.bone).set(0, 7, -3, C.blood);
  // Arm held forward with the lantern
  m.fill(3, 6, 0, 3, 8, 2, C.leather);
  m.fill(3, 3, 3, 4, 6, 4, C.stoneDeep);
  m.fill(3, 4, 3, 4, 5, 4, C.flame);
  m.set(3, 7, 3, C.rust).set(4, 7, 4, C.rust);
  return m;
}

// Vanguard: plate armor, red tabard, tower shield, sword.
export function vanguard(): VoxelModel {
  const m = new VoxelModel();
  m.fill(-3, 0, -1, -1, 1, 1, C.shadow).fill(1, 0, -1, 3, 1, 1, C.shadow);
  m.fill(-3, 2, -1, -1, 5, 1, C.steelDark).fill(1, 2, -1, 3, 5, 1, C.steelDark);
  m.fill(-3, 6, -2, 3, 11, 1, C.steel);
  m.fill(-3, 6, 2, 3, 7, 2, C.leather); // belt
  m.fill(-1, 3, 2, 1, 10, 2, C.blood); // tabard
  m.set(0, 8, 3, C.gold);
  m.fill(-5, 10, -2, -4, 12, 1, C.steelLight).fill(4, 10, -2, 5, 12, 1, C.steelLight);
  // Helm with a dark slit
  m.fill(-2, 12, -2, 2, 16, 2, C.steel);
  m.fill(-2, 14, 2, 2, 14, 2, C.void);
  m.fill(-1, 17, -1, 1, 17, 1, C.blood); // plume
  // Tower shield on the left arm
  m.fill(-6, 3, 0, -6, 13, 4, C.rust);
  m.fill(-7, 3, 0, -7, 13, 0, C.steelDark).fill(-7, 3, 4, -7, 13, 4, C.steelDark);
  m.fill(-7, 3, 1, -7, 3, 3, C.steelDark).fill(-7, 13, 1, -7, 13, 3, C.steelDark);
  m.fill(-7, 7, 2, -7, 9, 2, C.gold);
  // Sword arm pointing forward
  m.fill(4, 6, 0, 5, 9, 1, C.steel);
  m.fill(5, 7, 2, 5, 7, 3, C.leather);
  m.fill(5, 7, 4, 5, 7, 10, C.steelLight);
  m.fill(4, 7, 4, 6, 7, 4, C.gold);
  return m;
}

// Ranger: leather, hooded cloak, bow.
export function ranger(): VoxelModel {
  const m = new VoxelModel();
  m.fill(-2, 0, -1, -1, 1, 0, C.shadow).fill(1, 0, -1, 2, 1, 0, C.shadow);
  m.fill(-2, 2, -1, -1, 5, 0, C.leather).fill(1, 2, -1, 2, 5, 0, C.leather);
  m.fill(-2, 6, -1, 2, 11, 1, C.moss);
  m.fill(-2, 6, 2, 2, 6, 2, C.rust);
  m.fill(-3, 7, -2, 3, 11, -2, 0x2f382d); // cloak
  m.fill(-2, 12, -2, 2, 15, 1, 0x2f382d); // hood
  m.fill(-1, 12, 2, 1, 13, 2, C.skin);
  m.set(-1, 13, 2, C.void).set(1, 13, 2, C.void);
  // Quiver
  m.fill(2, 8, -3, 3, 13, -3, C.leather).fill(2, 14, -3, 3, 15, -3, C.bone);
  // Bow held out on the left
  m.fill(-3, 8, 0, -3, 10, 2, C.moss);
  m.fill(-4, 4, 3, -4, 14, 3, C.rust);
  m.fill(-4, 3, 2, -4, 3, 2, C.rust).fill(-4, 15, 2, -4, 15, 2, C.rust);
  m.fill(-4, 4, 2, -4, 14, 2, C.bone);
  return m;
}

// Hollow soldier: one of the Old King's dead, still guarding.
export function hollowSoldier(): VoxelModel {
  const m = new VoxelModel();
  // Bone legs
  m.fill(-2, 0, 0, -2, 5, 0, C.bone).fill(2, 0, 0, 2, 5, 0, C.bone);
  m.fill(-3, 0, 0, -1, 0, 1, C.bone).fill(1, 0, 0, 3, 0, 1, C.bone);
  // Tattered cloth
  m.fill(-3, 4, -1, 3, 6, 1, C.stoneDeep);
  m.set(-3, 3, 1, C.stoneDeep).set(0, 3, 1, C.stoneDeep).set(2, 2, 1, C.stoneDeep);
  // Spine and ribs under a rusted breastplate
  m.fill(0, 6, -1, 0, 8, -1, C.bone);
  m.fill(-3, 8, -2, 3, 12, 1, C.rust);
  m.fill(-2, 9, 2, 2, 11, 2, C.leather);
  m.fill(-2, 10, 2, 2, 10, 2, C.bone);
  // Skull, helm and crown spikes
  m.fill(-2, 13, -2, 2, 16, 2, C.bone);
  m.fill(-1, 14, 2, -1, 14, 2, C.spectral).fill(1, 14, 2, 1, 14, 2, C.spectral);
  m.fill(-1, 13, 2, 1, 13, 2, C.shadow);
  // A rusted iron crown: a band with a row of short points.
  m.fill(-3, 16, -3, 3, 16, 3, C.rust);
  for (const [x, z] of [[-3, -1], [-3, 1], [3, -1], [3, 1], [-1, 3], [1, 3], [-1, -3], [1, -3]]) {
    m.set(x, 17, z, C.rust);
  }
  m.set(0, 17, 3, C.gold).set(0, 18, 3, C.gold);
  // Arms and a long spear
  m.fill(-4, 7, 0, -4, 11, 0, C.bone).fill(4, 7, 0, 4, 11, 0, C.bone);
  m.fill(4, 8, 1, 4, 8, 3, C.bone);
  m.fill(5, 8, -6, 5, 8, 10, C.leather);
  m.fill(5, 8, 11, 5, 8, 13, C.steelLight).set(5, 9, 11, C.steelLight).set(5, 7, 11, C.steelLight);
  return m;
}

// Blight crawler: low, swollen, glowing growths.
export function crawler(): VoxelModel {
  const m = new VoxelModel();
  m.fill(-3, 2, -5, 3, 6, 4, C.blight);
  m.fill(-2, 7, -4, 2, 7, 2, C.blight);
  m.fill(-2, 2, 5, 2, 5, 7, 0x3a2c44);
  m.fill(-2, 3, 8, 2, 3, 8, C.bone); // teeth
  m.set(-1, 5, 8, C.blightGlow).set(1, 5, 8, C.blightGlow);
  m.set(-2, 7, -2, C.blightGlow).set(1, 8, 0, C.blightGlow).set(2, 7, -3, C.blightGlow).set(-1, 8, 1, C.blightGlow);
  for (const z of [-4, -1, 2]) {
    m.fill(-5, 0, z, -4, 3, z, 0x3a2c44).fill(4, 0, z, 5, 3, z, 0x3a2c44);
  }
  return m;
}

// A dead merc, lying where it fell. Its corpse stays until resurrected.
export function corpse(): VoxelModel {
  const m = new VoxelModel();
  m.fill(-6, 0, -5, 6, 0, 5, C.blood);
  m.fill(-3, 1, -1, 3, 3, 1, C.steel); // body lying along x
  m.fill(4, 1, -1, 7, 2, 1, C.steelDark); // legs
  m.fill(-7, 1, -2, -4, 4, 2, C.steel); // helm
  m.fill(-7, 2, 2, -5, 2, 2, C.void);
  m.fill(-1, 1, 3, 1, 1, 9, C.steelLight); // dropped sword
  return m;
}

export function bones(): VoxelModel {
  const m = new VoxelModel();
  m.fill(-3, 0, 0, 2, 0, 0, C.bone).fill(-1, 0, -2, -1, 0, 2, C.bone);
  m.fill(1, 0, 2, 3, 2, 4, C.bone).set(2, 1, 4, C.shadow);
  return m;
}

export function brokenPillar(height: number): VoxelModel {
  const m = new VoxelModel();
  m.fill(-4, 0, -4, 3, 1, 3, C.stoneLight);
  m.fill(-3, 2, -3, 2, height, 2, C.stone);
  m.fill(-3, height + 1, -3, 0, height + 2, 2, C.stone);
  m.fill(-3, 2, 3, 2, 3, 3, C.moss);
  return m;
}

export function rubble(): VoxelModel {
  const m = new VoxelModel();
  m.fill(-2, 0, -1, 1, 1, 1, C.stone).fill(2, 0, -3, 3, 0, -2, C.stoneLight).set(-3, 0, 2, C.stoneLight);
  return m;
}
