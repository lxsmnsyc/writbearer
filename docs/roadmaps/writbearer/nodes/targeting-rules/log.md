# Log: targeting-rules

- Branch was behind 8e7cdd8; reset to it. Verify command and criteria were not met (no targeting.ts), so built the node.
- Format with oxfmt; prettier rewrote whole files by mistake and was undone.
- The hostile test is `forbidden(from, target)` in ai.ts: the target is in sim.foes(side) and canTarget is false. Allies are never asked, so `aim()` of heals and buffs is untouched.
- A taunt from a forbidden unit is treated as no taunt (the TAUNTED status stays; the monster ignores it).
- A forbidden current target is cleared in `think()`, except for the bearer.
- Straight shots ask canTarget per unit inside the hit radius; volley extras use `allowed()`. The first homing target is the shooter's own pick, not re-checked at release.
- Not filtered, by contract: area skills in src/content that scan `sim.living(Side.Monster)` themselves.
