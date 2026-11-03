# Log: arcanist-upgrades

- Branch feat/arcanist-upgrades on main 07b0126. All 12 upgrades were designedUpgrade placeholders at the start.
- Wrote the 12 upgrades in upgrades.ts (patch for release, wants and cost; effect for listeners). Exported castAs and blast from spells.ts.
- Added iceWall and volcano to ZONE_LOOKS (append only).
- test/content/jobs.test.ts asserted that no upgrade is built; it now checks that built ones have a patch or effect.
- Tests in test/sim/arcanist-upgrades.test.ts, 21 cases. Fast check passes.
