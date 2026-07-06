# Batch 1 — Foundation

Three parallel tasks on disjoint files: diagnose the edge divergence, pin the
baseline goldens (regression guard before any code change), and build the HTML
compartment-label helper.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Diagnose edge-topology divergence (feeds T5) | debugger | `../decision-journal.md` | — | [x] |
| T2 | Pin 9 baseline class goldens + wire ratchet | typescript-pro | `oracle/goldens/class/**`, `tests/oracle/class-dot-parity.test.ts` | — | [x] |
| T3 | Class HTML compartment-label builder | typescript-pro | `src/diagrams/class/class-html-label.ts`, `tests/unit/class/class-html-label.test.ts` | — | [x] |

All three write disjoint files → run in parallel. T2 must complete before T4
changes the shape rule (the goldens protect the 9 EQUAL fixtures). T1's findings
feed T5. T3's `buildClassHtmlLabel` is consumed by T4.

Gate after batch: `npm run typecheck && npm run lint && npm test` +
`npx vitest run tests/oracle/class-dot-parity.test.ts`.
