# New jobs

Draft. Six jobs to add to the fourteen in [mercenaries](05-mercenaries.md#jobs). Each one gives the party something no current job does.

## Where the roster stands

| State | Jobs |
|---|---|
| In the game | Vanguard, Ranger, Cleric |
| Full trees designed, not built | Sellsword, Warden, Duelist, Arcanist. See [skill trees](09-skill-trees.md#starting-jobs). |
| Outlines only | Bard, Alchemist, Sapper, Beastmaster, Scout, Hexblade, Necromancer. See [other jobs](09-skill-trees.md#other-jobs). |
| New in this file | Lamplighter, Berserker, Monk, Sage, Medium, Arbalist |

## What each new job adds

| Job | Role | Elements | Signature shape | Inspired by | What no other job does |
|---|---|---|---|---|---|
| Lamplighter | Light and vision | Fire, Radiant | A tall pole with a lantern hanging from it | Darkest Dungeon's torch, rAthena's Ruwach and Sight | Changes how far the party sees, and blinds monsters. |
| Berserker | Melee area damage | Neutral, Fire | A two-handed axe as long as its body | Diablo 2's Barbarian, rAthena's Lord Knight | Warcries that weaken monsters and buff the party. Loses Discipline as it rages. |
| Monk | Melee burst | Neutral, Spectral | Huge wrapped fists and a ring of prayer beads | rAthena's Monk and Champion, Diablo 3's Monk | Spirit spheres as a second resource. Snaps to the bearer in an instant. |
| Sage | Element support | Fire, Frost, Storm, Earth | A giant open book | rAthena's Sage and Professor | Gives allies' weapons an element. Cancels enemy spells and ground warnings. |
| Medium | Souls and spirits | Spectral | A funeral bell as big as its head | rAthena's Soul Linker, Darkest Dungeon's Occultist | Spectral damage. Buffs each job in its own way. Lays dead mercs to rest so the Creditor cannot raise them. |
| Arbalist | Planted ranged damage | Neutral, Earth | A crossbow on a stand, behind a tall shield | rAthena's Gunslinger, Diablo 3's Demon Hunter | Gets stronger the longer it holds still. Shoots whatever comes near the bearer. |

- Each signature shape is large and simple, so the job reads from its silhouette at 384×216.
- No two jobs share a shape. The Arbalist's crossbow sits on a stand; the Ranger's bow is held.

## Rules every new job follows

- 3 branches of 5 skills. The fifth is a capstone with 1 rank. Tiers open at levels 1, 4, 8, 12 and 16.
- At least one skill in each job cares about the bearer.
- **A** marks an active skill and **P** marks a passive.
- Numbers are not set here. They are set when the job is built and tested.

## Lamplighter

Fire and Radiant. A guide who carries the light the bearer walks by.

The game already uses light: the bearer sees 7 tiles, mercs 4.5, and monsters notice the lantern from further away. The Lamplighter changes these numbers. It is weak in a straight fight.

**Beacon**: light and what it reveals.

1. Wide Light (P): the bearer's light reaches further. Monsters are seen sooner, but they also notice the lantern sooner.
2. Flare (A): throws a flare that lights an area for a few seconds. Monsters inside are Blinded: their accuracy drops and they cannot notice anyone outside the light.
3. Steady Flame (P): party members in its light take less Dread buildup.
4. Brazier (A): plants a brazier that lights a circle for the rest of the area. Hidden monsters inside are revealed.
5. Dawn (P, capstone): once an area, when the bearer drops below 25% health, the lantern flares. Every enemy within 6 tiles is Blinded and gets Sear buildup.

**Kindling**: lamp oil turned into a weapon.

1. Oil Flask (A): a flask of burning oil. Fire damage in a small area, with Burn buildup.
2. Pitch (P): Burning enemies are slowed.
3. Firebreak (A): pours a line of fire across the ground. Monsters that cross it burn.
4. Wick (P): a Burning enemy that dies spreads Burn to those beside it.
5. Pyre (A, capstone): sets a corpse alight. Fire bursts around it, and the corpse is consumed so nothing can raise it.

**Wayfinding**: guiding the bearer.

1. Lead the Way (P): the bearer walks faster while the Lamplighter is within 3 tiles.
2. Lantern Post (A): plants a spare lantern. The light stays there for the rest of the area, and the bearer can retreat to it.
3. Watchful (P): ground warnings from traps and bosses show sooner, and hidden chests are marked.
4. Signal Light (A): for a few seconds, mercs in its light answer shouts with less delay.
5. Long Night (P, capstone): darkness modifiers do not shrink the party's light, and the light is wider in Labyrinths.

- Needs from the engine: a Blind status, hidden monsters, and light radius as a stat that skills can change.

## Berserker

Neutral and Fire. A raider who fights best when hurt.

The Berserker is the job that trades control for damage. Its strongest skills lower its own Discipline, so it follows fewer orders while it rages.

**Warcries**: shouts of its own, as Diablo 2's Barbarian.

1. Howl (A): normal monsters within 4 tiles are frightened and run for a moment.
2. Battle Cry (A): enemies within 4 tiles lose armor and damage for a few seconds.
3. Shout (A): the party gains armor for a while.
4. Battle Orders (A): the party gains max health and max mana for a while.
5. War Cry (A, capstone): a roar that damages and stuns every enemy around it.

**Fury**: damage that grows as health falls.

1. Bloodlust (P): more damage the lower its health.
2. Frenzy (A): each hit in a row is faster, up to a limit. The streak ends if it stops attacking.
3. Leap Attack (A): leaps onto an enemy that has just hit the bearer.
4. Whirlwind (A): spins along a line, hitting every enemy it passes.
5. Berserk (A, capstone): as rAthena's Berserk. For 10 seconds it deals double damage and attacks faster, but loses health each second, drinks no potions and ignores shouts.

**Hide**: staying up long enough to use the other two.

1. Thick Skin (P): more armor.
2. Unyielding (P): once an area, a killing blow leaves it at 1 health instead.
3. Blood Rage (P): each kill restores a little health and morale.
4. Iron Will (P): its Discipline drops less from its own skills.
5. Deathless (P, capstone): while Berserk, it cannot die. When Berserk ends, it is left at 1 health.

- Needs from the engine: fear on monsters, buffs for the whole party, and skills that lower the caster's Discipline for a while.

## Monk

Neutral and Spectral. A fighter monk who builds spirit spheres, as rAthena's Monk.

Each hit has a chance to make a spirit sphere, up to 5. Skills spend spheres as well as mana. The Monk is the only job whose damage is saved up and spent in bursts.

**Spheres**: making and spending them.

1. Spirit Sphere (P): hits can make spheres. Higher ranks make them more often and hold more.
2. Throw Sphere (A): throws spheres at an enemy for Spectral damage.
3. Investigate (A): a palm strike that hits harder the more armor the target has.
4. Absorb Spirit (A): turns its spheres into mana.
5. Asura Strike (A, capstone): as rAthena's Extremity Fist. Spends all its mana and spheres on one enormous blow. Its mana does not return for 10 seconds after. Best set to "Elites" on its sheet.

**Combos**: chains of blows on one target.

1. Triple Attack (P): a chance for a basic attack to hit three times.
2. Chain Combo (A): follows a Triple Attack with a stronger chain.
3. Tiger Fist (A): a blow that roots the target. Breaks a cast.
4. Combo Finish (A): ends a chain with a heavy blow that adds stun buildup.
5. Flowing Strikes (P, capstone): combos cost no spheres while it has 5.

**Stillness**: the body as armor.

1. Iron Body (P): more armor for each 10 points of effective Discipline.
2. Snap (A): as rAthena's Body Relocation. Appears beside the bearer at once, between it and the nearest threat.
3. Steel Body (A): takes much less damage for a few seconds, but moves slowly.
4. Blade Catch (A): catches the next melee blow aimed at the bearer. The attacker and the Monk are both held for a few seconds.
5. Mantra (P, capstone): its effective Discipline never drops below 70. Mercs within 3 tiles gain Discipline.

- Needs from the engine: a resource beside mana, and Spectral as an attack element.

## Sage

Fire, Frost, Storm and Earth. A scholar of the elements, as rAthena's Sage.

The game has a full element table, but only gear decides who hits with what. The Sage chooses elements for the party, and for the enemy.

**Endow**: elements for the party.

1. Endow (A): gives an ally's weapon an element for a while. It picks the element the ally's target is weakest to.
2. Bolts (A): Fire, Frost, Storm or Earth bolts, each picked by the target's weakness.
3. Elemental Change (A): changes an enemy's defense element for a while, to the one the party hits hardest.
4. Element Fields (A): Volcano, Deluge, Whirlwind or Quagmire, as rAthena's. Allies inside deal more of that element. Quagmire slows enemies instead.
5. Endow the Party (A, capstone): endows every merc at once.

**Breaker**: undoing what enemies cast.

1. Dispel (A): removes buffs from an enemy, such as the Abbess's Litany on a Penitent.
2. Spell Breaker (A): breaks off an enemy's cast and takes some of its mana.
3. Magic Rod (A): the next spell aimed at the bearer is absorbed. The Sage gains mana from it.
4. Hindsight (P): when it is hit, it may cast a bolt back on its own.
5. Land Protector (A, capstone): a zone where no ground skill can be laid. Enemy ground warnings inside it are cancelled before they strike.

**Study**: knowledge as power.

1. Study (P): reveals the compendium's hidden details for monsters it fights.
2. Free Cast (P): it can walk while it casts.
3. Weak Point (P): its bolts hit harder on enemies it has studied.
4. Memorize (A): its next few casts have no windup.
5. Double Cast (P, capstone): its bolts have a chance to be cast twice.

- Needs from the engine: weapon element buffs, buffs on enemies to dispel, and a way to cancel a warning.

## Medium

Spectral. Someone who speaks with the dead and rings them to rest.

The lore gives souls weight: every merc death feeds the Creditor, and dead mercs rise against the party at the end. The Medium is the job that works with that system on purpose.

**Links**: binding spirits to allies, as rAthena's Soul Linker.

1. Soul Link (A): binds a spirit to an ally for a while. The spirit depends on the ally's job. A Vanguard's taunts last longer, a Ranger reaches further, a Cleric heals more.
2. Kaizel (A): as rAthena's. The linked ally rises once, at low health, if it dies while the link lasts.
3. Kaahi (P): when a linked ally is hit, the Medium spends a little mana to heal it.
4. Shared Spirit (P): links last longer and reach two allies.
5. Soul Bond (P, capstone): Soul Link costs no mana on the bearer, and the bearer's link also slows enemies that touch it.

**Rites**: the dead and the Creditor's count.

1. Toll (A): rings the bell. Spectral damage around it, with Dread buildup on Occult enemies.
2. Last Rites (A): lays a dead merc to rest. It can never be raised, by a Cleric or by the Creditor. The soul does not count for the Creditor at the end.
3. Speak with the Dead (P): earlier bearers' remains and some Events offer an extra choice.
4. Grave Ward (P): mercs near the Medium are harder to tear apart, so more bodies can be raised.
5. Requiem (P, capstone): in the final fight, each merc laid to rest during the run weakens the Creditor.

**Haunting**: Spectral damage and control.

1. Phantom Hand (A): a Spectral blow at range.
2. Wail (A): a cone of Dread buildup in front of it.
3. Spirit Walk (P): it passes through enemies.
4. Possess (A): takes control of a non-boss monster for a few seconds. The monster fights for the party.
5. Haunt (P, capstone): an enemy it kills leaves a spirit that fights for the party for a few seconds.

- Needs from the engine: buffs that depend on the target's job, a way to mark a corpse as laid to rest, and monsters switching sides for a while.
- Last Rites is a real choice. It costs a merc that could be raised. It saves a soul the Creditor would use.

## Arbalist

Neutral and Earth. A siege crossbowman who fights from one place.

The Hold stance and the Hold shout exist, but only a few skills reward them. The Arbalist is the job that wants to stand still behind its shield.

**Siege**: digging in.

1. Brace (P): while it stands still, its damage and reach grow, up to a limit.
2. Pavise (A): plants a tall shield in front of it. Arrows from the front stop at it, and allies behind it are covered.
3. Bolt Rack (P): it reloads faster.
4. Ballista (A): sets up a ballista that shoots on its own for a while.
5. Siege Bolt (A, capstone): a bolt that flies to the edge of the area, piercing everything in its line and pushing enemies back.

**Marksman**: heavy single shots.

1. Heavy Bolt (A): a slow, heavy shot.
2. Tracking (A): as rAthena's Tracking. A long aim for a sure critical.
3. Armor Piercer (P): its bolts ignore part of the target's armor.
4. Disarm (A): as rAthena's Disarm. The target deals much less damage for a few seconds.
5. Overpenetration (P, capstone): a bolt that kills goes on to the next enemy in its line.

**Overwatch**: guarding the bearer from afar.

1. Overwatch (P): takes a free shot at the first enemy that comes within 3 tiles of the bearer.
2. Covering Fire (A): pins an enemy down. It is slowed and cannot start skills for a few seconds.
3. Cover the Writ (P): the bearer takes less ranged damage while it stands behind the Pavise.
4. Spotter (P): enemies it hits take more damage from the other mercs for a moment.
5. Kill Zone (P, capstone): while it holds, every enemy that steps within 4 tiles of the bearer is shot once.

- Needs from the engine: a stand-still timer, knockback, and a turret that is a zone that shoots.

## What the engine needs

The new jobs share a few new systems. Building these first makes each job smaller.

| System | Used by |
|---|---|
| Party buffs with a duration | Berserker, Sage, Medium, Bard |
| Blind status | Lamplighter |
| Fear on monsters | Berserker, Medium |
| Light radius as a stat | Lamplighter, Scout |
| Hidden monsters | Lamplighter, Warden, Scout |
| A second resource | Monk |
| Spectral attacks | Monk, Medium |
| Weapon element buffs | Sage, Alchemist |
| Removing enemy buffs and warnings | Sage |
| Corpses laid to rest | Medium, Necromancer |
| Monsters switching sides for a while | Medium, Necromancer |
| Knockback | Arbalist, Sapper |
| Turrets as zones that shoot | Arbalist, Sapper |
| Standing-still timer | Arbalist |

Zones on the ground already exist. See `src/sim/zone.ts`.

## Order to build in

1. Warden. Its full tree is designed, and it is the job most about the bearer.
2. Arcanist. Designed, and it adds Fire and Frost area magic, which no current job has.
3. Sage. It makes the element table matter, and Land Protector answers boss warnings.
4. Monk. Snap and Blade Catch give a second way to guard the bearer.
5. Arbalist. It needs ranged monsters to block, which come with the new monsters.
6. Berserker, Lamplighter and Medium, once party buffs, light and souls are in.

## Starting offers

In the story, the Guild House is the only place to hire. So its four recruits must cover a party and still vary from run to run.

| Recruit | Drawn from |
|---|---|
| A guard | Vanguard, Warden, Monk |
| A striker | Ranger, Duelist, Arcanist, Berserker, Arbalist, Sellsword |
| A support | Cleric, Sage, Medium, Bard, Lamplighter |
| One more | Any job, the outlines included once they are built |

- No two recruits share a job.
- The road out still needs a recruit that can kill what attacks the bearer. A guard or a striker counts.
- The deserter Event and endless mode's wandering mercs draw from every job.
- Every job is available from the first run. There are no unlocks.
