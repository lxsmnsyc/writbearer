# Sim events

`src/sim/events.ts` holds the `SimEvents` const enum and `SimEventMap`, and re-exports every payload type from the group modules here. Importers keep importing from `src/sim/events`.

## Add an event

1. Add one line to `SimEvents` in `src/sim/events.ts`.
2. In a module here, add the payload interface and an entry `[SimEvents.Name]: [PayloadEvent, Priority]` in that module's `<Group>EventMap`. Reuse a group (`hits`, `skills`, `statuses`, `life`) when the event fits. Otherwise add a module named for the feature, with its own `<Group>EventMap`.
3. For a new module, add `export type * from './events/<module>'` and the map type import to `events.ts`, and append the map name to the `extends` list of `SimEventMap`.
4. Group modules import `SimEvents` with `import type` from `../events`. Never move the enum into a group module (a const enum cannot be split).
5. Only append; do not reorder or rewrite existing lines.
