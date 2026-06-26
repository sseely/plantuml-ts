# T2 — `deepMergeTheme` + `resolveSkinparam` + `parseStyleBlock`

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript + Vite,
Vitest tests (90/90/90 coverage). ESLint. Working directory: `/Users/scottseely/git/plantuml-js`.
Branch: `feat/skinparam`.

Batch 1 (T1) runs in parallel — do not depend on its output. Read `src/core/theme.ts`
and `tests/unit/theme.test.ts` fully before editing.

## Task

### Part A — Extract `deepMergeTheme` in `theme.ts`

Extract the deep-merge logic currently inline in `resolveTheme` into a new
exported function:

```typescript
export function deepMergeTheme(base: Theme, partial: Partial<Theme>): Theme {
  return {
    fontFamily: partial.fontFamily ?? base.fontFamily,
    fontSize: partial.fontSize ?? base.fontSize,
    colors: {
      ...base.colors,
      ...(partial.colors ?? {}),
      graph: {
        ...base.colors.graph,
        ...(partial.colors?.graph ?? {}),
      },
    },
    sequence: {
      ...base.sequence,
      ...(partial.sequence ?? {}),
    },
  };
}
```

Update `resolveTheme` to call `deepMergeTheme(defaultTheme, partial)` for the
`Partial<Theme>` branch. All existing behavior is preserved — this is a
pure refactor of that branch.

Add tests for `deepMergeTheme` to `tests/unit/theme.test.ts`:
- Merges a partial over an arbitrary base (not just defaultTheme)
- Retains all base values not present in partial
- Does not mutate the base

### Part B — Create `src/core/skinparam.ts`

```typescript
export interface SkinparamResult {
  theme: Theme;
  unknown: string[];
}

export function resolveSkinparam(
  skinparams: ReadonlyMap<string, string>,
  base: Theme,
): SkinparamResult

export function parseStyleBlock(raw: string): Map<string, string>
```

#### Key normalisation — must match `SkinParam.cleanForKeySlow`

The normalisation is NOT just `toLowerCase()`. Port this exact sequence from
`SkinParam.java:cleanForKeySlow`:

```typescript
function normaliseKey(raw: string): string {
  let key = raw.trim().toLowerCase();
  // 1. Strip underscores and dots
  key = key.replace(/[_.]/g, '');
  // 2. Collapse sequenceparticipant / sequenceactor prefix
  key = key.replace(/sequence(participant|actor)/g, '$1');
  // 3. Collapse diagram-type arrow prefixes to plain "arrow"
  key = key.replace(/(?:activity|class|component|object|sequence|state|usecase)arrow/g, 'arrow');
  // 4. Normalise "align" suffix to "alignment"
  key = key.replace(/align$/, 'alignment');
  return key;
}
```

**Why this matters:**
- `skinparam classArrowColor` and `skinparam sequenceArrowColor` both normalise
  to `arrowcolor` — they share a single slot in the map. This matches upstream.
- `skinparam sequenceParticipantBackgroundColor` normalises to
  `participantbackgroundcolor`, not a sequence-scoped key.
- `skinparam sequence_participant_background_color` (with underscores) is
  identical to the above — underscores are stripped.
- `skinparam sequenceMessageAlign` normalises to `sequencemessagealignment`.

#### Stereotype-qualified keys

Upstream also supports `skinparam classBackgroundColor<<Foo>> red` (per-stereotype
overrides). The `cleanForKeySlow` `stereoPattern` extracts `<<Foo>>` and stores
a separate key `classbackgroundcolor<<foo>>`. Our `Theme` has no stereotype
concept — treat any key containing `<<` as unknown and add to `unknown[]`.
Do NOT crash; just collect it.

#### `resolveSkinparam` — key mapping table

After normalising each key, map to `Theme` properties. Build up a
`Partial<Theme>` from matched keys, then call `deepMergeTheme(base, partial)`.
Collect unmatched keys in `unknown[]`.

| Normalised key (post-`normaliseKey`) | Theme property |
|--------------------------------------|----------------|
| `backgroundcolor` | `colors.background` |
| `bordercolor` | `colors.border` |
| `fontcolor` | `colors.text` |
| `defaultfontcolor` | `colors.text` |
| `arrowcolor` | `colors.arrow` |
| `defaultarrowcolor` | `colors.arrow` |
| `notebackgroundcolor` | `colors.noteBackground` |
| `fontname` | `fontFamily` |
| `defaultfontname` | `fontFamily` |
| `fontsize` | `fontSize` (parse as `Number(value)`) |
| `defaultfontsize` | `fontSize` (parse as `Number(value)`) |
| `classbackgroundcolor` | `colors.graph.classBackground` |
| `interfacebackgroundcolor` | `colors.graph.interfaceBackground` |
| `enumbackgroundcolor` | `colors.graph.enumBackground` |
| `actorbordercolor` | `colors.graph.actorStroke` |
| `packagebackgroundcolor` | `colors.graph.packageBackground` |
| `packagebordercolor` | `colors.graph.packageBorder` |

Any key not in this table (and not a stereotype-qualified key) goes to
`unknown[]` using the normalised form.

#### Known upstream default mismatch to document

Upstream `ColorParam.noteBackground` defaults to `#FBFB77` (HColors.COL_FBFB77).
Our `defaultTheme.colors.noteBackground` is `'#FEFECE'` — a pre-existing
divergence. Do NOT fix it in this task (it's a separate correctness issue);
add a comment in `theme.ts` next to the value noting the upstream default and
log a row in the decision journal.

#### `parseStyleBlock` — style block parsing

```typescript
export function parseStyleBlock(raw: string): Map<string, string>
```

Input: the raw string content of one `<style>` block (already extracted by
the preprocessor — no `<style>` tags present).

Algorithm:
1. Split on `\n`
2. Skip lines that match `/^\s*[\w.#*\[: -]+\s*\{/` (selector openers)
3. Skip lines that match `/^\s*\}\s*$/` (block closers)
4. For remaining lines, attempt to match `/^\s*([\w-]+)\s*:\s*(.+)$/`
   — if matched: key = `match[1].toLowerCase()`, value = `match[2].trim()`
5. Lines that match none of the above are silently skipped

Return the collected `Map<string, string>`. This map can be passed directly
to `resolveSkinparam`.

## Write-Set

- `src/core/theme.ts`
- `tests/unit/theme.test.ts`
- `src/core/skinparam.ts` *(new)*
- `tests/unit/skinparam.test.ts` *(new)*

## Read-Set

- `src/core/theme.ts` — read fully before editing
- `tests/unit/theme.test.ts` — read fully before editing

## Architecture Decisions

- D1: `deepMergeTheme` extracted into `theme.ts`, exported
- D2: `resolveSkinparam` returns `{ theme, unknown }`
- D4: `parseStyleBlock` lives in `skinparam.ts`

## Acceptance Criteria

- Given `deepMergeTheme(customBase, { colors: { background: '#FF0000' } })`,
  then result has `#FF0000` background and all other values from `customBase`
- Given `deepMergeTheme` called, then `customBase` is not mutated
- Given `resolveSkinparam(new Map([['backgroundcolor','#FF0000']]), defaultTheme)`,
  then `theme.colors.background` = `'#FF0000'` and `unknown` = `[]`
- Given `resolveSkinparam(new Map([['classbackgroundcolor','#AABBCC']]), defaultTheme)`,
  then `theme.colors.graph.classBackground` = `'#AABBCC'`
- Given unknown key `resolveSkinparam(new Map([['handwritten','true']]), defaultTheme)`,
  then `unknown` contains `'handwritten'`
- Given alias `fontname`, then maps to same property as `defaultfontname`
- Given pre-normalised key `classarrowcolor`, then maps to `colors.arrow`
  (arrow prefix collapsed — same as `sequencearrowcolor` and `arrowcolor`)
- Given pre-normalised key `participantbackgroundcolor`, then is unknown
  (no Theme property yet — goes to `unknown[]`)
- Given stereotype-qualified key `classbackgroundcolor<<foo>>`, then goes to
  `unknown[]` without throwing
- Given key with underscores `class_background_color` (pre-normalised), then
  maps to `colors.graph.classBackground` (underscores stripped before lookup)
- Given `parseStyleBlock("element {\n  backgroundColor: red\n}")`,
  then result `Map` has `{ 'backgroundcolor': 'red' }` and no selector entries
- Given `parseStyleBlock("")`, then returns empty map
- All existing `theme.test.ts` tests pass (regression — `resolveTheme` behavior unchanged)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
feat(theme): add deepMergeTheme helper and resolveSkinparam pipeline

Extract deepMergeTheme from resolveTheme for reuse. Add resolveSkinparam
mapping 13 skinparam keys onto Theme properties, surfacing unknown keys.
Add parseStyleBlock to convert <style> content into a skinparam-compatible map.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
