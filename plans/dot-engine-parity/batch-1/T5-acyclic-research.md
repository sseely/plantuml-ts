# T5 — Research: acyclic.c vs acyclic.ts

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Same project context as T1. Cycle removal is the simplest of the
five algorithms — acyclic.c is only 70 lines. Our implementation
is 54 lines. This task verifies correctness rather than finding
large gaps.

## Task

Compare `~/git/graphviz/lib/dotgen/acyclic.c` against
`src/core/dot/acyclic.ts` and produce a findings report.

Cover:
1. **DFS order** — does graphviz use a specific node visitation order
   that affects which edges get reversed? Does our DFS match?
2. **Edge selection** — when multiple back-edges exist, does graphviz
   have a preference for which to reverse? Document the rule.
3. **Self-loops** — how does acyclic.c handle A→A self-loops?
   Does our code handle them the same way?
4. **Multi-edges** — two edges A→B in the same direction; how does
   acyclic.c handle them? Does it matter?
5. **Reversed flag** — acyclic.c sets a reversed flag on edges; our
   code does the same. Verify the semantics match exactly.
6. **Already-acyclic graphs** — confirm both return without mutation.
7. **Verdict** — is our implementation correct, or does it diverge
   in a way that would produce different layouts?

## Write-set

`plans/dot-engine-parity/batch-1/T5-acyclic-findings.md`

## Read-set

- `~/git/graphviz/lib/dotgen/acyclic.c` (full file)
- `src/core/dot/acyclic.ts` (full file)

## Quality Bar

Concise — this should be under 100 lines. Either "implementation
matches, minor edge cases to fix" or "significant divergence found,
here's what to change."
