# Provider: vscode-chat-debug

VS Code GitHub Copilot Chat debug logs, written by the
`GitHub.copilot-chat` extension into VS Code's `logs/` and
`User/workspaceStorage/` directories.

- **Source file:** `src/providers/vscode-chat-debug.ts`
- **Loading:** read-only file I/O; recursive directory walk capped at depth 6
- **Test:** `test/local-datastore.test.ts` (VS Code blocks)

## Where it reads from

Two roots per VS Code variant (`Code`, `Code - Insiders`), per platform:

### macOS
- `~/Library/Application Support/Code/logs/`
- `~/Library/Application Support/Code/User/workspaceStorage/`

### Linux
- `~/.config/Code/logs/`
- `~/.config/Code/User/workspaceStorage/`
- `~/.vscode-server/data/logs/`

### Windows
- `%APPDATA%/Code/logs/`
- `%APPDATA%/Code/User/workspaceStorage/`

`Code - Insiders` equivalents are included automatically.

Override the auto-discovery set entirely with
`VISUALIZER_VSCODE_DEBUG_ROOTS` (colon-separated on POSIX,
semicolon-separated on Windows). Explicit `--vscode-chat-debug-path`
arguments are always honored regardless of `--include-vscode-chat-debug`.

## Storage format

Plain-text log lines, one event per line, of the shape

```
[2026-05-12 05:40:00.000] [debug] Chat request started ...
```

Files are discovered by name pattern: `*.log` or `*.jsonl` whose
basename or path contains `github copilot chat`, `copilot chat`, or
`github.copilot-chat`.

## Output

Every line becomes one `sourceEvent` envelope with:

- `source: "vscode"`, `sourceVersion: "copilot-chat-debug-log-v1"`
- `sessionId: "vscode-copilot-chat-<8-hex>"` derived deterministically
  from `machineId + logPath` so re-imports from the same file land on
  the same synthetic session.
- `facets.debugEvents` populated from the level + message.
- No token counts (debug logs do not contain them). Cost enrichment
  (Phase 3) will skip these events.

## Quirks

- VS Code log timestamps do not include a timezone; we treat them as
  UTC. If you see drift, it is almost certainly this.
- Files with no recognizable timestamp prefix fall back to `ctx.now()`,
  marked `confidence: "inferred"` at the envelope level.
- The same workspace can appear under multiple `workspaceStorage`
  hashes if VS Code regenerates them; each becomes a distinct
  synthetic session. This is by design — we never speculatively
  merge across path hashes.

## When fixing a bug here

1. Add a fixture with the exact log line that reproduces the bug to
   the relevant VS Code block in `test/local-datastore.test.ts`.
2. If the time-zone assumption changes, change it in
   `parseVscodeChatDebugLine` only — do not touch the orchestrator.
3. Discovery depth is capped at 6 to prevent runaway walks on
   misconfigured `workspaceStorage` trees. Raise only with a real
   reproduction.
