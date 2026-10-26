---
id: cc-cast-events
title: Cast events, interrupts and silence
status: todo
priority: should
type: feature
outline: true
milestone: combat-core
size: L
depends_on:
  - on: roster-balance
    kind: hard
    why: edits the sim core (statuses, unit, ai, sim, damage) that the starting-jobs nodes are changing; start once they have merged
---

# Cast events, interrupts and silence

## Goal

Add the missing skill events (CheckCastTime, CheckCastAllowed, UnitSkillHit, UnitSkillRecovery, UnitTriggerSkill), cast time reduced by DEX and items, interrupt and stagger rules (melee hits break casts, big hits break magic), and a Silence status.

## Context

- Source: `docs/design/03-combat-engine.md#skill-lifecycle, #physical-and-magical-rules, #status-effects`
- Items: `../../COVERAGE.md`, entries with target `cc-cast-events`.
