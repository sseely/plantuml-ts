# T1 — Core Infrastructure

## Context

plantuml-js is a TypeScript SVG renderer for PlantUML. Plugins are registered
in `src/index.ts` and resolved via `src/core/dispatcher.ts`. Diagram type
detection happens in `src/core/block-extractor.ts` — the `DiagramType` union
and `START_SUFFIX_MAP` live there. Theme colors live in `src/core/theme.ts`.

Stack: TypeScript, Vitest (90/90/90 coverage), ESLint, Vite build.
Tests: `npm test`. Typecheck: `npm run typecheck`. Lint: `npm run lint`.

## Task

1. In `src/core/block-extractor.ts`:
   - Add `'json'` to the `DiagramType` union (around line 11)
   - Add `json: 'json'` to `START_SUFFIX_MAP` (around line 40)

2. In `src/core/theme.ts`:
   - Add `json?` optional object to `theme.colors.graph` with these keys:
     ```typescript
     json?: {
       keyText?: string;
       stringValue?: string;
       numberValue?: string;
       booleanValue?: string;
       nullValue?: string;
       background?: string;
       border?: string;
       headerBackground?: string;
       highlightBackground?: string;
       arrowColor?: string;
     };
     ```
   - In `defaultTheme.colors.graph`, add `json` with these default values:
     ```
     keyText:             '#181818'
     stringValue:         '#3A6E96'
     numberValue:         '#A67F52'
     booleanValue:        '#BE5D47'
     nullValue:           '#767676'
     background:          '#FFFFFF'
     border:              '#181818'
     headerBackground:    '#F1F1F1'
     highlightBackground: '#FFFF44'
     arrowColor:          '#181818'
     ```
   - In `darkTheme.colors.graph`, add `json` with dark-appropriate overrides:
     ```
     keyText:             '#CCCCCC'
     stringValue:         '#6A9FBF'
     numberValue:         '#C9985A'
     booleanValue:        '#D47070'
     nullValue:           '#999999'
     background:          '#2D2D2D'
     border:              '#CCCCCC'
     headerBackground:    '#3C3C3C'
     highlightBackground: '#555500'
     arrowColor:          '#CCCCCC'
     ```
   - In `deepMergeTheme`, merge `json` the same way `activity` is merged:
     ```typescript
     json: {
       ...(base.colors.graph.json ?? {}),
       ...(partial.colors?.graph?.json ?? {}),
     },
     ```

## Write-set

- `src/core/block-extractor.ts`
- `src/core/theme.ts`

## Read-set

- `src/core/block-extractor.ts` (full file — it's small)
- `src/core/theme.ts` (full file — understand existing activity pattern)

## Acceptance criteria

- Given source `@startjson\n{}\n@endjson`, when `extractBlocks` runs,
  then the returned block has `type === 'json'`
- Given `defaultTheme`, when reading `theme.colors.graph.json`, then all
  ten keys are present with non-empty string values
- Given `darkTheme`, when reading `theme.colors.graph.json`, then
  `background` is `'#2D2D2D'` (not the default `'#FFFFFF'`)
- Given `deepMergeTheme(defaultTheme, { colors: { graph: { json: { background: '#FF0000' } } } })`,
  then the merged theme has `json.background === '#FF0000'` and all other
  json keys retain their defaultTheme values

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass before committing.
Commit message: `feat(json): add DiagramType entry and theme color keys`
