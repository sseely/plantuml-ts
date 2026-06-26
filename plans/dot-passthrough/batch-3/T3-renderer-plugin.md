# T3 — Renderer + Plugin Wiring + Registration + Tests + Visual Page

## Context

plantuml-js is a TypeScript port of PlantUML. This task completes the DOT
passthrough feature by rendering `DotGeometry` to SVG, wiring the plugin,
registering it in `src/index.ts`, and writing the test suite.

Test framework: **vitest**. Run tests with `npm test`.

## Task

1. Create `src/diagrams/dot/renderer.ts` exporting `renderDot(geo, theme)`.
2. Create `src/diagrams/dot/index.ts` exporting `dotPlugin` (`SyncPlugin`).
3. Modify `src/index.ts`: import and register `dotPlugin`.
4. Create `tests/unit/dot/renderer.test.ts`.
5. Create `tests/visual/dot.html` (visual smoke test page).
6. Append to `DIVERGENCES.md` documenting the D7 title/skinparam divergence.

## Write-set

- `src/diagrams/dot/renderer.ts` (create)
- `src/diagrams/dot/index.ts` (create)
- `src/index.ts` (modify)
- `tests/unit/dot/renderer.test.ts` (create)
- `tests/visual/dot.html` (create)
- `DIVERGENCES.md` (modify — append)

## Read-set

- `src/diagrams/dot/ast.ts` — DotGeometry, DotNodeGeo, DotEdgeGeo, DotNodeShape
- `src/diagrams/dot/layout.ts` — layoutDot signature (from T2)
- `src/diagrams/dot/parser.ts` — parseDot signature (from T1)
- `src/core/svg.ts` — rect, ellipse, diamond, text, path, group, svgRoot, arrowHeadRef
- `src/core/theme.ts` — Theme, resolveTheme
- `src/core/skinparam.ts` — resolveSkinparam (for D7 skinparam support)
- `src/core/dispatcher.ts` — SyncPlugin interface
- `src/index.ts` — existing import/register pattern
- `src/diagrams/files/index.ts` — SyncPlugin wiring pattern
- `src/diagrams/files/renderer.ts` — minimal renderer pattern
- `tests/visual/files.html` — visual page pattern to follow
- `plans/dot-passthrough/decisions.md` — D1 (shapes), D2 (directionality), D7 (title/skinparam)

## Corpus fixtures (must be integration test cases)

```
~/git/pdiff/dbhum/b_em/bemepi-16-kuzo249.puml:
  @startdot
  digraph toto {
  azerty;
  }
  @enddot

~/git/pdiff/dbhum/c_id/ciditi-21-xacu710.puml:
  @startdot
  graph graphname {
      a -- b -- c;
      b -- d;
  }
  @enddot
```

Read the fixture files directly in the test to extract the diagram source
(skip the JSON metadata header, read from `@startdot` to `@enddot`).

## Renderer implementation

### Node rendering (D1)

```typescript
function renderNode(node: DotNodeGeo, theme: Theme): string {
  const cx = node.x, cy = node.y, w = node.width, h = node.height;
  switch (node.shape) {
    case 'box':
      return group([
        rect(cx - w/2, cy - h/2, w, h, { fill: theme.colors.graph.nodeFill, stroke: theme.colors.graph.nodeBorder }),
        text(cx, cy, node.label, { ... }),
      ]);
    case 'circle':   // fall-through to ellipse (already square w=h from layout)
    case 'ellipse':
      return group([
        ellipse(cx, cy, w/2, h/2, { fill: ..., stroke: ... }),
        text(cx, cy, node.label, { ... }),
      ]);
    case 'diamond':
      return group([
        diamond(cx, cy, w, h, { fill: ..., stroke: ... }),
        text(cx, cy, node.label, { ... }),
      ]);
    case 'plaintext':
      return text(cx, cy, node.label, { ... });
  }
}
```

### Edge rendering (D2)

For each `DotEdgeGeo`:
- If `points` has ≥ 2 entries, build a polyline/path from the points.
- If `directed: true`, add `markerEnd: arrowHeadRef('sync')`.
- If `directed: false`, no marker.
- If `label` is non-null, render it at the midpoint of the edge.

### Title rendering (D7)

If `geo.title` is non-null, render a `<text>` element centered at the top
of the SVG, above the diagram content. Apply a top-margin (e.g. 24px) and
shift all node/edge content down by that margin.

### Skinparam (D7)

In `index.ts`, after calling `parseDot`, call `resolveSkinparam` on
`ast.skinparamLines` to produce a theme override, merge with the base
theme via `deepMergeTheme`, and pass the merged theme to both `layoutDot`
and `renderDot`.

### `svgRoot` call

```typescript
return svgRoot(geo.totalWidth, geo.totalHeight, [
  ...nodeElements,
  ...edgeElements,
  ...(titleElement ? [titleElement] : []),
], theme.colors.graph.background);
```

## Plugin wiring (`index.ts`)

```typescript
export const dotPlugin: SyncPlugin<DotDiagramAST, DotGeometry> = {
  type: 'dot',
  accepts(_lines) { return false; },
  parse(source) { return parseDot(source); },
  layoutSync(ast, measurer, theme) { return layoutDot(ast, measurer, theme); },
  render(geo, theme) { return renderDot(geo, theme); },
};
```

## `src/index.ts` registration

Add after the `chartPlugin` import and register call:
```typescript
import { dotPlugin } from './diagrams/dot/index.js';
// ...
registry.register(dotPlugin);
```

## DIVERGENCES.md entry

Append:
```markdown
## @startdot — title and skinparam support

Upstream Java (`PSystemDot`) ignores `title` and `skinparam` directives
inside `@startdot` blocks. This port parses and applies both, matching
the behavior of all other diagram types.

Rationale: DOT diagrams frequently appear alongside other PlantUML
content in the same document; ignoring directives that work everywhere
else creates confusing inconsistency.
```

## Acceptance criteria

```
Given a DotGeometry with a 'box' node:
  renderDot output contains a <rect> element

Given a DotGeometry with an 'ellipse' node:
  renderDot output contains an <ellipse> element

Given a DotGeometry with a directed edge (digraph):
  output contains markerEnd referencing an arrowhead marker

Given a DotGeometry with an undirected edge (graph):
  output contains no markerEnd attribute on the edge path

Given a DotGeometry with title 'My Graph':
  output contains a <text> element with content 'My Graph'

Given corpus fixture 1 (digraph toto { azerty; }):
  renderSync() returns a string starting with '<svg' and ending with '</svg>'
  no exception is thrown

Given corpus fixture 2 (graph graphname { a -- b -- c; b -- d; }):
  renderSync() returns valid SVG with 4 node elements visible
  no exception is thrown

All four quality gates pass:
  npm test, npm run typecheck, npm run lint, npm run build
```

## Quality bar

Run all four quality gates before finishing. All must pass, including
90/90/90 coverage. Zero type errors. Zero lint errors.
