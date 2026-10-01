import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CELL, layoutOffice, type OfficeLayout } from "../model/officeLayout";
import {
  officeStatusLabel,
  type OfficeDesk,
  type OfficeDeskStatus,
  type OfficeZone,
} from "../model/officeState";
import { OfficeScene } from "../render/scene";

type Props = {
  zones: OfficeZone[];
  onOpenSession: (sessionId: string) => void;
  onOpenProject: (path: string) => void;
};

/**
 * The office floor: a canvas paints the room and its people under a
 * scrolling layer of HTML that carries the text, so labels stay crisp,
 * selectable by assistive tech, and clickable.
 */
export function OfficeFloor({ zones, onOpenSession, onOpenProject }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OfficeScene | null>(null);
  sceneRef.current ??= new OfficeScene();
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo<OfficeLayout | null>(
    () => (width > 0 ? layoutOffice(zones, width) : null),
    [width, zones],
  );
  const desks = useMemo(() => zones.flatMap((zone) => zone.desks), [zones]);

  useEffect(() => {
    if (layout) sceneRef.current?.update(layout, desks);
  }, [layout, desks]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => sceneRef.current?.setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  // The render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const scroller = scrollRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !scroller || !ctx) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = (now - last) / 1000;
      last = now;
      const scene = sceneRef.current;
      if (!scene) return;
      scene.tick(dt);
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      scene.render(
        ctx,
        { x: scroller.scrollLeft, y: scroller.scrollTop, w, h },
        new Date(),
      );
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#2b2320]">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-auto overflow-x-auto overscroll-none"
      >
        {layout ? (
          <div
            className="relative"
            style={{ width: layout.width, height: layout.height }}
          >
            {layout.zones.map((zone) => (
              <ZoneSign key={zone.id} zone={zone} desks={zones.find((z) => z.id === zone.id)?.desks ?? []} />
            ))}
            {desks.map((desk) => {
              const slot = layout.slots.get(desk.key);
              if (!slot) return null;
              return (
                <DeskOverlay
                  key={desk.key}
                  desk={desk}
                  x={slot.x}
                  y={slot.y}
                  w={slot.w}
                  h={slot.h}
                  onOpen={() =>
                    desk.sessionId ? onOpenSession(desk.sessionId) : onOpenProject(desk.path)
                  }
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ZoneSign({
  zone,
  desks,
}: {
  zone: OfficeLayout["zones"][number];
  desks: OfficeDesk[];
}) {
  const working = desks.filter((desk) => desk.agents > 0).length;
  return (
    <div
      className="pointer-events-none absolute flex items-center gap-2 font-sans"
      style={{ left: zone.x + 32, top: zone.y + 16, maxWidth: zone.w - 110 }}
    >
      <span className="truncate text-[14px] font-semibold tracking-wide text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
        {zone.name}
      </span>
      <span className="shrink-0 rounded-full bg-black/25 px-2 py-0.5 text-[11px] text-white/70">
        {desks.length} {desks.length === 1 ? "desk" : "desks"}
        {working ? ` · ${working} active` : ""}
      </span>
    </div>
  );
}

const PILL: Record<OfficeDeskStatus, { box: string; dot: string }> = {
  working: {
    box: "bg-emerald-500/95 text-white ring-emerald-300/40",
    dot: "bg-white",
  },
  thinking: {
    box: "bg-teal-500/95 text-white ring-teal-200/40",
    dot: "bg-white",
  },
  "needs-input": {
    box: "bg-amber-400 text-amber-950 ring-amber-200/60",
    dot: "bg-amber-950",
  },
  updates: {
    box: "bg-sky-500 text-white ring-sky-200/60",
    dot: "bg-white",
  },
  offline: {
    box: "bg-[#3a1f22]/85 text-red-300 ring-red-400/30",
    dot: "bg-red-400",
  },
};

function DeskOverlay({
  desk,
  x,
  y,
  w,
  h,
  onOpen,
}: {
  desk: OfficeDesk;
  x: number;
  y: number;
  w: number;
  h: number;
  onOpen: () => void;
}) {
  const style = PILL[desk.status];
  const label = officeStatusLabel(desk);
  const busy = desk.status !== "offline";
  const agents = desk.agents === 1 ? "1 agent" : `${desk.agents} agents`;
  const description = [
    desk.name,
    label,
    desk.agents ? agents : null,
    desk.activity && desk.activity !== label ? desk.activity : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${description}. ${desk.sessionId ? "Open conversation" : "Open project"}`}
      title={description}
      className="group absolute rounded-2xl font-sans outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-white/60"
      style={{ left: x + 6, top: y, width: w - 12, height: h - 4 }}
    >
      {/* Status bubble above the worker's head. Keyed so a change pops in. */}
      <span
        key={desk.status}
        data-status={desk.status}
        className={`office-bubble absolute left-1/2 top-[2px] flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.35)] ring-1 ${style.box}`}
        style={{ transform: "translateX(-50%)" }}
      >
        <span className="relative flex size-1.5">
          {busy ? (
            <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-70 ${style.dot}`} />
          ) : null}
          <span className={`relative inline-flex size-1.5 rounded-full ${style.dot}`} />
        </span>
        <span className={desk.status === "thinking" ? "office-dots" : undefined}>{label}</span>
        {desk.agents > 0 ? (
          <span className="rounded-full bg-black/20 px-1.5 text-[10px] font-medium tabular-nums">
            {agents}
          </span>
        ) : null}
      </span>
      {/* Name plate under the desk. */}
      <span
        className="absolute left-1/2 flex max-w-[88%] -translate-x-1/2 items-center gap-1.5 rounded-md bg-black/35 px-2 py-0.5 text-[11.5px] font-medium text-white/90 shadow-sm backdrop-blur-[2px] transition-colors group-hover:bg-black/55"
        style={{ top: CELL.plateY }}
      >
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: desk.color }} />
        <span className="truncate">{desk.name}</span>
      </span>
    </button>
  );
}
