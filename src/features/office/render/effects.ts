import { rgba, shade, type Rgb } from "./color";

/** Particles, speech bubbles, and screen light. */

type Particle = {
  kind: "glyph" | "confetti" | "dust" | "puff";
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: Rgb;
  text?: string;
  rotation: number;
  spin: number;
  size: number;
};

const GLYPHS = ["{ }", "</>", "=>", "( )", ";", "01", "fn", "[ ]", "&&", "#"];
const CONFETTI: Rgb[] = [
  { r: 255, g: 99, b: 99 },
  { r: 255, g: 206, b: 84 },
  { r: 92, g: 214, b: 140 },
  { r: 96, g: 170, b: 255 },
  { r: 196, g: 126, b: 255 },
];

export class Particles {
  private items: Particle[] = [];

  /** Bits of code drifting up beside a busy worker's head. */
  glyph(x: number, y: number, color: Rgb) {
    const side = Math.random() < 0.5 ? -1 : 1;
    this.items.push({
      kind: "glyph",
      x: x + side * (26 + Math.random() * 16),
      y,
      vx: side * (2 + Math.random() * 5),
      vy: -18 - Math.random() * 10,
      life: 0,
      max: 1.8 + Math.random() * 0.6,
      color,
      text: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      rotation: (Math.random() - 0.5) * 0.3,
      spin: (Math.random() - 0.5) * 0.4,
      size: 11 + Math.random() * 3,
    });
  }

  confetti(x: number, y: number) {
    for (let i = 0; i < 34; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 70 + Math.random() * 90;
      this.items.push({
        kind: "confetti",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        max: 1.4 + Math.random() * 0.8,
        color: CONFETTI[i % CONFETTI.length],
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 14,
        size: 3 + Math.random() * 2.5,
      });
    }
  }

  /** A little dust kicked up when someone sits down or stands up. */
  puff(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      this.items.push({
        kind: "puff",
        x: x + (Math.random() - 0.5) * 20,
        y,
        vx: (Math.random() - 0.5) * 24,
        vy: -6 - Math.random() * 6,
        life: 0,
        max: 0.6 + Math.random() * 0.3,
        color: { r: 240, g: 230, b: 220 },
        rotation: 0,
        spin: 0,
        size: 3 + Math.random() * 3,
      });
    }
  }

  dust(x: number, y: number) {
    this.items.push({
      kind: "dust",
      x,
      y,
      vx: (Math.random() - 0.3) * 4,
      vy: (Math.random() - 0.5) * 3,
      life: 0,
      max: 4 + Math.random() * 4,
      color: { r: 255, g: 244, b: 214 },
      rotation: 0,
      spin: 0,
      size: 0.8 + Math.random() * 1.2,
    });
  }

  get count(): number {
    return this.items.length;
  }

  update(dt: number) {
    for (const p of this.items) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
      if (p.kind === "confetti") {
        p.vy += 220 * dt;
        p.vx *= 1 - 1.6 * dt;
        p.spin *= 1 - 0.5 * dt;
      }
      if (p.kind === "puff") {
        p.vx *= 1 - 3 * dt;
      }
    }
    this.items = this.items.filter((p) => p.life < p.max);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.items) {
      const t = p.life / p.max;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      switch (p.kind) {
        case "glyph": {
          const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
          ctx.font = `700 ${p.size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = "center";
          ctx.shadowColor = rgba(shade(p.color, 0.1), 0.95 * alpha);
          ctx.shadowBlur = 8;
          ctx.fillStyle = rgba(shade(p.color, 0.8), 0.95 * alpha);
          ctx.fillText(p.text ?? "", 0, 0);
          break;
        }
        case "confetti": {
          ctx.globalAlpha = 1 - Math.max(0, t - 0.7) / 0.3;
          ctx.fillStyle = rgba(p.color);
          ctx.scale(1, Math.abs(Math.cos(p.rotation * 1.7)) + 0.2);
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          break;
        }
        case "puff": {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (1 + t), 0, Math.PI * 2);
          ctx.fillStyle = rgba(p.color, 0.35 * (1 - t));
          ctx.fill();
          break;
        }
        case "dust": {
          const alpha = Math.sin(t * Math.PI) * 0.7;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = rgba(p.color, alpha);
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  }
}

/** A thought cloud with dots that fill in one by one. */
export function drawThoughtBubble(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const float = Math.sin(time * 2.2) * 1.5;
  ctx.save();
  ctx.translate(x, y + float);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.strokeStyle = "rgba(60,60,80,0.35)";
  ctx.lineWidth = 1;
  for (const [dx, dy, r] of [
    [-12, 18, 2.6],
    [-6, 11, 3.8],
  ] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(8, -2, 17, 11, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(16, 1, 9, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const step = Math.floor(time * 2.5) % 4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(1 + i * 7, -1, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = i < step ? "rgba(70,90,140,0.95)" : "rgba(70,90,140,0.25)";
    ctx.fill();
  }
  ctx.restore();
}

/** An amber "!" that pulses while an agent waits on the user. */
export function drawAlertBubble(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const pulse = 1 + Math.sin(time * 6) * 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = "rgba(255,170,40,0.8)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(255,184,46)";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(-4, 8);
  ctx.lineTo(-9, 14);
  ctx.lineTo(1, 9);
  ctx.fill();
  ctx.fillStyle = "rgb(60,36,6)";
  ctx.fillRect(-1.5, -6, 3, 8);
  ctx.beginPath();
  ctx.arc(0, 5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A blue envelope that bobs and pulses while finished work waits unread. */
export function drawMailBubble(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const bob = Math.sin(time * 3.2) * 2;
  const pulse = 1 + Math.max(0, Math.sin(time * 5)) * 0.07;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(pulse, pulse);
  // Ripple ring.
  const ring = (time * 0.9) % 1;
  ctx.beginPath();
  ctx.arc(0, 0, 12 + ring * 12, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(56,189,248,${0.55 * (1 - ring)})`;
  ctx.stroke();
  ctx.shadowColor = "rgba(56,189,248,0.85)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(14,165,233)";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(5, 9);
  ctx.lineTo(10, 15);
  ctx.lineTo(-1, 11);
  ctx.fill();
  // Envelope.
  ctx.beginPath();
  ctx.roundRect(-6.5, -4.5, 13, 9, 1.5);
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6.5, -4);
  ctx.lineTo(0, 1);
  ctx.lineTo(6.5, -4);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = "rgb(14,116,170)";
  ctx.stroke();
  ctx.restore();
}

/** Screen light on the worker's face and the desk, stronger in the dark. */
export function drawScreenGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: Rgb,
  strength: number,
  time: number,
) {
  const flicker = 0.9 + 0.1 * Math.sin(time * 5.3 + x);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, 56);
  g.addColorStop(0, rgba(shade(color, 0.55), 0.3 * strength * flicker));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - 56, y - 56, 112, 112);
  ctx.restore();
}

/** Warm cone from a desk lamp at night. */
export function drawLampGlow(ctx: CanvasRenderingContext2D, x: number, y: number, strength: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, 64);
  g.addColorStop(0, `rgba(255,214,140,${0.32 * strength})`);
  g.addColorStop(1, "rgba(255,214,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 64, y - 64, 128, 128);
  ctx.restore();
}
