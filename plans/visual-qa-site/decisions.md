# Architecture Decisions

## D1 — Corpus scope: no cap, all types

Classify and capture all fixtures from `~/git/pdiff/dbhum/` and
`~/git/pdiff/input/` for all 26 diagram types, not just the 7
currently implemented. Fixtures for unimplemented types are captured
now so the pages work immediately when those types are added later.

## D2 — Fixture coverage: full corpus (Option B)

All fixtures for all types. Not just a representative sample.
The pdiff corpus exists to capture the long tail of real user
behavior; showing every fixture is the point.

## D3 — Live rendering: in-browser ESM

Pages import `../../dist/plantuml-js.js` (browser ESM build) and
call `renderSync()` or `render()` on DOMContentLoaded. No server-side
rendering, no pre-built SVG files.

Public API entry points (from `src/index.ts`):
- `renderSync(source: string, options?: RenderOptions): string`
- `render(source: string, options?: RenderOptions): Promise<string>`

Use `render()` (async) in the browser for forward compatibility.

## D4 — PNG storage: local only, not committed

Corpus reference PNGs go to `tests/visual/reference/<type>/<slug>.png`
locally. They are NOT committed to git (too large). The `.gitignore`
entry `tests/visual/reference/` excludes them; the 7 existing canonical
PNGs (`*/canonical.png`) are re-excluded with `!tests/visual/reference/*/canonical.png`.

R2/Cloudflare at `plantuml-orig.knowvah.com` is available for hosting
captured PNGs if a shareable artifact is needed later. Out of scope for
this mission.

## D5 — Manifest format

```typescript
interface FixtureEntry { slug: string; markup: string; }
// File: tests/visual/data/<type>.json  (FixtureEntry[])
```

Slug sources:
- **dbhum**: `humhash` field from JSON header (e.g. `babadu-29-gexe909`)
- **input**: `<filename-without-ext>-<index>` (e.g. `Class-visibility-0`)

Manifests ARE committed to git (small JSON, useful as reference).

## D6 — @startuml disambiguation priority

When body scanning is needed, check markers in this order:

1. Object: `object `, `map `
2. Class: `class `, `interface `, `enum `, `abstract `, `<|--`
3. State: `[*] -->`, `state `
4. Component: `[`, `component `, `node `
5. Activity: `:action;`, `start`, `if (`, `fork`, `|swimlane|`
6. Use Case: `actor `, `:usecase:`, `(usecase)`, `usecase `
7. Timing: `robust `, `concise `, `clock `, `binary `
8. Network: `nwdiag {`, `network `
9. C4: `!include <C4`, `Person(`, `System(`, `Container(`
10. Sequence: `->`, `->>`, `<-`, `participant `, `actor `
11. Unknown: anything that doesn't match

Non-`@startuml` keywords map directly:
`@startmindmap` → mindmap, `@startgantt` → gantt, `@startwbs` → wbs,
`@startjson` → json, `@startyaml` → yaml, `@startdot` → dot,
`@startsalt` → salt, `@startebnf` → ebnf, `@startditaa` → ditaa,
`@startchen` → chen, `@startboard` → board,
`@startchronology` → chronology, `@startpacket` → packet,
`@startwire` → wire, `@startregex` → regex, `@startgitgraph` → gitgraph
