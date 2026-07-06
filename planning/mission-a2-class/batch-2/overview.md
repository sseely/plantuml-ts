# Batch 2 — Graph-attr parity (RE-SCOPED 2026-07-06)

**Re-scoped from "class node shapes (plaintext/rect)."** The T4 investigation
falsified ADR-1's premise (see decisions.md ADR-1/ADR-2/ADR-6 + the journal):
oracle renders ordinary classes as `shape=rect,label=""`, so no plaintext
compartment change was warranted. The real batch-2-sized lever was a graph
attribute: `nodesep`. The narrow plaintext rule (3 triggers) moved to T7.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T4 | Graph-attr parity: `nodeSep=35` to match oracle `nodesep=0.486111in` | orchestrator (1-constant) | `src/diagrams/class/layout.ts`, `tests/unit/class/layout.test.ts` | — | [x] |

Result: `nodesepOk` 475→4 fails; structural parity **1%→20%** (9→136/680).
Done directly (one constant + one assertion) rather than dispatched — trivial
once diagnosed. Gate: typecheck 0, lint 0, class ratchet 16/16 (9 goldens stay
EQUAL), full suite green. Commit `18cb4c5`.
