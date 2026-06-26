# T16 — yamlDiagram Style Selectors

## Context

PlantUML YAML diagrams support `<style>` blocks using `yamlDiagram { ... }`
selectors. The TypeScript port reuses the JSON renderer, which reads
`jsondiagram.node`, `jsondiagram.arrow`, etc. from the theme.

`src/index.ts` contains `resolveThemeWithStyles(base, styleMap)` which maps
`jsondiagram.node` → theme overrides. We need the same logic for
`yamldiagram.node`.

Corpus fixtures for this behavior: `polela-38`, `lelofi-17`, `bedega-54`.

Also note: some fixtures use `element` and `document` selectors inside
`yamlDiagram { }`. These appear in `gipoxa-19-bico146`:
```yaml
yamlDiagram {
    element { backgroundColor yellow }
    document { backgroundColor Silver }
}
```

## Task

1. In `src/index.ts`, in `resolveThemeWithStyles`, add handling for
   `yamldiagram.node`, `yamldiagram.arrow`, `yamldiagram.node.separator`,
   `yamldiagram.node.highlight` that mirrors the existing `jsondiagram.*`
   handling exactly.
2. Also add `yamldiagram.element` as an alias for `yamldiagram.node` (the
   `element` selector inside `yamlDiagram { }` maps to the same theme keys
   as `jsondiagram.node`).
3. Create `tests/unit/yaml/plugin-style.test.ts` verifying the style
   resolution.

### Style selector mapping

```
yamldiagram.node        → same as jsondiagram.node
yamldiagram.arrow       → same as jsondiagram.arrow
yamldiagram.node.separator → same as jsondiagram.node.separator
yamldiagram.node.highlight → same as jsondiagram.node.highlight
yamldiagram.element     → same as yamldiagram.node (alias)
```

The simplest implementation: after processing `jsondiagram.*` keys, also
process `yamldiagram.*` keys with the same logic. Use a helper function
to avoid duplication.

## Write-set

- `src/index.ts` (modify — extend resolveThemeWithStyles)
- `tests/unit/yaml/plugin-style.test.ts` (create)

## Read-set

- `src/index.ts` — current resolveThemeWithStyles implementation (read the
  full jsondiagram.* section to understand the pattern)
- `src/core/skinparam.ts` — resolveColor utility
- `src/core/theme.ts` — Theme type for json color fields
- Corpus fixtures: polela-38, bedega-54, gipoxa-19

## Acceptance criteria

- `styleMap` with `yamldiagram.node` → `BackGroundColor lightblue` →
  `theme.colors.graph.json.background === '#add8e6'` (or equivalent lightblue)
- `styleMap` with `yamldiagram.arrow` → `LineColor green` →
  `theme.colors.graph.json.arrowColor === 'green'` (or CSS equiv)
- `styleMap` with `yamldiagram.node.highlight` → `BackGroundColor red` →
  `theme.colors.graph.json.highlightBackground === 'red'`
- `styleMap` with `yamldiagram.element` → `backgroundColor yellow` →
  same result as `yamldiagram.node` → `BackGroundColor yellow`
- Existing `jsondiagram.*` style handling still works (no regression in
  JSON diagram tests)

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
