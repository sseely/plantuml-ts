# T2 — Plugin Wiring + Index Registration + Style Selectors + Tests + Visual Page

## Context

You are working on `plantuml-js`, a TypeScript port of PlantUML. The project
renders PlantUML diagram source to SVG strings with no DOM dependency.

Stack: TypeScript, Vitest, Vite. Test command: `npm test`. Typecheck:
`npm run typecheck`. Lint: `npm run lint`. Build: `npm run build`.

Batch 1 (T1) is complete. `src/diagrams/hcl/parser.ts` exists and exports
`parseHcl(source: UmlSource): JsonDiagramAST`. The `DiagramType` union
includes `'hcl'` and `START_SUFFIX_MAP['hcl'] === 'hcl'` in
`src/core/block-extractor.ts`.

## Task

Wire the HCL parser into the plugin and registration system:

1. Create `src/diagrams/hcl/index.ts` — the `hclPlugin: SyncPlugin`
2. Modify `src/index.ts` — register `hclPlugin` and add `hcldiagram.*`
   style selectors to `applyStyleMap`
3. Create `tests/unit/hcl/plugin.test.ts` — integration tests
4. Create `tests/visual/hcl.html` — visual smoke test page
5. Update `DIVERGENCES.md` — document the style selector addition

## Write-set

- `src/diagrams/hcl/index.ts` (create)
- `src/index.ts` (modify)
- `tests/unit/hcl/plugin.test.ts` (create)
- `tests/visual/hcl.html` (create)
- `DIVERGENCES.md` (modify — append new entry)

## Read-set

- `src/diagrams/hcl/parser.ts` — the `parseHcl` function from T1
- `src/diagrams/yaml/index.ts` — exact plugin structure to mirror
- `src/index.ts` — current state (read before modifying)
- `tests/unit/yaml/plugin.test.ts` — test pattern to follow
- `tests/visual/yaml.html` — visual page template to mirror
- `DIVERGENCES.md` — current state (read before appending)
- `plans/hcl-diagram/decisions.md` — confirmed architecture decisions

## Architecture decisions (pre-made)

**D3 — Style selectors (intentional divergence):** Add full `hcldiagram.*`
selector support in `applyStyleMap`. Java has this commented out; this port
implements it as an improvement. Document in `DIVERGENCES.md`.

**D4 — `accepts()` always returns false:** HCL is only routed via
`@starthcl` / `START_SUFFIX_MAP`. No `@startuml` fallback needed.

**D5 — No title support:** Do not handle `title` in the plugin; the parser
already strips it without populating `ast.title`.

## Interface contracts

### `hclPlugin` shape (mirrors `yamlPlugin`)

```typescript
import type { SyncPlugin } from '../../core/dispatcher.js';
import type { JsonDiagramAST } from '../json/ast.js';
import type { JsonGeometry } from '../json/layout.js';

export const hclPlugin: SyncPlugin<JsonDiagramAST, JsonGeometry> = {
  type: 'hcl',
  accepts(_lines: readonly string[]): boolean { return false; },
  parse(source) { return parseHcl(source); },
  layoutSync(ast, theme, measurer) { return layoutJson(ast, theme, measurer); },
  render(geo, theme) { return renderJson(geo, theme); },
};
```

### `src/index.ts` changes

**Import line** (add after `yamlPlugin` import):
```typescript
import { hclPlugin } from './diagrams/hcl/index.js';
```

**Registration** (add after `registry.register(yamlPlugin)`):
```typescript
registry.register(hclPlugin);
```

**`applyStyleMap` — `hcldiagram.*` selectors** (add after the
`yamldiagram.node.highlight` block, before the highlight classes loop):

Mirror the `yamldiagram.*` block exactly, replacing `yamldiagram` with
`hcldiagram` and using the same `jsonOverride` target fields.

Six selector blocks to add:
- `hcldiagram.element` → `jsonOverride.headerBackground`
- `hcldiagram.node` → background, border, arrowColor, nodeLineThickness,
  roundCorner, maximumWidth, textAlign, nodeFontColor, nodeFontSize,
  nodeFontFamily, nodeFontBold/Italic, nodeLineDasharray
- `hcldiagram.arrow` → arrowColor, arrowThickness, arrowDasharray
- `hcldiagram.node.separator` → separatorColor, separatorThickness,
  separatorDasharray
- `hcldiagram.node.highlight` → highlightBackground, highlightFontColor,
  highlightFontBold/Italic

**`applyStyleMap` — document background loop** (extend existing array):
```typescript
// Before:
for (const sel of ['document', 'jsondiagram.document', 'yamldiagram.document']) {
// After:
for (const sel of ['document', 'jsondiagram.document', 'yamldiagram.document', 'hcldiagram.document']) {
```

## `DIVERGENCES.md` entry to append

```markdown
---

## HCL diagrams

### Style selector support (limitation)

**Upstream:** `HclDiagramFactory.java` has `styleExtractor.applyStyles()`
commented out. `<style>` blocks inside `@starthcl` are stripped from the
content but never applied — HCL diagrams always render with default styling.

**This port:** Full `hcldiagram.*` style selector support is implemented,
mirroring the `yamldiagram.*` block in `src/index.ts`. Users can write
`<style> hclDiagram { node { BackgroundColor "#eee" } } </style>` inside
an `@starthcl` block and it will be applied.

**Reason:** The Java omission appears to be an incomplete implementation
rather than a deliberate design choice. Style support is expected by users
and consistent with how `@startyaml` and `@startjson` behave.

**Affects:** all `@starthcl` diagrams using `<style>` blocks.
```

## Visual smoke test page

`tests/visual/hcl.html` should mirror `tests/visual/yaml.html` structure
(same CSS, same two-panel layout of source + rendered SVG). Include at
minimum these HCL examples:

1. **Flat key-value** — simple Terraform variable block
2. **Nested blocks** — Terraform `resource "aws_s3_bucket"` with attributes
3. **Array values** — a block containing a list of strings
4. **Function call** — a value using `templatefile("path", {})` syntax
5. **Comments** — `# comment` lines that should be absent from the tree
6. **Multiple top-level blocks** — two `resource` blocks showing sibling roots

Use `import { renderSync } from '../../../src/index.js'` (same import path
as `yaml.html` uses). The page should be self-contained and open directly
with a static file server (`npx serve .` from repo root).

## Acceptance criteria

1. Given `renderSync('@starthcl\nresource "aws_s3_bucket" "b" {\n  bucket = "test"\n}\n@endhcl')`,
   when called, then returns a string starting with `<svg`

2. Given `hclPlugin`, then `hclPlugin.type === 'hcl'` and
   `hclPlugin.accepts([])` returns `false` and `hclPlugin.accepts(['resource "r" "n" {'])` returns `false`

3. Given `@starthcl` with `<style>\nhclDiagram {\n  node {\n    BackgroundColor "#ffcc00"\n  }\n}\n</style>`,
   when `renderSync` is called, then the SVG output contains `fill="#ffcc00"` (or the
   equivalent hex) on node rectangles

4. Given `@starthcl` with `title My Title\nkey = "value"\n@endhcl`, when
   rendered, then no `<text` element in the SVG contains `My Title`

5. Given `@starthcl` with content containing `cond ? "a" : "b"`, when
   `renderSync` is called, then it returns an SVG (either empty-tree or
   error SVG — not a thrown exception)

6. `DIVERGENCES.md` contains a section for HCL diagrams describing the
   style selector addition

## Quality bar

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`
before finishing. All must pass. Coverage for `src/diagrams/hcl/index.ts`
must meet 90/90/90.
