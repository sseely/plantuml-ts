# T1 — Classify Corpus

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML. We have a pdiff corpus at
`~/git/pdiff/` containing thousands of `.puml` fixtures that serve as
the reference specification for diagram behavior.

Stack: TypeScript, Node.js ESM, vitest, vite. Scripts run with `jiti`.

## Task

Write `scripts/classify-corpus.ts` — a Node.js script that:

1. Scans all `.puml` files in `~/git/pdiff/dbhum/` (subdirectory per
   2-char prefix, files named `<humhash>.puml`) and `~/git/pdiff/input/`
   (flat directory of named `.puml` files).

2. For each fixture, extracts one or more diagrams and detects the
   diagram type using the rules in decisions.md#D6.

3. Writes per-type manifests to `tests/visual/data/<type>.json` as
   `FixtureEntry[]`. Creates the directory if it doesn't exist.

4. Overwrites existing manifests on each run (idempotent).

5. Prints a summary: `<type>: <count> fixtures` for each type found.

## Fixture file formats

### dbhum (`~/git/pdiff/dbhum/<2char>/<humhash>.puml`)

Each file contains a JSON metadata object on the first line(s), then
the diagram source:

```
{
  "sha1": "...",
  "insertion": { ... },
  "humhash": "babadu-29-gexe909"
}
@startuml
... diagram body ...
@enduml
```

Parsing strategy: find the first line starting with `@start` — everything
from that line to end of file is the markup. The slug is the `humhash`
field from the JSON header (parse the JSON lines before `@start`).

### input (`~/git/pdiff/input/<Name>.puml`)

Each file may contain multiple diagrams, each preceded by a GitHub issue URL:

```
https://github.com/plantuml/plantuml/issues/NNNN
@startuml
...diagram 1...
@enduml

https://github.com/plantuml/plantuml/issues/NNNN
@startuml
...diagram 2...
@enduml
```

Parsing strategy: split on blank lines between diagrams. Find runs of
lines that contain `@start`. Each run is one diagram. Slug = `<filename-without-ext>-<index>` (0-based).

## Type detection (decisions.md#D6)

```
@startmindmap  → mindmap
@startgantt    → gantt
@startwbs      → wbs
@startjson     → json
@startyaml     → yaml
@startdot      → dot
@startsalt     → salt
@startebnf     → ebnf
@startditaa    → ditaa
@startchen     → chen
@startboard    → board
@startchronology → chronology
@startpacket   → packet
@startwire     → wire
@startregex    → regex
@startgitgraph → gitgraph
```

For `@startuml`, scan the first 30 non-empty body lines (after `@startuml`)
for markers in this priority order:

1. Object:    line matches `/^object\s/i` or `/^map\s/i`
2. Class:     line matches `/^class\s/i`, `/^interface\s/i`, `/^enum\s/i`,
              `/^abstract\s/i`, or contains `<|--`
3. State:     line matches `/^\[\*\]\s*-->/ ` or `/^state\s/i`
4. Component: line matches `/^\[/`, `/^component\s/i`, `/^node\s/i`
5. Activity:  line matches `/^:/` (action), `start`, `/^if\s*\(/`,
              `fork`, `/^\|/` (swimlane)
6. Use Case:  line matches `/^actor\s/i`, `/:.*:/`, `/^\(.*\)/`, `/^usecase\s/i`
7. Timing:    line matches `/^robust\s/`, `/^concise\s/`, `/^clock\s/`, `/^binary\s/`
8. Network:   line matches `nwdiag {` or `network `
9. C4:        line contains `!include <C4`, `Person(`, `System(`, `Container(`
10. Sequence: line matches `/->|->>/` or `/^participant\s/i` or `/^actor\s/i`
11. Unknown:  no match

## Write-set

- `scripts/classify-corpus.ts` (create)
- `tests/visual/data/` directory and `*.json` files created at runtime

## Read-set

- `planning/visual-qa.md` — disambiguation rules reference
- `decisions.md` — D5 (manifest format), D6 (type detection)

## Interface contracts

Output manifest at `tests/visual/data/<type>.json`:
```typescript
interface FixtureEntry { slug: string; markup: string; }
// file = JSON.stringify(entries, null, 2)
```

`markup` is the full diagram source including `@startuml`/`@enduml` lines.

## Acceptance criteria

- Given a dbhum fixture with `@startmindmap` in its content, it appears
  in `data/mindmap.json`
- Given a dbhum fixture with `@startuml` + `class Foo {`, it appears in
  `data/class.json`
- Given an input file with 3 diagrams, the manifest gets 3 entries with
  slugs `<name>-0`, `<name>-1`, `<name>-2`
- Given the script is run twice, manifests have the same entry count
  (no duplication)
- Given a fixture with no recognized markers, it appears in
  `data/unknown.json`
- Script prints a summary line per type: `sequence: 842 fixtures`

## Quality bar

```sh
npm run typecheck   # no errors in scripts/classify-corpus.ts
npm run lint        # no lint errors
```

Note: this script is a runtime tool, not imported by the library —
coverage gates don't apply to `scripts/`.
