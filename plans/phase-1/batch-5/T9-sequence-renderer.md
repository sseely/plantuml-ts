# T9 — Sequence Renderer + Plugin Wiring

## Context

Project: plantuml-js — TypeScript PlantUML renderer producing SVG in browser.
Stack: TypeScript 5 strict, Vitest for tests.

The renderer is a pure function: it takes `SequenceGeometry` and `Theme` and
returns an SVG string. It calls only the primitives from `src/core/svg.ts` and
the Creole parser from `src/core/creole.ts`. No DOM access, no layout logic.

After the renderer is implemented, `src/diagrams/sequence/index.ts` wires the
parser, layout, and renderer into the `DiagramPlugin` interface so the
dispatcher can invoke the full sequence diagram pipeline.

## Task

Implement `src/diagrams/sequence/renderer.ts`, `src/diagrams/sequence/index.ts`,
and renderer tests using TDD.

## Write-set

| File | Action |
|------|--------|
| `src/diagrams/sequence/renderer.ts` | Create |
| `src/diagrams/sequence/index.ts` | Create |
| `tests/unit/sequence/renderer.test.ts` | Create |

## Read-set

- `planning/tdd-plan.md` — section `tests/unit/sequence/renderer.test.ts`
- `src/diagrams/sequence/ast.ts` — `SequenceGeometry`, `EventGeo` types
- `src/core/svg.ts` — all primitive function signatures
- `src/core/creole.ts` — `creoleToSvg()` function
- `src/core/theme.ts` — `Theme` interface
- `src/core/block-extractor.ts` — `DiagramPlugin` interface
- `src/diagrams/sequence/parser.ts` — `parseSequence()` function
- `src/diagrams/sequence/layout.ts` — `layoutSequence()` function

## Interface contract

```typescript
// src/diagrams/sequence/renderer.ts

import type { SequenceGeometry } from './ast.js';
import type { Theme } from '../../core/theme.js';

export function renderSequence(geo: SequenceGeometry, theme: Theme): string;
```

```typescript
// src/diagrams/sequence/index.ts

import type { DiagramPlugin } from '../../core/dispatcher.js';
import type { SequenceDiagramAST, SequenceGeometry } from './ast.js';

export const sequencePlugin: DiagramPlugin<SequenceDiagramAST, SequenceGeometry>;
```

## Rendering rules

### Participant boxes

For each `ParticipantGeo`:
- Emit a `rect()` at participant.x, participant.y, width, height with theme border/background colors
- Emit a `text()` at participant.centerX, participant.y + half height (vertically centered) with participant display name (run through `creoleToSvg`)
- If `hideFootbox` is false, also emit a matching box at the bottom (same x, y = lifelineEndY)

### Lifelines

For each participant, emit a `line()` from participant bottom-center
(participant.y + participant.height, participant.centerX) to
(lifelineEndY, participant.centerX) with `strokeDasharray: "5,5"` from theme.lifeline color.

### Messages

For each `MessageGeo`:
1. Emit a `line()` or `path()` from (fromX, y) to (toX, y)
   - Sync/async: solid line; reply/replyAsync: dashed line (`strokeDasharray: "5,5"`)
   - Add `markerEnd` pointing to the appropriate arrow marker id
   - Self-message: emit two horizontal segments and one short vertical segment (right then down then left)
2. Emit `text()` for the label above the arrow line
   - Apply `messageAlign` option: 'center' → x = (fromX + toX) / 2; 'left' → x = min(fromX,toX) + 5; 'right' → x = max(fromX,toX) - 5
   - If autonumber sequenceNumber is present, prepend it: `"1: label"`

### Activation boxes

For each `ActivationGeo`:
- Emit a `rect()` centered on lifelineX (x = lifelineX - activationWidth/2)
- y = activation.y, height = activation.height
- Fill with theme.colors.activation (or custom color if set)

### Notes

For each `NoteGeo`:
- Emit a `rect()` at note.x, note.y, note.width, note.height with `fill: theme.colors.noteBackground`
- Emit `text()` for each line of note.text, spaced by lineHeight

### Frames (loop, alt, etc.)

For each `FrameGeo`:
- Emit a `rect()` at frame.x, frame.y, frame.width, frame.height
  with no fill (transparent) and theme.colors.frame stroke, dashed
- Emit a small filled `rect()` for the label tab (top-left corner)
- Emit `text()` with the frameType keyword + " " + frame.label inside the tab

### Dividers

For each `DividerGeo`:
- Emit a `line()` spanning full width at divider.y
- Emit centered `text()` with divider.text

### SVG root

Call `svgRoot(geo.totalWidth, geo.totalHeight, [...all elements])`. The defs
section (with all arrow markers) must appear before any element that references
a marker.

## sequencePlugin wiring (index.ts)

```typescript
export const sequencePlugin: DiagramPlugin<SequenceDiagramAST, SequenceGeometry> = {
  type: 'sequence',

  accepts(lines) {
    const patterns = [/->>?|-->>?/, /^(participant|actor|boundary|control|entity|database|collections|queue)\s/];
    return lines.slice(0, 20).some(l => patterns.some(p => p.test(l)));
  },

  parse(source) {
    return parseSequence(source);
  },

  layout(ast, theme, measurer) {
    return Promise.resolve(layoutSequence(ast, theme, measurer));
  },

  layoutSync(ast, theme, measurer) {
    return layoutSequence(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderSequence(geo, theme);
  },
};
```

## Acceptance criteria

- Given geometry for two participants, when rendered, then the SVG contains
  at least 2 `<rect` elements (participant boxes)
- Given a sync message in geometry, when rendered, then SVG contains a
  `<line` or `<path` and the label text
- Given an activation in geometry, when rendered, then SVG contains a
  filled `<rect` whose x is near the lifeline center
- Given a note in geometry, when rendered, then SVG contains a `<rect`
  and the note text in a `<text` element
- Given a loop frame in geometry, when rendered, then SVG contains a
  `<rect` with dashed stroke and text containing "loop"
- Given defaultTheme and darkTheme rendering the same geometry, when
  compared, then the participant rect `fill` values differ

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` all pass. Coverage ≥ 90% on
`src/diagrams/sequence/renderer.ts`. Commit:
`feat(sequence): implement renderer and plugin wiring`
