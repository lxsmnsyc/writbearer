# Log: cleric-upgrades

- Spells already sit at doc 16's per-rank numbers (Ward 8, Sacred Ground 2.5, Smite 10); only Heal stays at 20 a rank (comment in cleric.ts: at 10 the layer-1 boss test fails). Left as is.
- Old tree skills (Renew, Cleanse, Resurrection, Wall of Faith, Veil, Consecrate, Turn Undead and the passives) moved out of cleric.ts into jobs/cleric/upgrades.ts as patches/effects. Their ranks now follow the base spell, halved where doc 16 says (0.5r, 2r, 5r, 3r).
- `after` takes the Cleric and goes through hostiles(); Ward, Wall of Faith and Twin Ward read it.
- recruits.test.ts lost its three Cleric cases for the old skills (renew, cleanse, raise); cleric-upgrades.test.ts covers them.
- Fast check passes: typecheck, lint, 67 files / 624 tests.
- Review fixes: Duel test now puts both enemies on the ground and silences all other damage (fails without the hostiles filter); Holy Light spread honors event.disabled; Sear rules and a real-cast Resurrection test added.
