# T3 — Skinparam Extensions for Activity Diagrams

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript + Vitest +
Vite. Test command: `npm test`. Typecheck: `npm run typecheck`. Lint:
`npm run lint`. Build: `npm run build`. All four must pass.

The tile-based layout engine needs to read activity-specific colors (action
background, swimlane header background, diamond/decision fill, fork bar color)
from the theme/skinparam system. Currently `src/core/skinparam.ts` has no
activity-specific keys and `src/core/theme.ts` has no activity fields in
`colors.graph`.

**Critical constraint (stop condition):** This task ONLY adds new keys and fields.
It must NOT remove, rename, or change the behavior of any existing skinparam key,
theme field, or theme resolution path.

## Task

### 1. Extend `src/core/theme.ts` — add `activity` subobject to `colors.graph`

In the `Theme` interface, extend `colors.graph` with an optional `activity?`
subobject:

```typescript
activity?: {
  background?: string;      // ActivityBackgroundColor — action box fill
  border?: string;          // ActivityBorderColor — action box stroke
  barColor?: string;        // ActivityBarColor — fork/join bar fill
  diamondBackground?: string; // ActivityDiamondBackgroundColor
  diamondBorder?: string;   // ActivityDiamondBorderColor
  startColor?: string;      // ActivityStartColor — filled start circle
  endColor?: string;        // ActivityEndColor — filled end circle
  swimlaneBorder?: string;  // SwimlaneHeaderBackgroundColor — lane divider/header
};
```

Extend `defaultTheme.colors.graph` with an `activity` entry containing
PlantUML's default values (black fills, white boxes — verify against
`~/git/plantuml` `SkinParam.java` defaults or use `undefined` to fall back to
theme.colors.background/border if unsure).

Extend `deepMergeTheme` to handle the new nested `activity` subobject (one
extra spread level inside `graph`).

### 2. Extend `src/core/skinparam.ts` — add activity key mappings

In `resolveSkinparam`, add cases for the new keys (after the existing cases):

```
'activitybackgroundcolor'   → theme.colors.graph.activity.background
'activitybordercolor'       → theme.colors.graph.activity.border
'activitybarcolor'          → theme.colors.graph.activity.barColor
'activitydiamondbackgroundcolor' → theme.colors.graph.activity.diamondBackground
'activitydiamondforegroundcolor' → theme.colors.graph.activity.diamondBorder
'activitystartcolor'        → theme.colors.graph.activity.startColor
'activityendcolor'          → theme.colors.graph.activity.endColor
'swimlanebordercolor'       → theme.colors.graph.activity.swimlaneBorder
'swimlaneheaderbackgroundcolor' → theme.colors.graph.activity.swimlaneBorder
```

### 3. Tests

Extend the existing skinparam test file (find it with `grep -r "resolveSkinparam"
tests/`):

- `ActivityBackgroundColor #aabbcc` → `theme.colors.graph.activity?.background === '#aabbcc'`
- `ActivityBarColor #001122` → `theme.colors.graph.activity?.barColor === '#001122'`
- `SwimlaneHeaderBackgroundColor #334455` → `theme.colors.graph.activity?.swimlaneBorder === '#334455'`
- Unknown key is still collected in `unknown[]`
- Existing keys (backgroundcolor, bordercolor, etc.) still resolve correctly
  after the extension (regression test)

## Write-set

- `src/core/theme.ts` (extend Theme interface + defaultTheme + deepMergeTheme)
- `src/core/skinparam.ts` (add cases in resolveSkinparam switch)
- Existing skinparam test file (add new cases; do NOT create a separate file)

## Read-set

- `src/core/theme.ts` — full file; understand Theme interface and deepMergeTheme
- `src/core/skinparam.ts` — full file; understand resolveSkinparam structure
- `tests/` — find skinparam test file via `grep -r "resolveSkinparam" tests/`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/SkinParam.java` — check
  default values for ActivityBackgroundColor etc. (read: grep for "ACTIVITY")

## Architecture Decisions

- D3: Theme values feed tile constructors at sizing time via the StringBounder
  context; tile constructors will accept a `theme: Theme` parameter
- Stop condition: If this task would change any existing key behavior, stop

## Acceptance Criteria

- Given `ActivityBackgroundColor #aabbcc` in skinparams, when `resolveSkinparam`
  runs, then `result.theme.colors.graph.activity?.background === '#aabbcc'`
- Given an existing key like `BackgroundColor #ffffff`, when `resolveSkinparam`
  runs after this change, then it still maps correctly (no regression)
- Given `deepMergeTheme(base, { colors: { graph: { activity: { background: 'x' } } } })`,
  when called, then only `activity.background` is overridden; other fields preserved
- Given `npm test`, then all tests pass including existing skinparam coverage

## Quality Bar

`npm run typecheck`, `npm test`, `npm run lint` must all pass before committing.
Commit: `feat(skinparam): add activity-specific skinparam keys and theme fields`
