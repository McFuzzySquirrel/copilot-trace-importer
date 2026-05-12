# copilot-trace-importer

**Import GitHub Copilot session events from local SQLite databases, JSONL files, and VS Code debug logs into a normalized, redacted local datastore.**

Transform Copilot telemetry into actionable insights: track token usage across sessions, analyze model invocation patterns, understand tool adoption, and prepare data for enterprise analytics—all with privacy-first redaction and offline-first design.

**Status:** v0.1.0 (Beta) | **License:** MIT | **Node.js:** ≥22

---

## Overview

### Why This Exists

Copilot already records session data locally. This tool imports it *without* hook bootstrap, service dependencies, or repository modifications:

- `~/.copilot/session-store.db` — session metadata (SQLite)
- `~/.copilot/session-state/<session-id>/events.jsonl` — event stream (JSONL)
- VS Code GitHub Copilot Chat debug logs — IDE session telemetry

### What You Get

- ✅ **Append-only normalized datastore** — JSONL format, immutable history, no external DB required
- ✅ **Rich metadata & facets** — Models, tokens, tools, files, agents, errors, debug signals
- ✅ **Redaction by default** — Credentials, API keys, tokens, passwords stripped automatically
- ✅ **Multi-machine & multi-session support** — Track usage across devices; tag with machine and user IDs
- ✅ **CLI + Programmatic API** — Both command-line and npm library interfaces
- ✅ **Cross-platform** — Works on macOS (Intel + Apple Silicon), Linux, Windows

### Roadmap

See [PRD.md](PRD.md) for the complete product vision. Next phases:

| Phase | Focus | Target |
|-------|-------|--------|
| **v0.1** (current) | CLI import/summary, local analysis | ✅ Done |
| **v0.5** | Real-time streaming, backend API, web UI prototype | H2 2026 |
| **v0.7** | Azure integration (Cosmos/SQL/Fabric), enterprise deployment | H2 2026 |
| **v0.9** | Alerts, research plugins, team features | 2026 |
| **v1.0** | Stable API, GDPR/SOC2 compliance, production ready | 2026 |

## Installation

```bash
# Clone and run locally
git clone https://github.com/McFuzzySquirrel/copilot-trace-importer.git
cd copilot-trace-importer
npm install
npm run datastore:import -- --db-path ~/.copilot/session-store.db --datastore ./datastore/events.jsonl
```

Or install globally from npm (once available):

```bash
npm install -g copilot-trace-importer
copilot-trace-importer import --db-path ~/.copilot/session-store.db --datastore ./datastore/events.jsonl
```

### Prerequisites

- **Node.js 22+** (LTS or later)
- **sqlite3 CLI** (for SQLite imports)
  - macOS: `brew install sqlite3`
  - Linux: `apt install sqlite3` (Debian/Ubuntu) or `yum install sqlite` (RHEL)
  - Windows: `choco install sqlite` or download from [sqlite.org](https://sqlite.org/download.html)

---

## Quick Start

### 1. Import Your Copilot Sessions

**Basic import** (session-store.db + VS Code logs):

```bash
npm run datastore:import -- \
  --db-path ~/.copilot/session-store.db \
  --datastore ./datastore/events.jsonl \
  --machine-id "$(hostname)"
```

**Include VS Code Copilot Chat debug logs:**

```bash
npm run datastore:import -- \
  --db-path ~/.copilot/session-store.db \
  --datastore ./datastore/events.jsonl \
  --machine-id "$(hostname)" \
  --include-vscode-chat-debug
```

**IDE-only import** (skip Copilot CLI session store):

```bash
npm run datastore:import -- \
  --no-session-store \
  --vscode-chat-debug-path ~/.config/Code/User/workspaceStorage \
  --datastore ./datastore/events.jsonl \
  --machine-id "$(hostname)"
```

**Import specific sessions only:**

```bash
npm run datastore:import -- \
  --db-path ~/.copilot/session-store.db \
  --datastore ./datastore/events.jsonl \
  --ids session-1,session-2,session-3 \
  --machine-id "$(hostname)"
```

**Store raw payloads** (still redacted; useful for debugging):

```bash
npm run datastore:import -- \
  --db-path ~/.copilot/session-store.db \
  --datastore ./datastore/events.jsonl \
  --include-raw-payload
```

### 2. Inspect Your Data

**Quick summary:**

```bash
npm run datastore:summary -- --datastore ./datastore/events.jsonl
```

**Detailed summary** (with VS Code path breakdown and top source paths):

```bash
npm run datastore:summary -- \
  --datastore ./datastore/events.jsonl \
  --verbose
```

**Example output:**

```json
{
  "datastorePath": "./datastore/events.jsonl",
  "eventCount": 1247,
  "sessionCount": 3,
  "machineCount": 1,
  "sourceCount": 2,
  "sessions": ["session-1", "session-2", "session-3"],
  "machines": ["my-laptop"],
  "sources": ["copilot-session-store", "vscode"],
  "earliestTimestamp": "2026-05-01T08:00:00.000Z",
  "latestTimestamp": "2026-05-13T17:45:00.000Z",
  "sourceEventCounts": {
    "assistant.message": 234,
    "tool.execution_complete": 456,
    "notification": 123,
    "...": "..."
  }
}
```

## CLI Reference

### `import` Command

Imports session events from local sources; appends to JSONL datastore.

**Usage:**
```bash
npm run datastore:import -- [options]
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--db-path <path>` | string | `~/.copilot/session-store.db` | Path to Copilot session store (SQLite) |
| `--datastore <path>` | string | `./datastore/events.jsonl` | Output JSONL datastore path |
| `--ids <csv>` | string | (none) | Comma-separated session IDs to import (optional filter) |
| `--machine-id <id>` | string | hostname | Machine identifier for multi-machine tracking |
| `--user-id <id>` | string | (none) | User identifier (optional) |
| `--include-raw-payload` | flag | false | Store redacted raw payloads alongside normalized events |
| `--no-session-store` | flag | false | Skip session-store.db; IDE-only import |
| `--include-vscode-chat-debug` | flag | false | Discover and import VS Code Copilot Chat debug logs from default locations |
| `--vscode-chat-debug-path <path>` | string | (none) | Specific VS Code debug log path or directory to import |
| `--no-redact` | flag | false | ⚠️ Disable redaction (not recommended; for testing only) |

### `summary` Command

Summarizes datastore: event counts, date range, session/machine inventory, source counts.

**Usage:**
```bash
npm run datastore:summary -- [options]
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--datastore <path>` | string | `./datastore/events.jsonl` | JSONL datastore path to summarize |
| `--verbose` | flag | false | Include VS Code path breakdown and top source paths by event volume |

---

## Privacy & Redaction

**Redaction is enabled by default.** All sensitive data is stripped before persistence:

- ✅ GitHub tokens (personal access tokens, fine-grained tokens)
- ✅ API keys (OpenAI, AWS, generic `key=value` patterns)
- ✅ Slack tokens
- ✅ AWS credentials (AKIA... format)
- ✅ Passwords and secrets (generic patterns)
- ✅ URLs with embedded credentials (e.g., `https://user:pass@host`)

**See:** [src/redaction/patterns.ts](src/redaction/patterns.ts) for the complete pattern list.

### Opt-In Raw Payloads

To store *redacted* raw event payloads for debugging:

```bash
npm run datastore:import -- \
  --datastore ./datastore/events.jsonl \
  --include-raw-payload
```

Raw payloads are **still redacted** and marked as `opt-in` in the event metadata. Each event includes a `privacy` field:

```json
{
  "privacy": {
    "classification": "internal",
    "locallyRedacted": true,
    "rawPayloadOptIn": true,
    "retention": "standard"
  }
}
```

### Future: Configurable Policies (Roadmap)

In v0.5+, redaction will be configurable by policy (strict/moderate/permissive). See [PRD.md §10](PRD.md#10-security-and-privacy).

---

## Datastore Format

### Schema Overview

Each line in the JSONL datastore is a normalized event:

```json
{
  "envelope": {
    "timestamp": "2026-05-13T14:30:00.000Z",
    "source": "copilot-session-store",
    "sourceVersion": "1.0",
    "sessionId": "sess-abc123",
    "machineId": "my-laptop",
    "userId": "me",
    "interactionId": "turn-1",
    "schemaVersion": "1.0.0"
  },
  "facets": {
    "modelUsage": {
      "model": "gpt-4-turbo",
      "inputTokens": 250,
      "outputTokens": 150,
      "totalTokens": 400,
      "confidence": "exact"
    },
    "toolCalls": [
      {
        "toolName": "subagent",
        "toolCallId": "tc-1",
        "category": "agent_delegation",
        "status": "success",
        "confidence": "exact"
      }
    ],
    "tokens": {
      "inputTokens": 250,
      "outputTokens": 150,
      "totalTokens": 400,
      "confidence": "exact"
    },
    "filesTouched": [
      {
        "path": "src/handler.ts",
        "action": "read",
        "confidence": "inferred"
      }
    ],
    "agentActivity": {
      "agentName": "qa-engineer",
      "agentType": "copilot-agent",
      "action": "started",
      "confidence": "inferred"
    },
    "debugEvent": null,
    "errors": null
  },
  "privacy": {
    "classification": "internal",
    "locallyRedacted": true,
    "rawPayloadOptIn": false,
    "retention": "standard"
  },
  "payload": {
    "type": "assistant.message",
    "data": {
      "interactionId": "turn-1",
      "model": "gpt-4-turbo",
      "inputTokens": 250,
      "outputTokens": 150,
      "toolRequests": [
        {
          "name": "subagent",
          "toolCallId": "tc-1",
          "intentionSummary": "qa-engineer",
          "arguments": {
            "agentName": "qa-engineer",
            "task": "test implementation"
          }
        }
      ]
    }
  }
}
```

### Querying the Datastore

The JSONL format is queryable with standard tools:

```bash
# Count total events
wc -l datastore/events.jsonl

# Filter by source
grep '"source".*"vscode"' datastore/events.jsonl | wc -l

# Extract model names (jq)
cat datastore/events.jsonl | jq -r '.facets.modelUsage.model' | sort | uniq -c

# Filter by date range
cat datastore/events.jsonl | jq 'select(.envelope.timestamp > "2026-05-10")' | wc -l

# Load into DuckDB for SQL
duckdb -c "SELECT COUNT(*), facets->>'modelUsage'->>'model' as model FROM read_ndjson('datastore/events.jsonl') GROUP BY model;"
```

---

## Architecture

---

## Architecture

### Import Flow

```
Sources (Local)
  ├─ SQLite: ~/.copilot/session-store.db
  ├─ JSONL: ~/.copilot/session-state/<id>/events.jsonl
  └─ VS Code: logs/, User/workspaceStorage/

        ↓ (CLI or Programmatic API)

Schema Validation (Zod)
  ├─ Parse event type
  ├─ Validate payload structure
  └─ Extract facets (tokens, tools, models, agents)

        ↓

Redaction (Policy-Based)
  ├─ Apply regex patterns (credentials, tokens, secrets)
  ├─ Mark as redacted in privacy metadata
  └─ Optionally store raw payloads (still redacted)

        ↓

Datastore (Append-Only JSONL)
  └─ ./datastore/events.jsonl (immutable, queryable)
```

### Key Design Decisions

See [docs/ADR-001-append-only-jsonl.md](docs/ADR-001-append-only-jsonl.md) for architectural decisions and rationale.

**Highlights:**
- **Append-only immutability**: Full history preserved; no external DB required during collection
- **Schema versioning**: Zod validation at import time; forward/backward compatibility checks
- **Privacy-first defaults**: Redaction applied before persistence; no sensitive data in logs
- **Facet extraction**: Rich metadata (tokens, tools, models) for multi-dimensional analysis
- **Cross-platform**: Handles Windows, macOS, Linux path differences transparently
- **Offline-capable**: Works entirely locally; optional streaming to cloud later (v0.5+)

---

## Programmatic API

Use the npm library directly:

```typescript
import { 
  importCopilotSessionStore, 
  summarizeDatastore 
} from "copilot-trace-importer";

// Import sessions
const importResult = await importCopilotSessionStore({
  dbPath: "~/.copilot/session-store.db",
  datastorePath: "./datastore/events.jsonl",
  machineId: "my-machine",
  userId: "me",
  includeRawPayload: false,
  redact: true,
  includeSessionStore: true,
  includeDefaultVscodeChatDebug: true
});

console.log(`Imported ${importResult.importedEvents} events from ${importResult.sessions.length} sessions`);

// Summarize
const summary = await summarizeDatastore(
  "./datastore/events.jsonl",
  { verbose: true }
);

console.log(`Datastore contains ${summary.eventCount} events from ${summary.sessionCount} sessions`);
console.log(`Token usage: ${summary.sourceEventCounts["assistant.message"]?.tokens || 0} total`);
```

**See:** [src/index.ts](src/index.ts) for full API types.

---

## Multi-Machine Setup

To analyze Copilot usage across multiple devices:

1. **On each machine**, run import with a stable `--machine-id`:

   ```bash
   # On laptop
   npm run datastore:import -- \
     --db-path ~/.copilot/session-store.db \
     --datastore ~/copilot-data/laptop.jsonl \
     --machine-id "laptop-$(hostname)"

   # On desktop
   npm run datastore:import -- \
     --db-path ~/.copilot/session-store.db \
     --datastore ~/copilot-data/desktop.jsonl \
     --machine-id "desktop-$(hostname)"
   ```

2. **Concatenate** local datastores for aggregate analysis:

   ```bash
   cat ~/copilot-data/*.jsonl > ~/copilot-data/combined.jsonl
   npm run datastore:summary -- --datastore ~/copilot-data/combined.jsonl --verbose
   ```

Each event includes `machineId` and `sessionId`, so you can pivot by device or session.

---

## Development

### Setup

```bash
npm install
npm run typecheck  # TypeScript validation
npm test           # Run test suite (Vitest)
npm run test:watch # Watch mode
```

### Testing

```bash
# Full test suite (unit + integration)
npm test

# Watch mode (recommended for development)
npm run test:watch

# Coverage report
npm test -- --coverage
```

**Coverage requirement:** ≥70% across all modules. [Coverage report](coverage/lcov-report/index.html) generated after each test run.

### Project Structure

```
src/
├── index.ts              # Core: import & summary logic
├── redaction/
│   ├── index.ts          # Redaction engine
│   ├── patterns.ts       # Sensitive data patterns (regex)
│   ├── retention.ts      # Data retention policies
│   └── export-config.ts  # Policy configuration
└── schema/
    ├── index.ts          # Schema validation (Zod)
    └── schema.ts         # Type definitions (EVENT_TYPES, facets, etc.)

bin/
└── ingest.ts             # CLI entry point

test/
└── local-datastore.test.ts  # Integration tests (SQLite import, summary)

docs/
└── ADR-*.md              # Architecture Decision Records
```

### Building

```bash
# Compile TypeScript
npm run build

# Generates: dist/src/, dist/bin/

# Global install from local build
npm link
copilot-trace-importer import --help
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Write tests for new functionality
4. Ensure tests pass and coverage ≥70% (`npm test`)
5. Commit with descriptive messages (`git commit -am 'feat: add XYZ'`)
6. Push and open a pull request

**Code style:** TypeScript with strict mode; no `implicit any`. Use `npm run typecheck` before committing.

---

## Troubleshooting

### SQLite CLI Not Found

**Error:** `Error: ENOENT: no such file or directory, spawn 'sqlite3'`

**Solution:**
- macOS: `brew install sqlite3`
- Linux: `apt install sqlite3` (Debian/Ubuntu) or `yum install sqlite` (RHEL)
- Windows: `choco install sqlite`

### No Events Imported

**Possible causes:**
- Session store doesn't exist: `ls ~/.copilot/session-store.db`
- No sessions yet: Run Copilot for a few minutes first
- Wrong path: Check `--db-path` argument

**Debug:**
```bash
# Check if session store exists
file ~/.copilot/session-store.db

# Query sessions directly
sqlite3 ~/.copilot/session-store.db "SELECT COUNT(*) FROM sessions;"
```

### Windows Path Issues

**Symptom:** Import fails or paths don't match expected format

**Solution:** Use double quotes and backslashes (or forward slashes):

```bash
npm run datastore:import -- ^
  --db-path "C:\Users\YourName\.copilot\session-store.db" ^
  --datastore "./datastore/events.jsonl"
```

Or use PowerShell (which handles paths better):

```powershell
npm run datastore:import -- `
  --db-path "$env:USERPROFILE\.copilot\session-store.db" `
  --datastore "./datastore/events.jsonl"
```

---

## Resources

- **[PRD.md](PRD.md)** — Complete product vision, roadmap, requirements
- **[docs/ADR-001-append-only-jsonl.md](docs/ADR-001-append-only-jsonl.md)** — Architecture decision record
- **[src/schema/schema.ts](src/schema/schema.ts)** — Full type definitions and schema
- **[src/redaction/patterns.ts](src/redaction/patterns.ts)** — Redaction patterns reference

## License

MIT
