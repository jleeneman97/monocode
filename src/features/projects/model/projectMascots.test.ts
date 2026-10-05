import { describe, expect, it } from "vitest";
import {
  MASCOT_GRID,
  PROJECT_MASCOTS,
  mascotPath,
  projectMascot,
} from "./projectMascots";

describe("projectMascots", () => {
  it("keeps every sprite square on its own grid", () => {
    expect(PROJECT_MASCOTS).toHaveLength(11);
    for (const mascot of PROJECT_MASCOTS) {
      const letters = mascot.restLayers ? "#.fe" : "#.";
      expect(mascot.grid).toBe(mascot.name === "monkey" ? 16 : MASCOT_GRID);
      for (const frame of [mascot.rest, mascot.talk]) {
        expect(frame).toHaveLength(mascot.grid);
        for (const row of frame) {
          expect(row).toMatch(new RegExp(`^[${letters}]{${mascot.grid}}$`));
        }
      }
      expect(mascot.restPath).not.toBe("");
      expect(mascot.talkPath).not.toBe("");
      expect(mascot.talkPath).not.toBe(mascot.restPath);
    }
  });

  it("merges filled runs into one rect each", () => {
    expect(mascotPath(["##..###."])).toBe("M0 0h2v1h-2zM4 0h3v1h-3z");
    expect(mascotPath(["........"])).toBe("");
  });

  it("picks the same mascot for the same project", () => {
    expect(projectMascot("~/code/monocode")).toBe(
      projectMascot("~/code/monocode"),
    );
  });

  it("honors an explicit pick and ignores unknown names", () => {
    expect(projectMascot("alpha", "ghost").name).toBe("ghost");
    expect(projectMascot("alpha", "nope").name).toBe(
      projectMascot("alpha").name,
    );
    expect(projectMascot("alpha", null).name).toBe(projectMascot("alpha").name);
  });

  it("spreads projects across the roster", () => {
    const names = new Set(
      ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"].map(
        (project) => projectMascot(project).name,
      ),
    );
    expect(names.size).toBeGreaterThan(3);
  });

  it("draws the monkey in its own colors or in one, face cut out", () => {
    const monkey = projectMascot("alpha", "monkey");
    expect(monkey.restLayers?.map((layer) => layer.fill)).toEqual([
      "#8f5b34",
      "#f2cc9d",
      "#2b1a10",
    ]);
    // A picked color replaces the fur only, so face and eyes keep theirs.
    expect(monkey.restLayers?.map((layer) => !!layer.tint)).toEqual([
      true,
      false,
      false,
    ]);
    // Where art must be one color, fur and eyes paint and the face is a hole.
    expect(monkey.restPath).toBe(mascotPath(monkey.rest, "#e"));
    expect(monkey.restPath).not.toContain("M6 4h3");
  });

  it("never hands out an opt-in mascot on its own", () => {
    const projects = Array.from({ length: 200 }, (_, i) => `project-${i}`);
    expect(projects.some((project) => projectMascot(project).name === "monkey")).toBe(
      false,
    );
  });
});
