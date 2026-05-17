import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getVersion } from "../bin/ingest.js";

describe("cli --version", () => {
  it("getVersion() returns the package.json version", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(
      readFileSync(join(here, "..", "package.json"), "utf8")
    ) as { version: string };

    expect(getVersion()).toBe(manifest.version);
    // sanity: should be a semver-ish string, not "unknown"
    expect(getVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
