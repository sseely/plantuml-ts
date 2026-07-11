# Batch 1 — Parser consolidation into the class engine

Sequential chain (T1→T2→T3): all three write `src/diagrams/class/ast.ts`
and `class-commands.ts`. One agent per task, one commit each.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | CommandCreateEntityObject + classAccepts + OBJECT leaf | sonnet | class/ast.ts, class-commands.ts, class-dispatch.ts, tests | T0 | [ ] |
| T2 | CommandCreateEntityObjectMultilines + CommandAddData | sonnet | class/ast.ts, class-commands.ts, class-member-parser.ts?, tests | T1 | [ ] |
| T3 | CommandCreateMap + MAP leaf | sonnet | class/ast.ts, class-commands.ts, tests | T1 | [ ] |
