# Premortem

It is some weeks from now and the starting jobs shipped late or broken. Why?

1. The job-def contract was frozen with a shape that does not fit the Arcanist or Duelist (job-only item bases, zones that need drawing, a second weapon). Every job node wrote change requests. Mitigation: job-registry is gated; its acceptance adds a throwaway fourth job in a test. At the gate, check the contract against the four trees in doc 09 before fanning out.
2. `src/sim/ai.ts` became a merge hotspot: targeting-rules, hidden-units, warden (Tether), sellsword-tricks (Play Dead) and arcanist-weave (new priority) all edit it. Mitigation: briefs ask for listeners and toggles over new branches; ai.ts is under `shared:` so the merge order is planned. If wave 3 shows conflicts, add a node that splits ai.ts into merc and monster modules.
3. Balance: the new jobs pass their unit tests but the party loses bosses, and roster-balance turns into a long tuning loop. Mitigation: roster-balance is gated and its outcome records each number changed. Accept the risk; numbers are first guesses by design.
4. Hidden units grew into a bestiary feature (stealth monsters, render work) and blocked the Warden's Watchman branch. Mitigation: hidden-units is limited to the disguised assassin in Escort; warden-watchman depends on it only as `behavior`, so it builds against the stub.
5. Agents edited `src/content/items.ts` and `roster.ts` anyway to add starter weapons, and the four job PRs conflicted. Mitigation: roadmap CLAUDE.md forbids it; the job-def contract has `bases` and `wields` so a job never needs to.

## Added for the whole-game roadmap

6. Outline nodes for later milestones were started on stale plans, or combat-core work collided with the starting-jobs edits to the sim core. Mitigation: outlines are never started (roadmap CLAUDE.md); `plan.py refine` lists them two waves ahead for the curator to break into briefs; the combat-core outlines that edit `statuses.ts`, `unit.ts`, `ai.ts` and `sim.ts` wait `hard` on roster-balance. Outlines with no tie to the jobs (be-boss-pool, gs-terrain) may use spare slots during starting-jobs.
