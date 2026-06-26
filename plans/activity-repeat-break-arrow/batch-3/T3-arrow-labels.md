# T3 — arrow labels: AST + parser + layout + renderer

## Context

Project: `plantuml-js` — TypeScript port of PlantUML, pure SVG output.
Stack: TypeScript, Vitest, ESLint, Vite.
Test command: `npm test` (vitest + 90/90/90 coverage thresholds).
Type check: `npm run typecheck`.
Lint: `npm run lint`.

`-><back:red> no3 ;` is an arrow-label line that annotates the **next**
edge drawn with a text label and optional colored background pill.
Currently there is no parser rule for `->` prefix lines; they fall through
to "unknown line" and are silently dropped.

Java reference: `CommandArrow3.executeArg()` calls
`diagram.setLabelNextArrow(label)` — mutable pending state consumed by
the next edge. D2 (decisions.md) adopts a functionally equivalent
approach: a standalone `ActivityArrowLabel` AST node that `layoutSequence`
treats as "pending style" applied to the next edge, then cleared.

Depends on T2 (AST union, layout infrastructure must be stable).

## Task

### 1. AST — add `ActivityArrowLabel`

In `src/diagrams/activity/ast.ts`, add:
```typescript
export interface ActivityArrowLabel {
  kind: 'arrow-label';
  label: string;
  color?: string;   // CSS/SVG color string e.g. "red", "#FF0000"
  swimlane?: string;
}
```
Add `ActivityArrowLabel` to the `ActivityNode` union type.

### 2. Parser — recognise arrow-label lines

In `src/diagrams/activity/parser.ts`, add a regex and parse rule.

Regex:
```typescript
// Matches: -> label ;
//          -><back:color> label ;
//          -><color:color> label ;
const RE_ARROW_LABEL =
  /^->(?:<(?:back|color):([^>]+)>)?\s*(.*?)\s*;?\s*$/i;
```

Rule: if the trimmed line starts with `'->'`, try `RE_ARROW_LABEL.exec`.
If it matches:
- `color` = match[1]?.trim() || undefined  (undefined if no color tag)
- `label` = match[2]?.trim() ?? ''
Push an `ActivityArrowLabel` node.

### 3. Layout — pending style in layoutSequence

In `src/diagrams/activity/layout.ts`:

`layoutSequence` already processes nodes one by one. Add a local
variable `pendingLabel: { label: string; color?: string } | undefined`.

In the per-node switch (in `layoutSingleNode`), add a case for
`'arrow-label'`:
```typescript
case 'arrow-label':
  // No geo emitted. Return a sentinel that layoutSequence interprets
  // as "set pending".
```

Since `layoutSingleNode` returns a `BranchResult`, the cleanest approach
is to handle `'arrow-label'` **before** calling `layoutSingleNode`, inside
`layoutSequence` directly:

```typescript
if (node.kind === 'arrow-label') {
  pendingLabel = { label: node.label, color: node.color };
  continue;  // no geo, no edge wiring for this node
}
```

When the next edge is created (the edge from `lastId` to the new
`result.firstId`), attach the pending style:
```typescript
const edgeGeo: ActivityEdgeGeo = {
  points: ...,
  ...(pendingLabel !== undefined ? { label: pendingLabel.label, color: pendingLabel.color } : {}),
};
pendingLabel = undefined;  // consume it
```

Check `ActivityEdgeGeo` definition — it should already have `label?:
string`. Add `color?: string` if not present.

### 4. Renderer — colored pill rendering

`ActivityEdgeGeo` gains `color?: string`. In the edge renderer
(`src/diagrams/activity/renderer.ts`):

When rendering an edge label that has a `color`:
- Compute edge midpoint from the `points` array.
- Render a filled `<rect>` behind the label text:
  - width: `text_width + 8` (4px padding each side)
  - height: `fontSize + 4` (2px padding each side)
  - fill: `edge.color`
  - No stroke
- Render the `<text>` element centered on the midpoint, on top of the rect.

Use a fixed approximation for text width: `label.length * (fontSize * 0.6)`,
consistent with the project's existing approach (no full text measurer in
edge rendering context). This matches D3 (decisions.md).

When the edge has a label but no color, render only the `<text>` (existing
behaviour for labeled edges, if any).

## Write-set

- `src/diagrams/activity/ast.ts` — ActivityArrowLabel, union update
- `src/diagrams/activity/parser.ts` — RE_ARROW_LABEL, parse rule
- `src/diagrams/activity/layout.ts` — pending label in layoutSequence,
  color field on ActivityEdgeGeo
- `src/diagrams/activity/renderer.ts` — colored pill rendering
- `tests/unit/activity/parser.test.ts` — arrow-label parse tests
- `tests/unit/activity/layout.test.ts` — pending label tests
- `tests/unit/activity/renderer.test.ts` — pill rendering tests

## Read-set

- `src/diagrams/activity/ast.ts` — ActivityNode union, ActivityEdgeGeo
- `src/diagrams/activity/parser.ts:63-81` — matchesStopKeyword pattern
- `src/diagrams/activity/parser.ts:100-130` — parseNodes loop structure
- `src/diagrams/activity/layout.ts:242-350` — layoutSequence, BranchResult,
  edge creation pattern
- `src/diagrams/activity/renderer.ts:156-220` — edge renderer
- `plans/activity-repeat-break-arrow/decisions.md#D2` — arrow label decision
- `plans/activity-repeat-break-arrow/decisions.md#D3` — pill rendering decision

## Architecture decisions

- D2 (decisions.md): `ActivityArrowLabel` is a standalone AST node.
  `layoutSequence` carries pending style for one step, applies to next edge,
  clears it. No geo node emitted.
- D3 (decisions.md): colored pill = SVG `<rect>` + `<text>` at edge midpoint.
  Pill: `text_width + 8` wide, `fontSize + 4` tall. Named colors passed through
  as-is to SVG `fill`.

## Interface contracts

`ActivityEdgeGeo` must have:
```typescript
interface ActivityEdgeGeo {
  points: Point[];
  label?: string;
  color?: string;   // ADD THIS if not already present
}
```

## Acceptance criteria

```
Given `-><back:red> no3 ;`,
When parsed,
Then an ActivityArrowLabel node with label='no3' and color='red' is produced.

Given `-> some label ;` (no color tag),
When parsed,
Then an ActivityArrowLabel node with label='some label' and color=undefined.

Given a sequence [action, arrow-label(label='x', color='blue'), action],
When laid out,
Then the edge between the two actions has label='x' and color='blue'.

Given the pending label is consumed by the next edge,
When there is no edge after the arrow-label (arrow-label is last),
Then the pending label is silently discarded (no crash).

Given an edge with color='red' and label='no3',
When rendered,
Then the SVG contains a <rect> with fill='red' and a <text> 'no3'
overlapping it.

Given an edge with label but no color,
When rendered,
Then no <rect> is emitted for that label (plain text only).
```

## Quality bar

`npm test && npm run typecheck && npm run lint && npm run build`
must all pass. No files outside the write-set should be modified.
