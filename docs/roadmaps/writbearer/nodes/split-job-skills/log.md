# Log: split-job-skills

- Baseline: skills.ts 762 lines, passives.ts 130 lines. Work did not exist.
- Moved code by line ranges with a script, then fixed imports. Code moved as is.
- Lint forced two small changes: `listen` became the default export of passives.ts (prefer-default-export), and moved blocks sit before each job module's older code (no-use-before-define).
- Fast check and build pass.
