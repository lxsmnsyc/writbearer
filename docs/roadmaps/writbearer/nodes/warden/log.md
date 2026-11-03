# Log: warden

- Spells, innate and statuses all live in src/content/jobs/warden/index.ts (the brief owns only that file). Exported for the upgrade node: COVER, EXECUTE, TRIPWIRE, PURSUE, INTERPOSE, MARKED, COVERING, isMarked, trippedFor.
- A status def has a fixed slow, so Tripwire's 30 + 2r% slow is ten defs (trippedFor). Its setup marks the victim, so no change to trap.ts or sim.ts was needed.
- Interpose marks any enemy that damages the bearer, even when the Warden is far; the redirect needs the Warden within 2 tiles. Redirect is True damage with the Redirected flag, as Shared Burden does.
- Cover is a status on the Warden whose CheckProjectile listener stops shots from the Warden's side of the bearer. It needs a ranged enemy aimed at the bearer.
- Look: hood and lantern attachments that already exist in sprites.ts. No sprites.ts edit.
- Left to warden-upgrades: Living Shield, Tether, Retaliate, Blood Debt, Hangman's Reach, Last Rites, Sentry, Trap Field, Never Surprised, Marked for Death, Debt Collector, Read the Room.
