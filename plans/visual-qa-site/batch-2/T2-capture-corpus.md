# T2 — Capture Corpus Script

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript, Node.js
ESM, vitest, vite. Scripts run via `jiti` (already a devDependency).

`tests/visual/plantuml-encode.ts` already implements the PlantUML URL
encoding (deflate-raw + custom base64). Import and use it directly.

## Task

Write `scripts/capture-corpus.ts` — a Node.js script that:

1. Reads all `tests/visual/data/<type>.json` manifest files.
2. For each `FixtureEntry`, checks whether
   `tests/visual/reference/<type>/<slug>.png` exists AND has size > 0.
3. If the file exists and is non-zero: skip (log `skip <slug>`).
4. If the file is missing or zero-byte: fetch the PNG from plantuml.com,
   write it, log `fetched <slug> (<bytes> bytes)`.
5. Sleeps exactly 3000ms between every HTTP request.
6. On HTTP error: logs `error <slug>: HTTP <status>` and continues
   (does not abort the full run).
7. After processing all types, prints a summary:
   `<type>: <fetched> fetched, <skipped> skipped, <errors> errors`

Accepts an optional `--type <name>` CLI argument to process only one
type (useful for resuming after interruption).

## PlantUML URL encoding

```typescript
import { plantumlUrl } from '../tests/visual/plantuml-encode.js';
// plantumlUrl(markup, 'png') → 'https://www.plantuml.com/plantuml/png/<encoded>'
```

## Idempotency rule

Skip if `fs.existsSync(outPath) && fs.statSync(outPath).size > 0`.
Zero-byte files are treated as failed fetches — delete and re-fetch.

## Write-set

- `scripts/capture-corpus.ts` (create)
- `tests/visual/reference/<type>/<slug>.png` — written at runtime, not
  tracked in git (see .gitignore)

## Read-set

- `tests/visual/plantuml-encode.ts` — URL encoding utility to import
- `plans/visual-qa-site/decisions.md#D5` — manifest format

## Interface contracts

Manifest consumed (from T1 at runtime):
```typescript
interface FixtureEntry { slug: string; markup: string; }
// tests/visual/data/<type>.json = FixtureEntry[]
```

PNG written to: `tests/visual/reference/<type>/<slug>.png`

## Acceptance criteria

- Given a manifest entry where the PNG is missing, the script fetches
  and writes the PNG
- Given a PNG that exists with size > 0, the script skips it without
  fetching
- Given a zero-byte PNG, the script re-fetches it
- Given an HTTP 500 from plantuml.com, logs the error and continues
  to the next entry (no abort)
- Between every HTTP request, script waits exactly 3 seconds
- Given `--type sequence`, only sequence.json is processed
- Final summary line per type is printed after all entries are processed

## Quality bar

```sh
npm run typecheck   # no errors
npm run lint        # no lint errors
```
