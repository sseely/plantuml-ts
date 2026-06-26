# T4 — Renderer

## Context

plantuml-js renders diagrams as pure SVG strings (no DOM). The renderer
takes a geometry object and theme and returns an SVG string. SVG primitives
(`rect`, `text`, `path`, `svgRoot`) are in `src/core/svg.ts`.

The JSON renderer draws:
1. For each `JsonNodeGeo`: a bordered rectangle, a vertical divider between
   key and value columns, horizontal row separators, key and value text.
2. For highlighted rows: a filled background rectangle before the text.
3. For each `JsonEdgeGeo`: a Bézier path arrow.

See `src/diagrams/state/renderer.ts` lines 160-200 for the Bézier path
drawing pattern from dot edge points.
See `src/diagrams/usecase/renderer.ts` lines 330-370 for an alternative.

Stack: TypeScript, Vitest (90/90/90 coverage), ESLint.

## SVG structure per node

```
<g transform="translate(x, y)">
  <!-- highlighted row backgrounds (behind everything) -->
  <rect x="1" y="{row.y+1}" width="{width-2}" height="{row.height-1}"
        fill="{json.highlightBackground}" />  <!-- only for highlighted rows -->

  <!-- outer border -->
  <rect x="0" y="0" width="{width}" height="{height}"
        fill="{json.background}" stroke="{json.border}" stroke-width="1" rx="4"/>

  <!-- key-column background -->
  <rect x="0" y="0" width="{keyColWidth}" height="{height}"
        fill="{json.headerBackground}" stroke="none"/>

  <!-- row separators (y > 0 only) -->
  <line x1="0" y1="{row.y}" x2="{width}" y2="{row.y}"
        stroke="{json.border}" stroke-width="0.5"/>

  <!-- vertical column divider -->
  <line x1="{keyColWidth}" y1="0" x2="{keyColWidth}" y2="{height}"
        stroke="{json.border}" stroke-width="0.5"/>

  <!-- key text (left-aligned in key column) -->
  <text x="{H_PAD}" y="{row.y + row.height/2 + fontSize*0.35}"
        font-family="{fontFamily}" font-size="{fontSize}"
        fill="{json.keyText}" dominant-baseline="middle">{row.key}</text>

  <!-- value text (left-aligned in value column) -->
  <text x="{keyColWidth + H_PAD}" y="{row.y + row.height/2 + fontSize*0.35}"
        font-family="{fontFamily}" font-size="{fontSize}"
        fill="{valueColor(row.valueType)}" dominant-baseline="middle">{row.value}</text>
</g>
```

### Value color helper

```typescript
function valueColor(valueType: JsonRowGeo['valueType'], json: Theme['colors']['graph']['json']): string {
  switch (valueType) {
    case 'string':  return json?.stringValue  ?? '#3A6E96';
    case 'number':  return json?.numberValue  ?? '#A67F52';
    case 'boolean': return json?.booleanValue ?? '#BE5D47';
    case 'null':    return json?.nullValue    ?? '#767676';
    default:        return json?.keyText      ?? '#181818';
  }
}
```

## Bézier arrows

For each `JsonEdgeGeo`:
- If `edge.spline === true` and `edge.points.length >= 4`: draw cubic
  Bézier path `M p0 C p1 p2 p3 [C p4 p5 p6 ...]`.
- Otherwise (straight or 2-point): draw `M p0 L p1`.
- Stroke color: `theme.colors.graph.json?.arrowColor ?? theme.colors.arrow`.
- Add arrowhead marker: reuse `url(#arrow)` from `svgRoot` defs — it is
  already embedded by `svgRoot()` in `src/core/svg.ts`.

Reference: `src/diagrams/state/renderer.ts` — search for `edge.spline` and
`edge.points` to see the exact path-building loop.

## Export

```typescript
export function renderJson(geo: JsonGeometry, theme: Theme): string
```

Wrap everything in `svgRoot(width, height, content)` from `src/core/svg.ts`.

## Write-set

- `src/diagrams/json/renderer.ts`
- `tests/unit/json/renderer.test.ts`

## Read-set

- `src/diagrams/json/layout.ts` (JsonGeometry, JsonNodeGeo, JsonEdgeGeo, JsonRowGeo types)
- `src/core/svg.ts` (rect, text, path, line, svgRoot primitives)
- `src/core/theme.ts` (Theme interface — json color keys)
- `src/diagrams/state/renderer.ts` lines 155-210 (Bézier path drawing)

## Acceptance criteria

- Given 1 node with a string value row, when `renderJson` runs, then
  SVG contains `fill="${theme.colors.graph.json?.stringValue}"` on a text element
- Given a highlighted row, when `renderJson` runs, then SVG contains a
  `<rect>` with `fill="${theme.colors.graph.json?.highlightBackground}"`
- Given 2 connected nodes, when `renderJson` runs, then SVG contains
  a `<path>` element with `d="M`
- Given a boolean `true` value, when `renderJson` runs, then SVG text
  contains `☑`
- Given a null value, when `renderJson` runs, then SVG text contains `␀`

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
Commit message: `feat(json): add SVG renderer`
