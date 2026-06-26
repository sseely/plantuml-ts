# Mission: Activity Diagram — repeat/break/arrow-label fixes

## Objective

Fix four bugs in the activity diagram pipeline discovered in fixture
`bisoje-74-pipa697`. The repeat-while terminator is not recognised,
causing cascading parse failure. The repeat-start node renders as a
rounded rect instead of a diamond. The `break` keyword is silently
dropped. Arrow labels with `<back:color>` tags are not parsed or
rendered.

## Branch

`feat/class-diagram` (current working branch)

## Quality Gates

```sh
npm test              # vitest + coverage (90/90/90 thresholds)
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

All four must pass after every batch before moving to the next.

## Constraints

### Stop and wait for human
- Any file outside the declared write-set needs changes
- Two consecutive quality gate failures on the same check
- `ActivityBreak` or `ActivityArrowLabel` added to the AST union causes
  exhaustiveness errors outside the write-set
- Break-exit diamond edge routing conflicts with existing repeat back-edge

### Push forward with judgment
- Break-exit diamond size/position: use `DIAMOND_MIN`
- Colored pill rect padding: 4px horizontal, 2px vertical
- Named colors (`red`, `blue`) passed through as-is to SVG fill
- Minor test assertion wording

## Batches

| Batch | Task | Description | Done |
|-------|------|-------------|------|
| 1 | T1 | repeat terminator fix + repeat-start diamond | [x] |
| 2 | T2 | break keyword — AST + parser + layout | [x] |
| 3 | T3 | arrow labels — AST + parser + layout + renderer | [x] |

## Links

- [decisions.md](decisions.md)
- [decision-journal.md](decision-journal.md)
- [Batch 1 overview](batch-1/overview.md) → [T1](batch-1/T1-repeat-terminator-diamond.md)
- [Batch 2 overview](batch-2/overview.md) → [T2](batch-2/T2-break-support.md)
- [Batch 3 overview](batch-3/overview.md) → [T3](batch-3/T3-arrow-labels.md)
- [Component map](diagrams/component-map.md)
- [Data flow](diagrams/data-flow.md)

## Reference fixture

`~/git/pdiff/dbhum/b_is/bisoje-74-pipa697.puml`

```
@startuml
start
repeat
    if (Something went wrong?) then
      :OK;
      break
    endif
    :Alert;
repeat while
-><back:red> no3 ;
stop
@enduml
```

## Upstream Java references

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/activitydiagram3/command/CommandBreak.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/activitydiagram3/InstructionBreak.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/activitydiagram3/ftile/FtileBreak.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/activitydiagram3/ftile/vcompact/FtileFactoryDelegatorRepeat.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/activitydiagram3/command/CommandArrow3.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/activitydiagram3/command/CommandRepeatWhile3.java`
