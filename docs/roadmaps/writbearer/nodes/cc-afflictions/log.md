# Log: cc-afflictions

- WIL scaling for fear and a direct curse: time / (1 + wil * 3%), same 3% per point as the buildup thresholds.
- Dread immunity is read from `unit.immunity.get('dread')`; passives that block through CheckStatusDuration are covered by addStatus.
- `curse(source, target, power, direct=false)`: buildup by default; `direct` gives it at once with `power` as status power.
- dispel removes in Map insertion order (order given).
