# Game layer rules

- A unit can leave a fight without `UnitDies` (a bribed unit is set `alive = false` and removed from `sim.units`), so code that reacts to units leaving checks `alive` instead of listening for deaths.
- Draws that must give the same result after a load use `g.streams.area(...)` with an id offset, not a stateful stream, because an area stream needs no saved state.
