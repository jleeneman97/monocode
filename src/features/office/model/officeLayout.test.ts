import { describe, expect, it } from "vitest";
import { CELL, CELL_W, layoutOffice, pointAlong, polylineLength } from "./officeLayout";
import type { OfficeDesk, OfficeZone } from "./officeState";

function desk(key: string): OfficeDesk {
  return { key, path: key, name: key, color: "#fff", status: "offline", agents: 0, updates: 0 };
}

const zones: OfficeZone[] = [
  { id: "a", name: "A", color: "#f00", desks: ["1", "2", "3", "4", "5"].map(desk) },
  { id: "b", name: "B", color: "#0f0", desks: ["6"].map(desk) },
];

describe("layoutOffice", () => {
  it("lays desks out in a grid per zone, stacking zones down the floor", () => {
    const layout = layoutOffice(zones, 900);
    const [a, b] = layout.zones;
    expect(a.columns).toBe(Math.floor((a.w - 36) / CELL_W));
    expect(b.y).toBeGreaterThan(a.y + a.h);
    const first = layout.slots.get("1")!;
    const second = layout.slots.get("2")!;
    expect(second.x - first.x).toBe(CELL_W);
    expect(second.y).toBe(first.y);
    const wrapped = layout.slots.get(String(a.columns + 1))!;
    expect(wrapped.y).toBeGreaterThan(first.y);
    expect(layout.height).toBeGreaterThan(b.y + b.h);
  });

  it("walks from the door down the corridor, behind the chairs, into the seat", () => {
    const layout = layoutOffice(zones, 900);
    const slot = layout.slots.get("3")!;
    expect(slot.path[0]).toEqual(layout.door);
    expect(slot.path.at(-1)).toEqual(slot.seat);
    expect(slot.path[2]).toEqual({ x: layout.corridorX, y: slot.y + CELL.aisleY });
    expect(slot.pathLength).toBeCloseTo(polylineLength(slot.path));
    expect(pointAlong(slot.path, 0).point).toEqual(layout.door);
    expect(pointAlong(slot.path, 1).facing).toBe("down");
    expect(pointAlong(slot.path, slot.pathLength).point).toEqual(slot.seat);
    const alongAisle = slot.pathLength - (slot.seat.y - slot.aisleY) - 10;
    expect(pointAlong(slot.path, alongAisle).facing).toBe("right");
  });

  it("keeps a usable floor on narrow windows", () => {
    const layout = layoutOffice(zones, 200);
    expect(layout.width).toBeGreaterThanOrEqual(560);
    expect(layout.zones[0].columns).toBeGreaterThanOrEqual(1);
  });
});
