// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { Composer } from "./Composer";

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: async () => () => {} }),
}));

function press(target: HTMLElement, key: string) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  });
}

it("lists earlier prompts on ArrowUp and places the chosen one in the input", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onSubmit = vi.fn();
  try {
    await act(async () =>
      root.render(
        createElement(Composer, {
          focused: true,
          harness: "claude",
          model: "",
          runtimeMode: "supervised",
          executionCwd: "~",
          hideTopBar: true,
          promptHistory: ["first prompt", "second prompt\nmore", "latest"],
          onFocus: vi.fn(),
          onCwdChange: vi.fn(),
          onModelChange: vi.fn(),
          onRuntimeModeChange: vi.fn(),
          onSubmit,
        }),
      ),
    );
    const textarea = container.querySelector("textarea")!;
    textarea.focus();

    press(textarea, "ArrowUp");
    const picker = () =>
      container.querySelector("[data-prompt-history-picker]");
    expect(picker()).not.toBeNull();
    const selected = () =>
      container.querySelector('[role="option"][aria-selected="true"]')
        ?.textContent;
    expect(selected()).toBe("latest");

    press(textarea, "ArrowUp");
    expect(selected()).toContain("second prompt");

    press(textarea, "Enter");
    expect(picker()).toBeNull();
    expect(textarea.value).toBe("second prompt\nmore");
    expect(onSubmit).not.toHaveBeenCalled();

    press(textarea, "ArrowUp");
    expect(picker()).toBeNull();

    textarea.setSelectionRange(0, 0);
    press(textarea, "ArrowUp");
    expect(picker()).not.toBeNull();
    press(textarea, "Escape");
    expect(picker()).toBeNull();
    expect(textarea.value).toBe("second prompt\nmore");
  } finally {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  }
});
