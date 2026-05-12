# copilot-trace-importer

Import GitHub Copilot session events from local SQLite databases, JSONL files, and VS Code debug logs into a normalized, redacted local datastore.

## Why This Exists

The local Copilot store already contains source data for sessions that have happened:

- `~/.copilot/session-store.db` — session metadata
- `~/.copilot/session-state/<session-id>/events.jsonl` — source events
- VS Code GitHub Copilot Chat debug logs under `logs/` and `User/workspaceStorage/**/GitHub.copilot-chat/**/` for IDE chat sessions

This tool imports that data directly. It does not require hook bootstrap, repository modification, a running service, or a browser.

## What You Get

- Append-only JSONL datastore of normalized `sourceEvent` records
- Multi-session and multi-machine metadata fields
- Redacted-by-default persistence (credentials, tokens, API keys stripped)
- Optional raw payload retention (still redacted, opt-in)
- Filtering-ready facets: models, tokens, tools, subagents, files, errors, debug signals
- Summary command for inspecting scope and provenance

## Installation

```bash
git clone https://github.com/McFuzzySquirrel/copilot-trace-importer.git
cd copilot-trace-importer
npm install
```

Or install globally from npm (once published):

```bash
npm install -g copilot-trace-importer
```

## Usage

### Import local Copilot session data

```bash
npm run datastore:import -- \
  --db-path ~/.copilot/session-store.db \
  --datastore ./datastore/events.jsonl \
  --machine-id "$(hostname)"
```

### Include VS Code Copilot Chat debug events

```bash
npm run datastore:import -- \
  --db-path ~/.copilot/session-store.db \
  --datastore ./datastore/events.jsonl \
  --include-vscode-chat-debug
```

### IDE-only import (skip Copilot CLI session store)

```bash
npm run datastore:import -- \
  --no-session-store \
  --vscode-chat-debug-path ~/.config/Code/User/workspaceStorage \
  --datastore ./datastore/events.jsonl
```

### Inspect the datastore summary

```bash
npm run datastore:summary -- --datastore ./datastore/events.jsonl
```

For provenance-oriented analysis with VS Code path-pattern breakdown and top source paths by event volume:

```bash
npm run datastore:summary -- \
  --datastore ./datastore/events.jsonl \
  --verbose
```

### Import selected sessions only

```bash
npm run datastore:import -- \
  --db-path ~/.copilot/session-store.db \
  --datastore ./datastore/events.jsonl \
  --ids <session-id-1,session-id-2> \
  --machine-id laptop-a
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--db-path <path>` | Path to local Copilot `session-store.db` |
| `--datastore <path>` | Append-only normalized event datastore JSONL path |
| `--ids <csv>` | Comma-separated session IDs to import |
| `--machine-id <id>` | Machine identifier for multi-machine records |
| `--user-id <id>` | User identifier for datastore records |
| `--include-raw-payload` | Store opt-in redacted raw source payload copies |
| `--include-vscode-chat-debug` | Import VS Code Copilot Chat debug logs from default `logs/` and `workspaceStorage` locations |
| `--vscode-chat-debug-path <path>` | Import a specific VS Code Copilot Chat debug log file or directory |
| `--verbose` | (summary) Include VS Code path-pattern breakdown and top source paths |
| `--no-session-store` | Skip `~/.copilot/session-store.db` for IDE-only imports |
| `--no-redact` | Disable local redaction (not recommended) |

## Privacy Defaults

Redaction is on by default. Sensitive strings (tokens, API keys, credentials, passwords) are stripped from all event payload fields before persistence.

To include source payload copies for debugging, opt in explicitly:

```bash
npm run datastore:import -- \
  --datastore ./datastore/events.jsonl \
  --include-raw-payload
```

The raw payload copy is still redacted and marked as opt-in in the event privacy metadata.

## Datastore Shape

Each line is one schema-compliant event envelope:

- `eventType`: `sourceEvent`
- `source`: `copilot-session-store` or `vscode`
- `sourceVersion`: adapter/source format label
- `sessionId`: Copilot session ID or stable VS Code Copilot Chat log identifier
- `machineId`: importer-provided or local hostname
- `payload.sourceEventType`: original source event type
- `payload.data`: flexible source event payload
- `facets`: normalized filtering fields

## Working Across Machines

Use a stable `--machine-id` for each device or runner. Each machine can import to its own JSONL file, then files can be concatenated into a shared local analysis folder — each record carries machine, session, source, and event identity metadata.

## Library API

The package also exposes a typed programmatic API:

```ts
import { importCopilotSessionStore, summarizeDatastore } from "copilot-trace-importer";

const result = await importCopilotSessionStore({
  dbPath: "~/.copilot/session-store.db",
  datastorePath: "./datastore/events.jsonl",
  machineId: "my-machine",
  userId: "me"
});

const summary = await summarizeDatastore("./datastore/events.jsonl", { verbose: true });
```

## Requirements

- Node.js ≥ 22
- `sqlite3` CLI (for session-store.db imports): `apt install sqlite3` / `brew install sqlite3`

## License

MIT
