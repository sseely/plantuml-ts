# T3 — Layout

## Context

plantuml-js renders diagrams via a parse → layoutSync → render pipeline.
Layout takes an AST + theme + measurer and returns a geometry object that
render consumes. The dot engine (`src/core/dot/index.ts`) accepts a graph
description and returns positioned nodes and routed edges.

The JSON diagram renders each object/array as a two-column table (keys left,
values right). Nested objects/arrays become child nodes connected by arrows.
Layout uses the dot engine with `rankDir: 'LR'` — same approach as class
diagrams. See `src/diagrams/class/layout.ts` for the full reference pattern.

Stack: TypeScript, Vitest (90/90/90 coverage), ESLint.

## Geometry types to define

```typescript
// A single row within a JSON node block
export interface JsonRowGeo {
  key: string;          // display key (or '' for array items)
  value: string;        // display value ('' for nested objects/arrays)
  valueType: 'string' | 'number' | 'boolean' | 'null' | 'nested';
  highlight: boolean;
  y: number;            // y offset within the node (top of row)
  height: number;
}

// A positioned JSON node (one object or array)
export interface JsonNodeGeo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  keyColWidth: number;    // width of left (key) column
  valueColWidth: number;  // width of right (value) column
  rows: JsonRowGeo[];
}

// A routed edge from a parent node row to a child node
export interface JsonEdgeGeo {
  points: ReadonlyArray<{ x: number; y: number }>;
  spline: boolean;
}

export interface JsonGeometry {
  nodes: JsonNodeGeo[];
  edges: JsonEdgeGeo[];
  width: number;
  height: number;
}
```

## Algorithm

The layout walks the parsed JSON value tree recursively:

1. **Flatten a value into rows** (`flattenRows(value, highlights)`):
   - For each key/index in the object/array, create one `JsonRowGeo` (with
     measured height).
   - If the value is an object or array, `valueType = 'nested'`; otherwise
     determine type from `typeof`.
   - `highlight = true` if the key matches the first segment of any
     highlight path.

2. **Measure column widths** for each node:
   - `keyColWidth` = max across rows of `measurer.getDimension(key, fontSize).width + 2*H_PAD`
   - `valueColWidth` = max across rows of `measurer.getDimension(value, fontSize).width + 2*H_PAD`
   - Both clamped to `MIN_COL_WIDTH = 30`.

3. **Build a dot graph** (see `src/core/dot/types.ts` for `DotNode`,
   `DotEdge`, `DotGraph`):
   - One `DotNode` per JSON object/array, with `width` and `height` from
     the measured block.
   - One `DotEdge` per parent→child relationship, with `tailPort` = the
     row index of the child entry in the parent.
   - `rankDir: 'LR'`, `rankSep: 40`, `nodeSep: 20`.

4. **Run the dot engine**: `import { runDot } from '../../core/dot/index.js'`

5. **Extract positions**: Map dot output node positions to `JsonNodeGeo`
   with absolute x/y. Map edge spline points to `JsonEdgeGeo`.

6. **Compute canvas size**: `width` and `height` from bounding box of all
   nodes + padding.

### Value display strings

Use these for the `value` field in `JsonRowGeo` (matching upstream):

| Type | Display string |
|------|---------------|
| string | the string value |
| number | `String(v)` |
| boolean true | `'☑ true'` |
| boolean false | `'☐ false'` |
| null | `'␀'` |
| object / array | `''` (empty — child node handles it) |

### Constants

```typescript
const H_PAD = 8;
const V_PAD = 4;
const MIN_COL_WIDTH = 30;
const MIN_HEIGHT = 15;
const ROW_HEIGHT_MIN = 20;
```

## Write-set

- `src/diagrams/json/layout.ts`
- `tests/unit/json/layout.test.ts`

## Read-set

- `src/diagrams/json/ast.ts` (JsonDiagramAST)
- `src/core/dot/index.ts` (runDot signature)
- `src/core/dot/types.ts` (DotNode, DotEdge, DotGraph types)
- `src/diagrams/class/layout.ts` lines 1-80 (dot engine usage pattern)
- `src/core/measurer.ts` (StringMeasurer / StringBounder interface)
- `plans/json-diagram/decisions.md` (value display rules table)

## Acceptance criteria

- Given a flat object `{ "a": 1, "b": "hello" }`, when `layoutJson` runs,
  then geometry has exactly 1 node with 2 rows
- Given `{ "child": { "x": 1 } }`, when `layoutJson` runs, then geometry
  has 2 nodes and 1 edge
- Given any valid non-empty JSON, when `layoutJson` runs, then all nodes
  have `width > 0`, `height > 0`, `x >= 0`, `y >= 0`
- Given `[1, 2, 3]`, when `layoutJson` runs, then the single node's rows
  have keys `'0'`, `'1'`, `'2'`
- Given `{}`, when `layoutJson` runs, then geometry has 1 node with 0 rows
  and `height >= MIN_HEIGHT`

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
Commit message: `feat(json): add layout engine (dot LR, geometry types)`
