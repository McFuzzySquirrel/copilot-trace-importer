import { spawnSync } from "node:child_process";

/**
 * Row shape returned from `~/.copilot/session-store.db#sessions`.
 *
 * NOTE: this provider is intentionally read-only; we never write to the
 * Copilot session store. See ADR-002 (Provider isolation) for why session
 * metadata lives in its own provider distinct from the per-session event
 * stream provider (`copilot-events-jsonl`).
 */
export interface CopilotSessionRow {
  id: string;
  cwd: string | null;
  repository: string | null;
  host_type: string | null;
  branch: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CopilotSessionStoreOptions {
  dbPath: string;
  sessionIds?: string[];
}

function sqlEscape(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function runSqlJson<T>(dbPath: string, sql: string): T[] {
  const result = spawnSync("sqlite3", [dbPath, "-json", sql], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `sqlite3 failed with exit code ${result.status ?? "unknown"}`);
  }
  const stdout = (result.stdout || "").trim();
  if (!stdout) {
    return [];
  }
  return JSON.parse(stdout) as T[];
}

/**
 * Read session rows from a local Copilot session-store SQLite database.
 *
 * Returns rows newest-first (by `updated_at`) so the orchestrator processes
 * the most recently active sessions first. When `sessionIds` is provided,
 * the query is filtered to that subset for deterministic re-imports.
 */
export function readCopilotSessionRows(options: CopilotSessionStoreOptions): CopilotSessionRow[] {
  const { dbPath, sessionIds } = options;
  const where = sessionIds && sessionIds.length > 0
    ? `WHERE id IN (${sessionIds.map(sqlEscape).join(", ")})`
    : "";
  return runSqlJson<CopilotSessionRow>(
    dbPath,
    `SELECT id, cwd, repository, host_type, branch, created_at, updated_at
     FROM sessions
     ${where}
     ORDER BY updated_at DESC`
  );
}
