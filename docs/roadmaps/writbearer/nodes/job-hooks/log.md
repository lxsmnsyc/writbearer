# Log: job-hooks

- Reset branch to main d41b797, renamed feat/job-hooks. verify test did not exist: nothing built yet.
- Read doc 16 for the four jobs. Kept all eight hooks of the draft. Added CheckAttackElements (Elemental Sense with two elements). Added helpers areaVictims, buffsOf, stealBuff.
- BLIND uses CheckHit at ValuePriority.Additive (-30 hit chance). Core buffs marked: Mending, Refreshing, Renewed, Shield Wall.
- nav.block needs bodies to stop: small edit to Unit.walkTo (not in shared list). Nav.advance is called from Sim.tick.
- Added "Enemies weak to its element" to the PRIORITIES list in merc-panel.tsx.
- Checked other needs of doc 16 (Overchannel, Echo, Shatterpoint, Duel bind, Riposte): listeners on existing events cover them. Pocket Change (gold on kill) and Bribe (spend gold) are game-layer, not sim: left to sellsword-upgrades.
