# Visual QA — Side-by-Side Comparison Pages

A static web artifact at `tests/visual/` that lets Arnaud and other reviewers
compare our TypeScript renders against the canonical PlantUML Java output,
fixture-by-fixture, for every diagram type.

## Goal

For each implemented diagram type, show every pdiff corpus fixture as a row:

```
┌─────────────────────────────────────────────────────────────┐
│ [▶] fixture name (e.g. "issue-1234")                        │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│    │ PlantUML src │  │  Original    │  │   Ours       │    │
│    │ (collapsed)  │  │  (PNG from   │  │  (SVG live-  │    │
│    │              │  │  plantuml.   │  │  rendered    │    │
│    │              │  │  com)        │  │  in browser) │    │
│    └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

- **Markup panel**: collapsible `<details>` block with the raw `.puml` source.
- **Original panel**: `<img>` pointing to the pre-captured reference PNG.
- **Ours panel**: live SVG rendered by plantuml-js in the browser on page load.
- **Row name**: fixture slug (issue number or input filename) — used to discuss
  specific items in conversation.

## File layout

```
tests/visual/
  index.html                 ← landing page, links to all types
  sequence.html              ← per-type page
  class.html
  component.html
  ... (one per type)
  reference/
    sequence/
      <slug>.png             ← captured reference PNGs (committed)
    class/
    ...
  data/
    sequence.json            ← fixture manifest: [{slug, markup}]
    class.json
    ...
```

## Workflow

### Step 1 — Classify corpus (one-time)

```sh
npm run visual:classify
```

Scans `~/git/pdiff/dbhum/` and `~/git/pdiff/input/`, reads the `@start*`
keyword from each fixture, and writes per-type manifests to
`tests/visual/data/<type>.json`.

Each manifest entry: `{ slug: string, markup: string }`.

### Step 2 — Capture reference images (resumable)

```sh
npm run visual:capture
```

Reads each manifest. For each entry:
1. If `tests/visual/reference/<type>/<slug>.png` exists and is non-zero, skip.
2. Encode the markup with PlantUML's deflate+base64 encoding.
3. GET `https://www.plantuml.com/plantuml/png/<encoded>`.
4. Write the PNG to `tests/visual/reference/<type>/<slug>.png`.
5. Sleep 3 seconds before the next request.

The script is fully restartable — interrupted runs continue from where they
left off.

### Step 3 — Build comparison pages

```sh
npm run visual:build
```

Reads all manifests and generates static HTML pages. Each page:
- Imports our plantuml-js library from `../../dist/plantuml-js.js`.
- For each fixture row: renders the SVG on page load via our library.
- Reference PNGs are linked as `./reference/<type>/<slug>.png`.

### Serving locally

```sh
npm run visual
```

Starts a local file server at `tests/visual/` (e.g. via `serve` or Vite
preview). The pages work from any HTTP server — no backend required.

## Publishing

The entire `tests/visual/` directory is a self-contained static site.
Commit the reference PNGs once captured; regenerate the HTML pages after
each code change with `npm run visual:build`.

The site can be published to GitHub Pages or any static host as an artifact
for external review.

## Throttle and idempotency rules

- **3-second pause** between every API call (plantuml.com rate limit respect).
- **Skip-if-exists**: check file existence AND `fs.statSync().size > 0` before
  fetching. Zero-byte files are treated as failed fetches and re-fetched.
- **No parallel fetches**: requests are strictly sequential.
- **Graceful error handling**: on HTTP error, log the slug and move on — do not
  abort the full run. The skipped fixture can be retried on the next run.

## PlantUML encoding

PlantUML uses a custom encoding for diagram URLs:

```
encoded = base64-custom(deflate-raw(utf8(markup)))
```

The custom base64 alphabet is `0-9A-Za-z-_` (62 printable chars + 2).
Implement inline in the capture script — do not add a dependency for this.

## Diagram type coverage order

Matches `planning/phases.md` implementation order:

| Priority | Type | `@start` keyword | Status |
|----------|------|-----------------|--------|
| 1 | Sequence | `@startuml` | ✅ implemented |
| 2 | Class | `@startuml` | ✅ implemented |
| 3 | Component | `@startuml` | ✅ implemented |
| 4 | State | `@startuml` | ✅ implemented |
| 5 | Use Case | `@startuml` | ✅ implemented |
| 6 | Activity | `@startuml` | ✅ implemented |
| 7 | Object | `@startuml` | ✅ implemented |
| 8 | Timing | `@startuml` | 🔲 planned Phase 4b |
| 9 | Mind Map | `@startmindmap` | 🔲 planned Phase 4c |
| 10 | Gantt | `@startgantt` | 🔲 planned Phase 4d |
| 11 | WBS | `@startwbs` | 🔲 planned Phase 4e |
| 12 | Network | `@startuml` (nwdiag body) | 🔲 planned Phase 4f |
| 13 | C4 | `@startuml` (C4 macros) | 🔲 planned Phase 4g |
| 14 | Git Graph | `@startgitgraph` | 🔲 planned Phase 5a |
| 15 | JSON | `@startjson` | 🔲 planned Phase 5b |
| 16 | YAML | `@startyaml` | 🔲 planned Phase 5c |
| 17 | DOT | `@startdot` | 🔲 planned Phase 5d |
| 18 | Salt | `@startsalt` | 🔲 planned Phase 5e |
| 19 | EBNF | `@startebnf` | 🔲 planned Phase 5f |
| 20 | DITAA | `@startditaa` | 🔲 planned Phase 5g |
| 21 | Chen EER | `@startchen` | 🔲 planned Phase 5h |
| 22 | Board | `@startboard` | 🔲 planned Phase 5i |
| 23 | Chronology | `@startchronology` | 🔲 planned Phase 5j |
| 24 | Packet | `@startpacket` | 🔲 planned Phase 5k |
| 25 | Wire | `@startwire` | 🔲 planned Phase 5l |
| 26 | Regex | `@startregex` | 🔲 planned Phase 5m |

Note: many types share `@startuml`. Classification uses the first
diagram-specific keyword in the body (e.g. `nwdiag {`, `class `, `[*] -->`,
`Alice ->`) after the `@startuml` line. The classifier script handles this.

## Notes on @startuml disambiguation

For types that all use `@startuml`, the classifier detects the diagram type
by scanning the first few meaningful lines of the body for type-specific
syntax markers:

| Type | Distinguishing marker |
|------|-----------------------|
| Sequence | `->`, `->>`, `<-`, participant/actor declarations |
| Class | `class `, `interface `, `enum `, `abstract `, `<\|--` |
| Component | `[component]`, `component `, `()interface`, `node ` |
| State | `[*] -->`, `state `, concurrent region `--` |
| Use Case | `actor `, `:usecase:`, `(usecase)`, `usecase ` |
| Activity | `:action;`, `start`, `if (`, `fork`, `|swimlane|` |
| Object | `object `, `map ` |
| Timing | `robust `, `concise `, `clock `, `binary ` |
| Network (nwdiag) | `nwdiag {`, `network ` |
| C4 | `!include <C4`, `Person(`, `System(`, `Container(` |

## Adding a new diagram type

When a new diagram type is implemented in `src/`:

1. Add its `@start` keyword (or body marker) to the classifier in
   `scripts/classify-corpus.ts` (add a case to the `detectType` function).
2. Re-run `npm run visual:classify` to regenerate manifests.
3. Run `npm run visual:capture` to fetch reference PNGs for the new
   type (skips already-captured files).
4. Run `npm run visual:build` to regenerate HTML pages.
5. Update the status column in `planning/phases.md` and the coverage
   table in `planning/visual-qa.md`.

No changes needed to the HTML templates or page generator — new types
are picked up automatically from manifests.
