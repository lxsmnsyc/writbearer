---
id: concealment-timeout
title: Concealment test that times out under load
status: active
priority: should
type: fix
outline: false
milestone: combat-core
target:
from:
size: S
spike: false
verify: pnpm test test/sim/concealment.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns:
  - test/sim/concealment.test.ts
shared: []
reserves: []
provides: []
depends_on: []
---

# Concealment test that times out under load

## Goal

`test/sim/concealment.test.ts` ("lands about one Escort in four") takes about 2.5 s alone and passes 5 s, the default vitest limit, whenever several test runs share the machine. It failed this way on four branches in wave 1 of 2026-11-05, and on unmodified main. Make it pass under load without weakening what it checks.

## Acceptance

- [ ] The test passes in a full `pnpm test` while another `pnpm test` runs at the same time.
- [ ] It still checks the same Escort rate with the same tolerance.

## Notes for the worker

- First try fewer simulated runs with the same statistical bound, or a cheaper setup per run. Raise the per-test timeout only if that fails, and say why in the outcome.
