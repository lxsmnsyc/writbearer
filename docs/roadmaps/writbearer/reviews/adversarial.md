# Adversarial review

A fresh-context reviewer checked contracts, shared files and dependency edges on 2026-10-26. Each finding below was checked against the code before acting.

## Accepted

1. Deriving HIREABLE from JOBS would grow the Guild House draw (`rollStartingOffers` in `src/content/recruits.ts` uses `[...HIREABLE, one fighter]`) as soon as the first job merged, breaking the recruit tests. Fix: new jobs stay `hireable: false`; roster-balance turns them on.
2. job-def was vague: `Template` not exported, `JobLook` undefined, no rule for item bases, and it ignored existing Arcanist and Duelist gear and `WeaponKind` (dagger, staff) in `src/sim/item.ts`. Fix: contract rewritten; bases stay in items.ts with one-way imports; the weaponType open question is dropped since `ItemBase.weapon` exists.
3. Job nodes missed shared files (damage.ts, hit.ts, sim.ts, skill.ts, zone.ts, trap.ts, light.ts, skills.ts for `rankOf`). Fix: added to `shared:`.
4. The targeting rule would have forbidden heals and ignored `Side.Ward`; `projectile.ts` was the wrong shared file. Fix: only hostile choices are filtered, built-in rule is `sim.foes`, `sim.ts` replaces `projectile.ts`, blocker and bait are filtered.
5. Listeners on CheckTarget cannot be built against a stub with no event. Fix: sellsword-tricks, duelist-showmanship and hidden-units depend `hard` on targeting-rules; warden and arcanist-weave too, since they edit the same AI functions.
6. hidden-units missed files and an edge to job-registry (roster.ts), and the disguised assassin's side was unspecified. Fix: files and edge added; contract says it starts as `Side.Ward` and turns `Side.Monster` with `Hunt.Assassin`.
7. The registries were hot files. Fix: job-registry pre-registers the four jobs with placeholder modules and fixed branch file and export names, so job nodes never edit a registry.
8. Branch nodes did not need a `hard` edge on their job node once placeholders exist. Fix: they depend on the job-def contract, except sellsword-coin (bonus ranks) and arcanist-weave (friendlyFire), which keep `hard` with a reason.

## Rejected

- Pre-adding Blind and Marked statuses in an early node to avoid sharing `statuses.ts`: the file is a list of independent consts, so appends merge cleanly. Not worth an extra node.
