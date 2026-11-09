# Batch 1 checkpoint (2026-11-09)

Two groups of six nodes ran on `batch/writbearer`, each with a worker, a review and the fast check before landing.

- Group 1, cut as PR #36 (open, waits for the maintainer because it freezes `contracts/terrain.md` v2): gs-terrain-kinds, cc-buffs, cc-afflictions, cc-resource, cc-sight-still, cc-el-spectral.
- Group 2, landed on the local batch only, not pushed: gs-terrain-landmarks, cc-knockback, bp-link, cc-side-switch, gs-terrain-hazards, ie-item-roll.
- Full check on the batch merged with origin/main after group 2: lint, `pnpm test` (911 passed), `pnpm test:e2e` (25 passed).

Next:
- Push group 2 after PR #36 merges, so it opens as its own cut. The PR head is `batch/writbearer`, so pushing earlier adds group 2 to PR #36.
- Group 3 from the measured batch: cc-el-field, cc-el-chain, cc-el-overshield, cc-el-skill-amp, second-wind-area (its verify already passes, check before building), doc16-sync, layer-map-snapshot, test-nits. Then bp-ground, cc-ground-zones and ie-item-carry, which wait on files group 1 and 2 changed. gs-terrain-patrols comes last.

Open questions for the maintainer:
- Merc sight: the brief says 4.5, the code gives every unit 7.
- Spectral against Neutral: the brief says 100%, `src/sim/elements.ts` has 90%.

Lessons:
- `src/sim/events.ts` conflicts on every parallel node that adds events. The conflict is a two-sided append each time and takes a minute by hand.
- Playwright 1.63 needs headless shell build 1243; it was missing from the cache and broke e2e everywhere until installed.
- Plain `pnpm lint` fails under the rtk hook ("JSON parse failed"); use `rtk proxy pnpm lint`.
- Full test runs time out under load (spawn, concealment, boss tests); a rerun passes.
- Fresh reviews found a real gap in 3 of 10 reviewed nodes (gs-terrain-kinds skipped the reserved kinds, cc-resource's panel went stale, ie-item-roll's hook skipped chests and rewards).
