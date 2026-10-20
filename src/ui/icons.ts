import type { ComponentProps, JSX } from 'solid-js';
import GiAnkh from '~icons/game-icons/ankh';
import GiAnvil from '~icons/game-icons/anvil';
import GiAnvilImpact from '~icons/game-icons/anvil-impact';
import GiArrowScope from '~icons/game-icons/arrow-scope';
import GiBarbedArrow from '~icons/game-icons/barbed-arrow';
import GiBellShield from '~icons/game-icons/bell-shield';
import GiBiceps from '~icons/game-icons/biceps';
import GiBlackKnightHelm from '~icons/game-icons/black-knight-helm';
import GiBowArrow from '~icons/game-icons/bow-arrow';
import GiBowman from '~icons/game-icons/bowman';
import GiBrain from '~icons/game-icons/brain';
import GiBroadsword from '~icons/game-icons/broadsword';
import GiBrokenBone from '~icons/game-icons/broken-bone';
import GiBrokenShield from '~icons/game-icons/broken-shield';
import GiBullseye from '~icons/game-icons/bullseye';
import GiCampfire from '~icons/game-icons/campfire';
import GiCardPickup from '~icons/game-icons/card-pickup';
import GiCauldron from '~icons/game-icons/cauldron';
import GiChainMail from '~icons/game-icons/chain-mail';
import GiChargedArrow from '~icons/game-icons/charged-arrow';
import GiCheckedShield from '~icons/game-icons/checked-shield';
import GiChemicalDrop from '~icons/game-icons/chemical-drop';
import GiCloak from '~icons/game-icons/cloak';
import GiCrescentStaff from '~icons/game-icons/crescent-staff';
import GiCrossMark from '~icons/game-icons/cross-mark';
import GiCrossShield from '~icons/game-icons/cross-shield';
import GiCrossedSwords from '~icons/game-icons/crossed-swords';
import GiCrownedSkull from '~icons/game-icons/crowned-skull';
import GiCultist from '~icons/game-icons/cultist';
import GiCutDiamond from '~icons/game-icons/cut-diamond';
import GiDeathSkull from '~icons/game-icons/death-skull';
import GiDefensiveWall from '~icons/game-icons/defensive-wall';
import GiDervishSwords from '~icons/game-icons/dervish-swords';
import GiDiabloSkull from '~icons/game-icons/diablo-skull';
import GiDrop from '~icons/game-icons/drop';
import GiEagleEmblem from '~icons/game-icons/eagle-emblem';
import GiEarthCrack from '~icons/game-icons/earth-crack';
import GiEarthSpit from '~icons/game-icons/earth-spit';
import GiElectric from '~icons/game-icons/electric';
import GiEnergyShield from '~icons/game-icons/energy-shield';
import GiFeather from '~icons/game-icons/feather';
import GiFireRay from '~icons/game-icons/fire-ray';
import GiFlagObjective from '~icons/game-icons/flag-objective';
import GiFlangedMace from '~icons/game-icons/flanged-mace';
import GiFlyingFlag from '~icons/game-icons/flying-flag';
import GiFootprint from '~icons/game-icons/footprint';
import GiGemPendant from '~icons/game-icons/gem-pendant';
import GiGhost from '~icons/game-icons/ghost';
import GiHammerDrop from '~icons/game-icons/hammer-drop';
import GiHangingSpider from '~icons/game-icons/hanging-spider';
import GiHeadshot from '~icons/game-icons/headshot';
import GiHealing from '~icons/game-icons/healing';
import GiHealthPotion from '~icons/game-icons/health-potion';
import GiHeartBottle from '~icons/game-icons/heart-bottle';
import GiHeartPlus from '~icons/game-icons/heart-plus';
import GiHeartWings from '~icons/game-icons/heart-wings';
import GiHelp from '~icons/game-icons/help';
import GiHolySymbol from '~icons/game-icons/holy-symbol';
import GiHolyWater from '~icons/game-icons/holy-water';
import GiHood from '~icons/game-icons/hood';
import GiHoodedFigure from '~icons/game-icons/hooded-figure';
import GiHouse from '~icons/game-icons/house';
import GiIncense from '~icons/game-icons/incense';
import GiKnapsack from '~icons/game-icons/knapsack';
import GiKnightBanner from '~icons/game-icons/knight-banner';
import GiLeatherBoot from '~icons/game-icons/leather-boot';
import GiLeatherVest from '~icons/game-icons/leather-vest';
import GiLightningBow from '~icons/game-icons/lightning-bow';
import GiLightningStorm from '~icons/game-icons/lightning-storm';
import GiLightningTree from '~icons/game-icons/lightning-tree';
import GiLinkedRings from '~icons/game-icons/linked-rings';
import GiLockedChest from '~icons/game-icons/locked-chest';
import GiMagicPotion from '~icons/game-icons/magic-potion';
import GiMagicShield from '~icons/game-icons/magic-shield';
import GiMaze from '~icons/game-icons/maze';
import GiMeditation from '~icons/game-icons/meditation';
import GiMetalBar from '~icons/game-icons/metal-bar';
import GiMountains from '~icons/game-icons/mountains';
import GiMusicSpell from '~icons/game-icons/music-spell';
import GiOpenBook from '~icons/game-icons/open-book';
import GiOverlordHelm from '~icons/game-icons/overlord-helm';
import GiPadlock from '~icons/game-icons/padlock';
import GiPocketBow from '~icons/game-icons/pocket-bow';
import GiPopeCrown from '~icons/game-icons/pope-crown';
import GiRegeneration from '~icons/game-icons/regeneration';
import GiReturnArrow from '~icons/game-icons/return-arrow';
import GiRing from '~icons/game-icons/ring';
import GiRobe from '~icons/game-icons/robe';
import GiRolledCloth from '~icons/game-icons/rolled-cloth';
import GiRoundShield from '~icons/game-icons/round-shield';
import GiScrollQuill from '~icons/game-icons/scroll-quill';
import GiScrollUnfurled from '~icons/game-icons/scroll-unfurled';
import GiShamblingZombie from '~icons/game-icons/shambling-zombie';
import GiShield from '~icons/game-icons/shield';
import GiShieldBash from '~icons/game-icons/shield-bash';
import GiShieldEchoes from '~icons/game-icons/shield-echoes';
import GiShieldImpact from '~icons/game-icons/shield-impact';
import GiShieldOpposition from '~icons/game-icons/shield-opposition';
import GiShieldReflect from '~icons/game-icons/shield-reflect';
import GiShoppingBag from '~icons/game-icons/shopping-bag';
import GiShouting from '~icons/game-icons/shouting';
import GiSkullCrack from '~icons/game-icons/skull-crack';
import GiSkullCrossedBones from '~icons/game-icons/skull-crossed-bones';
import GiSparkles from '~icons/game-icons/sparkles';
import GiSpiderAlt from '~icons/game-icons/spider-alt';
import GiSpiderFace from '~icons/game-icons/spider-face';
import GiSpikedFence from '~icons/game-icons/spiked-fence';
import GiSpikedHalo from '~icons/game-icons/spiked-halo';
import GiSpikedShell from '~icons/game-icons/spiked-shell';
import GiSpikes from '~icons/game-icons/spikes';
import GiSprint from '~icons/game-icons/sprint';
import GiStiletto from '~icons/game-icons/stiletto';
import GiStoneWall from '~icons/game-icons/stone-wall';
import GiSunPriest from '~icons/game-icons/sun-priest';
import GiSunSpear from '~icons/game-icons/sun-spear';
import GiSunbeams from '~icons/game-icons/sunbeams';
import GiSupersonicArrow from '~icons/game-icons/supersonic-arrow';
import GiTargetDummy from '~icons/game-icons/target-dummy';
import GiTargeted from '~icons/game-icons/targeted';
import GiTargeting from '~icons/game-icons/targeting';
import GiThreeFriends from '~icons/game-icons/three-friends';
import GiTowerFlag from '~icons/game-icons/tower-flag';
import GiTrashCan from '~icons/game-icons/trash-can';
import GiTreasureMap from '~icons/game-icons/treasure-map';
import GiTwoCoins from '~icons/game-icons/two-coins';
import GiUpgrade from '~icons/game-icons/upgrade';
import GiVillage from '~icons/game-icons/village';
import GiVisoredHelm from '~icons/game-icons/visored-helm';
import GiWeight from '~icons/game-icons/weight';
import GiWizardStaff from '~icons/game-icons/wizard-staff';
import GiWolfTrap from '~icons/game-icons/wolf-trap';

// Icons from game-icons.net, by Lorc, Delapouite and others, under CC BY 3.0.
// Each is compiled into the bundle only as it is imported here.

export type IconComponent = (props: ComponentProps<'svg'>) => JSX.Element;

export const ICONS = {
  // Items, by base
  armingSword: GiBroadsword,
  flangedMace: GiFlangedMace,
  huntingBow: GiPocketBow,
  yewLongbow: GiBowArrow,
  stiletto: GiStiletto,
  ashStaff: GiWizardStaff,
  pilgrimStaff: GiCrescentStaff,
  censer: GiIncense,
  towerShield: GiCheckedShield,
  buckler: GiRoundShield,
  hood: GiHood,
  kettleHelm: GiVisoredHelm,
  jerkin: GiLeatherVest,
  hauberk: GiChainMail,
  vestments: GiRobe,
  shroud: GiCloak,
  boots: GiLeatherBoot,
  ring: GiRing,
  amulet: GiGemPendant,
  healingDraught: GiHealthPotion,
  manaTincture: GiMagicPotion,
  greaterDraught: GiHeartBottle,
  gold: GiTwoCoins,
  card: GiCardPickup,
  gem: GiCutDiamond,
  // Materials
  chitin: GiSpikedShell,
  bone: GiBrokenBone,
  rag: GiRolledCloth,
  iron: GiMetalBar,
  venomEssence: GiChemicalDrop,
  occultEssence: GiDrop,
  radiantEssence: GiSunbeams,
  blessing: GiAnvilImpact,
  // Skills and tree nodes, by id
  challenge: GiShouting,
  shieldWall: GiDefensiveWall,
  bastion: GiShieldEchoes,
  rampart: GiStoneWall,
  immovable: GiMountains,
  sunder: GiBrokenShield,
  crush: GiHammerDrop,
  shieldBash: GiShieldBash,
  faultLine: GiEarthCrack,
  earthshaker: GiEarthSpit,
  vow: GiShieldReflect,
  intercept: GiShieldImpact,
  sharedBurden: GiLinkedRings,
  banner: GiKnightBanner,
  lastLine: GiShieldOpposition,
  aimedShot: GiArrowScope,
  pinDown: GiBarbedArrow,
  eagleEye: GiEagleEmblem,
  piercingArrow: GiSupersonicArrow,
  killshot: GiHeadshot,
  snare: GiWolfTrap,
  rearguard: GiFootprint,
  bait: GiTargetDummy,
  spikeField: GiSpikes,
  killingGround: GiSpikedFence,
  chargedArrow: GiChargedArrow,
  static: GiElectric,
  arcVolley: GiLightningBow,
  lightningRod: GiLightningTree,
  thunderhead: GiLightningStorm,
  heal: GiHealing,
  renew: GiRegeneration,
  cleanse: GiSparkles,
  resurrection: GiAnkh,
  martyr: GiHeartWings,
  ward: GiMagicShield,
  sacredGround: GiHolyWater,
  wallOfFaith: GiCrossShield,
  veil: GiEnergyShield,
  aegis: GiBellShield,
  smite: GiSunSpear,
  holyLight: GiSunbeams,
  turnUndead: GiSkullCrack,
  consecrate: GiHolySymbol,
  purge: GiFireRay,
  hymn: GiMusicSpell,
  // Units, by kind
  bearer: GiScrollUnfurled,
  vanguard: GiBlackKnightHelm,
  ranger: GiBowman,
  cleric: GiSunPriest,
  hollowSoldier: GiDeathSkull,
  penitent: GiCultist,
  cantor: GiHoodedFigure,
  hollowed: GiShamblingZombie,
  husk: GiGhost,
  mite: GiSpiderAlt,
  crawler: GiHangingSpider,
  broodMother: GiSpiderFace,
  gatekeeper: GiOverlordHelm,
  abbess: GiPopeCrown,
  hollowedSaint: GiSpikedHalo,
  creditor: GiCrownedSkull,
  // Places on the map
  combat: GiCrossedSwords,
  elite: GiSkullCrossedBones,
  camp: GiCampfire,
  event: GiHelp,
  town: GiVillage,
  boss: GiDiabloSkull,
  start: GiHouse,
  waystation: GiTowerFlag,
  hunt: GiTargeted,
  horde: GiDervishSwords,
  maze: GiMaze,
  escort: GiThreeFriends,
  // The interface
  close: GiCrossMark,
  locked: GiPadlock,
  weight: GiWeight,
  pack: GiKnapsack,
  rally: GiFlyingFlag,
  focus: GiTargeting,
  fallBack: GiReturnArrow,
  hold: GiFlagObjective,
  guard: GiShield,
  advance: GiSprint,
  smith: GiAnvil,
  bench: GiCauldron,
  temple: GiAnkh,
  market: GiShoppingBag,
  vault: GiLockedChest,
  compendium: GiOpenBook,
  points: GiUpgrade,
  drop: GiTrashCan,
  map: GiTreasureMap,
  seed: GiScrollQuill,
  str: GiBiceps,
  agi: GiFeather,
  vit: GiHeartPlus,
  int: GiBrain,
  dex: GiBullseye,
  wil: GiMeditation,
} satisfies Record<string, IconComponent>;

export type IconName = keyof typeof ICONS;

export const isIconName = (name: string): name is IconName => Object.hasOwn(ICONS, name);

/** The icon by a name from the game, such as a unit's kind, or a fallback. */
export const iconOr = (name: string, fallback: IconName): IconName =>
  isIconName(name) ? name : fallback;
