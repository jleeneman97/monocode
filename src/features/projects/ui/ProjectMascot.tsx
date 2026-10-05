import { projectMascot, type MascotLayer } from "../model/projectMascots";

type Props = {
  project: string;
  /** Project color; omit to inherit the surrounding text color. */
  color?: string;
  /** Explicit pick from the project menu; falls back to the hashed one. */
  name?: string | null;
  className?: string;
  /** Cycles the mascot's two frames while a turn is in flight. */
  active?: boolean;
  /**
   * The project is on its automatic color, so a mascot with colors of its own
   * shows all of them. A picked color paints a plain mascot in that color,
   * and on one with its own colors replaces only the body color.
   */
  multicolor?: boolean;
};

/** Pixel mascot standing in for the project's color dot. */
export function ProjectMascot({
  project,
  color,
  name,
  className = "size-3 shrink-0",
  active = false,
  multicolor = false,
}: Props) {
  const mascot = projectMascot(project, name);
  const frame = (path: string, layers: readonly MascotLayer[] | undefined, frameClass?: string) =>
    layers ? (
      <g className={frameClass}>
        {layers.map((layer) => (
          <path
            key={layer.fill}
            d={layer.path}
            fill={layer.tint && !multicolor ? "currentColor" : layer.fill}
          />
        ))}
      </g>
    ) : (
      <path className={frameClass} d={path} />
    );
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${mascot.grid} ${mascot.grid}`}
      shapeRendering="crispEdges"
      className={`${className} ${active ? "mascot-active" : ""}`}
      fill="currentColor"
      style={color ? { color } : undefined}
    >
      {active ? (
        <>
          {frame(mascot.restPath, mascot.restLayers, "mascot-rest")}
          {frame(mascot.talkPath, mascot.talkLayers, "mascot-talk")}
        </>
      ) : (
        frame(mascot.restPath, mascot.restLayers)
      )}
    </svg>
  );
}
