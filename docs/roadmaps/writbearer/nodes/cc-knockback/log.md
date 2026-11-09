# Log: cc-knockback

- Added `src/sim/knockback.ts`, `src/sim/events/cc-knockback.ts`, `CheckKnockback` in events.ts.
- Charge uses `knockback` with a `from` point one unit behind the target along the push direction.
- Immovable listens on CheckKnockback and blocks any `flees` status.
