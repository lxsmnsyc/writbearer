# Log: be-kidnappers

- Checked: no kidnappers test existed, nothing built.
- `grab.ts`: hold pair in two WeakMaps, a `HELD` status (disables) on the victim, a sim listener for UnitDies and StatusApplied (disable, flee, root) on the captor. The status tick lets go if the captor is gone or the area changed.
- `ai/kidnapper.ts`: step inserted after `lureStep`. Exits come from `sim.pocket.exits()` (set by `watchTheft`), else the farthest corner.
- `Template.kidnapper` flag, `kidnapperFlag` appended to `SPAWN_STEPS`.
- Test rig note: a bearer next to the wards gets fought as a blocker in the lane, so the rig keeps them apart.
