# T3 — Board Parser + Parser Tests

## Context

plantuml-js ports PlantUML diagram types to TypeScript. We are implementing
`@startboard` (Phase 5i). The parser converts `UmlSource` lines into a
`BoardDiagramAST` (tree of Activities with BNode trees).

Java reference: `CommandBoardPlus.java` + `BoardDiagram.addLine` +
`Activity.addRelease` in `~/git/plantuml/src/main/java/net/sourceforge/plantuml/board/`.

Stack: TypeScript 5, Vitest, no DOM.

## Task

Create `src/diagrams/board/parser.ts` and `tests/unit/board/parser.test.ts`.

## Write-Set

- `src/diagrams/board/parser.ts` (create)
- `tests/unit/board/parser.test.ts` (create)

## Read-Set

- `src/diagrams/board/ast.ts` — `BoardDiagramAST`, `BoardActivity`, `BoardNode`
- `src/core/block-extractor.ts:28-31` — `UmlSource` type
- `src/diagrams/hcl/parser.ts:305-320` — how existing parsers strip wrapper lines
- `tests/unit/hcl/parser.test.ts:1-15` — test file structure + `makeSource` helper

## Java Algorithm to Port

### Line dispatch (CommandBoardPlus regex + BoardDiagram.addLine)

```
regex: /^([+]*)(.+)$/   (zero or more plus chars, then non-empty label)
```

- If `plus.length === 0`: new Activity with that label as column name
- If `plus.length > 0`: call `getLastActivity().addRelease(plus.length, label)`

### Activity.addRelease (cursor walk)

```java
public void addRelease(int stage, String label) {
    final BNode newNode = new BNode(stage, label);
    while (true) {
        if (stage > cursor.getStage()) {
            cursor.addChild(newNode);
            cursor = newNode;
            return;
        }
        cursor = cursor.getParent();
    }
}
```

Walk up the cursor until finding a node whose stage is strictly less than
`stage`, then add `newNode` as a child there. Cursor becomes `newNode`.

Initial cursor = root (stage=0).

### Blank lines

Java's `BoardDiagramFactory` skips blank lines before dispatching to
`CommandBoardPlus`. Blank lines do not create activities; they are ignored.

### Wrapper lines

Strip `@startboard` / `@endboard` lines (case-insensitive).

## TypeScript Implementation Sketch

```typescript
export function parseBoard(source: UmlSource): BoardDiagramAST {
  const activities: BoardActivity[] = [];
  let cursor: BoardNode | null = null;   // current insertion point
  let currentRoot: BoardNode | null = null;

  for (const line of source.lines) {
    const t = line.trim();
    if (t === '') continue;
    if (/^@startboard\s*$/i.test(t) || /^@endboard\s*$/i.test(t)) continue;

    const m = /^([+]*)(.+)$/.exec(t);
    if (!m) continue;

    const plusCount = m[1]!.length;
    const label = m[2]!.trim();

    if (plusCount === 0) {
      // New activity
      const root: BoardNode = { name: label, stage: 0, children: [] };
      activities.push({ name: label, root });
      currentRoot = root;
      cursor = root;
    } else {
      // Add card to current activity
      if (cursor === null || currentRoot === null) continue;
      const newNode: BoardNode = { name: label, stage: plusCount, children: [] };
      // Walk up cursor until stage < plusCount
      while (cursor.stage >= plusCount) {
        // need parent pointer — see note below
      }
      cursor.children.push(newNode);
      cursor = newNode;
    }
  }

  return { activities };
}
```

**Note on parent pointers:** Java's `BNode` stores a `parent` reference.
In our TypeScript `BoardNode` (from ast.ts) there is no `parent` field —
the tree is stored as children-only for simplicity. The parser needs a
cursor-walk-up capability. Implement using a **cursor stack**:

```typescript
// Instead of parent pointers, maintain a stack of ancestors.
// Stack bottom = root (stage=0). Stack top = current cursor.
const stack: BoardNode[] = [];
// On new card:
while (stack.length > 0 && stack[stack.length-1]!.stage >= plusCount) {
  stack.pop();
}
stack[stack.length-1]!.children.push(newNode);
stack.push(newNode);
```

This avoids mutating `BoardNode` to add `parent` while faithfully
reproducing the cursor-walk semantics.

## Acceptance Criteria

1. Given `['World']`, when parsed, then `ast.activities.length === 1` and
   `ast.activities[0].name === 'World'`.
2. Given `['World', '+Europe', '++France']`, when parsed, then
   `root.children[0].name === 'Europe'` and
   `root.children[0].children[0].name === 'France'`.
3. Given `['World', '+A', '+++C']` (skipping stage 2), when parsed, then
   `C` is a child of `A` (`A.children[0].name === 'C'`).
4. Given `['World', '+A', '+B']`, when parsed, then both `A` and `B` are
   direct children of root (`root.children.length === 2`).
5. Given `['World', '', '+Card']`, when parsed, then blank line is ignored
   and `+Card` is added to `World`'s activity.
6. Given `['@startboard', 'World', '@endboard']` in `source.lines`, when
   parsed, then wrapper lines are stripped and `activities.length === 1`.
7. Given `['World', '+A', 'Other', '+B']`, when parsed, then two activities:
   `World` with child `A`, `Other` with child `B`.
8. Given `[]` (empty source), when parsed, then `activities` is empty, no throw.

## Quality Bar

- `npm test` passes with the new test file included.
- 90/90/90 line/branch/function coverage for `parser.ts`.
- No `any` types — use the exported types from `ast.ts`.
