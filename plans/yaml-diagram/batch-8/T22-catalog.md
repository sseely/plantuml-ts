# T22 — Catalog Update

## Context

After all YAML tasks pass quality gates, update the feature catalog to mark
YAML as Done and document the public API surface.

## Task

Update `.claude/catalog.md`:

1. Change `| YAML visualisation | Phase 5c | @startyaml |` in the
   "Planned — Not Yet Built" table to remove the row.

2. Add a new section under "Diagram Types" after the JSON section:

```markdown
### YAML — `src/diagrams/yaml/`

**Status:** Done

- **Plugin:** `yamlPlugin` (`SyncPlugin` — delegates layoutSync + render to jsonPlugin)
- **AST types:** `JsonDiagramAST` (shared with JSON diagram; no new types)
- **Parser:** `parseYaml()` in `src/diagrams/yaml/parser.ts`
- **Core parser modules:**
  - `yaml-line.ts` — `YamlLine.build()` tokenizer + `YamlLineType` enum
  - `monomorph.ts` — `Monomorph` intermediate tree + `monomorphToJson()` converter
  - `yaml-builder.ts` — `YamlBuilder` two-stack state machine
  - `yaml-parser.ts` — `parseYamlLines()` orchestrator (Peeker lookahead)
- **Features:** `@startyaml`/`@endyaml`, all YAML key-value forms, nested objects,
  scalar lists, list-of-objects, flow sequences (`[a, b, c]`), block scalar (`|`),
  multiline text continuation, tab indentation (expanded to 4 spaces),
  inline/full-line comment stripping, common-indent normalization,
  `#highlight` exact paths, unquoted paths, `*`/`**` wildcards,
  `<style>` block with `yamlDiagram { node/arrow/separator/highlight }` selectors,
  `title` and `skinparam` directives
- **Shares with JSON:** `layoutJson`, `renderJson`, `JsonDiagramAST`, all theme/style handling
```

3. Update the `DiagramType` union in the block-extractor entry:
   Add `'yaml'` to the union.

## Write-set

- `.claude/catalog.md` (modify)

## Read-set

- `.claude/catalog.md` — current state (read before editing)
- `src/diagrams/yaml/` — confirm all listed files exist

## Quality bar

No tests needed. Visual review that catalog is accurate.
