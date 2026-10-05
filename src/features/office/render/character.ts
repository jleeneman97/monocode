import type { Facing } from "../model/officeLayout";
import { hashString, parseColor, rgba, shade, type Rgb } from "./color";

/**
 * The office workers. Each project gets its own person, picked from its key,
 * wearing the project's color. Drawn as soft vector shapes lit from the top
 * left, with a walk cycle, seated poses, blinking, and breathing.
 */

export type CharacterLook = {
  skin: Rgb;
  hair: Rgb;
  hairStyle: number;
  shirt: Rgb;
  pants: Rgb;
  shoes: Rgb;
  glasses: boolean;
  headphones: boolean;
  headphoneColor: Rgb;
  /** Offsets idle motion so neighbors never move in lockstep. */
  seed: number;
  /** Projects with the monkey mascot get a monkey at their desk. */
  monkey?: boolean;
};

/** The monkey's face, inner ears, hands, and feet; its fur is the mascot color. */
const MONKEY_FACE: Rgb = { r: 242, g: 204, b: 157 };

const SKINS: Rgb[] = [
  { r: 255, g: 222, b: 196 },
  { r: 241, g: 194, b: 158 },
  { r: 224, g: 172, b: 132 },
  { r: 198, g: 140, b: 100 },
  { r: 150, g: 100, b: 70 },
  { r: 112, g: 74, b: 52 },
];
const HAIRS: Rgb[] = [
  { r: 38, g: 30, b: 28 },
  { r: 74, g: 48, b: 32 },
  { r: 122, g: 78, b: 44 },
  { r: 196, g: 150, b: 88 },
  { r: 168, g: 62, b: 40 },
  { r: 60, g: 60, b: 72 },
  { r: 222, g: 214, b: 200 },
];
const PANTS: Rgb[] = [
  { r: 46, g: 54, b: 72 },
  { r: 58, g: 52, b: 48 },
  { r: 34, g: 38, b: 46 },
  { r: 70, g: 84, b: 100 },
];
const HEADPHONES: Rgb[] = [
  { r: 30, g: 32, b: 38 },
  { r: 236, g: 236, b: 240 },
  { r: 230, g: 90, b: 80 },
];

export function lookFor(
  key: string,
  color: string,
  /** Fur color when the project's mascot is the monkey. */
  monkeyFur?: string,
): CharacterLook {
  const hash = hashString(key);
  const pick = <T,>(list: T[], shift: number) => list[(hash >>> shift) % list.length];
  if (monkeyFur) {
    const fur = parseColor(monkeyFur);
    return {
      skin: MONKEY_FACE,
      hair: fur,
      hairStyle: 0,
      shirt: fur,
      pants: fur,
      shoes: shade(MONKEY_FACE, -0.12),
      glasses: false,
      headphones: false,
      headphoneColor: pick(HEADPHONES, 19),
      seed: (hash % 1000) / 97,
      monkey: true,
    };
  }
  return {
    skin: pick(SKINS, 0),
    hair: pick(HAIRS, 3),
    hairStyle: (hash >>> 7) % 6,
    shirt: parseColor(color),
    pants: pick(PANTS, 11),
    shoes: (hash >>> 13) % 3 === 0 ? { r: 236, g: 236, b: 232 } : { r: 40, g: 34, b: 32 },
    glasses: (hash >>> 15) % 10 < 3,
    headphones: (hash >>> 17) % 10 < 3,
    headphoneColor: pick(HEADPHONES, 19),
    seed: (hash % 1000) / 97,
  };
}

export type SitMode = "typing" | "thinking" | "waving" | "relaxed";

export type Pose =
  | { kind: "stand"; facing: Facing }
  | { kind: "walk"; facing: Facing; phase: number }
  | { kind: "sit"; mode: SitMode };

const INK = { r: 34, g: 26, b: 30 };

function outline(ctx: CanvasRenderingContext2D, color: Rgb, width = 1.4) {
  ctx.lineWidth = width;
  ctx.strokeStyle = rgba(shade(color, -0.55), 0.9);
  ctx.stroke();
}

function lit(
  ctx: CanvasRenderingContext2D,
  color: Rgb,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, rgba(shade(color, 0.16)));
  gradient.addColorStop(0.55, rgba(color));
  gradient.addColorStop(1, rgba(shade(color, -0.2)));
  return gradient;
}

function capsule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A limb from a joint, rotated by `angle` (0 hangs straight down). */
function limb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  width: number,
  angle: number,
  color: Rgb,
  end?: { color: Rgb; radius: number },
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  capsule(ctx, -width / 2, -width / 2, width, length + width / 2, width / 2);
  ctx.fillStyle = lit(ctx, color, -width, 0, width, 0);
  ctx.fill();
  outline(ctx, color, 1.2);
  if (end) {
    ctx.beginPath();
    ctx.arc(0, length, end.radius, 0, Math.PI * 2);
    ctx.fillStyle = rgba(end.color);
    ctx.fill();
    outline(ctx, end.color, 1.1);
  }
  ctx.restore();
}

/** Blink for ~130ms every few seconds, out of step per character. */
function eyeOpen(time: number, seed: number): number {
  const period = 3.4 + (seed % 1.7);
  const t = (time + seed * 1.3) % period;
  return t < 0.13 ? Math.abs(t - 0.065) / 0.065 : 1;
}

type FaceOptions = {
  facing: Facing;
  time: number;
  lookUp?: boolean;
  mouth?: "smile" | "open" | "grin" | "flat";
};

function drawHead(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  cx: number,
  cy: number,
  options: FaceOptions,
) {
  if (look.monkey) {
    drawMonkeyHead(ctx, look, cx, cy, options);
    return;
  }
  const { facing, time } = options;
  const r = 15;
  const side = facing === "left" || facing === "right";

  // Hair behind the head: long styles and buns.
  ctx.fillStyle = lit(ctx, look.hair, cx - r, cy - r, cx + r, cy + r);
  if (look.hairStyle === 3 || look.hairStyle === 5) {
    ctx.beginPath();
    ctx.roundRect(cx - r - 1.5, cy - 4, r * 2 + 3, look.hairStyle === 3 ? 26 : 18, 9);
    ctx.fill();
    outline(ctx, look.hair);
  }
  if (look.hairStyle === 4) {
    ctx.beginPath();
    ctx.arc(cx + (side ? -9 : 0), cy - r - 3, 7, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, look.hair);
  }

  // Neck.
  ctx.fillStyle = rgba(shade(look.skin, -0.12));
  ctx.fillRect(cx - 4.5, cy + r - 4, 9, 7);

  // Ears.
  ctx.fillStyle = rgba(shade(look.skin, -0.04));
  for (const dx of side ? [-2] : [-r + 0.5, r - 0.5]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx, cy + 2, 3.3, 4.3, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, look.skin, 1);
  }

  // Face.
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r + 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = lit(ctx, look.skin, cx - r, cy - r, cx + r, cy + r);
  ctx.fill();
  outline(ctx, look.skin);

  if (facing === "up") {
    // The back of the head is all hair.
    ctx.beginPath();
    ctx.ellipse(cx, cy - 1, r + 1, r + 0.5, 0, Math.PI * 0.98, Math.PI * 2.02);
    ctx.lineTo(cx + r + 1, cy + 8);
    ctx.quadraticCurveTo(cx, cy + 14, cx - r - 1, cy + 8);
    ctx.closePath();
    ctx.fillStyle = lit(ctx, look.hair, cx - r, cy - r, cx + r, cy + r);
    ctx.fill();
    outline(ctx, look.hair);
    drawHeadphones(ctx, look, cx, cy, facing);
    return;
  }

  // Features.
  const open = eyeOpen(time, look.seed);
  const lookY = options.lookUp ? -2 : 0;
  const eyes = side ? [6] : [-5.5, 5.5];
  for (const dx of eyes) {
    const ex = cx + dx;
    const ey = cy + 2 + lookY;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 2.1, Math.max(0.35, 2.9 * open), 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK);
    ctx.fill();
    if (open > 0.6) {
      ctx.beginPath();
      ctx.arc(ex + 0.7, ey - 1.1, 0.75, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
    }
    // Brows.
    ctx.beginPath();
    ctx.moveTo(ex - 2.6, ey - 5.2 + (options.lookUp ? -1 : 0));
    ctx.quadraticCurveTo(ex, ey - 6.6, ex + 2.6, ey - 5.4);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = rgba(shade(look.hair, -0.25), 0.85);
    ctx.stroke();
  }
  // Cheeks.
  ctx.fillStyle = "rgba(255,120,120,0.22)";
  for (const dx of side ? [3] : [-8.5, 8.5]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx, cy + 7, 3, 1.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (side) {
    // Nose.
    ctx.beginPath();
    ctx.moveTo(cx + r - 0.5, cy + 1);
    ctx.quadraticCurveTo(cx + r + 3, cy + 4, cx + r - 0.5, cy + 6);
    ctx.fillStyle = rgba(look.skin);
    ctx.fill();
    outline(ctx, look.skin, 1);
  }
  // Mouth.
  const mx = side ? cx + 8 : cx;
  const my = cy + 9;
  ctx.beginPath();
  switch (options.mouth ?? "smile") {
    case "open":
      ctx.ellipse(mx, my + 0.5, 2.2, 2.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(shade(INK, 0.2));
      ctx.fill();
      break;
    case "grin":
      ctx.moveTo(mx - 3.6, my - 0.5);
      ctx.quadraticCurveTo(mx, my + 4, mx + 3.6, my - 0.5);
      ctx.closePath();
      ctx.fillStyle = "rgba(120,40,50,0.9)";
      ctx.fill();
      break;
    case "flat":
      ctx.moveTo(mx - 2.4, my + 0.5);
      ctx.lineTo(mx + 2.4, my + 0.5);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = rgba(INK, 0.75);
      ctx.stroke();
      break;
    default:
      ctx.moveTo(mx - 2.8, my - 0.2);
      ctx.quadraticCurveTo(mx, my + 2.6, mx + 2.8, my - 0.2);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = rgba(INK, 0.75);
      ctx.stroke();
  }

  if (look.glasses) {
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = "rgba(30,30,40,0.95)";
    for (const dx of eyes) {
      ctx.beginPath();
      ctx.roundRect(cx + dx - 4.2, cy - 1.6 + lookY * 0.3, 8.4, 7, 2.4);
      ctx.stroke();
      ctx.fillStyle = "rgba(200,230,255,0.16)";
      ctx.fill();
    }
    if (!side) {
      ctx.beginPath();
      ctx.moveTo(cx - 1.3, cy + 1.2);
      ctx.lineTo(cx + 1.3, cy + 1.2);
      ctx.stroke();
    }
  }

  drawFrontHair(ctx, look, cx, cy, side);
  drawHeadphones(ctx, look, cx, cy, facing);
}

function drawFrontHair(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  cx: number,
  cy: number,
  side: boolean,
) {
  const r = 15;
  ctx.fillStyle = lit(ctx, look.hair, cx - r, cy - r, cx + r, cy);
  ctx.beginPath();
  switch (look.hairStyle) {
    case 0: // Short crop.
      ctx.ellipse(cx, cy - 4, r + 1, r - 3, 0, Math.PI, Math.PI * 2);
      ctx.quadraticCurveTo(cx + r - 2, cy - 7, cx + 2, cy - 8);
      ctx.quadraticCurveTo(cx - 8, cy - 9, cx - r - 1, cy - 4);
      break;
    case 1: // Swept fringe.
      ctx.ellipse(cx, cy - 3, r + 1.5, r - 1, 0, Math.PI, Math.PI * 2);
      ctx.quadraticCurveTo(cx + 6, cy - 4, cx - 4, cy - 2);
      ctx.quadraticCurveTo(cx - 10, cy - 2, cx - r - 1.5, cy + 2);
      break;
    case 2: // Spiky.
      ctx.moveTo(cx - r - 1, cy - 2);
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        const rr = i % 2 ? r + 6 : r + 1;
        ctx.lineTo(cx + Math.cos(a) * rr, cy - 3 + Math.sin(a) * rr);
      }
      ctx.lineTo(cx + r + 1, cy - 2);
      ctx.quadraticCurveTo(cx, cy - 8, cx - r - 1, cy - 2);
      break;
    case 3: // Long, parted.
      ctx.ellipse(cx, cy - 3, r + 2, r - 1, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(cx + r + 2, cy + 8);
      ctx.quadraticCurveTo(cx + r - 3, cy - 4, cx + 1, cy - 8);
      ctx.quadraticCurveTo(cx - r + 3, cy - 4, cx - r - 2, cy + 8);
      break;
    case 4: // Bun, tidy front.
      ctx.ellipse(cx, cy - 4, r + 1, r - 2.5, 0, Math.PI, Math.PI * 2);
      ctx.quadraticCurveTo(cx, cy - 10, cx - r - 1, cy - 4);
      break;
    default: // Bob with bangs.
      ctx.ellipse(cx, cy - 3, r + 2, r - 0.5, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(cx + r + 2, cy + 6);
      ctx.lineTo(cx + r - 3, cy + 6);
      ctx.quadraticCurveTo(cx + r - 4, cy - 4, cx, cy - 4);
      ctx.quadraticCurveTo(cx - r + 4, cy - 4, cx - r + 3, cy + 6);
      ctx.lineTo(cx - r - 2, cy + 6);
  }
  ctx.closePath();
  ctx.fill();
  outline(ctx, look.hair);
  // Sheen.
  ctx.beginPath();
  ctx.ellipse(cx - 5 + (side ? 3 : 0), cy - r + 3, 5, 1.8, -0.35, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fill();
}

function drawHeadphones(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  cx: number,
  cy: number,
  facing: Facing,
) {
  if (!look.headphones) return;
  const color = look.headphoneColor;
  ctx.beginPath();
  ctx.arc(cx, cy - 1, 17, Math.PI * 1.08, Math.PI * 1.92);
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = rgba(shade(color, -0.1));
  ctx.stroke();
  const side = facing === "left" || facing === "right";
  const cups = side ? [-3] : [-16, 16];
  for (const dx of cups) {
    ctx.beginPath();
    ctx.roundRect(cx + dx - 3.5, cy - 4, 7, 11, 3);
    ctx.fillStyle = lit(ctx, color, cx + dx - 4, cy - 4, cx + dx + 4, cy + 7);
    ctx.fill();
    outline(ctx, color, 1);
  }
}

/**
 * A monkey's head: round fur, big ears with pale insides, a tuft on top, and
 * a pale heart-shaped face around the eyes and muzzle.
 */
function drawMonkeyHead(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  cx: number,
  cy: number,
  options: FaceOptions,
) {
  const { facing, time } = options;
  const fur = look.hair;
  const face = look.skin;
  const r = 15;
  const side = facing === "left" || facing === "right";

  // Neck.
  ctx.fillStyle = rgba(shade(fur, -0.15));
  ctx.fillRect(cx - 5, cy + r - 4, 10, 7);

  // Ears behind the head.
  const ears = side ? [-4] : facing === "up" ? [-16, 16] : [-16.5, 16.5];
  for (const dx of ears) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + 1, 7, 0, Math.PI * 2);
    ctx.fillStyle = lit(ctx, fur, cx + dx - 7, cy - 6, cx + dx + 7, cy + 8);
    ctx.fill();
    outline(ctx, fur);
    if (facing !== "up") {
      ctx.beginPath();
      ctx.arc(cx + dx * (side ? 1 : 0.97), cy + 1.5, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(shade(face, -0.08));
      ctx.fill();
    }
  }

  // Head and tuft.
  ctx.beginPath();
  ctx.ellipse(cx, cy, r + 0.5, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = lit(ctx, fur, cx - r, cy - r, cx + r, cy + r);
  ctx.fill();
  outline(ctx, fur);
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy - r + 1.5);
  ctx.quadraticCurveTo(cx - 1, cy - r - 6, cx + 1, cy - r - 3);
  ctx.quadraticCurveTo(cx + 3, cy - r - 7, cx + 5, cy - r + 1.5);
  ctx.closePath();
  ctx.fillStyle = rgba(shade(fur, -0.06));
  ctx.fill();
  outline(ctx, fur, 1.1);
  if (facing === "up") return;

  if (side) {
    // Profile: pale face toward the front, muzzle sticking out.
    ctx.beginPath();
    ctx.ellipse(cx + 6, cy + 1, 8, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = lit(ctx, face, cx - 2, cy - 8, cx + 14, cy + 10);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 11, cy + 6, 6.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, face, 1);
    const open = eyeOpen(time, look.seed);
    ctx.beginPath();
    ctx.ellipse(cx + 7, cy - 1, 1.9, Math.max(0.35, 2.6 * open), 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 15.5, cy + 5, 0.9, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Face mask: two eye patches merged with the muzzle.
  ctx.beginPath();
  ctx.ellipse(cx - 5, cy - 1, 6.2, 6.5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 5, cy - 1, 6.2, 6.5, 0, 0, Math.PI * 2);
  ctx.moveTo(cx + 10, cy + 6);
  ctx.ellipse(cx, cy + 6, 10, 7.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = lit(ctx, face, cx - 10, cy - 8, cx + 10, cy + 14);
  ctx.fill();

  const open = eyeOpen(time, look.seed);
  const lookY = options.lookUp ? -1.6 : 0;
  for (const dx of [-5, 5]) {
    const ex = cx + dx;
    const ey = cy - 0.5 + lookY;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 2.2, Math.max(0.35, 2.8 * open), 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(INK);
    ctx.fill();
    if (open > 0.6) {
      ctx.beginPath();
      ctx.arc(ex + 0.7, ey - 1.1, 0.8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
    }
  }
  // Nostrils.
  ctx.fillStyle = rgba(shade(face, -0.5));
  for (const dx of [-1.8, 1.8]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx, cy + 5, 0.9, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mouth.
  const my = cy + 9;
  ctx.beginPath();
  switch (options.mouth ?? "smile") {
    case "open":
      ctx.ellipse(cx, my + 0.5, 2.6, 2.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(shade(INK, 0.2));
      ctx.fill();
      break;
    case "grin":
      ctx.moveTo(cx - 4.5, my - 0.5);
      ctx.quadraticCurveTo(cx, my + 4, cx + 4.5, my - 0.5);
      ctx.closePath();
      ctx.fillStyle = "rgba(120,40,50,0.9)";
      ctx.fill();
      break;
    case "flat":
      ctx.moveTo(cx - 3, my + 0.5);
      ctx.lineTo(cx + 3, my + 0.5);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = rgba(INK, 0.75);
      ctx.stroke();
      break;
    default:
      ctx.moveTo(cx - 3.6, my - 0.4);
      ctx.quadraticCurveTo(cx, my + 2.8, cx + 3.6, my - 0.4);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = rgba(INK, 0.75);
      ctx.stroke();
  }
}

/** A curled tail from the hip, drawn behind the body. */
function drawTail(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  x: number,
  y: number,
  direction: 1 | -1,
  time: number,
) {
  const sway = Math.sin(time * 2.4 + look.seed) * 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(
    x + direction * 14,
    y + 2,
    x + direction * (20 + sway),
    y - 10,
    x + direction * (16 + sway),
    y - 20,
  );
  ctx.quadraticCurveTo(
    x + direction * (12 + sway),
    y - 26,
    x + direction * (8 + sway),
    y - 21,
  );
  ctx.lineCap = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = rgba(shade(look.hair, -0.55), 0.9);
  ctx.stroke();
  ctx.lineWidth = 3.8;
  ctx.strokeStyle = rgba(look.hair);
  ctx.stroke();
  ctx.lineCap = "butt";
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  cx: number,
  top: number,
  height: number,
  width: number,
  facing: Facing,
) {
  ctx.beginPath();
  ctx.roundRect(cx - width / 2, top, width, height, [10, 10, 6, 6]);
  ctx.fillStyle = lit(ctx, look.shirt, cx - width / 2, top, cx + width / 2, top + height);
  ctx.fill();
  outline(ctx, look.shirt);
  if (look.monkey) {
    // A pale belly instead of a shirt.
    if (facing !== "up") {
      ctx.beginPath();
      ctx.ellipse(
        cx + (facing === "down" ? 0 : 2),
        top + height * 0.58,
        width * (facing === "down" ? 0.3 : 0.26),
        height * 0.34,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = rgba(shade(look.skin, -0.04));
      ctx.fill();
    }
    return;
  }
  if (facing === "down") {
    // Collar and lanyard badge.
    ctx.beginPath();
    ctx.moveTo(cx - 5, top + 0.5);
    ctx.lineTo(cx, top + 6);
    ctx.lineTo(cx + 5, top + 0.5);
    ctx.fillStyle = rgba(shade(look.skin, -0.08));
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 4, top + 2);
    ctx.lineTo(cx + 3, top + height * 0.55);
    ctx.moveTo(cx + 4, top + 2);
    ctx.lineTo(cx + 3, top + height * 0.55);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(30,40,60,0.55)";
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(cx, top + height * 0.52, 6.5, 8, 1.5);
    ctx.fillStyle = "rgba(250,250,252,0.95)";
    ctx.fill();
    ctx.fillStyle = rgba(shade(look.shirt, -0.3));
    ctx.fillRect(cx + 1.2, top + height * 0.52 + 1.4, 4, 1.6);
  }
  // Soft fold shading.
  ctx.beginPath();
  ctx.roundRect(cx - width / 2 + 2, top + height - 6, width - 4, 4, 2);
  ctx.fillStyle = rgba(shade(look.shirt, -0.35), 0.25);
  ctx.fill();
}

/** Characters are modeled at this size and scaled up to suit the desks. */
export const CHARACTER_SCALE = 1.28;

/** Draws one character with its feet (or, seated, its hips) at (x, y). */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  x: number,
  y: number,
  pose: Pose,
  time: number,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x * 2) / 2, Math.round(y * 2) / 2);
  ctx.scale(CHARACTER_SCALE, CHARACTER_SCALE);
  if (pose.kind === "sit") drawSeated(ctx, look, pose.mode, time);
  else drawStanding(ctx, look, pose, time);
  ctx.restore();
}

function drawStanding(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  pose: Extract<Pose, { kind: "stand" | "walk" }>,
  time: number,
) {
  const walking = pose.kind === "walk";
  const phase = walking ? pose.phase : 0;
  const swing = walking ? Math.sin(phase) : 0;
  const bob = walking ? Math.abs(Math.cos(phase)) * 2.2 : Math.sin(time * 2 + look.seed) * 0.5;
  const facing = pose.facing;

  // Contact shadow.
  ctx.beginPath();
  ctx.ellipse(0, 0, 15 - bob, 4.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20,12,8,0.28)";
  ctx.fill();

  ctx.save();
  if (facing === "left") ctx.scale(-1, 1);
  const hip = -24 + bob * 0.4 - bob;
  const top = hip - 27;
  const side = facing === "left" || facing === "right";

  if (look.monkey) {
    // The tail trails behind: away from the walk, or out to one side.
    drawTail(ctx, look, side ? -8 : 9, hip - 2, side ? -1 : 1, time);
  }

  if (side) {
    // Far arm and leg, then body, then near arm and leg.
    limb(ctx, 2, top + 5, 18, 6.5, swing * 0.7, shade(look.shirt, -0.18), { color: shade(look.skin, -0.12), radius: 3.2 });
    limb(ctx, -1, hip, 22, 8, -swing * 0.55, shade(look.pants, -0.15), { color: look.shoes, radius: 4 });
    drawTorso(ctx, look, 0, top, 28, 19, facing);
    limb(ctx, 1, hip, 22, 8, swing * 0.55, look.pants, { color: look.shoes, radius: 4 });
    limb(ctx, -1, top + 5, 18, 6.5, -swing * 0.7, look.shirt, { color: look.skin, radius: 3.3 });
    drawHead(ctx, look, 1, top - 13, { facing: "right", time });
  } else {
    const liftL = walking ? Math.max(0, swing) * 4.5 : 0;
    const liftR = walking ? Math.max(0, -swing) * 4.5 : 0;
    limb(ctx, -6, hip, 22 - liftL, 8.5, 0, look.pants, { color: look.shoes, radius: 4.3 });
    limb(ctx, 6, hip, 22 - liftR, 8.5, 0, look.pants, { color: look.shoes, radius: 4.3 });
    const armSwing = walking ? swing * 0.22 : 0;
    if (facing === "up") drawHead(ctx, look, 0, top - 13, { facing, time });
    limb(ctx, -15, top + 5, 18, 7, 0.12 + armSwing, look.shirt, { color: look.skin, radius: 3.4 });
    limb(ctx, 15, top + 5, 18, 7, -0.12 + armSwing, look.shirt, { color: look.skin, radius: 3.4 });
    drawTorso(ctx, look, 0, top, 28, 28, facing);
    if (facing !== "up") drawHead(ctx, look, 0, top - 13, { facing, time });
  }
  ctx.restore();
}

function drawSeated(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  mode: SitMode,
  time: number,
) {
  const t = time + look.seed;
  const breathe = Math.sin(t * 1.9) * 0.6;
  const lean = mode === "relaxed" ? 2 : mode === "typing" ? -1 : 0;
  const top = -30 + lean - breathe;
  const headY = top - 13 + (mode === "typing" ? Math.sin(t * 7) * 0.35 : 0);
  const tilt =
    mode === "thinking" ? 0.13 : mode === "typing" ? Math.sin(t * 0.7) * 0.04 : 0;

  if (look.monkey) drawTail(ctx, look, 11, -4, 1, time);

  // Arms behind the body first, so the torso overlaps their roots.
  const stretch = mode === "relaxed" && t % 9 < 2.6;
  if (stretch) {
    const lift = Math.sin(((t % 9) / 2.6) * Math.PI);
    limb(ctx, -14, top + 6, 17, 7, Math.PI - 0.5 * lift - 0.35, look.shirt, { color: look.skin, radius: 3.4 });
    limb(ctx, 14, top + 6, 17, 7, -Math.PI + 0.5 * lift + 0.35, look.shirt, { color: look.skin, radius: 3.4 });
  }

  drawTorso(ctx, look, 0, top, 30, 29, "down");

  ctx.save();
  ctx.translate(0, headY);
  ctx.rotate(tilt);
  drawHead(ctx, look, 0, 0, {
    facing: "down",
    time,
    lookUp: mode === "thinking",
    mouth:
      mode === "waving" ? "open" : mode === "relaxed" ? "grin" : mode === "thinking" ? "flat" : "smile",
  });
  ctx.restore();

  if (stretch) return;
  switch (mode) {
    case "typing": {
      const l = Math.sin(t * 17) * 1.6;
      const r = Math.sin(t * 15.3 + 1.7) * 1.6;
      // Forearms reach in toward the keyboard behind the laptop lid.
      limb(ctx, -14, top + 6, 17 + l, 7, -0.42, look.shirt, { color: look.skin, radius: 3.4 });
      limb(ctx, 14, top + 6, 17 + r, 7, 0.42, look.shirt, { color: look.skin, radius: 3.4 });
      break;
    }
    case "thinking": {
      limb(ctx, -14, top + 6, 17, 7, 0.32, look.shirt, { color: look.skin, radius: 3.4 });
      // Upper arm down, forearm up to the chin.
      limb(ctx, 14, top + 6, 12, 7, -0.1, look.shirt);
      limb(ctx, 13, top + 18, 13, 6.5, Math.PI - 0.55, look.shirt, { color: look.skin, radius: 3.4 });
      break;
    }
    case "waving": {
      limb(ctx, -14, top + 6, 17, 7, 0.3, look.shirt, { color: look.skin, radius: 3.4 });
      const wave = Math.sin(t * 9) * 0.35;
      limb(ctx, 14, top + 6, 19, 7, -(Math.PI - 0.5) + wave, look.shirt, { color: look.skin, radius: 3.8 });
      break;
    }
    case "relaxed": {
      limb(ctx, -14, top + 6, 17, 7, 0.3, look.shirt, { color: look.skin, radius: 3.4 });
      // A mug, raised for a sip now and then.
      const cycle = (t % 7) / 7;
      const sip = cycle < 0.62 ? 0 : Math.sin(((cycle - 0.62) / 0.38) * Math.PI);
      const upper = -0.15;
      limb(ctx, 14, top + 6, 12, 7, upper, look.shirt);
      const ex = 14 - Math.sin(upper) * 12;
      const ey = top + 6 + Math.cos(upper) * 12;
      const hx = 7 - sip * 4;
      const hy = top + 16 - sip * 17;
      const reach = Math.max(6, Math.hypot(hx - ex, hy - ey));
      limb(ctx, ex, ey, reach, 6.5, Math.atan2(-(hx - ex), hy - ey), look.shirt, { color: look.skin, radius: 3.3 });
      ctx.beginPath();
      ctx.roundRect(hx - 4, hy - 6, 8, 9, 2);
      ctx.fillStyle = "rgba(245,245,240,1)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(90,80,80,0.8)";
      ctx.stroke();
      ctx.fillStyle = rgba(shade(look.shirt, -0.1));
      ctx.fillRect(hx - 4, hy - 3, 8, 2.5);
      break;
    }
  }
}
