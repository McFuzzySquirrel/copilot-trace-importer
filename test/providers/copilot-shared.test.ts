import { describe, expect, it } from "vitest";
import {
  inferModelFamilyFromToolCallId,
  estimateTokensFromText,
  CHARS_PER_TOKEN,
  dedupKey
} from "../../src/providers/copilot-shared.js";

describe("copilot-shared: inferModelFamilyFromToolCallId", () => {
  it.each([
    ["toolu_bdrk_abc", "anthropic"],
    ["toolu_vrtx_abc", "anthropic"],
    ["tooluse_abc", "anthropic"],
    ["toolu_abc", "anthropic"],
    ["call_abc", "openai"]
  ])("maps %s prefix to %s", (id, family) => {
    expect(inferModelFamilyFromToolCallId(id)).toBe(family);
  });

  it("returns undefined for unknown prefixes and missing input", () => {
    expect(inferModelFamilyFromToolCallId(undefined)).toBeUndefined();
    expect(inferModelFamilyFromToolCallId("")).toBeUndefined();
    expect(inferModelFamilyFromToolCallId("custom_xyz")).toBeUndefined();
    expect(inferModelFamilyFromToolCallId("toolu")).toBeUndefined();
  });
});

describe("copilot-shared: estimateTokensFromText", () => {
  it("returns undefined for empty or missing text", () => {
    expect(estimateTokensFromText(undefined)).toBeUndefined();
    expect(estimateTokensFromText("")).toBeUndefined();
  });

  it("uses ceil(length / CHARS_PER_TOKEN) and never less than 1", () => {
    expect(CHARS_PER_TOKEN).toBe(4);
    expect(estimateTokensFromText("a")).toBe(1);
    expect(estimateTokensFromText("abcd")).toBe(1);
    expect(estimateTokensFromText("abcde")).toBe(2);
    expect(estimateTokensFromText("a".repeat(40))).toBe(10);
  });
});

describe("copilot-shared: dedupKey", () => {
  it("is stable for the same inputs and changes when inputs differ", () => {
    const a = dedupKey(["interaction-1", "tc-1", "assistant.message"]);
    const b = dedupKey(["interaction-1", "tc-1", "assistant.message"]);
    const c = dedupKey(["interaction-1", "tc-2", "assistant.message"]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("ignores undefined and empty parts to keep keys collision-resistant", () => {
    const onlyDefined = dedupKey(["x"]);
    const withUndefined = dedupKey([undefined, "x", ""]);
    expect(onlyDefined).toBe(withUndefined);
  });
});
