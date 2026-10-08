import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useLockOverscroll } from "../../../shared/hooks/useLockOverscroll";

type Props = {
  /** Prompts oldest first, so the newest sits next to the input. */
  prompts: readonly string[];
  active: number;
  onActive: (index: number) => void;
  onPick: (prompt: string) => void;
};

/** Earlier prompts of this session, recalled with ArrowUp from the composer. */
export function PromptHistoryPicker({
  prompts,
  active,
  onActive,
  onPick,
}: Props) {
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const activeRef = useRef<HTMLButtonElement>(null);
  const pointer = useRef({ x: Number.NaN, y: Number.NaN, allow: false });
  const fromPointer = useRef(false);

  useEffect(() => {
    if (fromPointer.current) {
      fromPointer.current = false;
      return;
    }
    pointer.current.allow = false;
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onListMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.clientX === pointer.current.x && e.clientY === pointer.current.y) {
      return;
    }
    pointer.current = { x: e.clientX, y: e.clientY, allow: true };
  };

  const onRowEnter = (index: number) => {
    if (!pointer.current.allow) return;
    fromPointer.current = true;
    onActive(index);
  };

  return (
    <div
      data-prompt-history-picker
      className="prompt-history-picker overflow-hidden rounded-lg border border-content/10 bg-content/5 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-3 pt-2 pb-1 text-[11px] text-content/45">
        <span>Previous messages</span>
        <span className="font-mono">↑↓ · Enter · Esc</span>
      </div>
      <div
        ref={lockOverscroll}
        role="listbox"
        aria-label="Previous messages in this session"
        onMouseMove={onListMouseMove}
        className="max-h-[min(280px,45vh)] overflow-y-auto overscroll-none px-1 pb-1"
      >
        {prompts.map((prompt, index) => {
          const highlighted = index === active;
          const lines = prompt.split(/\r?\n/).filter((line) => line.trim());
          return (
            <button
              key={`${index}:${prompt}`}
              ref={highlighted ? activeRef : undefined}
              type="button"
              role="option"
              aria-selected={highlighted}
              title={prompt}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => onRowEnter(index)}
              onClick={() => onPick(prompt)}
              className={`flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug ${
                highlighted ? "bg-selection text-content" : "text-content/80"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">
                {lines[0]?.trim() ?? prompt}
              </span>
              {lines.length > 1 ? (
                <span className="shrink-0 font-mono text-[11px] text-content/40">
                  +{lines.length - 1} lines
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
