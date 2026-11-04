# Log: split-ai

- Split ai.ts into orders, merc, monster, ward, dodge, think, plus common (nearest, engage, flee) to avoid a merc/monster import cycle.
- thinkMonster now runs MONSTER_STEPS in today's order; the last step (pursue) always handles the tick.
- concealment.test.ts timed out once at 5 s under machine load (load 18); passes alone in under 4 s.
