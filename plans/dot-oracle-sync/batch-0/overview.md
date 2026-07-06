# Batch 0 — Merge + branch + housekeeping

Sequential, single agent, one commit on main is the merge; the rest lands as
the first commits on the new branch.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T0 | Merge consolidation branch, create mission branch, commit stray tooling/docs | executor (direct) | git state; `scripts/dot-sync-report.ts`; `planning/*.md`; `.claude/settings.autonomous.json` | — | [x] |

See [T0-housekeeping.md](T0-housekeeping.md).
