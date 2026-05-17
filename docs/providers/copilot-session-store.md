# Provider: copilot-session-store

GitHub Copilot CLI session metadata read from a local SQLite database
(`~/.copilot/session-store.db`).

- **Source file:** `src/providers/copilot-session-store.ts`
- **Loading:** read-only via the `sqlite3` CLI (no native binding required)
- **Test:** `test/local-datastore.test.ts` (`describeIfSqlite` block)

## Where it reads from

A single SQLite table:

- `sessions` — one row per Copilot CLI session, with `id`, `cwd`,
  `repository`, `host_type`, `branch`, `created_at`, `updated_at`.

Default DB path is `~/.copilot/session-store.db`; override with `--db-path`.

## Storage format

SQLite database file. This provider **never** writes to it. We only
`SELECT` the columns above; everything else in the file is ignored.

## Output

This provider does not emit events directly — it only returns the session
row inventory used by the `copilot-events-jsonl` provider to locate
`session-state/<id>/events.jsonl` files. This split is deliberate: it
keeps the SQLite parser entirely free of event-shape concerns and lets
us add alternative session-discovery sources later (e.g. a future Copilot
manifest file) without touching the events parser.

## Dependencies

- The `sqlite3` CLI must be on `PATH`. We invoke it with `-json` so no
  native binding is needed; this keeps installs lightweight on Windows
  and avoids node-gyp pain in CI.

## When fixing a bug here

1. If columns change, update both `CopilotSessionRow` and the `SELECT`
   in `readCopilotSessionRows`. Do not start projecting extra columns
   without a corresponding need in `copilot-events-jsonl`.
2. Filtering by `--ids` uses single-quoted SQL escaping via `sqlEscape`.
   If you add new string parameters, route them through `sqlEscape` —
   do not interpolate raw user input.
3. Sort order is `updated_at DESC`. Downstream consumers should not
   depend on this; it is purely so the most recent sessions stream
   into the JSONL first.
