# T9 — Mainframe rendering (BigFrame port)

## Context

T1 parses `mainframe` into the model (decisions.md D9). Upstream draws it in
`DiagramChromeFactory.decorateWithFrame` (:257-318): a `BigFrame(title,
original, style.getPadding(), symbolContext)` using the `SName.mainframe`
style (plantuml.skin: Padding 1 5, LineThickness 1.5, Margin 10 5);
`computePadding` grows the top by `dimTitle.height + 10` (:306-309). It is
the INNERMOST chrome layer (inside legend/title/caption/header/footer).

## Task

Port `decorateWithFrame` + the `BigFrame` drawing (find `BigFrame.java` —
grep the whole `net/` tree) into `src/core/annotations/`: frame border with
the mainframe title in its tab, padding/margin per style, wrap position
innermost in `applyChrome`'s stacking. Jar-verify with
`@startuml\nmainframe demo\na->b\n@enduml` (capture the jar svg; assert
structure/relations).

If BigFrame's geometry drags in unported symbol machinery
(`USymbols.FRAME` etc.), check `src/core/klimt/` and the description
engine's symbol renderers for an existing frame primitive
(`renderer-symbol.ts`) before porting anything new. If it is genuinely
large (>~300 LOC of new port), STOP per D9: record mainframe rendering in
`DIVERGENCES.md` as TEMPORARY (parsed, not yet drawn), journal it, and
close the task with the model-only state.

## Read-set

- `~/git/plantuml/.../core/DiagramChromeFactory.java:257-318`
- `BigFrame.java` (locate via grep), `plantuml.skin:85-89`
- `src/core/annotations/{chrome,blocks,model}.ts`
- `src/diagrams/description/renderer-symbol.ts` (existing frame drawing?)

## Acceptance criteria

- Given `mainframe demo`, the diagram is wrapped in a frame whose tab shows `demo`; top padding grows by title height + 10; frame is inside title/legend layers when both present.
- Given no mainframe, applyChrome output unchanged (byte-stability holds).
- Jar-relation test committed; OR the DIVERGENCES.md temporary entry + journal row if the stop branch was taken.

## Quality bar: all gates.
## Observability: N/A. Rollback: Reversible.
## Commit: `feat(T9): mainframe BigFrame rendering` (or `docs(T9): ledger mainframe as temporary divergence`)
