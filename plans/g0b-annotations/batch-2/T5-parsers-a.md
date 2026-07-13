# T5 — Parser wiring A: class, state, sequence

## Context

plantuml-ts. T1 provides `matchAnnotationCommand` + `DiagramAnnotations`.
Each parser must call it at its own command-dispatch position — NOT a
pre-parse strip (decisions.md D3: a strip would steal `title …` lines from
inside `note … end note` bodies). Upstream registers these commands on
every diagram factory (CommonCommands.addTitleCommands), tried in the
factory's command order; our equivalent is "matcher consulted where the
parser currently ignores/drops these lines".

## Task

Per engine:

1. **class** — `src/diagrams/class/`:
   - AST: add `annotations?: DiagramAnnotations` to `ClassDiagramAST`
     (ast.ts:460).
   - `class-commands.ts:88-90`: the ignore pattern `/^(skinparam|title\s|scale\b)/i`
     currently swallows `title` — remove `title` from it and route through
     the matcher instead (call the matcher BEFORE the ignore check, at the
     same dispatch point).
   - Legend strip: `class/parser.ts:68,227-231` and
     `class-dispatch.ts:228-232` strip `legend…end legend` — REPLACE the
     strip with matcher consumption so the content lands in annotations.
   - `header`/`footer`/`caption`/multiline `title` currently fall through as
     unknown lines — matcher now consumes them.
2. **state** — `src/diagrams/state/`:
   - AST field on `StateDiagramAST` (ast.ts:307).
   - `state-commands.ts:96-101` ignore pattern `/^(?:skinparam|title|scale|hide|show)\b/i`:
     remove `title`, consult matcher first. Legend/caption/header/footer:
     matcher at the unknown-line position.
3. **sequence** — `src/diagrams/sequence/`:
   - AST field on `SequenceDiagramAST` (ast.ts:111).
   - parser.ts (~:540 "Normal dispatch" / unrecognized-line drop): consult
     the matcher BEFORE the silent drop. CRITICAL: sequence has multiline
     constructs (`note over A … end note`, alt/else blocks) — the matcher
     must only see lines at TOP-LEVEL dispatch, never inside a multiline
     body the parser is already consuming. Verify with a test:
     `note over A\ntitle not a title\nend note` keeps the line as note text.

Rule for ALL: the matcher call sits where the parser decides "this line is
not mine" — after the engine's own commands have had their chance where
upstream's ordering demands it (check CommonCommands position: title
commands are registered FIRST in addCommonCommands1 — mirror that: matcher
BEFORE engine commands, but ONLY for lines outside any open multiline
construct; document per engine which position you chose and why in the
decision journal if it deviates).

parse() returns the AST with `annotations` populated (always present —
`createAnnotations()` default; `isEmpty` distinguishes).

## Read-set

- `src/core/annotations/index.ts` (T1 contract)
- `src/diagrams/class/{parser.ts:60-80+220-240, class-commands.ts:80-100, class-dispatch.ts:220-240, ast.ts:455-465}`
- `src/diagrams/state/{state-commands.ts:90-110, parser.ts, ast.ts:300-315}`
- `src/diagrams/sequence/{parser.ts:520-560, ast.ts:105-120}`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/command/CommonCommands.java:54-124` (ordering)
- Corpus spot fixtures: grep `^title|^legend` under tests/corpus/{class,state,sequence} for 2-3 real fixtures each to use in tests.

## Interface contract

Each AST type gains `annotations: DiagramAnnotations` (required, defaulted).
Consumed by T7 via a shared structural type `{ annotations?: DiagramAnnotations }`.

## Acceptance criteria

- Given `title X` in a class/state/sequence fixture, parse() yields annotations.title set AND the directive absent from the engine's own AST nodes (no phantom class named `title`, no dropped-line warnings).
- Given `legend\nfoo\nend legend` in class, the legend body reaches annotations and NO legend text leaks into entities (replaces the old strip).
- Given `note over A` containing `title inside` (sequence), the note body keeps the line; annotations.title stays null.
- Given annotation-free fixtures, parse output is deep-equal to main (assert on 2-3 corpus fixtures per engine).
- DOT gate after batch: EXACTLY 251/259, 81/87, 680/680, 78/80, 260/261 — parsing changes must not shift any fixture into/out of error (Trap 3).

## Quality bar

Gates green. Do not modify renderer files (T7/T8 own rendering).

## Observability: N/A.
## Rollback: Reversible.
## Commit: `feat(T5): wire annotation commands into class/state/sequence parsers`
