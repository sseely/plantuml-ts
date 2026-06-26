# T4 — Renderer + Renderer Tests

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: vitest, tsc, eslint, vite.
Pattern reference: `src/diagrams/board/renderer.ts`, `src/diagrams/chronology/renderer.ts`.

## Task

Create `src/diagrams/files/renderer.ts` and `tests/unit/files/renderer.test.ts`.

## Write-Set

- `src/diagrams/files/renderer.ts` (create)
- `tests/unit/files/renderer.test.ts` (create)

## Read-Set

- `src/diagrams/files/ast.ts` — `FilesGeometry`, `EntryGeometry`
- `src/diagrams/board/renderer.ts` — `svgRoot` usage pattern
- `src/core/svg.ts` lines 1–200 — `rect()`, `text()`, `line()`, `svgRoot()`

## SVG Primitives

```typescript
import { rect, text, svgRoot } from '../../core/svg.js';
import type { Theme } from '../../core/theme.js';
```

## Rendering Spec

### Per file/folder entry

```typescript
const icon = entry.type === 'folder' ? '📂' : '📄';
const label = icon + ' ' + entry.name;   // non-breaking space after icon
text(entry.x + PADDING, entry.y + BASELINE_OFFSET, label, {
  fontFamily: 'sans-serif',
  fontSize: 14,
  dominantBaseline: 'hanging',
  fill: '#000000',
})
```

Where `PADDING = 10`, `BASELINE_OFFSET = 4` (small top padding within the row).

### Per note entry

Note boxes are yellow rounded rectangles with text lines inside.

```
NOTE_FILL   = '#FEFECE'
NOTE_STROKE = '#AAAAAA'
NOTE_RX     = 4
NOTE_FONT   = 12
NOTE_PAD    = 6
NOTE_LINE_H = 16   (line height within the note box)
```

For a note with N lines:
- Box height = `NOTE_PAD * 2 + N * NOTE_LINE_H`
- Box width = longest line's labelWidth + NOTE_PAD * 2 (use a reasonable fallback
  of 120px if labelWidth is 0)
- `rect(entry.x + PADDING, entry.y + 2, boxWidth, boxHeight, { fill: NOTE_FILL, stroke: NOTE_STROKE, strokeWidth: 1, rx: NOTE_RX })`
- For each line i: `text(entry.x + PADDING + NOTE_PAD, entry.y + 2 + NOTE_PAD + i * NOTE_LINE_H, line, { fontSize: NOTE_FONT, fontFamily: 'sans-serif', dominantBaseline: 'hanging', fill: '#000000' })`

### svgRoot call

```typescript
const MIN_WIDTH = 200;
const width = Math.max(geo.totalWidth, MIN_WIDTH);
const height = Math.max(geo.totalHeight, 40);
return svgRoot(width, height, parts, theme.colors.background);
```

## Interface Contract

```typescript
export function renderFiles(geo: FilesGeometry, theme: Theme): string
```

## Test Helpers

Build geometry directly — do NOT call parser or layout in renderer tests:

```typescript
import type { FilesGeometry, EntryGeometry } from '../../../src/diagrams/files/ast.js';
import { resolveTheme } from '../../../src/core/theme.js';

const theme = resolveTheme('default');

function makeGeo(entries: EntryGeometry[] = []): FilesGeometry {
  return { entries, totalWidth: 400, totalHeight: entries.length * 22 };
}

function makeEntry(overrides: Partial<EntryGeometry> = {}): EntryGeometry {
  return { type: 'file', name: 'test.ts', depth: 0, x: 0, y: 0, labelWidth: 60, ...overrides };
}
```

## Acceptance Criteria

- **AC1:** SVG contains `📂` for folder entries
- **AC2:** SVG contains `📄` for file entries
- **AC3:** SVG contains `<rect` for each note entry
- **AC4:** A depth-2 entry has a larger x position in the SVG than a depth-0 entry
- **AC5:** `svgRoot` produces output with `width` and `height` (or `viewBox`) attributes
- **AC6:** Note text lines appear in the SVG output
- **AC7:** Empty geometry renders without throwing and produces a valid SVG string
- **AC8:** Note `<rect>` has `fill="#fefece"` or `fill: #FEFECE` (case-insensitive)

## Quality Bar

`npm test -- --run tests/unit/files/renderer.test.ts` passes.
`npm run typecheck` and `npm run lint` pass with zero new errors.
90/90/90 coverage on `renderer.ts`. Write at least 10 tests.

## Commit

`feat(files): add SVG renderer and renderer tests`
