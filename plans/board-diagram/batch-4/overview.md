# Batch 4 — Wire boardPlugin into Runtime

Single task. Wires the completed board plugin into the dispatcher and
registers the type in the visual QA page builder.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T6 | Register boardPlugin in src/index.ts + build-pages.ts | typescript-pro | `src/index.ts`, `scripts/build-pages.ts` | T5 | [ ] |

## After T6 completes

Run the full quality gate suite:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

All four must pass. If they do, the feature is complete.
