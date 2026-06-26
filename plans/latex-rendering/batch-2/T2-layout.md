# T2 — Use case layout: LaTeX node sizing

## Context

plantuml-js is a TypeScript library (Vite build, vitest tests, ESM+CJS output).
No DOM, no async. Tests use vitest. Coverage threshold: 90/90/90.

T1 has added `measureLatex(expr)` to `src/core/latex.ts`. The use case layout
engine currently measures all leaf node labels with `measurer.measure(display, fontSpec)`.
For labels containing `<latex>...</latex>`, this produces wrong dimensions
(it measures the raw tag string, not the math expression).

Read decisions.md before starting:
`plans/latex-rendering/decisions.md`

## Task

Update `measureLeafNode` in `src/diagrams/usecase/layout.ts` to detect
`<latex>` in the `node.display` string and use `measureLatex()` instead of
the string measurer when the label contains a LaTeX expression.

Detection: `node.display.includes('<latex>')` is sufficient — no need to
call `parseLatexLabel` at this point (D1 decision).

For mixed labels (text + latex), use `measureLatex` on the full display string
as a conservative estimate. The heuristic is already approximate (D3).

## Write-set

- `src/diagrams/usecase/layout.ts` — update `measureLeafNode`
- `tests/unit/usecase/layout.test.ts` — add LaTeX sizing tests

## Read-set

- `src/core/latex.ts` — `measureLatex` signature (from T1)
- `src/diagrams/usecase/layout.ts:97-112` — `measureLeafNode` function
- `decisions.md#d1` — parse strategy (detect, don't parse at layout time)
- `decisions.md#d3` — heuristic sizing

## Interface contracts

`measureLeafNode` signature is unchanged. Internal logic gains a branch:

```typescript
function measureLeafNode(node, fontSpec, measurer) {
  if (node.kind === 'actor' || node.kind === 'business-actor') {
    return { width: ACTOR_WIDTH, height: ACTOR_HEIGHT };
  }
  // New branch: latex label in usecase node
  if (node.display.includes('<latex>')) {
    return measureLatex(node.display);
  }
  // existing string measurer path
  const textWidth = measurer.measure(node.display, fontSpec).width;
  return { width: Math.max(USECASE_MIN_WIDTH, textWidth + 56), height: USECASE_HEIGHT };
}
```

Note: actor nodes always use fixed ACTOR_WIDTH/HEIGHT regardless of label
content — the label floats below the figure and does not affect node sizing.

## Acceptance criteria

- Given a usecase node with `display = "<latex>\\frac{a}{b}</latex>"`, when
  `measureLeafNode()`, then returned dimensions match `measureLatex()`
  (not the string measurer dimensions for that raw string)
- Given an actor node with `display = "<latex>x^2</latex>"`, when
  `measureLeafNode()`, then returns `{ width: ACTOR_WIDTH, height: ACTOR_HEIGHT }`
  (actor sizing is not affected by label content)
- Given a plain usecase node with `display = "Login"`, when `measureLeafNode()`,
  then returns dimensions from the string measurer path (no regression)
- Given a diagram with one latex-labeled usecase and one plain usecase, when
  `layoutUseCase()`, then both nodes have positive x/y/width/height

## Quality bar

`npm test && npm run typecheck && npm run lint` — all pass.
