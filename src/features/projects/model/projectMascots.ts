/**
 * Pixel mascots used in place of a project's color dot, 8×8 unless noted.
 * '#' paints the project color, '.' stays transparent so the surface shows
 * through — eyes and gaps are holes, like the arcade sprites they borrow from.
 *
 * Each mascot has two frames: `rest`, and `talk` swapped in on a loop while the
 * project has a turn in flight — mouths chew, legs shuffle, flames flicker.
 *
 * A mascot can also carry its own colors. Its rows then use more letters, and
 * each letter takes its `PALETTES` fill. A picked project color replaces only
 * the '#' body color. Where art must be one color (the terminal arcade, the
 * reset scene) the letters paint like '#' or stay holes as `SOLID` says.
 */
const GRID = 8;

type MascotRows = readonly string[];

/**
 * One color of a multicolored frame. A `tint` layer takes the project color
 * once one is picked; the others keep their own color.
 */
export type MascotLayer = { fill: string; path: string; tint?: boolean };

export type ProjectMascot = {
  name: string;
  /** Pixels per side of this mascot's square art. */
  grid: number;
  rest: MascotRows;
  talk: MascotRows;
  /** One-color SVG path data over a grid×grid viewBox, one per frame. */
  restPath: string;
  talkPath: string;
  /** Its own colors, for projects still on the automatic color. */
  restLayers?: readonly MascotLayer[];
  talkLayers?: readonly MascotLayer[];
};

const REST: Record<string, MascotRows> = {
  invader: [
    "..#..#..",
    ".######.",
    "##.##.##",
    "########",
    ".######.",
    ".#.##.#.",
    "#.#..#.#",
    "........",
  ],
  ghost: [
    "..####..",
    ".######.",
    "##.##.##",
    "########",
    "########",
    "########",
    "########",
    "#.##.##.",
  ],
  robot: [
    "...#....",
    ".######.",
    ".#.##.#.",
    ".######.",
    ".#....#.",
    ".######.",
    "..#..#..",
    "........",
  ],
  cat: [
    ".#....#.",
    ".##..##.",
    "########",
    "#.####.#",
    "########",
    "###..###",
    ".######.",
    "..#..#..",
  ],
  skull: [
    ".######.",
    "########",
    "##.##.##",
    "########",
    ".##..##.",
    ".######.",
    ".#.##.#.",
    "........",
  ],
  crab: [
    "#......#",
    ".#....#.",
    ".######.",
    "##.##.##",
    "########",
    "#.####.#",
    "#......#",
    "........",
  ],
  mushroom: [
    "..####..",
    ".######.",
    "########",
    "##.##.##",
    "########",
    "...##...",
    "...##...",
    "..####..",
  ],
  rocket: [
    "...##...",
    "..####..",
    "..#..#..",
    "..####..",
    ".######.",
    ".######.",
    "##....##",
    "..####..",
  ],
  dino: [
    "...#####",
    "...##.##",
    "...#####",
    ".#######",
    "########",
    "#####...",
    ".##.##..",
    "..#..#..",
  ],
  frog: [
    "........",
    "##....##",
    "#.####.#",
    "########",
    "########",
    ".######.",
    "##....##",
    "........",
  ],
  // 16×16: '#' fur, 'f' face and inner ears, 'e' eyes.
  monkey: [
    ".......#........",
    ".....#####......",
    "....#######.....",
    "...#########....",
    ".#####fff#####..",
    "##f#fefffef#f##.",
    "##f#fefffef#f##.",
    ".###fffffff###..",
    "...##fffff##....",
    "....#######..###",
    ".....#####...###",
    "....#######..#.#",
    "...#########.#..",
    "...#.#####.###..",
    ".....##.##......",
    "....###.###.....",
  ],
};

const TALK: Record<string, MascotRows> = {
  invader: [
    "..#..#..",
    ".######.",
    "##.##.##",
    "########",
    ".######.",
    "#.####.#",
    ".#....#.",
    "#......#",
  ],
  ghost: [
    "..####..",
    ".######.",
    "#.##.###",
    "########",
    "########",
    "########",
    "########",
    ".##.##.#",
  ],
  robot: [
    "....#...",
    ".######.",
    ".#.##.#.",
    ".######.",
    ".##..##.",
    ".######.",
    ".#....#.",
    "........",
  ],
  cat: [
    ".#....#.",
    ".##..##.",
    "########",
    "#.####.#",
    "########",
    "########",
    ".######.",
    ".#....#.",
  ],
  skull: [
    ".######.",
    "########",
    "##.##.##",
    "########",
    ".##..##.",
    ".######.",
    ".#....#.",
    "..####..",
  ],
  crab: [
    "#......#",
    "##....##",
    ".######.",
    "##.##.##",
    "########",
    ".######.",
    "#.#..#.#",
    "........",
  ],
  mushroom: [
    "........",
    "..####..",
    ".######.",
    "########",
    "##.##.##",
    "...##...",
    "...##...",
    "..####..",
  ],
  rocket: [
    "...##...",
    "..####..",
    "..#..#..",
    "..####..",
    ".######.",
    ".######.",
    "##....##",
    "...##...",
  ],
  dino: [
    "...#####",
    "...##.##",
    "...#####",
    ".#######",
    "########",
    "#####...",
    "..##.##.",
    "..#...#.",
  ],
  frog: [
    "##....##",
    "#.####.#",
    "########",
    "########",
    ".######.",
    "##....##",
    "#......#",
    "........",
  ],
  // Tail flicks up, one arm waves, feet shuffle.
  monkey: [
    ".......#........",
    ".....#####......",
    "....#######.....",
    "...#########....",
    ".#####fff#####..",
    "##f#fefffef#f##.",
    "##f#fefffef#f##.",
    ".###fffffff###.#",
    "...##fffff##..##",
    "....#######..##.",
    ".....#####...#..",
    "..#.#######..#..",
    "...#########.#..",
    ".....#####.###..",
    "....##...##.....",
    "...###...###....",
  ],
};

const OPT_IN_MASCOTS = new Set(["monkey"]);

/** Letters that paint in one-color mode; the rest are holes there. */
const SOLID: Record<string, string> = {
  monkey: "#e",
};

/** Full-color fills per letter, for mascots that have their own colors. */
const PALETTES: Record<string, Record<string, string>> = {
  monkey: {
    "#": "#8f5b34",
    f: "#f2cc9d",
    e: "#2b1a10",
  },
};

/**
 * Merges each row's filled runs into one rect so the path stays short.
 * `paint` lists the letters that count as filled.
 */
export function mascotPath(rows: MascotRows, paint = "#"): string {
  let path = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!paint.includes(row[x])) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < row.length && paint.includes(row[x + run])) run += 1;
      path += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  });
  return path;
}

function layers(rows: MascotRows, palette: Record<string, string>) {
  return Object.entries(palette).map(([letter, fill]) => ({
    fill,
    path: mascotPath(rows, letter),
    // '#' is the body color, which a picked project color replaces.
    ...(letter === "#" ? { tint: true } : {}),
  }));
}

export const PROJECT_MASCOTS: readonly ProjectMascot[] = Object.entries(
  REST,
).map(([name, rest]) => {
  const talk = TALK[name];
  const solid = SOLID[name] ?? "#";
  const palette = PALETTES[name];
  return {
    name,
    grid: rest.length,
    rest,
    talk,
    restPath: mascotPath(rest, solid),
    talkPath: mascotPath(talk, solid),
    ...(palette
      ? { restLayers: layers(rest, palette), talkLayers: layers(talk, palette) }
      : {}),
  };
});

/**
 * The mascots a project can get without choosing one. Mascots added later are
 * picked by hand only, so adding one never reshuffles existing projects.
 */
const HASHED_MASCOTS = PROJECT_MASCOTS.filter(
  (mascot) => !OPT_IN_MASCOTS.has(mascot.name),
);

/** The body color a mascot shows in its own colors, if it has any. */
export function mascotBodyColor(name: string): string | undefined {
  return PALETTES[name]?.["#"];
}

/** The grid of the classic 8×8 mascots; read `mascot.grid` for a given one. */
export const MASCOT_GRID = GRID;

/** Stable per-project pick — a different mix than the color hash so a project's
 *  mascot and color vary independently. An explicit `name` wins; an unknown one
 *  falls back to the hash. */
export function projectMascot(
  project: string,
  name?: string | null,
): ProjectMascot {
  const chosen = name
    ? PROJECT_MASCOTS.find((mascot) => mascot.name === name)
    : undefined;
  if (chosen) return chosen;

  let hash = 0;
  for (let i = 0; i < project.length; i++) {
    hash = (hash * 131 + project.charCodeAt(i)) >>> 0;
  }
  return HASHED_MASCOTS[hash % HASHED_MASCOTS.length];
}
