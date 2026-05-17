import { copilotEventsJsonlProvider } from "./copilot-events-jsonl.js";
import { vscodeChatDebugProvider } from "./vscode-chat-debug.js";
import type { Provider } from "./types.js";

/**
 * The built-in provider registry. Adding a new provider is a single import
 * + a single entry here. See ADR-002 for the rationale.
 *
 * Order matters only insofar as it determines the order in which providers
 * write to the datastore on a single import pass; downstream consumers
 * MUST NOT depend on this order beyond timestamp.
 */
export const BUILTIN_PROVIDERS = [
  copilotEventsJsonlProvider,
  vscodeChatDebugProvider
] as const;

export type BuiltinProvider = (typeof BUILTIN_PROVIDERS)[number];

export function getProvider(name: string): Provider<unknown> | undefined {
  return BUILTIN_PROVIDERS.find((provider) => provider.name === name) as Provider<unknown> | undefined;
}

export function listProviderNames(): string[] {
  return BUILTIN_PROVIDERS.map((provider) => provider.name);
}

export { copilotEventsJsonlProvider } from "./copilot-events-jsonl.js";
export { vscodeChatDebugProvider } from "./vscode-chat-debug.js";
export { readCopilotSessionRows, type CopilotSessionRow } from "./copilot-session-store.js";
export type { Provider, ProviderImportContext, ProviderImportResult, ProviderImportStats } from "./types.js";
