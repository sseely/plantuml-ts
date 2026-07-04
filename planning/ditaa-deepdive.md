# DITAA — Deep Dive

This document supplements the mission-guide entry for Phase 5g (DITAA).
Read it before drafting any agent prompt for this phase.

## What DITAA is

DITAA (DIagrams Through ASCII Art) converts ASCII art text into SVG. Unlike
every other PlantUML diagram type, DITAA does not parse a structured DSL — it
reads a 2D character grid and detects shapes, connectors, and text from the
cell patterns. The algorithm is essentially a rasterizer in reverse.

This means the Java source is the *only* specification. There is no grammar to
port; there is a pattern-detection algorithm. Read every file in `asciiart/`
and `ditaa/` before designing anything.

## Java source scale

| Package | What it contains |
|---------|-----------------|
| `ditaa/` | 3 files: entry point and factory; thin wrapper |
| `asciiart/` | The ditaa library, bundled as Java source ~40+ files |

The `asciiart/` package is an import of the ditaa open-source project's source
code into the PlantUML monorepo. It contains the entire shape detection and
rendering pipeline.

## Algorithm overview

### Step 1 — Build the character grid

Read the input text character by character into a 2D `char[][]` grid. Each
cell is addressed by `(row, col)`. Tabs are expanded to spaces; UTF-8 chars
outside ASCII occupy a single cell.

### Step 2 — Segment detection

Scan the grid for connected segments of `-`, `|`, `=`, `:`, `/`, `\`. Each
run of the same character type in a horizontal or vertical direction is a
candidate segment. Segment type determines rendering:
- `-` → solid horizontal line
- `|` → solid vertical line
- `=` → double/thick horizontal line
- `:` → dashed vertical line
- `/` → diagonal (bottom-left to top-right)
- `\` → diagonal (top-left to bottom-right)

### Step 3 — Shape detection

Find closed polygons formed by connected segments. The detection algorithm
traces segment endpoints looking for corner connections (`+`, or bare
intersections). A closed polygon becomes a shape.

**Shape modifiers** (character codes found inside the enclosed polygon):
- `{c}` — explicit fill color hex: `{c: #RRGGBB}` (also named colors)
- `{d}` — diamond shape (rotated square)
- `{io}` — parallelogram (I/O shape)
- `{o}` — rounded corners
- `{s}` — storage (cylinder)
- `{tr}` — trapezoid
- `{mo}` — manual operation
- `{r}` — rectilinear (default; explicit for clarity)

### Step 4 — Text extraction

Any characters inside a detected shape bounding box that are not part of
segments or modifiers are text content. Text is centered in the shape's
bounding box.

Characters outside all shapes are also text — rendered at their grid position.

### Step 5 — Arrow detection

At segment endpoints, look for directional characters:
- `>` — arrowhead pointing right
- `<` — arrowhead pointing left
- `^` — arrowhead pointing up
- `v` or `V` — arrowhead pointing down

Arrows can be on connectors (lines between shapes) or standalone.

### Step 6 — SVG output

Each detected shape → SVG polygon/rect/ellipse/path. Each connector → SVG
line. Each arrowhead → SVG polygon marker. Text → SVG `<text>` elements.

## Critical interactions

### Corner piece detection

`+` is the primary corner connector. The algorithm checks each `+` and
determines which edges connect to it by scanning in all four cardinal
directions. A `+` with top and right edges is a top-left corner; with all
four edges it is a crossing.

Crossings at `+` junctions produce connected lines, not separate line
endpoints. The distinction matters: a `+` with only two edges is a true
corner; a `+` with four edges means the lines cross, not intersect, and
they render differently.

### Segment vs. shape disambiguation

Horizontal `--` runs that terminate at `+` corners on both ends could be
either (a) the top edge of a rectangle or (b) a standalone connector. The
algorithm resolves this by attempting to close a polygon: if the `-` run
connects to a vertical run that closes back to the starting point, it is a
shape boundary. Otherwise it is a connector.

### Overlapping shapes

Multiple separate shapes can share a wall (adjacent bounding boxes sharing
an edge). Each shape is detected and rendered independently; shared walls
produce visually doubled lines. This is the upstream behavior — do not merge.

### Dashed connectors

`:` (vertical dashed) and `=` (horizontal dashed/double). The rendering
differs per connector type. `=` renders as a thicker or double line depending
on the output mode.

### No `+` corner case

PlantUML's DITAA processing accepts segments that "turn" without an explicit
`+` marker when two segments of the same type join at a 90° angle in the same
cell. This is ambiguous input that upstream handles with a fallback heuristic;
match the heuristic, not an ideal interpretation.

## Watch-outs

- **Whitespace is significant** — every character, including spaces, occupies
  a grid cell. Off-by-one shifts in the grid destroy shape detection.
- **Tab expansion must happen first** — tabs in input must be expanded to
  spaces before grid construction (upstream uses a fixed 8-column tab stop).
- **Round-trip color**: `{c}` hex colors are case-insensitive; named colors
  are resolved to the nearest DITAA palette color, not to CSS named colors.
- **The rendering is pixel-faithful, not semantic** — each grid cell maps to
  a fixed pixel size (default 10×10 px in upstream). Scale the entire SVG
  uniformly rather than computing a "natural" SVG size.
- **No graph engine, no layout** — the SVG coordinates are directly derived
  from grid cell positions multiplied by the cell pixel size. There is no
  layout step.
- **ASCII-only input** — DITAA input should be ASCII. Non-ASCII characters
  in the grid produce undefined behavior upstream; match that behavior (render
  the character as text, do not crash).
- **Shape type detection priority** — when multiple shape type codes appear
  inside one polygon, priority order follows `asciiart/` source; read it
  before implementing.
- **Blank lines inside shapes** — blank lines inside a detected polygon
  bounding box are not content and do not affect text centering.

## Architecture decisions

**Grid cell size:** 10px wide × 10px tall (upstream default). The SVG canvas
is `cols × 10` by `rows × 10` pixels.

**No third-party library:** Do not import an existing JavaScript DITAA
implementation. Port `asciiart/` faithfully to TypeScript. Any existing JS
DITAA implementation will have diverged from the PlantUML-bundled version.

**SyncPlugin:** All computation is synchronous and deterministic.

**No dot engine:** Never. DITAA has no graph topology; it has a pixel grid.

## Files to create

```
src/diagrams/ditaa/
  ast.ts          — DitaaGrid: the 2D char grid + detected shapes/segments
  parser.ts       — parseGrid(source): DitaaGrid
  detector.ts     — shape and segment detection algorithm
  renderer.ts     — renders DitaaGrid to SVG
  index.ts        — ditaaPlugin: SyncPlugin
tests/unit/ditaa/
  parser.test.ts
  detector.test.ts
  renderer.test.ts
```

## Suggested batch structure

**Batch 1:** Grid parser + segment detection (horizontal/vertical/diagonal
runs identified, no shapes yet)

**Batch 2:** Shape detection — closed polygon tracing, shape modifier parsing,
text extraction inside shapes

**Batch 3:** Arrow detection + corner disambiguation + crossing detection

**Batch 4:** SVG renderer — shapes, connectors, arrows, text

**Batch 5:** Block-extractor wiring + integration tests against upstream
fixtures from `tests/corpus/ditaa/`
