import type { OfficeZone } from "./officeState";

/**
 * World geometry for the office floor, in CSS pixels. The back wall runs
 * along the top with the entrance at its left end; a corridor runs down the
 * left side, and each project group gets a carpeted zone of desks to its
 * right. Every desk row has a walkway just behind its chairs, so an agent
 * walks in through the door, down the corridor, behind the row of chairs,
 * and into its own.
 */

export type Point = { x: number; y: number };

export const WALL_H = 168;
export const MARGIN = 20;
export const CORRIDOR_W = 92;
export const CELL_W = 212;
export const CELL_H = 228;
export const ZONE_HEADER = 58;
export const ZONE_PAD = 18;
export const ZONE_GAP = 34;
export const MIN_WORLD_W = 560;

/** Offsets inside a desk cell, from its top-left corner. */
export const CELL = {
  /** Walkway just behind the chairs. */
  aisleY: 94,
  /** Where a seated agent's hips rest. */
  seatY: 116,
  /** Top edge of the desk's work surface. */
  deskTopY: 120,
  /** Bottom edge of the desk's front panel. */
  deskBottomY: 178,
  /** Top of the name plate under the desk. */
  plateY: 184,
  deskW: 150,
} as const;

export type DeskSlot = {
  key: string;
  zoneId: string;
  /** Cell rectangle. */
  x: number;
  y: number;
  w: number;
  h: number;
  seat: Point;
  aisleY: number;
  /** Polyline from the doorway to the chair. */
  path: Point[];
  pathLength: number;
};

export type ZoneRect = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  columns: number;
  /** Right edge of the desk grid, for placing decor beside it. */
  gridRight: number;
};

export type OfficeLayout = {
  width: number;
  height: number;
  corridorX: number;
  door: Point;
  zones: ZoneRect[];
  slots: Map<string, DeskSlot>;
};

export function layoutOffice(
  zones: OfficeZone[],
  viewportWidth: number,
): OfficeLayout {
  const width = Math.max(MIN_WORLD_W, Math.floor(viewportWidth));
  const corridorX = MARGIN + CORRIDOR_W / 2;
  const door: Point = { x: corridorX, y: WALL_H - 6 };
  const zoneX = MARGIN + CORRIDOR_W + 14;
  const zoneW = width - zoneX - MARGIN;
  const columns = Math.max(1, Math.floor((zoneW - ZONE_PAD * 2) / CELL_W));
  const rects: ZoneRect[] = [];
  const slots = new Map<string, DeskSlot>();
  let y = WALL_H + 26;

  for (const zone of zones) {
    const rows = Math.max(1, Math.ceil(zone.desks.length / columns));
    const used = Math.min(columns, zone.desks.length);
    const h = ZONE_HEADER + rows * CELL_H + ZONE_PAD;
    const gridW = used * CELL_W;
    const left = zoneX + Math.max(ZONE_PAD, (zoneW - gridW) / 2);
    rects.push({
      id: zone.id,
      name: zone.name,
      color: zone.color,
      x: zoneX,
      y,
      w: zoneW,
      h,
      columns,
      gridRight: left + gridW,
    });
    zone.desks.forEach((desk, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cellX = left + column * CELL_W;
      const cellY = y + ZONE_HEADER + row * CELL_H;
      const seat = { x: cellX + CELL_W / 2, y: cellY + CELL.seatY };
      const aisleY = cellY + CELL.aisleY;
      const path = [
        door,
        { x: corridorX, y: door.y + 18 },
        { x: corridorX, y: aisleY },
        { x: seat.x, y: aisleY },
        seat,
      ];
      slots.set(desk.key, {
        key: desk.key,
        zoneId: zone.id,
        x: cellX,
        y: cellY,
        w: CELL_W,
        h: CELL_H,
        seat,
        aisleY,
        path,
        pathLength: polylineLength(path),
      });
    });
    y += h + ZONE_GAP;
  }

  return {
    width,
    height: Math.max(y + MARGIN, WALL_H + 260),
    corridorX,
    door,
    zones: rects,
    slots,
  };
}

export function polylineLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

export type Facing = "down" | "up" | "left" | "right";

/** Position and heading at a distance along a polyline. */
export function pointAlong(
  points: Point[],
  distance: number,
): { point: Point; facing: Facing } {
  let remaining = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (segment === 0) continue;
    if (remaining <= segment || i === points.length - 1) {
      const t = Math.min(1, remaining / segment);
      return {
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        facing: facingFor(b.x - a.x, b.y - a.y),
      };
    }
    remaining -= segment;
  }
  return { point: points[points.length - 1] ?? { x: 0, y: 0 }, facing: "down" };
}

function facingFor(dx: number, dy: number): Facing {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}
