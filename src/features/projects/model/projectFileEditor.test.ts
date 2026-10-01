import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUILTIN_FILE_EDITOR,
  DEFAULT_FILE_EDITOR,
  clearProjectFileEditor,
  fileEditorFor,
  projectFileEditor,
  projectFileEditorOverride,
  rebaseProjectFileEditor,
  setProjectFileEditor,
} from "./projectFileEditor";

describe("project file editor", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens files in PhpStorm until a project picks another editor", () => {
    expect(DEFAULT_FILE_EDITOR).toBe("phpstorm");
    expect(projectFileEditor("/work/shop")).toBe("phpstorm");
    expect(fileEditorFor("/work/shop/src/App.php")).toBe("phpstorm");

    setProjectFileEditor("/work/shop/", "vscode");
    expect(projectFileEditor("/work/shop")).toBe("vscode");
    expect(projectFileEditor("/work/blog")).toBe("phpstorm");
  });

  it("only stores overrides, so picking the default clears the choice", () => {
    setProjectFileEditor("/work/shop", "vscode");
    setProjectFileEditor("/work/shop", DEFAULT_FILE_EDITOR);
    expect(projectFileEditorOverride("/work/shop")).toBeUndefined();
    expect(JSON.parse(storage.get("monocode.projectFileEditor.v1")!)).toEqual(
      {},
    );
  });

  it("matches a file to the most specific project that picked an editor", () => {
    setProjectFileEditor("/work/mono", "vscode");
    setProjectFileEditor("/work/mono/packages/api", BUILTIN_FILE_EDITOR);

    expect(fileEditorFor("/work/mono/README.md")).toBe("vscode");
    expect(fileEditorFor("/work/mono/packages/api/index.ts")).toBe(
      BUILTIN_FILE_EDITOR,
    );
    // A file outside every project falls back to where it was opened from.
    expect(fileEditorFor("/tmp/worktree/a.ts", "/work/mono")).toBe("vscode");
    expect(fileEditorFor("/tmp/other.ts", "/work/blog")).toBe("phpstorm");
    // The file's own project outranks the project it was opened from.
    expect(fileEditorFor("/work/mono/a.ts", "/work/mono/packages/api")).toBe(
      "vscode",
    );
  });

  it("follows renames and is dropped with the project", () => {
    setProjectFileEditor("/work/shop", "cursor");
    rebaseProjectFileEditor("/work/shop", "/work/store");
    expect(projectFileEditor("/work/shop")).toBe("phpstorm");
    expect(projectFileEditor("/work/store")).toBe("cursor");

    clearProjectFileEditor("/work/store");
    expect(projectFileEditor("/work/store")).toBe("phpstorm");
  });
});
