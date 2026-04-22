# Architecture

## Guiding Principles

1. **Functional core, imperative shell.** Parsing returns immutable AST nodes.
   Layout returns immutable geometry. Rendering consumes geometry and emits an
   SVG string. No mutation flows backward through the pipeline.
2. **Diagram types are plugins.** A diagram registers a parser + renderer pair;
   the core dispatcher doesn't need to know what shapes exist.
3. **Layout is injectable.** Sequence uses a trivial built-in layout. Graph-
   based diagrams delegate to ELK.js. Future diagrams can add their own.
4. **No DOM dependency in core.** SVG is emitted as a string so the library
   works in server-side rendering contexts too.

---

## Layer Stack

```
┌─────────────────────────────────────────────────────────┐
│  Entry point  plantuml(source) → SVGString              │
├─────────────────────────────────────────────────────────┤
│  Preprocessor  macro expansion, !define, !if            │
├─────────────────────────────────────────────────────────┤
│  Block extractor  @startuml … @enduml → UmlSource[]     │
├─────────────────────────────────────────────────────────┤
│  Dispatcher  detects diagram type → factory             │
├───────────────────────────┬─────────────────────────────┤
│  Diagram parser           │  (per diagram type plugin)  │
│  command dispatch         │                             │
├───────────────────────────┤                             │
│  Diagram AST              │                             │
├───────────────────────────┤                             │
│  Layout engine            │  (built-in or ELK.js)       │
├───────────────────────────┤                             │
│  Geometry model           │                             │
├───────────────────────────┴─────────────────────────────┤
│  SVG renderer  geometry → SVG string                    │
└─────────────────────────────────────────────────────────┘
```

---

## Core Interfaces

```typescript
// A single diagram source (between @startuml / @enduml)
interface UmlSource {
  readonly lines: readonly string[];
  readonly type: DiagramType;
}

// Every diagram plugin implements this
interface DiagramPlugin<AST> {
  readonly type: DiagramType;
  parse(source: UmlSource): AST;
  layout(ast: AST, theme: Theme): Promise<Geometry>;
  render(geo: Geometry, theme: Theme): string; // SVG string
}

// Command pattern — each line pattern maps to a state mutation
interface Command<State> {
  readonly pattern: RegExp;
  execute(state: State, match: RegExpMatchArray): void;
}

// Geometry is the output of layout, input to render
// Each diagram type defines its own Geometry shape
// but all share a bounding box
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

---

## Data Flow (one diagram)

```
source text
  │
  ▼ Preprocessor.process(lines)
expanded lines
  │
  ▼ BlockExtractor.extract(lines)
UmlSource  (type detected from @start<type>)
  │
  ▼ Dispatcher.resolve(type) → DiagramPlugin
  │
  ▼ plugin.parse(source)
DiagramAST  (immutable, diagram-specific)
  │
  ▼ plugin.layout(ast, theme)      ← async (ELK.js uses web workers)
Geometry    (x/y/size for every node and edge)
  │
  ▼ plugin.render(geo, theme)
SVG string
```

---

## Preprocessor

Handles directives before type detection. Processes lines top-to-bottom:

| Directive | Behaviour |
|-----------|-----------|
| `!define FOO value` | Replace `FOO` with `value` in subsequent lines |
| `!undefine FOO` | Remove definition |
| `!ifdef FOO` / `!ifndef FOO` | Conditional block |
| `!endif` | End conditional |
| `!include path` | Inline local file (browser: preloaded map) |
| `!theme name` | Set theme for this diagram |
| Comments (`'...`) | Strip before passing to parser |

The preprocessor is a pure function: `(lines: string[], defines: Defines) → string[]`.

---

## Dispatcher

Reads the `@start<type>` keyword (case-insensitive). Maps it to a registered
plugin. Plugins register themselves at module load time:

```typescript
DiagramRegistry.register(sequenceDiagramPlugin);
DiagramRegistry.register(classDiagramPlugin);
// …
```

Unknown types produce a graceful error SVG (same pattern as PlantUML).

---

## Layout Engines

### Sequence layout (built-in)
No external dependency. Participants are laid out left-to-right by order of
first appearance. Messages flow top-to-bottom. Box sizes are computed from
text measurement.

### Graph layout (ELK.js)
Used for Class, Component, State, Use Case, Object, and Deployment diagrams.
ELK.js runs synchronously in the main thread (no web worker needed for diagrams
of typical size). Wrap it in a thin adapter so the calling code is layout-
engine-agnostic.

### Activity layout (built-in hierarchical)
Activity diagrams are structured (start → forks → joins → end). Use a
top-to-bottom hierarchical layout computed in pure TypeScript without ELK.

---

## Text Measurement

Text size affects layout for every diagram type. Two strategies:

1. **Canvas-based (primary)**: Create a hidden `<canvas>` element and use
   `CanvasRenderingContext2D.measureText()`. Accurate for web fonts.
2. **Formula-based fallback (SSR / Node)**: Width ≈ `charCount × fontSize × 0.55`.
   Inject the strategy via a `StringMeasurer` interface.

```typescript
interface StringMeasurer {
  measure(text: string, font: FontSpec): { width: number; height: number };
}
```

---

## SVG Renderer

Emits a self-contained SVG string. No external CSS dependencies by default.
Styles are inlined. The renderer is a set of pure functions:

```typescript
function svgRoot(width: number, height: number, children: string[]): string
function rect(x, y, w, h, style: BoxStyle): string
function line(x1, y1, x2, y2, style: LineStyle): string
function text(x, y, content: string, style: TextStyle): string
function path(d: string, style: LineStyle): string
function arrowHead(type: ArrowType): string   // <marker> element
function group(id: string, children: string[]): string
```

Rich text (Creole markup: `**bold**`, `//italic//`, `--strike--`) is rendered
as `<tspan>` elements within `<text>`.

---

## Theming

Themes are plain objects:

```typescript
interface Theme {
  fontFamily: string;
  fontSize: number;
  colors: {
    background: string;
    border: string;
    text: string;
    arrow: string;
    note: string;
    // …
  };
  sequence: { participantPadding: number; messageSpacing: number; /* … */ };
  class: { memberPadding: number; /* … */ };
  // …
}
```

Built-in themes: `default`, `dark`, `sketchy`, `monochrome`.
Custom themes merge on top of `default`.

---

## Public API

```typescript
// Synchronous — layout is async but result is awaited internally
// via top-level await in the module (only safe as ES module)
export async function render(source: string, options?: RenderOptions): Promise<string>;

// Render all @startuml…@enduml blocks in a string
export async function renderAll(source: string, options?: RenderOptions): Promise<string[]>;

// Low-level: parse only (useful for tooling)
export function parse(source: string): UmlSource[];

interface RenderOptions {
  theme?: Partial<Theme> | 'default' | 'dark' | 'sketchy' | 'monochrome';
  measurer?: StringMeasurer;  // for SSR
  maxWidth?: number;          // clip diagram width
}
```

---

## File Structure

```
src/
  core/
    preprocessor.ts     — !define / !if / !include
    block-extractor.ts  — @startuml … @enduml detection
    dispatcher.ts       — type → plugin registry
    measurer.ts         — StringMeasurer implementations
    theme.ts            — Theme type + built-in themes
    svg.ts              — SVG primitive builders
    creole.ts           — Creole → SVG tspan conversion
  diagrams/
    sequence/
      ast.ts            — SequenceDiagramAST types
      parser.ts         — command dispatch → AST
      layout.ts         — geometry from AST
      renderer.ts       — geometry → SVG
      index.ts          — DiagramPlugin export
    class/
      …
    component/
      …
    state/
      …
    activity/
      …
    usecase/
      …
    object/
      …
    timing/
      …
    mindmap/
      …
    gantt/
      …
  layout/
    elk-adapter.ts      — ELK.js wrapper (graph diagrams)
  index.ts              — public API
tests/
  fixtures/             — .puml test files
  helpers/              — shared test utilities
  sequence/
  class/
  …
planning/
  …
```
