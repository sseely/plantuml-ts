# T1 — Block Extractor + Plugin Scaffold

## Context

plantuml-js is a TypeScript port of PlantUML. It uses a plugin registry
(src/core/dispatcher.ts) where each diagram type implements SyncPlugin or
AsyncPlugin. Phase 5b (JSON) is Done and serves as the model. YAML reuses
the JSON renderer entirely — only a parser front-end is new.

Stack: TypeScript, Vitest, Vite library build. Quality gates:
`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Task

1. Add `'yaml'` to the `DiagramType` union in `src/core/block-extractor.ts`.
2. Add `yaml: 'yaml'` to `START_SUFFIX_MAP` in the same file so
   `@startyaml` blocks are recognized.
3. Create `src/diagrams/yaml/index.ts` with `yamlPlugin`:
   - Implements `SyncPlugin<JsonDiagramAST, JsonGeometry>`
   - `type: 'yaml'`
   - `accepts(lines)`: returns true when source lines contain YAML content
     (skip leading directive lines — title, skinparam, scale, skin, hide,
     `<style>` blocks — then return true for any non-empty line that does
     NOT start with `{` or `[`, i.e. not JSON. Also return true for lines
     starting with `#highlight` or `-` or plain word chars.)
   - `parse(source)`: calls `parseYaml(source)` from
     `src/diagrams/yaml/parser.ts` (file doesn't exist yet — import it and
     note it will be created in T6). For now, create a stub in parser.ts
     that returns `{ root: null, parseError: false, highlights: [] }`.
   - `layoutSync(ast, theme, measurer)`: delegates to `layoutJson`
   - `render(geo, theme)`: delegates to `renderJson`
4. Register `yamlPlugin` in `src/index.ts` (add import + `registry.register(yamlPlugin)`).
   Register it just before `jsonPlugin`.
5. Update `tests/unit/block-extractor.test.ts` — add tests verifying that
   `@startyaml` / `@endyaml` blocks have type `'yaml'`.
6. Create `tests/unit/yaml/plugin.test.ts`:
   - `yamlPlugin.accepts()` returns true for yaml-style content lines
   - `yamlPlugin.accepts()` returns false for JSON content lines
   - `yamlPlugin.type` is `'yaml'`

## Write-set

- `src/core/block-extractor.ts` (modify)
- `src/diagrams/yaml/index.ts` (create)
- `src/diagrams/yaml/parser.ts` (create stub only)
- `src/index.ts` (modify)
- `tests/unit/block-extractor.test.ts` (modify)
- `tests/unit/yaml/plugin.test.ts` (create)

## Read-set

- `src/core/block-extractor.ts` — current DiagramType and START_SUFFIX_MAP
- `src/diagrams/json/index.ts` — model for yamlPlugin structure
- `src/diagrams/json/ast.ts` — JsonDiagramAST type (reused as-is)
- `src/diagrams/json/layout.ts` — layoutJson signature
- `src/diagrams/json/renderer.ts` — renderJson signature
- `src/index.ts` — current registration order
- `tests/unit/block-extractor.test.ts` — existing test patterns

## Architecture decisions

- Decision D1: no external YAML parser; parser.ts is a stub for now
- Decision D3: yamlPlugin reuses layoutJson + renderJson unchanged
- The `accepts()` predicate: after stripping directive lines, YAML content
  starts with a word character, `-`, or `#highlight`. Never `{` or `[`
  (those are JSON). This is the inverse of jsonPlugin.accepts().

## Acceptance criteria

- Given source `@startyaml\nfruit: Apple\n@endyaml`, when `extractBlocks`
  runs, then the resulting UmlSource has `type === 'yaml'`
- Given `['fruit: Apple', 'size: Large']`, when `yamlPlugin.accepts()`,
  then `true`
- Given `['{"key": "value"}']`, when `yamlPlugin.accepts()`, then `false`
- Given `['[1, 2, 3]']`, when `yamlPlugin.accepts()`, then `false`
- Given `['title My Diagram', 'fruit: Apple']`, when `yamlPlugin.accepts()`,
  then `true` (title is a directive, skip it, then fruit: Apple qualifies)
- `yamlPlugin.type === 'yaml'`

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
