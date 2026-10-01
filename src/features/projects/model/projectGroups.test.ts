// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { pathKey } from "../../../shared/lib/paths";
import {
  createProjectGroup,
  loadProjectGroupAssignments,
  loadProjectGroups,
  nextProjectGroupName,
  projectGroupForCwd,
  saveProjectGroupAssignments,
  saveProjectGroups,
  setProjectGroupAssignment,
} from "./projectGroups";

beforeEach(() => localStorage.clear());

describe("project groups", () => {
  it("persists ordered appearance and collapsed state", () => {
    expect(
      saveProjectGroups([
        {
          id: "clients",
          name: "Clients",
          collapsed: true,
          customColor: "#AABBCC",
          mascot: "ghost",
        },
        {
          id: "personal",
          name: "Personal",
          collapsed: false,
          colorIndex: 4,
        },
      ]),
    ).toBe(true);

    expect(loadProjectGroups()).toEqual([
      {
        id: "clients",
        name: "Clients",
        collapsed: true,
        customColor: "#aabbcc",
        mascot: "ghost",
      },
      {
        id: "personal",
        name: "Personal",
        collapsed: false,
        colorIndex: 4,
      },
    ]);
  });

  it("keeps assignments only for groups that still exist", () => {
    saveProjectGroups([{ id: "clients", name: "Clients", collapsed: false }]);
    saveProjectGroupAssignments({
      [pathKey("/work/client")]: "clients",
      [pathKey("/work/stale")]: "missing",
    });

    expect(loadProjectGroupAssignments()).toEqual({
      [pathKey("/work/client")]: "clients",
    });
    expect(setProjectGroupAssignment("/work/client", null)).toEqual({});
  });

  it("creates stable unique default names", () => {
    const groups = [
      { id: "one", name: "New group", collapsed: false },
      { id: "two", name: "NEW GROUP 2", collapsed: false },
    ];
    expect(nextProjectGroupName(groups)).toBe("New group 3");
    expect(createProjectGroup(groups)).toMatchObject({
      name: "New group 3",
      collapsed: false,
    });
  });

  it("resolves the group for a project, its subfolders, and its worktrees", () => {
    saveProjectGroups([
      { id: "work", name: "Work", collapsed: false },
      { id: "nested", name: "Nested", collapsed: false },
    ]);
    setProjectGroupAssignment("/sites/shop", "work");
    setProjectGroupAssignment("/sites/shop/packages/app", "nested");

    expect(projectGroupForCwd("/sites/shop")?.id).toBe("work");
    expect(projectGroupForCwd("/sites/shop/src")?.id).toBe("work");
    expect(projectGroupForCwd("/sites/shop-worktrees/ASANA-1")?.id).toBe("work");
    expect(projectGroupForCwd("/sites/shop/packages/app/src")?.id).toBe("nested");
    expect(projectGroupForCwd("/sites/shopping")).toBeUndefined();
    expect(projectGroupForCwd("/sites/other")).toBeUndefined();
  });
});
