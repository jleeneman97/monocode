import {
  CORRIDOR_W,
  MARGIN,
  WALL_H,
  ZONE_HEADER,
  type OfficeLayout,
  type ZoneRect,
} from "../model/officeLayout";
import { desaturate, mix, parseColor, rgba, seeded, shade, type Rgb } from "./color";

/** Floor, walls, windows, light, and the fixed fittings of the office. */

export type Sky = {
  /** 1 at midday, 0 at night. */
  day: number;
  /** Peaks at sunrise and sunset. */
  golden: number;
  top: Rgb;
  bottom: Rgb;
  light: Rgb;
};

const NIGHT_TOP: Rgb = { r: 10, g: 18, b: 44 };
const NIGHT_BOTTOM: Rgb = { r: 34, g: 46, b: 92 };
const DAY_TOP: Rgb = { r: 104, g: 170, b: 236 };
const DAY_BOTTOM: Rgb = { r: 206, g: 232, b: 250 };
const GOLD_TOP: Rgb = { r: 88, g: 92, b: 168 };
const GOLD_BOTTOM: Rgb = { r: 255, g: 168, b: 112 };

/** The sky outside, from the local clock: dawn, day, dusk, and night. */
export function skyAt(date: Date): Sky {
  const hour = date.getHours() + date.getMinutes() / 60;
  // Smooth daylight curve between 6:00 and 20:30.
  const rise = smooth((hour - 5.5) / 2);
  const set = 1 - smooth((hour - 18.5) / 2);
  const day = Math.max(0, Math.min(rise, set));
  const golden = Math.max(
    0,
    1 - Math.abs(hour - 7) / 1.5,
    1 - Math.abs(hour - 19) / 1.6,
  );
  const top = mix(mix(NIGHT_TOP, DAY_TOP, day), GOLD_TOP, golden * 0.6);
  const bottom = mix(mix(NIGHT_BOTTOM, DAY_BOTTOM, day), GOLD_BOTTOM, golden * 0.75);
  const light = mix({ r: 255, g: 246, b: 220 }, { r: 255, g: 186, b: 120 }, golden);
  return { day, golden, top, bottom, light };
}

function smooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

type Patterns = { floor: CanvasPattern | null; rug: CanvasPattern | null };
const patterns = new WeakMap<CanvasRenderingContext2D, Patterns>();

function patternsFor(ctx: CanvasRenderingContext2D): Patterns {
  let entry = patterns.get(ctx);
  if (!entry) {
    entry = { floor: makeFloorPattern(ctx), rug: makeRugPattern(ctx) };
    patterns.set(ctx, entry);
  }
  return entry;
}

const TILE_SCALE = 2;

function tileCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w * TILE_SCALE;
  canvas.height = h * TILE_SCALE;
  const tile = canvas.getContext("2d");
  tile?.scale(TILE_SCALE, TILE_SCALE);
  return { canvas, tile };
}

function finishPattern(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const pattern = ctx.createPattern(canvas, "repeat");
  pattern?.setTransform(new DOMMatrix().scale(1 / TILE_SCALE));
  return pattern;
}

function makeFloorPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const W = 480;
  const H = 120;
  const plank = 20;
  const { canvas, tile } = tileCanvas(W, H);
  if (!tile) return null;
  const random = seeded(7);
  const base: Rgb = { r: 184, g: 136, b: 94 };
  for (let row = 0; row < H / plank; row++) {
    let x = -random() * 160;
    while (x < W) {
      const length = 140 + random() * 160;
      const tone = shade(base, (random() - 0.5) * 0.22);
      const y = row * plank;
      const g = tile.createLinearGradient(0, y, 0, y + plank);
      g.addColorStop(0, rgba(shade(tone, 0.06)));
      g.addColorStop(1, rgba(shade(tone, -0.06)));
      tile.fillStyle = g;
      tile.fillRect(x, y, length, plank);
      // Grain.
      tile.strokeStyle = rgba(shade(tone, -0.3), 0.18);
      tile.lineWidth = 0.7;
      for (let i = 0; i < 3; i++) {
        const gy = y + 4 + random() * (plank - 8);
        tile.beginPath();
        tile.moveTo(x, gy);
        tile.bezierCurveTo(x + length * 0.3, gy + (random() - 0.5) * 3, x + length * 0.7, gy + (random() - 0.5) * 3, x + length, gy);
        tile.stroke();
      }
      // Knot, now and then.
      if (random() < 0.25) {
        tile.beginPath();
        tile.ellipse(x + random() * length, y + plank / 2, 3, 1.6, 0, 0, Math.PI * 2);
        tile.fillStyle = rgba(shade(tone, -0.35), 0.35);
        tile.fill();
      }
      // Seam.
      tile.fillStyle = "rgba(60,32,16,0.45)";
      tile.fillRect(x + length - 1, y, 1.2, plank);
      x += length;
    }
    tile.fillStyle = "rgba(60,32,16,0.35)";
    tile.fillRect(0, row * plank + plank - 1, W, 1);
    tile.fillStyle = "rgba(255,240,220,0.08)";
    tile.fillRect(0, row * plank, W, 1);
  }
  return finishPattern(ctx, canvas);
}

function makeRugPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const S = 96;
  const { canvas, tile } = tileCanvas(S, S);
  if (!tile) return null;
  const random = seeded(11);
  for (let i = 0; i < 900; i++) {
    tile.fillStyle = random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    tile.fillRect(random() * S, random() * S, 1, 1 + random() * 1.5);
  }
  return finishPattern(ctx, canvas);
}

export type View = { x: number; y: number; w: number; h: number };

export function drawFloor(ctx: CanvasRenderingContext2D, layout: OfficeLayout, view: View) {
  const { floor } = patternsFor(ctx);
  const top = Math.max(view.y, WALL_H);
  ctx.fillStyle = floor ?? "rgb(184,136,94)";
  ctx.fillRect(view.x, top, view.w, view.y + view.h - top);
  // Ambient occlusion along the back wall and the left wall.
  const wallShade = ctx.createLinearGradient(0, WALL_H, 0, WALL_H + 70);
  wallShade.addColorStop(0, "rgba(30,16,8,0.4)");
  wallShade.addColorStop(1, "rgba(30,16,8,0)");
  ctx.fillStyle = wallShade;
  ctx.fillRect(view.x, WALL_H, view.w, 70);
  const leftShade = ctx.createLinearGradient(0, 0, 26, 0);
  leftShade.addColorStop(0, "rgba(30,16,8,0.35)");
  leftShade.addColorStop(1, "rgba(30,16,8,0)");
  ctx.fillStyle = leftShade;
  ctx.fillRect(0, WALL_H, 26, layout.height - WALL_H);
  const rightShade = ctx.createLinearGradient(layout.width, 0, layout.width - 26, 0);
  rightShade.addColorStop(0, "rgba(30,16,8,0.35)");
  rightShade.addColorStop(1, "rgba(30,16,8,0)");
  ctx.fillStyle = rightShade;
  ctx.fillRect(layout.width - 26, WALL_H, 26, layout.height - WALL_H);
}

const WALL: Rgb = { r: 58, g: 84, b: 96 };
const PANEL: Rgb = { r: 116, g: 78, b: 52 };

/** Window x positions along the back wall, clear of the door and kitchen. */
export function windowSlots(layout: OfficeLayout): number[] {
  const start = MARGIN + CORRIDOR_W + 150;
  const end = layout.width - 230;
  const slots: number[] = [];
  for (let x = start; x + 118 <= end; x += 236) slots.push(x);
  return slots;
}

export function drawBackWall(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  sky: Sky,
  time: number,
  date: Date,
) {
  const w = layout.width;
  // Plaster.
  const plaster = ctx.createLinearGradient(0, 0, 0, WALL_H);
  plaster.addColorStop(0, rgba(shade(WALL, -0.25)));
  plaster.addColorStop(1, rgba(shade(WALL, 0.05)));
  ctx.fillStyle = plaster;
  ctx.fillRect(0, 0, w, WALL_H);
  // Crown molding.
  ctx.fillStyle = rgba(shade(WALL, -0.45));
  ctx.fillRect(0, 0, w, 8);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, 8, w, 2);

  const windows = windowSlots(layout);
  for (const x of windows) drawWindow(ctx, x, 26, 118, 92, sky, time);
  // Framed prints between the windows.
  windows.slice(0, -1).forEach((x, i) => drawPrint(ctx, x + 177, 70, i));

  // Wainscoting.
  const panelTop = WALL_H - 44;
  const panel = ctx.createLinearGradient(0, panelTop, 0, WALL_H);
  panel.addColorStop(0, rgba(shade(PANEL, 0.08)));
  panel.addColorStop(1, rgba(shade(PANEL, -0.18)));
  ctx.fillStyle = panel;
  ctx.fillRect(0, panelTop, w, 44);
  ctx.fillStyle = rgba(shade(PANEL, 0.25));
  ctx.fillRect(0, panelTop, w, 3);
  ctx.strokeStyle = rgba(shade(PANEL, -0.35), 0.6);
  ctx.lineWidth = 1;
  for (let x = 14; x < w; x += 64) {
    ctx.strokeRect(x, panelTop + 9, 52, 26);
  }
  // Baseboard.
  ctx.fillStyle = rgba(shade(PANEL, -0.4));
  ctx.fillRect(0, WALL_H - 6, w, 6);

  const clockX = MARGIN + CORRIDOR_W + 70;
  drawClock(ctx, clockX, 64, date);
  drawNeon(ctx, layout, sky, time);
}

function drawWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sky: Sky,
  time: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, rgba(sky.top));
  g.addColorStop(1, rgba(sky.bottom));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const night = 1 - sky.day;
  // Stars.
  if (night > 0.2) {
    const random = seeded(Math.round(x));
    for (let i = 0; i < 14; i++) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * (1 + random() * 2) + i);
      ctx.fillStyle = `rgba(255,255,255,${(0.25 + 0.6 * twinkle) * night})`;
      ctx.fillRect(x + random() * w, y + random() * h * 0.5, 1.2, 1.2);
    }
  }
  // Sun or moon, shared across windows as if seen through them.
  const orbX = x + w * 0.7;
  const orbY = y + 26 + (1 - sky.day) * 6;
  const orb = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 34);
  orb.addColorStop(0, sky.day > 0.4 ? "rgba(255,250,220,0.95)" : "rgba(235,240,255,0.9)");
  orb.addColorStop(0.25, sky.day > 0.4 ? "rgba(255,230,160,0.35)" : "rgba(200,215,255,0.2)");
  orb.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = orb;
  ctx.fillRect(x, y, w, h);
  // Drifting clouds by day.
  if (sky.day > 0.1) {
    ctx.fillStyle = `rgba(255,255,255,${0.55 * sky.day})`;
    for (let i = 0; i < 2; i++) {
      const cx = x + (((time * (6 + i * 3) + i * 70 + x) % (w + 80)) - 40);
      const cy = y + 18 + i * 16;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 16, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 10, cy - 3, 10, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 9, cy - 1, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Skyline.
  const random = seeded(Math.round(x * 3));
  let bx = x - 6;
  while (bx < x + w) {
    const bw = 14 + random() * 22;
    const bh = 22 + random() * 40;
    const by = y + h - bh;
    ctx.fillStyle = rgba(mix(shade(sky.top, -0.35), { r: 30, g: 40, b: 60 }, 0.5 + night * 0.3));
    ctx.fillRect(bx, by, bw, bh);
    // Lit windows at night.
    for (let wy = by + 4; wy < y + h - 4; wy += 6) {
      for (let wx = bx + 3; wx < bx + bw - 3; wx += 5) {
        const on = random() < 0.35 * night + 0.03;
        if (!on) continue;
        ctx.fillStyle = `rgba(255,214,140,${0.55 + 0.4 * night})`;
        ctx.fillRect(wx, wy, 2, 2.5);
      }
    }
    bx += bw + 2;
  }
  ctx.restore();
  // Frame and mullions.
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgb(238,232,220)";
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h * 0.42);
  ctx.lineTo(x + w, y + h * 0.42);
  ctx.stroke();
  // Glass sheen.
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.moveTo(x + 8, y + h);
  ctx.lineTo(x + 30, y);
  ctx.lineTo(x + 44, y);
  ctx.lineTo(x + 22, y + h);
  ctx.fill();
  // Sill.
  ctx.fillStyle = "rgb(226,220,206)";
  ctx.fillRect(x - 6, y + h + 2, w + 12, 6);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(x - 6, y + h + 8, w + 12, 2);
}

const PRINT_COLORS: Rgb[] = [
  { r: 232, g: 96, b: 72 },
  { r: 250, g: 196, b: 82 },
  { r: 78, g: 150, b: 200 },
  { r: 104, g: 176, b: 132 },
  { r: 40, g: 46, b: 60 },
];

/** Small abstract prints, each one different. */
function drawPrint(ctx: CanvasRenderingContext2D, cx: number, cy: number, index: number) {
  const w = 48;
  const h = 62;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x + 2, y + 3, w, h);
  ctx.fillStyle = "rgb(42,34,30)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgb(244,238,226)";
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  const random = seeded(index * 31 + 5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 9, y + 9, w - 18, h - 18);
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = rgba(PRINT_COLORS[Math.floor(random() * PRINT_COLORS.length)], 0.9);
    const px = x + 9 + random() * (w - 18);
    const py = y + 9 + random() * (h - 18);
    const size = 8 + random() * 14;
    ctx.beginPath();
    if (random() < 0.5) ctx.arc(px, py, size / 2, 0, Math.PI * 2);
    else ctx.rect(px - size / 2, py - size / 3, size, size * 0.66);
    ctx.fill();
  }
  ctx.restore();
}

function drawClock(ctx: CanvasRenderingContext2D, x: number, y: number, date: Date) {
  ctx.beginPath();
  ctx.arc(x, y + 2, 19, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(36,40,48)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(246,244,238)";
  ctx.fill();
  ctx.fillStyle = "rgb(60,60,70)";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = i % 3 === 0 ? 10.5 : 12;
    ctx.save();
    ctx.translate(x + Math.sin(a) * r0, y - Math.cos(a) * r0);
    ctx.rotate(a);
    ctx.fillRect(-0.6, 0, 1.2, i % 3 === 0 ? 3 : 1.6);
    ctx.restore();
  }
  const h = (date.getHours() % 12) + date.getMinutes() / 60;
  const m = date.getMinutes() + date.getSeconds() / 60;
  const s = date.getSeconds() + date.getMilliseconds() / 1000;
  const hand = (angle: number, length: number, width: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(angle) * length, y - Math.cos(angle) * length);
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.lineCap = "butt";
  };
  hand((h / 12) * Math.PI * 2, 7, 2.2, "rgb(40,40,48)");
  hand((m / 60) * Math.PI * 2, 10.5, 1.6, "rgb(40,40,48)");
  hand((s / 60) * Math.PI * 2, 11.5, 0.8, "rgb(214,70,60)");
  ctx.beginPath();
  ctx.arc(x, y, 1.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(214,70,60)";
  ctx.fill();
}

function drawNeon(ctx: CanvasRenderingContext2D, layout: OfficeLayout, sky: Sky, time: number) {
  const x = layout.width - 128;
  const y = 58;
  const flicker = 0.92 + 0.08 * Math.sin(time * 23) * Math.sin(time * 3.1);
  const glow = (0.55 + 0.45 * (1 - sky.day)) * flicker;
  // Backing board.
  ctx.beginPath();
  ctx.roundRect(x - 74, y - 24, 148, 46, 10);
  ctx.fillStyle = "rgba(16,20,28,0.55)";
  ctx.fill();
  ctx.save();
  ctx.font = "600 23px ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = `rgba(120,220,255,${glow})`;
  ctx.shadowBlur = 18 * glow;
  ctx.fillStyle = `rgba(190,245,255,${0.6 + 0.4 * glow})`;
  ctx.fillText("monocode", x, y);
  ctx.shadowBlur = 6;
  ctx.fillText("monocode", x, y);
  ctx.restore();
}

export function drawDoor(ctx: CanvasRenderingContext2D, layout: OfficeLayout, open: number) {
  const cx = layout.door.x;
  const w = 58;
  const top = 34;
  const bottom = WALL_H - 4;
  const left = cx - w / 2;
  // Opening: the corridor beyond, lit warmly.
  const beyond = ctx.createLinearGradient(0, top, 0, bottom);
  beyond.addColorStop(0, "rgb(40,34,30)");
  beyond.addColorStop(1, "rgb(120,96,70)");
  ctx.fillStyle = beyond;
  ctx.fillRect(left, top, w, bottom - top);
  // Leaf, swinging inward: it narrows toward the hinge as it opens.
  const leafW = w * (1 - open * 0.82);
  const leaf = ctx.createLinearGradient(left, 0, left + leafW, 0);
  leaf.addColorStop(0, "rgb(120,80,54)");
  leaf.addColorStop(1, "rgb(150,104,70)");
  ctx.fillStyle = leaf;
  ctx.fillRect(left, top, leafW, bottom - top);
  if (leafW > 14) {
    ctx.fillStyle = "rgba(190,226,240,0.45)";
    ctx.fillRect(left + leafW * 0.2, top + 10, leafW * 0.6, 40);
    ctx.fillStyle = "rgb(222,206,160)";
    ctx.beginPath();
    ctx.arc(left + leafW - 8, top + 66, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Frame.
  ctx.lineWidth = 5;
  ctx.strokeStyle = rgba(shade(PANEL, -0.3));
  ctx.strokeRect(left - 2, top - 2, w + 4, bottom - top + 4);
  // Exit sign.
  ctx.beginPath();
  ctx.roundRect(cx - 16, top - 22, 32, 13, 3);
  ctx.fillStyle = "rgb(30,120,80)";
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "rgba(80,255,170,0.9)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "rgb(210,255,230)";
  ctx.font = "700 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EXIT", cx, top - 15.5);
  ctx.restore();
  // Warm light spilling onto the floor through the open door.
  if (open > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const spill = ctx.createRadialGradient(cx, WALL_H, 0, cx, WALL_H, 70);
    spill.addColorStop(0, `rgba(255,200,140,${0.28 * open})`);
    spill.addColorStop(1, "rgba(255,200,140,0)");
    ctx.fillStyle = spill;
    ctx.beginPath();
    ctx.ellipse(cx, WALL_H + 4, 70, 34, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }
}

/** Coffee corner against the back wall, far right. */
export function drawKitchenette(ctx: CanvasRenderingContext2D, layout: OfficeLayout, time: number) {
  const right = layout.width - 26;
  const left = right - 150;
  const top = WALL_H - 50;
  // Counter.
  ctx.fillStyle = "rgba(20,12,8,0.25)";
  ctx.fillRect(left - 4, WALL_H + 10, 158, 8);
  ctx.fillStyle = "rgb(236,232,224)";
  ctx.fillRect(left, top + 8, 150, WALL_H + 12 - top - 8);
  ctx.strokeStyle = "rgb(206,200,190)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) ctx.strokeRect(left + 6 + i * 48, top + 20, 42, WALL_H - top - 12);
  ctx.fillStyle = "rgb(60,62,70)";
  ctx.fillRect(left - 3, top + 2, 156, 8);
  // Coffee machine.
  const mx = left + 26;
  ctx.beginPath();
  ctx.roundRect(mx - 16, top - 36, 32, 38, 4);
  ctx.fillStyle = "rgb(48,50,58)";
  ctx.fill();
  ctx.fillStyle = "rgb(200,60,50)";
  ctx.fillRect(mx - 10, top - 30, 4, 4);
  ctx.fillStyle = "rgb(250,250,246)";
  ctx.fillRect(mx - 5, top - 8, 10, 9);
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.6 + i / 3) % 1;
    ctx.beginPath();
    ctx.arc(mx + Math.sin(t * 9 + i) * 2.5, top - 10 - t * 20, 2 + t * 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`;
    ctx.fill();
  }
  // Fruit bowl and water cooler.
  ctx.beginPath();
  ctx.ellipse(left + 74, top + 2, 14, 5, 0, 0, Math.PI);
  ctx.fillStyle = "rgb(240,236,226)";
  ctx.fill();
  for (const [dx, color] of [
    [-6, "rgb(230,70,60)"],
    [2, "rgb(250,200,60)"],
    [8, "rgb(120,190,80)"],
  ] as const) {
    ctx.beginPath();
    ctx.arc(left + 74 + dx, top - 2, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  const wx = left + 124;
  ctx.fillStyle = "rgb(226,230,236)";
  ctx.fillRect(wx - 12, top - 10, 24, 22);
  ctx.beginPath();
  ctx.roundRect(wx - 11, top - 46, 22, 36, 7);
  ctx.fillStyle = "rgba(140,200,240,0.75)";
  ctx.fill();
  const bubble = (time * 0.8) % 1;
  ctx.beginPath();
  ctx.arc(wx - 3, top - 14 - bubble * 26, 1.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fill();
}

export function drawCorridor(ctx: CanvasRenderingContext2D, layout: OfficeLayout) {
  const x = MARGIN + 10;
  const w = CORRIDOR_W - 20;
  const top = WALL_H + 4;
  const h = layout.height - top - MARGIN;
  ctx.fillStyle = "rgba(20,12,8,0.18)";
  ctx.fillRect(x + 2, top + 3, w, h);
  ctx.fillStyle = "rgb(86,44,52)";
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = patternsFor(ctx).rug ?? "transparent";
  ctx.fillRect(x, top, w, h);
  ctx.strokeStyle = "rgba(226,182,104,0.75)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 6, top + 6, w - 12, h - 12);
  ctx.strokeStyle = "rgba(226,182,104,0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 10, top + 10, w - 20, h - 20);
}

export function drawZoneRug(ctx: CanvasRenderingContext2D, zone: ZoneRect) {
  const base = desaturate(shade(parseColor(zone.color), -0.5), 0.45);
  ctx.save();
  ctx.shadowColor = "rgba(20,10,5,0.35)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.roundRect(zone.x, zone.y, zone.w, zone.h, 20);
  ctx.fillStyle = rgba(base);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(zone.x, zone.y, zone.w, zone.h, 20);
  ctx.clip();
  ctx.fillStyle = patternsFor(ctx).rug ?? "transparent";
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
  const sheen = ctx.createLinearGradient(zone.x, zone.y, zone.x + zone.w, zone.y + zone.h);
  sheen.addColorStop(0, "rgba(255,255,255,0.06)");
  sheen.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = sheen;
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
  ctx.restore();
  // Border bands.
  ctx.beginPath();
  ctx.roundRect(zone.x + 8, zone.y + 8, zone.w - 16, zone.h - 16, 14);
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgba(shade(parseColor(zone.color), -0.05), 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(zone.x + 22, zone.y + 22, zone.w - 44, zone.h - 44, 8);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(shade(parseColor(zone.color), 0.2), 0.25);
  ctx.stroke();
  // Woven diamonds along the border band.
  ctx.fillStyle = rgba(shade(parseColor(zone.color), 0.15), 0.32);
  const diamond = (x: number, y: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 3.2);
    ctx.lineTo(x + 3.2, y);
    ctx.lineTo(x, y + 3.2);
    ctx.lineTo(x - 3.2, y);
    ctx.closePath();
    ctx.fill();
  };
  for (let x = zone.x + 34; x < zone.x + zone.w - 30; x += 16) {
    diamond(x, zone.y + 15);
    diamond(x, zone.y + zone.h - 15);
  }
  for (let y = zone.y + 34; y < zone.y + zone.h - 30; y += 16) {
    diamond(zone.x + 15, y);
    diamond(zone.x + zone.w - 15, y);
  }
  // Header plaque, its text is laid over in HTML.
  const plaqueY = zone.y + 14;
  ctx.beginPath();
  ctx.roundRect(zone.x + 18, plaqueY, 6, ZONE_HEADER - 26, 3);
  ctx.fillStyle = rgba(parseColor(zone.color));
  ctx.fill();
}

/** Sunbeams by day, warm pendant pools by night, laid over the floor. */
export function drawAmbientLight(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  sky: Sky,
  time: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (sky.day > 0.05) {
    const strength = 0.09 * sky.day + 0.05 * sky.golden;
    for (const x of windowSlots(layout)) {
      const shimmer = 1 + 0.08 * Math.sin(time * 0.7 + x);
      const g = ctx.createLinearGradient(0, WALL_H, 0, WALL_H + 300);
      g.addColorStop(0, rgba(sky.light, strength * shimmer));
      g.addColorStop(1, rgba(sky.light, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + 4, WALL_H - 4);
      ctx.lineTo(x + 114, WALL_H - 4);
      ctx.lineTo(x + 230, WALL_H + 300);
      ctx.lineTo(x + 90, WALL_H + 300);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Darkens the room toward night, before lamps and screens light it again. */
export function drawNightTint(ctx: CanvasRenderingContext2D, view: View, sky: Sky) {
  const night = 1 - sky.day;
  if (night <= 0.01 && sky.golden <= 0.01) return;
  ctx.fillStyle = `rgba(14,20,52,${0.5 * night})`;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  if (sky.golden > 0.01) {
    ctx.fillStyle = `rgba(255,140,60,${0.06 * sky.golden})`;
    ctx.fillRect(view.x, view.y, view.w, view.h);
  }
}

export function drawPendantLights(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  sky: Sky,
) {
  const night = 1 - sky.day;
  if (night < 0.05) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const zone of layout.zones) {
    const count = Math.max(1, Math.round(zone.w / 360));
    for (let i = 0; i < count; i++) {
      const x = zone.x + (zone.w / count) * (i + 0.5);
      const y = zone.y + zone.h / 2;
      const r = Math.min(zone.h, 320) * 0.75;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,214,150,${0.16 * night})`);
      g.addColorStop(1, "rgba(255,214,150,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  ctx.restore();
}

/** A soft cinematic vignette over the visible frame. */
export function drawVignette(ctx: CanvasRenderingContext2D, view: View) {
  const cx = view.x + view.w / 2;
  const cy = view.y + view.h / 2;
  const r = Math.hypot(view.w, view.h) / 2;
  const g = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.05);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(8,4,12,0.32)");
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
}
