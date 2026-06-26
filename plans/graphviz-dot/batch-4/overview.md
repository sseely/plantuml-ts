# Batch 4 — Splines + Wire layout()

## Description

Implement the final pipeline stage (edge routing) and complete the
layout() entry point by composing all five stages. Also adds the
end-to-end layout.test.ts. After this batch, layout() is a fully working
synchronous function.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T5 | Spline routing + complete index.ts + e2e tests | typescript-pro | splines.ts, index.ts, splines.test.ts, layout.test.ts | T3, T4 | [x] |

## Quality Gate

```
npm test && npm run typecheck && npm run lint
```
