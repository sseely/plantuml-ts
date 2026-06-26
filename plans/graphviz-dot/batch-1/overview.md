# Batch 1 — Types + Acyclic

## Description

Lay the foundation: shared TypeScript types for the dot engine, plus the
first pipeline stage (cycle removal). After this batch, the working graph
type exists and acyclic.ts is tested and committed.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Shared types + acyclic stage | typescript-pro | types.ts, acyclic.ts, acyclic.test.ts | — | [x] |

## Quality Gate

```
npm test && npm run typecheck && npm run lint
```

All pre-existing 993+ tests must still pass.
