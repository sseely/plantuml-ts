# Batch 6 — Remove ELK

## Description

Delete elk-adapter.ts, remove elkjs from package.json, run npm install
to update the lockfile. Verify no residual imports remain.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T10 | Remove ELK adapter and dependency | typescript-pro | elk-adapter.ts (delete), package.json | T6, T7, T8, T9 | [x] |

## Quality Gate

```
npm install
npm test && npm run typecheck && npm run lint && npm run build
```

The build gate is added here to catch any bundler issues with the
removed dependency.
