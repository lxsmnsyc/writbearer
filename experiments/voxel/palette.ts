// A dark palette for the Drowned Undercroft. Every final pixel snaps to one of these.
export const C = {
  void: 0x0b0a0f,
  shadow: 0x17151f,
  stoneDeep: 0x24212f,
  stone: 0x353141,
  stoneLight: 0x4b4656,
  stonePale: 0x6b6573,
  ash: 0x8f8a8f,
  bone: 0xc9c1b0,
  skin: 0xc9a88a,
  leather: 0x5a3a2a,
  rust: 0x8a5a32,
  gold: 0xd6a24a,
  flame: 0xf2e3a0,
  waterDeep: 0x1d302f,
  water: 0x2d4a46,
  spectral: 0x6fc2ae,
  blood: 0x6e2b2b,
  bloodLight: 0xa34a3a,
  moss: 0x3f4a3a,
  blight: 0x4b3a56,
  blightGlow: 0x9ab54a,
  steelDark: 0x3b4656,
  steel: 0x5c6f86,
  steelLight: 0x8fa3b8,
} as const;

export const PALETTE: readonly number[] = Object.values(C);

// Outline colors by side. Only units get outlines.
export const SIDE = {
  citizen: 0xd6a24a,
  merc: 0x8fa3b8,
  monster: 0xa34a3a,
} as const;
