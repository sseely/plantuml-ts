# T9 — class hide/show directives

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. The class diagram parser currently
ignores `hide` and `show` directives (explicit skip in the command
table). These directives are used in ~40% of real-world class
diagrams. The most common: `hide empty members`, `hide circle`.

Architecture decision D3: hidden items enter the AST with a
`hidden: boolean` field; layout and renderer skip flagged items.

Key upstream behaviors to replicate (check upstream Java for others):
- `hide empty members` — suppress member section when a class has
  no members
- `hide members` — suppress all member rows regardless
- `hide circle` — suppress the C/I/A/E badge on classifier headers
- `hide empty fields` / `hide empty methods` — suppress specific
  empty sections
- `show` reverses a prior `hide`
- Directives apply globally to all classifiers unless scoped

## Task

1. Add a `HideShowDirective` type to `src/diagrams/class/ast.ts`
   and a `hidden` flag to relevant AST nodes
2. Parse `hide`/`show` directives in `src/diagrams/class/parser.ts`
   (currently skipped at line ~413)
3. Apply hide flags during layout in `src/diagrams/class/layout.ts`
   (skip hidden member rows in height calculation)
4. Respect hide flags in `src/diagrams/class/renderer.ts`
   (omit hidden sections and badges from SVG)

Consult `~/git/plantuml/src/main/java/net/sourceforge/plantuml/classdiagram/`
for upstream directive semantics.

## Write-set

- `src/diagrams/class/ast.ts`
- `src/diagrams/class/parser.ts`
- `src/diagrams/class/layout.ts`
- `src/diagrams/class/renderer.ts`
- `tests/unit/class/parser.test.ts`

## Read-set

- `src/diagrams/class/ast.ts`
- `src/diagrams/class/parser.ts` (especially the command table ~line 410)
- `src/diagrams/class/layout.ts`
- `src/diagrams/class/renderer.ts`
- `tests/unit/class/parser.test.ts`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/classdiagram/`
- `tests/corpus/class/*.puml` (scan for hide/show usage)

## Acceptance Criteria

- Given `"hide empty members"` and a class with no members, when
  rendered, then the member section `<rect>` and divider are absent
- Given `"hide circle"`, when rendered, then no C/I/A/E badge
  `<ellipse>` appears on any classifier header
- Given `"show empty members"` after `"hide empty members"`, when
  rendered, then empty member sections are visible
- Given `"hide members"` and a class with members, when rendered,
  then member rows are absent but the classifier box and header remain
- Given a class diagram with no hide/show directives, when rendered,
  then output is identical to before this change

## Quality Bar

`npm test` passes. `npm run typecheck` clean. All existing class
diagram tests must still pass.
