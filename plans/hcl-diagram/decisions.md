# Architecture Decisions

## D1: Function call representation

Port Java exactly.

- No-arg call `name()` → plain JSON string `"name()"`
- With args `name(a, b)` → object `{ "name()": ["a", "b"] }`

This matches `HclParser.getFunctionData()` exactly. Functions are stored
for display, never evaluated.

## D2: Comment stripping

Strip entire lines whose `.trim()` starts with `#` before tokenizing.
This mirrors `HclSource.add()` which does the same gate. Do this in
`parseHcl()` before passing characters to the tokenizer.

## D3: Style selectors (intentional divergence from Java)

Java's `HclDiagramFactory` has `styleExtractor.applyStyles()` commented
out — HCL diagrams in upstream Java always render with default styling.

**This port adds full `hcldiagram.*` style selector support** — mirroring
the `yamldiagram.*` block already in `src/index.ts`. This is an
intentional improvement documented in `DIVERGENCES.md`.

Selectors to support (all map to the same `Theme.colors.graph.json`
fields as their `yamldiagram.*` counterparts):

- `hcldiagram.element` → `headerBackground`
- `hcldiagram.node` → background, border, arrowColor, nodeLineThickness,
  roundCorner, maximumWidth, textAlign, nodeFontColor, nodeFontSize,
  nodeFontFamily, nodeFontBold, nodeFontItalic, nodeLineDasharray
- `hcldiagram.arrow` → arrowColor, arrowThickness, arrowDasharray
- `hcldiagram.node.separator` → separatorColor, separatorThickness,
  separatorDasharray
- `hcldiagram.node.highlight` → highlightBackground, highlightFontColor,
  highlightFontBold, highlightFontItalic
- `hcldiagram.document` → document background color (add to the
  `['document', 'jsondiagram.document', 'yamldiagram.document']` loop)

## D4: `accepts()` always returns false

`@starthcl` blocks are routed by type via `START_SUFFIX_MAP` — the
dispatcher never calls `accepts()` for them. HCL content inside
`@startuml` is not a real use case. `hclPlugin.accepts()` returns `false`.

## D5: Title directive not supported

`HclDiagramFactory.java` has title application commented out. Strip
`title …` lines before tokenizing (so they don't confuse the HCL parser)
but do not populate `ast.title`. Match Java behavior.

## D6: Test location

Tests go in `tests/unit/hcl/` — matching the existing `tests/unit/yaml/`
and `tests/unit/json/` convention, not `tests/diagrams/`.

## D7: Expression behavior (bug-for-bug compat)

| Construct | Java behavior | TypeScript port |
|-----------|--------------|-----------------|
| `var.foo` (variable ref) | Stored as string `"var.foo"` (`.` not special) | Same |
| `[for k in list : k]` | Empty array `[]` (STRING_SIMPLE silently ignored in getArray) | Same |
| `cond ? "a" : "b"` (ternary) | IllegalStateException → `data = null` | `root: null` |
| `"${var.name}"` (interpolation) | Literal string `"${var.name}"` (eatUntilDoubleQuote verbatim) | Same |
| `name(a, b)` (function) | `{ "name()": ["a", "b"] }` | Same |
| `name()` (no-arg function) | String `"name()"` | Same |
