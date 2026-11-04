# Log: split-unit

- Moved Unit logic into six modules under src/sim/unit/, with delegates in unit.ts. Made route, cardEffects and buildupAt public. Added RECALC_SOURCES in gear.ts.
- Fast check passes. One flaky hit-rate test failed once under load, passed on re-run.
