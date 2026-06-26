# T4 — Merged descriptive parser

## Context

`component/parser.ts` (454 LOC) and `usecase/parser.ts` (482 LOC) are structurally
parallel — same nesting and link logic, different keyword→kind maps and shorthand
handling. Upstream parses all of it in one `CommandCreateElementFull` keyed by
`ALL_TYPES`. Merge into one parser producing `DescriptionDiagramAST`. Per
`.claude/CLAUDE.md`, port faithfully — anything that does not map cleanly is
rewritten to match upstream `CommandCreateElementFull`, not force-fit; preserve
upstream behavior including apparent quirks that produce output.

## Task

Create `src/diagrams/description/parser.ts` exporting
`parseDescription(block: UmlSource): DescriptionDiagramAST`. Use
`KEYWORD_TO_SYMBOL` (T1) for keyword→`symbol`. Cover:

- Every `ALL_TYPES` keyword declaration → `DescriptiveNode` with correct `symbol`.
- Shorthands: `[Name]` → `component`; `() "Name"` / `(Name)` → `interface` or
  `usecase` per upstream rules; business variants (`actor/`, `usecase/`).
- Aliases (`X as Y`), quoted display names, stereotypes (`<<...>>`), colors
  (`#color`).
- Containers (`package`/`node`/`folder`/`frame`/`cloud`/`rectangle`/… with `{}`)
  → nested `children`. Reuse the container-kind logic from both parsers; the
  unified `CONTAINER_KINDS` is derived from `USymbol`.
- Links: solid/dashed, arrow heads, label, and `<<include>>`/`<<extend>>`
  stereotype stripped into `DescriptiveLink.stereotype`.

Migrate the union of test cases from both existing parser test suites, expressed
against the new AST (`symbol` not `kind`).

## Read-set

- `src/diagrams/component/parser.ts`, `src/diagrams/usecase/parser.ts` (merge
  source — read fully; this is the rewrite reference).
- `tests/unit/component/parser.test.ts`, `tests/unit/usecase/parser.test.ts`
  (cases to migrate).
- `~/git/plantuml/.../descdiagram/command/CommandCreateElementFull.java`
  (authoritative keyword/shorthand/business-variant rules).
- `src/diagrams/description/ast.ts` (T3), `src/core/descriptive-keywords.ts` (T1).
- `src/core/block-extractor.ts` (`UmlSource` type).

## Architecture decisions

D2 (full keyword set), D5 (naming). Locked. Faithfulness rule: reproduce upstream
behavior; rect-fallback (D2) is a render concern, not a parse concern — parse all
symbols regardless of whether the renderer draws them yet.

## Interface contract (consumed by T5, T7)

```ts
export function parseDescription(block: UmlSource): DescriptionDiagramAST;
```

## Acceptance criteria

- Given each `ALL_TYPES` keyword declaration, when parsed, then a node with the
  matching `symbol`.
- Given `[Comp]` and `() "Iface"`, when parsed, then `component` / `interface`
  nodes.
- Given `actor/ Biz` and `usecase/ Goal`, when parsed, then `actor-business` /
  `usecase-business`.
- Given `package P { node N }`, when parsed, then `P.children` contains `N`.
- Given `A ..> B : <<include>>`, when parsed, then a dashed link with
  `stereotype:'include'`.

## Observability

N/A — parser. Coverage enforced by migrated unit tests (≥ combined coverage of
the two source suites).

## Rollback

Reversible — delete the file; old parsers still live until Batch 8.

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` green; coverage 90/90/90. One commit:
`feat(T4): merge component+usecase parsers into descriptive parser`.
