# T15 — Highlight Wildcard * and ** in buildHighlightMap

## Context

`src/diagrams/json/layout.ts` contains `buildHighlightMap` which maps
nodeId → Set<key>. Currently it only does exact key matching. YAML highlight
paths may contain `*` (match any key at one level) and `**` (recursive).

Java reference for wildcard semantics:
`~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/Highlighted.java`
- `upOneLevel(key)`: if first segment is `"**"` return self; if `"*"` or
  first.equals(key) return new Highlighted with segments[1:]
- `isKeyHighlight(key)`: if `["**", key]` or `[key]` return true

This implements breadth-first matching for `**` (match at any depth) and
single-level matching for `*`.

## Task

Extend `buildHighlightMap` in `src/diagrams/json/layout.ts` to handle wildcard
path segments. Add tests to `tests/unit/json/layout.test.ts`.

### Algorithm extension

When walking a highlight path:

**For `*` at position i:**
Instead of looking up one specific child by key, look up ALL direct children
of `currentId` and continue with `path[i+1...]` from each child.

**For `**` at any position:**
The next segment (or last segment) is the key to match. Search `currentId`
AND all descendants recursively for nodes that have that key. This is
equivalent to: for every node in the subtree rooted at `currentId`, check
if `lastKey` is in its key set.

**Implementation approach:**

Add a helper that, given a `FlatNode[]` and a start nodeId, returns all
nodeIds reachable via the child tree (including the start).

For `**` handling: when processing a path `["**", key]`, iterate over all
flatNodes that are descendants of the current node (or ARE the current node),
and for each one that has `key` in its own key set, add `key` to the
highlight map for that nodeId.

For `*` handling: when processing a path `["*", ...rest]` at a given node,
find all direct children of that node and continue path navigation from each.

### Backward compatibility

If the path segment is neither `"*"` nor `"**"`, behavior is unchanged:
exact key lookup via `childLookup`. All existing JSON diagram tests must pass.

## Write-set

- `src/diagrams/json/layout.ts` (modify — extend buildHighlightMap)
- `tests/unit/json/layout.test.ts` (modify — add wildcard highlight tests)

## Read-set

- `src/diagrams/json/layout.ts` — current buildHighlightMap implementation
- `src/diagrams/json/layout.ts:164-210` — the exact function to modify
- Java source: Highlighted.java (upOneLevel, isKeyHighlight semantics)
- `tests/unit/json/layout.test.ts` — existing test patterns

## Acceptance criteria

- `path = ['*', 'count']` with root `{a:{count:'1'}, b:{count:'2'}}` →
  both `a/count` and `b/count` rows are highlighted
- `path = ['**', 'location']` with deep tree where `location` appears at
  multiple depths → ALL `location` keys highlighted regardless of depth
- `path = ['fruit']` (no wildcard) → exact match unchanged; existing tests pass
- `path = ['xmas-fifth-day', 'partridges']` (no wildcard) → unchanged behavior
- All existing JSON layout tests continue to pass

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
Existing JSON diagram layout tests must show zero regressions.
