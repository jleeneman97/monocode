import { describe, expect, it } from "vitest";
import { caretOnFirstLine, promptHistory } from "./promptHistory";
import type { Block } from "./session";

describe("promptHistory", () => {
  it("lists sent prompts oldest first, skipping hidden and empty turns", () => {
    const blocks: Block[] = [
      { id: "u1", role: "user", text: "first" },
      { id: "a1", role: "assistant", text: "ok" },
      { id: "i1", role: "user", text: "internal", internal: true },
      { id: "u2", role: "user", text: "  " },
      { id: "u3", role: "user", text: "second\nwith detail" },
      { id: "d1", role: "user", text: "unsent", draft: true },
    ];

    expect(promptHistory(blocks)).toEqual(["first", "second\nwith detail"]);
  });

  it("keeps a repeated prompt only at its latest position", () => {
    const blocks: Block[] = [
      { id: "u1", role: "user", text: "run tests" },
      { id: "u2", role: "user", text: "fix it" },
      { id: "u3", role: "user", text: "run tests" },
    ];

    expect(promptHistory(blocks)).toEqual(["fix it", "run tests"]);
  });
});

describe("caretOnFirstLine", () => {
  it("is true only for a collapsed caret before the first newline", () => {
    expect(caretOnFirstLine("", 0, 0)).toBe(true);
    expect(caretOnFirstLine("hello\nworld", 3, 3)).toBe(true);
    expect(caretOnFirstLine("hello\nworld", 8, 8)).toBe(false);
    expect(caretOnFirstLine("hello", 0, 3)).toBe(false);
  });
});
