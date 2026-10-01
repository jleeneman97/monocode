import {
  CELL,
  pointAlong,
  type DeskSlot,
  type Facing,
  type OfficeLayout,
  type Point,
} from "../model/officeLayout";
import type { OfficeDesk, OfficeDeskStatus } from "../model/officeState";
import { drawCharacter, lookFor, type CharacterLook, type Pose, type SitMode } from "./character";
import { parseColor, type Rgb } from "./color";
import {
  Particles,
  drawAlertBubble,
  drawLampGlow,
  drawScreenGlow,
  drawThoughtBubble,
} from "./effects";
import {
  drawAmbientLight,
  drawBackWall,
  drawCorridor,
  drawDoor,
  drawFloor,
  drawKitchenette,
  drawNightTint,
  drawPendantLights,
  drawVignette,
  drawZoneRug,
  skyAt,
  windowSlots,
  type Sky,
  type View,
} from "./environment";
import { deskPropsFor, drawChair, drawDesk, drawFloorPlant } from "./furniture";

/**
 * Runs the office: one worker per desk who walks in when the project's agents
 * start, sits and works while they run, waits with the news when they finish,
 * and walks out when there is nothing left to do.
 */

const WALK_SPEED = 120;
const SIT_SECONDS = 0.45;
const STRIDE = 8.5;

type Actor = {
  key: string;
  look: CharacterLook;
  progress: number;
  seated: number;
  alpha: number;
  phase: number;
  status: OfficeDeskStatus;
  glyphIn: number;
  backward: boolean;
};

type DeskView = {
  desk: OfficeDesk;
  slot: DeskSlot;
  accent: Rgb;
  props: ReturnType<typeof deskPropsFor>;
};

const PRESENT = new Set<OfficeDeskStatus>(["working", "thinking", "needs-input", "updates"]);
const BUSY = new Set<OfficeDeskStatus>(["working", "thinking", "needs-input"]);

export class OfficeScene {
  private layout: OfficeLayout | null = null;
  private desks = new Map<string, DeskView>();
  private actors = new Map<string, Actor>();
  private particles = new Particles();
  private door = 0;
  private time = 0;
  private started = false;
  private reducedMotion = false;

  setReducedMotion(value: boolean) {
    this.reducedMotion = value;
  }

  update(layout: OfficeLayout, desks: OfficeDesk[]) {
    this.layout = layout;
    const next = new Map<string, DeskView>();
    for (const desk of desks) {
      const slot = layout.slots.get(desk.key);
      if (!slot) continue;
      const previous = this.desks.get(desk.key);
      next.set(desk.key, {
        desk,
        slot,
        accent: parseColor(desk.color),
        props: previous?.props ?? deskPropsFor(desk.key),
      });
    }
    this.desks = next;
    for (const [key, actor] of this.actors) {
      const view = next.get(key);
      if (!view) {
        this.actors.delete(key);
        continue;
      }
      // A resize moves the desk; keep a seated worker in their chair.
      if (actor.seated > 0 || actor.progress > view.slot.pathLength) {
        actor.progress = view.slot.pathLength;
      }
      if (actor.status !== view.desk.status) {
        if (BUSY.has(actor.status) && view.desk.status === "updates" && actor.seated > 0.5) {
          this.celebrate(view);
        }
        actor.status = view.desk.status;
      }
    }
    if (!this.started) {
      // First paint: whoever is already working is already at their desk.
      this.started = true;
      for (const view of next.values()) {
        if (!PRESENT.has(view.desk.status)) continue;
        this.actors.set(view.desk.key, this.newActor(view, true));
      }
    }
  }

  private newActor(view: DeskView, seated: boolean): Actor {
    return {
      key: view.desk.key,
      look: lookFor(view.desk.key, view.desk.color),
      progress: seated ? view.slot.pathLength : 0,
      seated: seated ? 1 : 0,
      alpha: seated ? 1 : 0,
      phase: 0,
      status: view.desk.status,
      glyphIn: Math.random(),
      backward: false,
    };
  }

  private celebrate(view: DeskView) {
    if (this.reducedMotion) return;
    this.particles.confetti(view.slot.seat.x, view.slot.seat.y - 60);
  }

  tick(dt: number) {
    const step = Math.min(dt, 0.05);
    this.time += step;
    const speed = this.reducedMotion ? 1e6 : WALK_SPEED;
    const sitRate = this.reducedMotion ? 1e6 : 1 / SIT_SECONDS;

    for (const view of this.desks.values()) {
      const want = PRESENT.has(view.desk.status);
      let actor = this.actors.get(view.desk.key);
      if (want && !actor) {
        actor = this.newActor(view, false);
        this.actors.set(view.desk.key, actor);
      }
      if (!actor) continue;
      const length = view.slot.pathLength;
      if (want) {
        actor.alpha = Math.min(1, actor.alpha + step * 4);
        if (actor.progress < length) {
          actor.backward = false;
          actor.progress = Math.min(length, actor.progress + speed * step);
          actor.phase += (speed * step) / STRIDE;
        } else if (actor.seated < 1) {
          const before = actor.seated;
          actor.seated = Math.min(1, actor.seated + sitRate * step);
          if (before < 0.5 && actor.seated >= 0.5 && !this.reducedMotion) {
            this.particles.puff(view.slot.seat.x, view.slot.seat.y + 2);
          }
        }
      } else if (actor.seated > 0) {
        const before = actor.seated;
        actor.seated = Math.max(0, actor.seated - sitRate * step);
        if (before >= 0.5 && actor.seated < 0.5 && !this.reducedMotion) {
          this.particles.puff(view.slot.seat.x, view.slot.seat.y + 2);
        }
      } else if (actor.progress > 0) {
        actor.backward = true;
        actor.progress = Math.max(0, actor.progress - speed * step);
        actor.phase += (speed * step) / STRIDE;
      } else {
        actor.alpha -= step * 3;
        if (actor.alpha <= 0) this.actors.delete(view.desk.key);
      }

      if (
        !this.reducedMotion &&
        actor.seated >= 1 &&
        view.desk.status === "working"
      ) {
        actor.glyphIn -= step;
        if (actor.glyphIn <= 0) {
          actor.glyphIn = 0.55 + Math.random() * 0.6;
          this.particles.glyph(view.slot.seat.x, view.slot.y + CELL.deskTopY - 24, view.accent);
        }
      }
    }

    // The door swings open for anyone near it.
    let near = 0;
    if (this.layout) {
      for (const actor of this.actors.values()) {
        const view = this.desks.get(actor.key);
        if (!view) continue;
        const { point } = pointAlong(view.slot.path, actor.progress);
        const distance = Math.hypot(point.x - this.layout.door.x, point.y - this.layout.door.y);
        near = Math.max(near, 1 - distance / 70);
      }
    }
    const target = near > 0 ? 1 : 0;
    this.door += (target - this.door) * Math.min(1, step * (target ? 9 : 4));
    this.particles.update(step);
  }

  /** Draws the frame for the visible part of the world. */
  render(ctx: CanvasRenderingContext2D, view: View, now: Date) {
    const layout = this.layout;
    if (!layout) return;
    const sky = skyAt(now);
    const time = this.time;
    const night = 1 - sky.day;

    ctx.save();
    ctx.translate(-view.x, -view.y);

    drawFloor(ctx, layout, view);
    if (view.y < 200) {
      drawBackWall(ctx, layout, sky, time, now);
      drawDoor(ctx, layout, this.door);
      drawKitchenette(ctx, layout, time);
    }
    drawCorridor(ctx, layout);
    for (const zone of layout.zones) {
      if (zone.y > view.y + view.h || zone.y + zone.h < view.y) continue;
      drawZoneRug(ctx, zone);
    }
    drawAmbientLight(ctx, layout, sky, time);
    this.spawnDust(sky, layout);

    const drawables: { y: number; draw: () => void }[] = [];
    const visible = (y: number) => y > view.y - 220 && y < view.y + view.h + 220;
    for (const deskView of this.desks.values()) {
      const { slot, desk, accent, props } = deskView;
      if (!visible(slot.y + slot.h / 2)) continue;
      const actor = this.actors.get(desk.key);
      const occupied = !!actor && actor.seated > 0.5;
      drawables.push({ y: slot.seat.y - 1, draw: () => drawChair(ctx, slot.seat, accent, occupied) });
      drawables.push({
        y: slot.y + CELL.deskBottomY,
        draw: () =>
          drawDesk(ctx, slot, accent, props, {
            active: occupied && BUSY.has(desk.status),
            night,
            time,
          }),
      });
    }
    for (const actor of this.actors.values()) {
      const deskView = this.desks.get(actor.key);
      if (!deskView) continue;
      const placed = this.place(actor, deskView);
      if (!visible(placed.y)) continue;
      drawables.push({
        y: placed.sortY,
        draw: () => drawCharacter(ctx, actor.look, placed.x, placed.y, placed.pose, time, actor.alpha),
      });
    }
    for (const zone of layout.zones) {
      if (!visible(zone.y + zone.h / 2)) continue;
      // Plants stand in the header corner, and beside the desks when the
      // grid leaves room.
      const headerBase = zone.y + 46;
      drawables.push({
        y: headerBase,
        draw: () => drawFloorPlant(ctx, zone.x + zone.w - 34, headerBase, 0.72, zone.x, time),
      });
      const room = zone.x + zone.w - zone.gridRight;
      if (room > 64) {
        const base = zone.y + zone.h - 22;
        drawables.push({
          y: base,
          draw: () => drawFloorPlant(ctx, zone.gridRight + room / 2, base, 0.95, zone.y, time),
        });
      }
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const item of drawables) item.draw();

    // Lighting: darken toward night, then let screens and lamps light it.
    drawNightTint(ctx, view, sky);
    drawPendantLights(ctx, layout, sky);
    for (const deskView of this.desks.values()) {
      const { slot, desk, accent, props } = deskView;
      if (!visible(slot.y + slot.h / 2)) continue;
      const actor = this.actors.get(desk.key);
      const working = !!actor && actor.seated > 0.5 && BUSY.has(desk.status);
      if (working) {
        drawScreenGlow(ctx, slot.seat.x, slot.seat.y - 40, accent, 0.45 + 0.55 * night, time);
      }
      if (props.right === "lamp" && night > 0.2) {
        drawLampGlow(ctx, slot.seat.x + CELL.deskW / 2 - 12, slot.y + CELL.deskTopY - 8, night);
      }
    }

    this.particles.draw(ctx);
    for (const actor of this.actors.values()) {
      const deskView = this.desks.get(actor.key);
      if (!deskView || actor.seated < 1) continue;
      const { seat } = deskView.slot;
      if (!visible(seat.y)) continue;
      if (deskView.desk.status === "thinking") drawThoughtBubble(ctx, seat.x + 40, seat.y - 66, time);
      if (deskView.desk.status === "needs-input") drawAlertBubble(ctx, seat.x - 40, seat.y - 60, time);
    }
    ctx.restore();

    drawVignette(ctx, { x: 0, y: 0, w: view.w, h: view.h });
  }

  private place(actor: Actor, view: DeskView): { x: number; y: number; sortY: number; pose: Pose } {
    const seat = view.slot.seat;
    if (actor.seated > 0) {
      const s = actor.seated;
      if (s < 0.5) {
        return {
          x: seat.x,
          // Lowers until the hips meet the seated pose's at the halfway mark.
          y: seat.y + s * 2 * 27,
          sortY: seat.y,
          pose: { kind: "stand", facing: "down" },
        };
      }
      return {
        x: seat.x,
        y: seat.y + 2 - (1 - s) * 2 * 6,
        sortY: seat.y,
        pose: { kind: "sit", mode: sitMode(view.desk.status) },
      };
    }
    const { point, facing } = pointAlong(view.slot.path, actor.progress);
    const atSeat = actor.progress >= view.slot.pathLength;
    const heading: Facing = actor.backward ? reverse(facing) : facing;
    return {
      x: point.x,
      y: point.y,
      sortY: point.y,
      pose: atSeat
        ? { kind: "stand", facing: "down" }
        : { kind: "walk", facing: heading, phase: actor.phase },
    };
  }

  private spawnDust(sky: Sky, layout: OfficeLayout) {
    if (this.reducedMotion || sky.day < 0.3 || this.particles.count > 140) return;
    if (Math.random() > 0.25) return;
    const windows = windowSlots(layout);
    if (!windows.length) return;
    const x = windows[Math.floor(Math.random() * windows.length)];
    const depth = Math.random() * 280;
    const p: Point = { x: x + 10 + depth * 0.45 + Math.random() * 110, y: 172 + depth };
    this.particles.dust(p.x, p.y);
  }
}

function sitMode(status: OfficeDeskStatus): SitMode {
  switch (status) {
    case "working":
      return "typing";
    case "thinking":
      return "thinking";
    case "needs-input":
      return "waving";
    default:
      return "relaxed";
  }
}

function reverse(facing: Facing): Facing {
  switch (facing) {
    case "down":
      return "up";
    case "up":
      return "down";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}
