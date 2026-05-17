#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, basename, dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  importCopilotSessionStore,
  summarizeDatastore
} from "../src/index.js";

/**
 * Resolve and return the package version from package.json. Reads at call
 * time (not module load) so that test fixtures or future re-publishing
 * tooling can swap the manifest without bundler help.
 */
export function getVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // bin/ingest.ts → ../package.json from source; dist/bin/ingest.js → ../../package.json once built.
    const candidates = [
      join(here, "..", "package.json"),
      join(here, "..", "..", "package.json")
    ];
    for (const candidate of candidates) {
      try {
        const manifest = JSON.parse(readFileSync(candidate, "utf8")) as { version?: unknown };
        if (typeof manifest.version === "string" && manifest.version.length > 0) {
          return manifest.version;
        }
      } catch {
        // try next candidate
      }
    }
  } catch {
    // fall through to unknown
  }
  return "unknown";
}

interface Args {
  command: "import" | "summary";
  dbPath: string;
  datastorePath: string;
  ids: string[];
  machineId?: string;
  userId?: string;
  includeRawPayload: boolean;
  redact: boolean;
  includeSessionStore: boolean;
  includeDefaultVscodeChatDebug: boolean;
  vscodeChatDebugPaths: string[];
  verboseSummary: boolean;
}

function usage(): string {
  return [
    `copilot-trace-importer v${getVersion()}`,
    "",
    "Usage:",
    "  npm run datastore:import -- --db-path ~/.copilot/session-store.db --datastore ./datastore/events.jsonl",
    "  npm run datastore:summary -- --datastore ./datastore/events.jsonl",
    "  copilot-trace-importer --version",
    "Options:",
    "  --db-path <path>      Path to local Copilot session-store.db",
    "  --datastore <path>    Append-only normalized event datastore JSONL path",
    "  --ids <csv>           Optional comma-separated session ids to import",
    "  --machine-id <id>     Machine identifier for multi-machine datastore records",
    "  --user-id <id>        User identifier for datastore records",
    "  --include-raw-payload Store opt-in redacted raw source payload copies",
    "  --include-vscode-chat-debug",
    "                        Import VS Code GitHub Copilot Chat debug logs from default logs/workspaceStorage locations",
    "  --vscode-chat-debug-path <path>",
    "                        Import a VS Code GitHub Copilot Chat debug log file or directory",
    "  --verbose             Summary: include VS Code path-pattern breakdown and top source paths",
    "  --no-session-store    Skip ~/.copilot/session-store.db for IDE-only imports",
    "  --no-redact           Disable local redaction (not recommended)",
  ].join("\n");
}

function fail(message: string): never {
  console.error(`ingest-source-datastore error: ${message}`);
  process.exit(1);
}

export function parseArgs(argv: string[]): Args {
  const [maybeCommand, ...rest] = argv;
  const command = maybeCommand === "summary" ? "summary" : "import";
  const tokens = maybeCommand === "summary" || maybeCommand === "import" ? rest : argv;
  const args: Args = {
    command,
    dbPath: resolve(homedir(), ".copilot", "session-store.db"),
    datastorePath: resolve(process.cwd(), "datastore", "events.jsonl"),
    ids: [],
    includeRawPayload: false,
    redact: true,
    includeSessionStore: true,
    includeDefaultVscodeChatDebug: false,
    vscodeChatDebugPaths: [],
    verboseSummary: false
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "--include-raw-payload") {
      args.includeRawPayload = true;
      continue;
    }
    if (token === "--no-redact") {
      args.redact = false;
      continue;
    }
    if (token === "--include-vscode-chat-debug") {
      args.includeDefaultVscodeChatDebug = true;
      continue;
    }
    if (token === "--no-session-store") {
      args.includeSessionStore = false;
      continue;
    }
    if (token === "--verbose") {
      args.verboseSummary = true;
      continue;
    }
    if (!token.startsWith("--")) {
      continue;
    }

    const value = tokens[i + 1];
    if (!value || value.startsWith("--")) {
      fail(`missing value for ${token}`);
    }

    switch (token) {
      case "--db-path":
        args.dbPath = resolve(value);
        break;
      case "--datastore":
        args.datastorePath = resolve(value);
        break;
      case "--ids":
        args.ids = value.split(",").map((entry) => entry.trim()).filter(Boolean);
        break;
      case "--machine-id":
        args.machineId = value;
        break;
      case "--user-id":
        args.userId = value;
        break;
      case "--vscode-chat-debug-path":
        args.vscodeChatDebugPaths.push(resolve(value));
        break;
      default:
        fail(`unknown option ${token}`);
    }
    i += 1;
  }

  return args;
}

export async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`${getVersion()}\n`);
    return;
  }
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return;
  }

  const args = parseArgs(argv);
  if (args.command === "summary") {
    const summary = await summarizeDatastore(args.datastorePath, {
      verbose: args.verboseSummary
    });
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  const result = await importCopilotSessionStore({
    dbPath: args.dbPath,
    datastorePath: args.datastorePath,
    sessionIds: args.ids,
    machineId: args.machineId,
    userId: args.userId,
    includeRawPayload: args.includeRawPayload,
    redact: args.redact,
    includeSessionStore: args.includeSessionStore,
    includeDefaultVscodeChatDebug: args.includeDefaultVscodeChatDebug,
    vscodeChatDebugPaths: args.vscodeChatDebugPaths
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1]) {
  const currentFile = resolve(fileURLToPath(import.meta.url));
  const invokedFile = resolve(process.argv[1]);
  // Normalize for case-insensitive comparison on Windows
  const currentFileNormalized = currentFile.toLowerCase();
  const invokedFileNormalized = invokedFile.toLowerCase();
  if (currentFileNormalized === invokedFileNormalized) {
    void main();
  }
}
