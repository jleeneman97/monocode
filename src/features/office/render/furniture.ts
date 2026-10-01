import { CELL, type DeskSlot, type Point } from "../model/officeLayout";
import { desaturate, hashString, rgba, shade, type Rgb } from "./color";

/** Desks, chairs, desk props, and plants. */

const WOOD: Rgb = { r: 190, g: 140, b: 96 };
const WOOD_TOP: Rgb = { r: 214, g: 170, b: 124 };
const METAL: Rgb = { r: 196, g: 202, b: 210 };
const CHARCOAL: Rgb = { r: 54, g: 58, b: 68 };

type DeskProps = {
  monitor: boolean;
  left: "books" | "plant" | "none";
  right: "mug" | "lamp" | "duck" | "plant" | "figure";
};

export function deskPropsFor(key: string): DeskProps {
  const hash = hashString(key + ":desk");
  const rights: DeskProps["right"][] = ["mug", "lamp", "duck", "plant", "figure"];
  const lefts: DeskProps["left"][] = ["books", "plant", "none"];
  return {
    monitor: hash % 10 < 6,
    left: lefts[(hash >>> 4) % lefts.length],
    right: rights[(hash >>> 8) % rights.length],
  };
}

function gradientV(ctx: CanvasRenderingContext2D, color: Rgb, y0: number, y1: number, top = 0.1, bottom = -0.14) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(shade(color, top)));
  g.addColorStop(1, rgba(shade(color, bottom)));
  return g;
}

/** The chair back, which shows above the desk behind whoever sits there. */
export function drawChair(
  ctx: CanvasRenderingContext2D,
  seat: Point,
  accent: Rgb,
  occupied: boolean,
) {
  ctx.save();
  // Empty chairs are pushed in toward the desk.
  ctx.translate(seat.x, seat.y + (occupied ? 0 : 10));
  const fabric = desaturate(shade(accent, -0.3), 0.3);
  const frame = shade(CHARCOAL, -0.2);
  const w = 46;
  const top = -66;
  const h = 56;
  // Floor shadow behind the desk.
  ctx.beginPath();
  ctx.ellipse(0, 6, 26, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20,12,8,0.2)";
  ctx.fill();
  // Seat pan, seen past the back cushion.
  ctx.beginPath();
  ctx.roundRect(-w / 2 - 4, top + h - 10, w + 8, 14, 7);
  ctx.fillStyle = gradientV(ctx, fabric, top + h - 10, top + h + 4, 0.05, -0.3);
  ctx.fill();
  // Shell.
  ctx.beginPath();
  ctx.roundRect(-w / 2 - 2, top - 2, w + 4, h - 6, 11);
  ctx.fillStyle = rgba(frame);
  ctx.fill();
  // Back cushion.
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 1, top + 1, w - 2, h - 12, 10);
  ctx.fillStyle = gradientV(ctx, fabric, top, top + h - 12, 0.2, -0.18);
  ctx.fill();
  // Vertical channel stitching.
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(shade(fabric, -0.35), 0.55);
  for (const dx of [-8, 8]) {
    ctx.beginPath();
    ctx.moveTo(dx, top + 7);
    ctx.lineTo(dx, top + h - 18);
    ctx.stroke();
  }
  // Sheen along the top.
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 6, top + 4, w - 12, 5, 2.5);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fill();
  // Armrests.
  for (const dx of [-w / 2 - 6, w / 2]) {
    ctx.beginPath();
    ctx.roundRect(dx, top + h - 28, 6, 24, 3);
    ctx.fillStyle = rgba(frame);
    ctx.fill();
  }
  ctx.restore();
}

export type DeskState = {
  active: boolean;
  /** 0 by day, 1 at night: desk lamps switch on in the dark. */
  night: number;
  time: number;
};

/** The desk and everything on it, drawn in front of its chair and worker. */
export function drawDesk(
  ctx: CanvasRenderingContext2D,
  slot: DeskSlot,
  accent: Rgb,
  props: DeskProps,
  state: DeskState,
) {
  const cx = slot.seat.x;
  const left = cx - CELL.deskW / 2;
  const right = cx + CELL.deskW / 2;
  const top = slot.y + CELL.deskTopY;
  const surface = top + 24;
  const bottom = slot.y + CELL.deskBottomY;

  // Floor shadow.
  ctx.beginPath();
  ctx.roundRect(left - 6, bottom - 4, CELL.deskW + 12, 12, 6);
  ctx.fillStyle = "rgba(20,12,8,0.22)";
  ctx.fill();

  // Legs.
  ctx.fillStyle = rgba(shade(WOOD, -0.35));
  ctx.fillRect(left + 4, surface, 7, bottom - surface);
  ctx.fillRect(right - 11, surface, 7, bottom - surface);

  // Modesty panel.
  ctx.beginPath();
  ctx.roundRect(left + 2, surface, CELL.deskW - 4, bottom - surface - 4, [0, 0, 5, 5]);
  ctx.fillStyle = gradientV(ctx, WOOD, surface, bottom, -0.02, -0.3);
  ctx.fill();
  // Drawer and accent strip.
  ctx.beginPath();
  ctx.roundRect(right - 52, surface + 6, 40, 13, 3);
  ctx.fillStyle = rgba(shade(WOOD, -0.1));
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(shade(WOOD, -0.45), 0.6);
  ctx.stroke();
  ctx.fillStyle = rgba(METAL);
  ctx.fillRect(right - 38, surface + 11, 12, 2.5);
  ctx.fillStyle = rgba(accent, 0.85);
  ctx.fillRect(left + 2, bottom - 9, CELL.deskW - 4, 3);

  // Work surface, with a lip to read as depth.
  ctx.beginPath();
  ctx.roundRect(left - 3, top, CELL.deskW + 6, 24, 5);
  ctx.fillStyle = gradientV(ctx, WOOD_TOP, top, top + 24, 0.14, -0.06);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgba(shade(WOOD, -0.45), 0.7);
  ctx.stroke();
  ctx.fillStyle = rgba(shade(WOOD, -0.22));
  ctx.fillRect(left - 3, top + 20, CELL.deskW + 6, 4);
  // Grain.
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = "rgba(120,70,30,0.12)";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(left + 4, top + 5 + i * 5);
    ctx.bezierCurveTo(left + 50, top + 3 + i * 5, cx + 20, top + 8 + i * 5, right - 4, top + 5 + i * 5);
    ctx.stroke();
  }

  if (props.monitor) drawMonitor(ctx, left + 26, top + 6, state.active);
  if (props.left === "books") drawBooks(ctx, left + (props.monitor ? 6 : 16), top + 12);
  if (props.left === "plant" && !props.monitor) drawSucculent(ctx, left + 22, top + 14, state.time);
  drawLaptop(ctx, cx, top + 12, accent, state.active);
  drawRightProp(ctx, props.right, right - 22, top + 14, accent, state);
}

function drawLaptop(
  ctx: CanvasRenderingContext2D,
  cx: number,
  base: number,
  accent: Rgb,
  open: boolean,
) {
  if (!open) {
    // Closed: a flat slab.
    ctx.beginPath();
    ctx.roundRect(cx - 24, base - 2, 48, 6, 2.5);
    ctx.fillStyle = gradientV(ctx, METAL, base - 2, base + 4, 0.1, -0.2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(60,64,72,0.7)";
    ctx.stroke();
    return;
  }
  // Lid back, facing us.
  const lidTop = base - 32;
  ctx.beginPath();
  ctx.roundRect(cx - 25, lidTop, 50, 33, 4);
  ctx.fillStyle = gradientV(ctx, METAL, lidTop, base, 0.18, -0.12);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(70,74,84,0.8)";
  ctx.stroke();
  // Logo in the project color.
  ctx.beginPath();
  ctx.arc(cx, lidTop + 15, 5, 0, Math.PI * 2);
  ctx.fillStyle = rgba(shade(accent, 0.1));
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - 1.4, lidTop + 13.6, 1.7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  // Screen light spilling past the lid edges.
  ctx.fillStyle = "rgba(170,220,255,0.55)";
  ctx.fillRect(cx - 24, lidTop - 1.2, 48, 1.4);
  // Base.
  ctx.beginPath();
  ctx.roundRect(cx - 28, base, 56, 5, 2);
  ctx.fillStyle = gradientV(ctx, METAL, base, base + 5, 0.05, -0.25);
  ctx.fill();
}

function drawMonitor(ctx: CanvasRenderingContext2D, cx: number, base: number, on: boolean) {
  const top = base - 46;
  ctx.fillStyle = rgba(shade(CHARCOAL, -0.15));
  ctx.fillRect(cx - 3, top + 30, 6, 16);
  ctx.beginPath();
  ctx.roundRect(cx - 12, base - 2, 24, 5, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - 27, top, 54, 34, 4);
  ctx.fillStyle = gradientV(ctx, CHARCOAL, top, top + 34, 0.2, -0.15);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(20,22,28,0.9)";
  ctx.stroke();
  // Vents.
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 4; i++) ctx.fillRect(cx - 10, top + 9 + i * 4, 20, 1.4);
  if (on) {
    ctx.fillStyle = "rgba(170,220,255,0.5)";
    ctx.fillRect(cx - 26, top - 1, 52, 1.4);
  }
}

function drawBooks(ctx: CanvasRenderingContext2D, x: number, base: number) {
  const colors: Rgb[] = [
    { r: 196, g: 84, b: 70 },
    { r: 70, g: 120, b: 170 },
    { r: 230, g: 190, b: 90 },
  ];
  colors.forEach((color, i) => {
    const y = base - 6 - i * 5;
    ctx.beginPath();
    ctx.roundRect(x + (i % 2) * 2, y, 26 - i * 2, 5, 1);
    ctx.fillStyle = gradientV(ctx, color, y, y + 5, 0.15, -0.15);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(x + (i % 2) * 2 + 3, y + 1.8, 18 - i * 2, 1);
  });
}

function drawSucculent(ctx: CanvasRenderingContext2D, x: number, base: number, time: number) {
  ctx.beginPath();
  ctx.roundRect(x - 7, base - 10, 14, 11, [2, 2, 4, 4]);
  ctx.fillStyle = gradientV(ctx, { r: 236, g: 232, b: 224 }, base - 10, base, 0.05, -0.15);
  ctx.fill();
  const sway = Math.sin(time * 1.3 + x) * 0.05;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.5 + sway;
    ctx.save();
    ctx.translate(x, base - 10);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -6, 3, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba({ r: 96 + i * 8, g: 160 + i * 4, b: 110 });
    ctx.fill();
    ctx.restore();
  }
}

function drawRightProp(
  ctx: CanvasRenderingContext2D,
  kind: DeskProps["right"],
  x: number,
  base: number,
  accent: Rgb,
  state: DeskState,
) {
  switch (kind) {
    case "mug": {
      ctx.beginPath();
      ctx.roundRect(x - 6, base - 13, 12, 13, [2, 2, 3, 3]);
      ctx.fillStyle = gradientV(ctx, accent, base - 13, base, 0.15, -0.2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 7, base - 7, 3.5, -Math.PI / 2, Math.PI / 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(shade(accent, -0.2));
      ctx.stroke();
      break;
    }
    case "lamp": {
      ctx.fillStyle = rgba(shade(CHARCOAL, 0.1));
      ctx.beginPath();
      ctx.ellipse(x, base - 1, 8, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = rgba(shade(CHARCOAL, 0.15));
      ctx.beginPath();
      ctx.moveTo(x, base - 1);
      ctx.lineTo(x - 4, base - 20);
      ctx.lineTo(x + 6, base - 32);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 1, base - 36);
      ctx.lineTo(x + 15, base - 30);
      ctx.lineTo(x + 9, base - 22);
      ctx.closePath();
      ctx.fillStyle = rgba(shade(accent, -0.05));
      ctx.fill();
      if (state.night > 0.2) {
        ctx.beginPath();
        ctx.arc(x + 10, base - 25, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,240,190,0.95)";
        ctx.fill();
      }
      break;
    }
    case "duck": {
      const bob = Math.sin(state.time * 2 + x) * 0.6;
      ctx.beginPath();
      ctx.ellipse(x, base - 5 + bob, 8, 5.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(250,206,64,1)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 4, base - 12 + bob, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 8, base - 12 + bob);
      ctx.lineTo(x - 12, base - 11 + bob);
      ctx.lineTo(x - 8, base - 10 + bob);
      ctx.fillStyle = "rgba(240,130,40,1)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 5, base - 13 + bob, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(30,20,20,1)";
      ctx.fill();
      break;
    }
    case "plant":
      drawSucculent(ctx, x, base, state.time);
      break;
    case "figure": {
      ctx.beginPath();
      ctx.roundRect(x - 6, base - 4, 12, 4, 1.5);
      ctx.fillStyle = rgba(CHARCOAL);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x - 4, base - 14, 8, 10, 3);
      ctx.fillStyle = rgba(accent);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, base - 18, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(shade(accent, 0.35));
      ctx.fill();
      break;
    }
  }
}

/** A tall potted floor plant whose leaves sway in the air conditioning. */
export function drawFloorPlant(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number,
  scale: number,
  seed: number,
  time: number,
) {
  ctx.save();
  ctx.translate(x, base);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20,12,8,0.25)";
  ctx.fill();
  // Pot.
  ctx.beginPath();
  ctx.moveTo(-15, -30);
  ctx.lineTo(15, -30);
  ctx.lineTo(11, 0);
  ctx.lineTo(-11, 0);
  ctx.closePath();
  const pot = ctx.createLinearGradient(-15, 0, 15, 0);
  pot.addColorStop(0, "rgb(214,120,84)");
  pot.addColorStop(1, "rgb(150,74,52)");
  ctx.fillStyle = pot;
  ctx.fill();
  ctx.fillStyle = "rgb(190,100,70)";
  ctx.fillRect(-17, -34, 34, 6);
  // Leaves, back to front.
  const leaves = 9;
  for (let i = 0; i < leaves; i++) {
    const spread = (i / (leaves - 1) - 0.5) * 2.2;
    const sway = Math.sin(time * 0.9 + seed + i * 0.7) * 0.06;
    const length = 30 + ((i * 7 + seed * 13) % 14);
    ctx.save();
    ctx.translate(0, -32);
    ctx.rotate(spread + sway);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-9, -length * 0.55, 0, -length);
    ctx.quadraticCurveTo(9, -length * 0.55, 0, 0);
    const shadeAmount = (i % 3) * 0.08;
    ctx.fillStyle = rgba(shade({ r: 62, g: 140, b: 86 }, -shadeAmount + (i > leaves / 2 ? 0.08 : 0)));
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, -length + 3);
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = "rgba(200,240,200,0.35)";
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
