# Architecture Decisions

## D1 — Break edge propagation: BranchResult.breakGeos (Java welding-point pattern)

Java: `FtileBreak` implements `WeldingPoint`. The repeat layout collects all
welding points from the body, creates a **break-exit diamond** below the
condition diamond, and wires all break nodes to it. The break-exit diamond
becomes the post-repeat exit point.

**Decision:** Add `breakGeos?: ActivityNodeGeo[]` to `BranchResult`.

- `layoutBreak` emits a geo node and returns it in `breakGeos` with `lastId = undefined`
  (no outgoing edge from the break node itself).
- `layoutSequence` and `layoutIf` accumulate `breakGeos` from child results and
  propagate them upward via their own `BranchResult`.
- `layoutRepeat` drains `body.breakGeos`. If non-empty, it creates a break-exit
  diamond node positioned below the condition diamond. All break geos get edges
  to this diamond. The break-exit diamond is added to `exitIds` so `layoutSequence`
  wires it to the post-repeat node.
- The condition diamond's back-edge (to repeat-start) is unchanged.

**Why:** Pure functional, no mutable context. Consistent with how `exitIds`
already propagates multiple-exit nodes.

---

## D2 — Arrow label AST: standalone ActivityArrowLabel node (Java setLabelNextArrow pattern)

Java: `CommandArrow3.executeArg()` calls `diagram.setLabelNextArrow(label)` —
mutable "pending label" state on the diagram that the next edge consumes.

**Decision:** `ActivityArrowLabel` is a standalone AST node in the sequence.
`layoutSequence` consumes it as "pending style" that is applied to the NEXT
edge created, then clears it. No geo node is emitted for the arrow label itself.

Arrow label node shape:
```typescript
interface ActivityArrowLabel {
  kind: 'arrow-label';
  label: string;
  color?: string;   // resolved CSS/SVG color string, e.g. "red", "#FF0000"
  swimlane?: string;
}
```

**Why:** No parser lookahead required. Layout already processes nodes
sequentially — carrying a "pending" value for one step is straightforward.

---

## D3 — Colored pill rendering: SVG rect + text

**Decision:** Edge labels with a background color render as a filled `<rect>`
behind a `<text>` element, positioned at the edge midpoint.

Pill dimensions: `text_width + 8px` wide, `fontSize + 4px` tall.
Padding: 4px horizontal, 2px vertical inside the rect.

Named colors (e.g. `red`) are passed through as-is to SVG `fill` — browsers
handle all CSS named colors natively.

**Why:** No new dependencies. Consistent with how the rest of the renderer
generates SVG strings.

---

## D4 — repeat while parsing: space-flexible regex, optional parens

Java: `CommandRepeatWhile3` uses `RegexLeaf.spaceZeroOrMore()` between
`repeat` and `while`, and wraps the condition in `RegexOptional`.

**Decision:**
- Stop keyword list: `['repeatwhile', 'repeat while']` — both spellings accepted.
- `RE_REPEATWHILE`: `/^repeat\s*while(?:\s*\(([^)]*)\))?\s*$/i`
  — zero or more spaces between words, condition parens optional.
- Empty condition string (`''`) means no explicit exit condition (break is the
  only exit path).
