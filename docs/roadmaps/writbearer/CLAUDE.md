# Roadmap: writbearer

This folder is a parallel roadmap. `GOAL.md` has the outcome. Each node is a folder under `nodes/`. Nodes with `outline: true` are not ready to build; never start one, refine it into briefs first.

Rules for agents working on a node:

- Work only on your own node. Edit files inside your brief's owned paths and your own `nodes/<id>/` folder.
- Files under `shared:` in your brief are edited by other nodes too. Only append there (a new status, event or enum member), never reorder or rewrite.
- Do not edit other briefs, `status` fields, contracts or `GOAL.md`. The orchestrator owns them.
- If a contract is wrong, write `contracts/<name>.change-request.md` and adapt locally. Do not edit the contract.
- A job node never edits `src/content/items.ts`, `roster.ts`, `trees.ts`, `recruits.ts`, `src/ui/icons.ts` or `src/render/rig.ts` directly. Everything a job needs goes in its own module through the job-def contract.
- Follow the code style of `src/content/vanguard.ts`: one exported const per skill, a short comment on what it does, numbers as first guesses.
- Keep notes in your `log.md`. Finish by writing `outcome.md` from the template.
- Read the outcomes of your direct dependencies. Do not read other nodes' logs.
- The repo is public and no workflow runs the checks. Run them locally before opening a pull request.
- Add a changeset (`pnpm cs:add`) when your node changes the game: `patch` for changed behavior, `minor` for something new. Never `major`.
- A job node attaches to the engine through the job-hooks contract and does not edit core simulation files.

Script: `python3 ~/.claude/plugins/cache/lxsmnsyc-agent-skills/agent-skills/0.7.0/skills/parallel-roadmap/scripts/plan.py docs/roadmaps/writbearer context <id>` lists the files to load for a node.
