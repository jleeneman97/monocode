import { isEqualOrInside, pathKey } from "../../../shared/lib/paths";
import { notifyProjectPathsChanged } from "./recents";

/**
 * Which program opens a project's files. Projects without a choice use
 * PhpStorm; a project can pick another installed editor, or MonoCode's own
 * editor tabs. Only overrides are stored.
 */

/** The editor files open in when a project has not picked one. */
export const DEFAULT_FILE_EDITOR = "phpstorm";
/** MonoCode's built-in editor tabs instead of an external app. */
export const BUILTIN_FILE_EDITOR = "monocode";

const KEY = "monocode.projectFileEditor.v1";

type Stored = Record<string, string>;

let cache: Stored | null = null;
let cacheRaw: string | null = null;

/** The editor a project picked, or undefined when it uses the default. */
export function projectFileEditorOverride(
  project: string | undefined,
): string | undefined {
  if (!project) return undefined;
  return readAll()[pathKey(project)];
}

/** The editor a project opens files with. */
export function projectFileEditor(project: string | undefined): string {
  return projectFileEditorOverride(project) ?? DEFAULT_FILE_EDITOR;
}

/** `null`, or the default editor, drops the override. */
export function setProjectFileEditor(
  project: string,
  editor: string | null,
): void {
  const key = pathKey(project);
  const all = { ...readAll() };
  if (!editor || editor === DEFAULT_FILE_EDITOR) {
    if (!(key in all)) return;
    delete all[key];
  } else {
    if (all[key] === editor) return;
    all[key] = editor;
  }
  writeAll(all);
}

/**
 * The editor for a file. Each candidate (the file itself, then the project
 * it was opened from) is matched against the projects that picked an editor,
 * the most specific project winning; the first candidate with a match decides.
 */
export function fileEditorFor(...candidates: (string | undefined)[]): string {
  const all = readAll();
  const projects = Object.keys(all);
  if (projects.length === 0) return DEFAULT_FILE_EDITOR;
  for (const candidate of candidates) {
    if (!candidate) continue;
    let match: string | undefined;
    for (const project of projects) {
      if (!isEqualOrInside(candidate, project)) continue;
      if (!match || project.length > match.length) match = project;
    }
    if (match) return all[match];
  }
  return DEFAULT_FILE_EDITOR;
}

export function clearProjectFileEditor(project: string): void {
  setProjectFileEditor(project, null);
}

/** Follow a project rename so its choice is not orphaned. */
export function rebaseProjectFileEditor(from: string, to: string): void {
  const fromKey = pathKey(from);
  const toKey = pathKey(to);
  if (fromKey === toKey) return;
  const all = { ...readAll() };
  if (!(fromKey in all)) return;
  all[toKey] = all[fromKey];
  delete all[fromKey];
  writeAll(all);
}

function readAll(): Stored {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (cache && cacheRaw === raw) return cache;
  cacheRaw = raw;
  cache = parse(raw);
  return cache;
}

function parse(raw: string | null): Stored {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Stored = {};
    for (const [key, editor] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (typeof editor === "string" && editor && editor !== DEFAULT_FILE_EDITOR) {
        out[key] = editor;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(next: Stored): void {
  cache = next;
  const serialized = JSON.stringify(next);
  cacheRaw = serialized;
  try {
    localStorage.setItem(KEY, serialized);
  } catch {
    // private mode / quota
  }
  notifyProjectPathsChanged();
}
