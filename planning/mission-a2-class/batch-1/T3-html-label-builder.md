# T3 — Class HTML compartment-label builder

## Context
Class svek nodes are `shape=plaintext` with an HTML `<TABLE>` label: one
compartment per section (name+stereotype, attributes, operations), matching
`EntityImageClass` / the class HTML generator upstream. The DOT emitter
(`src/core/svek-dot-emit.ts`) already emits HTML-table labels for ports/clusters
and honors `node.shape`. This task builds the class compartment table as a
self-contained helper (kept out of `layout.ts` to respect the 500-line cap).
Per ADR-2, build the FULL table (future-proofs the SVG gate); note the
comparator never reads inside the label, so structural parity only needs the
`shape=plaintext` that T4 sets.

## Task
Create `buildClassHtmlLabel(classifier, theme, measurer)` returning the DOT HTML
label string and the overall width/height (from `WidthTableMeasurer` cell
sizing). Compartments: (1) name row + optional `«stereotype»` row, (2)
attributes, (3) operations. A **bare** classifier (no members, no stereotype)
returns `null` → the caller emits `shape=rect` instead. Mirror the upstream row
structure and `FIXEDSIZE`/`WIDTH`/`HEIGHT`/`PORT` attributes closely enough that
the table is well-formed; exact internal pixels are tolerant.

## Write-set
- `src/diagrams/class/class-html-label.ts` (create)
- `tests/unit/class/class-html-label.test.ts` (create)

## Read-set
- `src/core/svek-dot-emit.ts:78-135` (existing HTML-table label helpers — the
  format to mirror)
- `src/diagrams/class/ast.ts` (`Classifier`, `Member`, `ClassifierKind`)
- `src/diagrams/class/layout.ts:95-210` (`formatMemberText`, `measureClassifier`
  — reuse the member-text formatting; do not duplicate)
- `src/core/measurer.ts` (`WidthTableMeasurer`, `StringMeasurer`)
- `~/git/plantuml/.../svek/image/EntityImageClass.java` (compartment structure)

## Interface contract (consumed by T4)
```ts
export function buildClassHtmlLabel(
  classifier: Classifier,
  theme: Theme,
  measurer: StringMeasurer,
): { label: string; width: number; height: number } | null; // null → bare → rect
```

## Acceptance criteria
- Given a class with 2 attributes + 1 method, when built, then the label has 3
  compartment `<TR>` groups and `width/height > 0`.
- Given a class with a stereotype, then a `«…»` row appears in the name
  compartment.
- Given a bare `class X` (no members, no stereotype), then it returns `null`.
- Given `npm run typecheck && npm run lint`, then clean; the file is < 500 lines.

## Observability / Rollback
N/A. Reversible.

## Quality bar
Unit tests assert row counts + non-null/null cases with specific values (not
just non-throw). Reuse `formatMemberText`; don't reimplement member formatting.

## Commit
`feat(T3): class HTML compartment-label builder`
