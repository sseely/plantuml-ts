# T1 — LaTeX core module

## Context

plantuml-js is a TypeScript library (Vite build, vitest tests, ESM+CJS output)
that renders PlantUML diagrams to SVG strings. No DOM, no async, no canvas.
Tests use vitest. Coverage threshold: 90/90/90.

Node labels may contain `<latex>...</latex>` tags (e.g.
`<latex>\frac{c_1}{\lambda^5}</latex>`). Currently these are passed through
as raw text. This task creates the core module that parses, measures, and
renders LaTeX expressions.

Read decisions.md before starting:
`plans/latex-rendering/decisions.md`

## Task

1. Install KaTeX: `npm install katex` and `npm install --save-dev @types/katex`
2. Create `src/core/latex.ts` with three exports:
   - `LabelSpan` — discriminated union type
   - `parseLatexLabel(raw: string): LabelSpan[]`
   - `measureLatex(expr: string): { width: number; height: number }`
   - `renderLatexMathML(expr: string, x: number, y: number, w: number, h: number, color: string): string`
3. Add `foreignObject(x, y, w, h, content)` to `src/core/svg.ts`
4. Write `tests/unit/latex.test.ts` covering all exported functions

## Write-set

- `package.json` — add `katex` production dep, `@types/katex` dev dep
- `src/core/latex.ts` — new file
- `src/core/svg.ts` — add `foreignObject` export
- `tests/unit/latex.test.ts` — new file

## Read-set

- `src/core/svg.ts` — existing primitives pattern to follow
- `decisions.md#d1` — parse strategy
- `decisions.md#d2` — KaTeX output format
- `decisions.md#d3` — heuristic sizing formula

## Interface contracts

```typescript
// LabelSpan discriminated union
export type LabelSpan =
  | { kind: 'text'; content: string }
  | { kind: 'latex'; expr: string };

// parseLatexLabel: split raw label string into spans
// "<latex>x^2</latex>" → [{ kind:'latex', expr:'x^2' }]
// "prefix <latex>x^2</latex> suffix" → text · latex · text
// "plain text" → [{ kind:'text', content:'plain text' }]
export function parseLatexLabel(raw: string): LabelSpan[];

// measureLatex: heuristic bounding box (see D3)
// base height 40 + 20 per structural marker (cap 80)
// width = max(120, expr.length * 5.5)
export function measureLatex(expr: string): { width: number; height: number };

// renderLatexMathML: returns SVG <foreignObject> string containing KaTeX MathML
// x, y: top-left corner of the foreignObject
// w, h: explicit width/height (from measureLatex)
// color: text fill color (passed to KaTeX as color style)
export function renderLatexMathML(
  expr: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): string;

// foreignObject in svg.ts
export function foreignObject(
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
): string;
```

## KaTeX usage

```typescript
import katex from 'katex';

const mathml = katex.renderToString(expr, {
  output: 'mathml',
  throwOnError: false,
  displayMode: true,
});
```

The MathML string is then passed to `foreignObject()`.

## Acceptance criteria

- Given `"<latex>\\frac{a}{b}</latex>"`, when `parseLatexLabel()`, then
  returns `[{ kind: 'latex', expr: '\\frac{a}{b}' }]`
- Given `"prefix <latex>x^2</latex> suffix"`, when `parseLatexLabel()`,
  then returns 3 spans with kinds `['text','latex','text']`
- Given `"plain text"`, when `parseLatexLabel()`, then returns
  `[{ kind: 'text', content: 'plain text' }]`
- Given `"\\frac{c_1}{\\lambda^5 (e^{c_2}-1)}"` (one `\\frac`), when
  `measureLatex()`, then `width > 120` and `height > 40`
- Given any expr, when `renderLatexMathML()`, then output contains
  `<foreignObject` with `width` and `height` attributes
- Given any expr, when `renderLatexMathML()`, then content contains `<math`
- Given a malformed expr, when `renderLatexMathML()`, then output is still
  a valid foreignObject string (no throw — `throwOnError: false`)
- Given `foreignObject(10, 20, 100, 50, '<math/>')`, then output contains
  `x="10"`, `y="20"`, `width="100"`, `height="50"`

## Quality bar

`npm test && npm run typecheck && npm run lint && npm run build` — all pass.
KaTeX must appear in `package.json` `dependencies` (not devDependencies).
