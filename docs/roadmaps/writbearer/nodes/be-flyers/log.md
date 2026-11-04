# Log: be-flyers

- Read brief and deps. Nothing existed yet (no flight state, no flyer step).
- Flight state is a WeakMap in `src/sim/flight.ts`, time based (`until`), so no tick hook and no `Unit` field.
- Melee rule keys on `job.range === Range.Melee` because CheckTarget carries no skill.
- Rendering: `drawLifted` wraps `drawFigure` from `standing.ts`; no new figure.
- Killshot: doc 09 line 193 gives no flyer clause. Left as is.
- Full check passes (73 files, 711 tests).
