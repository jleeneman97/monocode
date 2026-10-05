import { describe, expect, it } from "vitest";
import { lookFor } from "./character";

describe("office worker looks", () => {
  it("sends a monkey furred in the mascot color, face and hands pale", () => {
    const monkey = lookFor("/work/shop", "#3b82f6", "#3b82f6");
    expect(monkey.monkey).toBe(true);
    expect(monkey.shirt).toEqual({ r: 59, g: 130, b: 246 });
    expect(monkey.hair).toEqual(monkey.shirt);
    expect(monkey.skin).toEqual({ r: 242, g: 204, b: 157 });
    expect(monkey.glasses).toBe(false);
  });

  it("keeps a person at desks without the monkey mascot", () => {
    const person = lookFor("/work/shop", "#3b82f6");
    expect(person.monkey).toBeUndefined();
    expect(person.shirt).toEqual({ r: 59, g: 130, b: 246 });
  });
});
