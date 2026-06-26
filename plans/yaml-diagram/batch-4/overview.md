# Batch 4 — parseYaml Entry Point (sequential)

Single task; depends on T1, T3, T5. This is the public API that the plugin
calls. It handles the YamlDiagramFactory logic: style stripping, highlight
extraction, title, and calling the core parser.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T6 | parseYaml() entry point | typescript-pro | `src/diagrams/yaml/parser.ts`, `tests/unit/yaml/parser.test.ts` | T1, T3, T5 | [ ] |

## Quality gate after Batch 4

```sh
npm test && npm run typecheck && npm run lint && npm run build
```

After T6, the plugin is fully wired. A complete `@startyaml` source should
render to SVG via `renderSync`.
