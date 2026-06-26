# T3 — Use case renderer: LaTeX label → foreignObject

## Context

plantuml-js is a TypeScript library (Vite build, vitest tests, ESM+CJS output).
No DOM, no async. Tests use vitest. Coverage threshold: 90/90/90.

T1 has added `parseLatexLabel()` and `renderLatexMathML()` to
`src/core/latex.ts`, and `foreignObject()` to `src/core/svg.ts`.

The use case renderer currently renders all node labels as SVG `<text>`
elements. For labels containing `<latex>...</latex>`, it must instead emit
a `<foreignObject>` containing KaTeX MathML.

Read decisions.md before starting:
`plans/latex-rendering/decisions.md`

## Task

Update `src/diagrams/usecase/renderer.ts` to use `renderLatexMathML()` for
actor and usecase node labels that contain `<latex>` tags.

Affected render paths:
- `renderActor` — label below stick figure (`text(cx, cy + 70, node.display, ...)`)
- `renderBusinessActor` — same label pattern
- `renderUseCaseNode` — label inside ellipse
- `renderBusinessUseCaseNode` — label inside ellipse

For each: if `node.display.includes('<latex>')`, replace the `text()` call
with `renderLatexMathML()` positioned at the same anchor point. Use
`measureLatex(node.display)` to obtain `w` and `h`; center the foreignObject
on the anchor point (`x = anchorX - w/2`, `y = anchorY - h/2`).

Plain labels (no `<latex>`) must continue using `<text>` — no regression.

## Write-set

- `src/diagrams/usecase/renderer.ts` — update four label render paths
- `tests/unit/usecase/renderer.test.ts` — add LaTeX label rendering tests

## Read-set

- `src/core/latex.ts` — `parseLatexLabel`, `measureLatex`, `renderLatexMathML` (T1)
- `src/core/svg.ts` — `foreignObject` (T1)
- `src/diagrams/usecase/renderer.ts:120-145` — `renderActor` label section
- `src/diagrams/usecase/renderer.ts:205-225` — `renderUseCaseNode` label section

## Interface contracts

Helper to add inside renderer.ts (not exported):

```typescript
function renderLabel(
  display: string,
  cx: number,
  cy: number,
  theme: Theme,
): string {
  if (display.includes('<latex>')) {
    const { width: w, height: h } = measureLatex(display);
    return renderLatexMathML(display, cx - w / 2, cy - h / 2, w, h, theme.colors.text);
  }
  return text(cx, cy, display, {
    textAnchor: 'middle',
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
  });
}
```

Then replace all four inline label constructions with `renderLabel(node.display, ...)`.

## Acceptance criteria

- Given a usecase node with `display = "<latex>\\epsilon_0</latex>"`, when
  rendered, then SVG contains `<foreignObject` and `<math`
- Given an actor node with a `<latex>` label, when rendered, then the SVG
  does not contain a `<text` element for the label
- Given a usecase node with `display = "Login"` (plain), when rendered, then
  SVG contains `<text` and does not contain `<foreignObject` (no regression)
- Given a business-actor node with a `<latex>` label, when rendered, then
  SVG contains `<foreignObject`
- Given a business-usecase node with a `<latex>` label, when rendered, then
  SVG contains `<foreignObject`

## Quality bar

`npm test && npm run typecheck && npm run lint && npm run build` — all pass.
