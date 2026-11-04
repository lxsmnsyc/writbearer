---
id: cc-tuning
title: Final numbers
status: todo
priority: could
type: feature
outline: true
milestone: combat-core
size: M
depends_on: []
---

# Final numbers

## Goal

Settle the element table, Discipline thresholds and refine rates with balance tests, and fix the card drop rate mismatch (3% in code, 5% in docs).

## Context

- Source: `docs/design/08-open-questions.md#still-open`
- Items: `../../COVERAGE.md`, entries with target `cc-tuning`.
- From roster-balance (outcome, boss numbers): Cleric parties with the Sellsword or the Duelist win the layer-1 boss 5 and 7 of 24 seeds; Warden, Ranger, Cleric win layer 3 17 of 24; Warden, Duelist, Arcanist sit at the limit (5 / 5 / 6 of 6); the Ranger's spell impact is x1.54 against a limit of 1.5. The 1.5x impact limit for Ranger and Arcanist stays (designer, wave 2).
- Heal, Crush, Charged Arrow, Interpose and the Storm chain keep the game's numbers over doc 16's (designer, wave 2); doc16-sync writes them into doc 16. Start from those.
- The inbox has the Creditor-raised Ranger whose chain hits its own side; fix it with a Creditor retune here.
