import type { EventEnvelope } from "../schema/index.js";

/**
 * Shared context passed to every provider import call.
 *
 * Providers SHOULD NOT mutate this object. They MAY read it freely.
 */
export interface ProviderImportContext {
  /** Stable machine identifier (hostname by default). */
  machineId: string;
  /** Stable user identifier (OS username by default). */
  userId: string;
  /** When true, providers attach an opt-in redacted raw payload to each event. */
  includeRawPayload: boolean;
  /** When true, providers must run their emitted events through {@link applyRedaction}. */
  redact: boolean;
  /** Deterministic clock for testability. */
  now: () => string;
}

/**
 * Per-provider stats returned after a single import call.
 *
 * Providers MUST report every line they considered. `importedEvents +
 * skippedLines + deduplicatedEvents` should equal "lines inspected", so the
 * orchestrator can sanity-check totals and surface user-visible numbers.
 */
export interface ProviderImportStats {
  /** Stable provider name used in diagnostics and registry lookups. */
  name: string;
  /** Session identifiers this provider produced events for. */
  sessions: string[];
  /** Count of envelopes that were validated and emitted. */
  importedEvents: number;
  /** Count of input lines/rows that failed to parse or validate. */
  skippedLines: number;
  /** Count of events suppressed by per-provider dedup (e.g. messageId collisions). */
  deduplicatedEvents: number;
}

/**
 * Result of a single provider's import pass. Events are returned eagerly
 * because today's datastore is small (single user, single machine). When the
 * datastore grows we will swap this for an async iterable; the interface is
 * kept narrow so that change stays local.
 */
export interface ProviderImportResult {
  stats: ProviderImportStats;
  events: EventEnvelope[];
}

/**
 * A Provider knows how to read one specific on-disk source of AI-coding
 * telemetry and emit normalized {@link EventEnvelope}s.
 *
 * Adding a new provider should be a single file under `src/providers/` plus
 * a matching `docs/providers/<name>.md` quirks doc and a fixture-driven test.
 * See ADR-002 for the rationale behind provider isolation.
 */
export interface Provider<Options = unknown> {
  /** Stable, kebab-case identifier (e.g. "copilot-session-store"). */
  readonly name: string;
  /** Short human-readable description, surfaced in CLI help. */
  readonly description: string;
  /**
   * Run the import. Implementations MUST validate every event through the
   * shared schema before returning it, and MUST apply redaction when
   * `ctx.redact` is true. The orchestrator only persists what is returned.
   */
  import(options: Options, ctx: ProviderImportContext): Promise<ProviderImportResult>;
}
