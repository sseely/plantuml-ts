# Batch 0 — Branch + baseline

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T0 | Create `feature/class-dot-sync` off main; verify baseline | orchestrator | (branch only) | — | [ ] |

T0 steps: `git checkout -b feature/class-dot-sync main`; run all four gates
(`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`) and
`npx tsx scripts/dot-sync-report.ts class`; journal the baseline numbers
(expect EQUAL 357). No commit — nothing changes.
