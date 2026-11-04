# Log: be-strippers

- Based on main beb8e6e. State in `src/sim/strip.ts` (WeakMap on the sim); `markStripper` in `src/sim/ai/stripper.ts` listens to UnitDamage, so no AI step and no change to `monster.ts`.
- gear.ts: stripped items skipped in equipment modifiers, weapon pick and card effects; equip/unequip of a slot clears its strip (hand-back).
- areas.ts: `restoreAll` after `sim.area++`. sets.ts: `piecesOn` uses working items.
- No template flag added (Confessor node does that); no log UI change, the line goes through `sim.pocket.say`.
