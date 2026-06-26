# T2 — break keyword: AST + parser + layout

## Context

Project: `plantuml-js` — TypeScript port of PlantUML, pure SVG output.
Stack: TypeScript, Vitest, ESLint, Vite.
Test command: `npm test` (vitest + 90/90/90 coverage thresholds).
Type check: `npm run typecheck`.
Lint: `npm run lint`.

The `break` keyword inside a `repeat` loop exits the loop immediately,
bypassing the repeat-while condition. Currently `break` falls through to
the "unknown line" handler and is silently dropped.

Java reference: `FtileBreak` implements `WeldingPoint`. The repeat layout
collects all welding points from the body, creates a break-exit diamond
below the condition diamond, and wires all break nodes to it. The break-exit
diamond then becomes the loop's post-exit point.

Depends on T1 (repeat terminator fix must be in place so `repeat` blocks
parse correctly before this work is tested end-to-end).

## Task

### 1. AST — add `ActivityBreak`

In `src/diagrams/activity/ast.ts`, add:
```typescript
export interface ActivityBreak {
  kind: 'break';
  swimlane?: string;
}
```
Add `ActivityBreak` to the `ActivityNode` union type.

### 2. Parser — recognise `break`

In `src/diagrams/activity/parser.ts`, add a rule that matches the bare
keyword `break` (case-insensitive) and pushes an `ActivityBreak` node.
Insert before the "unknown line" fallthrough.

### 3. Layout — BranchResult.breakGeos

In `src/diagrams/activity/layout.ts`:

**a. Add field to BranchResult:**
```typescript
interface BranchResult {
  // ... existing fields ...
  /**
   * Geo nodes emitted by `break` statements inside this branch.
   * layoutRepeat drains these and wires them to the break-exit diamond.
   */
  breakGeos?: ActivityNodeGeo[];
}
```

**b. Add layoutBreak:**
```typescript
function layoutBreak(
  node: ActivityBreak,
  startY: number,
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  const id = nextId(ctx, 'break');
  const size = DIAMOND_MIN;
  const geo: ActivityNodeGeo = {
    id,
    kind: 'break',
    x: centerX - size / 2,
    y: startY,
    width: size,
    height: size,
    ...swimlaneSpread(node),
  };
  return {
    nodes: [geo],
    edges: [],
    bottomY: startY + size,
    width: size,
    firstId: id,
    lastId: undefined,       // no outgoing edge from break itself
    breakGeos: [geo],
  };
}
```

**c. layoutSequence — accumulate breakGeos:**
After each child `result`, collect `result.breakGeos` into a running
array and return them in the final `BranchResult.breakGeos`.

**d. layoutIf — propagate breakGeos from branches:**
Each branch result may carry `breakGeos`. Collect all branch breakGeos
into a merged array and include in the returned `BranchResult.breakGeos`.

**e. layoutRepeat — drain breakGeos:**
After calling `layoutSequence(node.body, ...)` on the body:
- If `bodyResult.breakGeos` is non-empty:
  - Create a **break-exit diamond** node (`kind: 'while-header'`, or a
    dedicated `kind: 'break-exit'` — use `'while-header'` to reuse
    existing rendering) positioned below the condition diamond with
    `NODE_MARGIN_Y` spacing.
  - For each geo in `breakGeos`, add an edge from that geo to the
    break-exit diamond.
  - Use the break-exit diamond as an **additional exit** by including
    its id in `exitIds` so `layoutSequence` wires it to the post-repeat
    node.
- If no `breakGeos`, behaviour is unchanged (backward compatible).

**Node kind for break:** Add `'break'` to the `ActivityNodeGeo` kind
union (or the existing kind union in ast.ts if it lives there). The
renderer will need to handle this new kind — render it as a diamond
(same as `renderDiamond`). Add a case to `renderNode` in renderer.ts:
```typescript
case 'break':
  return renderDiamond(node, theme);
```

Note: `renderer.ts` is NOT in the write-set for T2. If adding `'break'`
to the kind union causes an exhaustiveness error in `renderer.ts`,
add the minimal case needed (`case 'break': return renderDiamond(node, theme)`)
and note this in the decision journal. This is the only permitted change
outside the declared write-set — check `plans/activity-repeat-break-arrow/README.md`
stop condition #3.

## Write-set

- `src/diagrams/activity/ast.ts` — ActivityBreak, union update
- `src/diagrams/activity/parser.ts` — break recognition
- `src/diagrams/activity/layout.ts` — BranchResult.breakGeos, layoutBreak,
  propagation, layoutRepeat drain
- `tests/unit/activity/parser.test.ts` — break parse tests
- `tests/unit/activity/layout.test.ts` — break layout tests

## Read-set

- `src/diagrams/activity/ast.ts` — ActivityNode union, existing node shapes
- `src/diagrams/activity/parser.ts:83-110` — ParseContext, helpers
- `src/diagrams/activity/parser.ts:376-400` — repeat parsing pattern
- `src/diagrams/activity/layout.ts:242-260` — BranchResult interface
- `src/diagrams/activity/layout.ts:269-345` — layoutSequence (accumulation pattern)
- `src/diagrams/activity/layout.ts:511-670` — layoutIf (branch propagation pattern)
- `src/diagrams/activity/layout.ts:888-967` — layoutRepeat (drain target)
- `plans/activity-repeat-break-arrow/decisions.md#D1` — breakGeos decision

## Architecture decisions

- D1 (decisions.md): `BranchResult.breakGeos?: ActivityNodeGeo[]`.
  `layoutBreak` emits geo + returns it in `breakGeos` with `lastId = undefined`.
  `layoutSequence` and `layoutIf` propagate upward. `layoutRepeat` drains and
  creates break-exit diamond.

## Acceptance criteria

```
Given `break` inside a repeat body,
When parsed,
Then the repeat body contains an `ActivityBreak` node with kind 'break'.

Given a sequence [action, break, action] inside a repeat body,
When laid out,
Then the BranchResult from layoutSequence contains breakGeos with one entry
and lastId is the id of the first action (break truncates the chain).

Given a repeat block with one break in the body,
When the full repeat is laid out,
Then the output nodes include a break-exit diamond (kind 'while-header' or
'break-exit') positioned below the condition diamond.

Given a repeat block with one break,
When laid out,
Then an edge connects the break geo to the break-exit diamond.

Given a repeat block with no break,
When laid out,
Then no break-exit diamond is created (backward compatible).
```

## Quality bar

`npm test && npm run typecheck && npm run lint` must all pass.
No files outside the write-set should be modified (except the minimum
renderer.ts case described above if exhaustiveness is triggered).
