# Divergence ledger — state-dot-sync (A4)

Per loop-protocol.md step 8 and decisions.md D4. Entries are DRAFTS pending
maintainer validation.

## Non-EQUAL comparable fixtures (1 of 261)

| Slug | Root cause | Detail |
|------|-----------|--------|
| fotuje-06-fifa085 | `graphviz-ts-crash` | Our state engine's DOT input is byte-structurally correct (graph #0 verified EQUAL against the oracle), but `graphviz-ts@0.1.26071122`'s `render()` throws `RenderError: Cannot read properties of undefined (reading 'info')` on this fixture's 5-level nested-cluster + labeled cross-cluster-boundary edge shape, aborting before the two flattened-wrapper re-entry passes fire (oracle 3 graphs, ours 1). Minimal reproduction isolated (removing the label from one specific cross-cluster edge, or certain other edges, avoids the crash). Per the maintainer's standing rule, layout defects downstream of a matching DOT are filed against graphviz-ts, not worked around here — **recommend filing the minimal repro as a graphviz-ts issue** (repro steps in `plans/state-dot-sync/decision-journal.md`, iter 18). |

## Oracle-blind (excluded from the comparable denominator)

6 fixtures with `!pragma layout …` — the jar only dumps svek DOT under the
graphviz path (same class as A2's 35 and A3's 1; the report excludes them).

## Excluded from the manifest's comparable set (hygiene notes, not divergences)

| Slug | Note |
|------|------|
| cagego-53-vemo516, xacona-99-peze211, fugedo-34-fice721, zecivu-62-pagu681 | Canonical SVGs are PlantUML parse-error pages (no `data-diagram-type` attribute) — the jar itself rejects these inputs, so they never enter the 261 comparable. fugedo's error is a dotted transition-reference whose ancestor was never promoted; zecivu was mis-grouped with jijuze in early journals (corrected iter 14). |
| nasuge-48-cesa800 | Deployment-diagram fixture misclassified into the state manifest (turned EQUAL through the shared pipeline regardless; noted for manifest hygiene). |

## Size backlog (structurally EQUAL, sizes not yet exact)

Tracked in `oracle/goldens/state/size-backlog.json` (~90 entries at close;
shrink-only, absent slug = exact required). Known mechanism families
(journaled across iterations): composite-wrapper sizing on autonom re-entry
nodes, `skinparam wrapWidth` text wrapping (unimplemented — deltas up to
6in), `scale N` factor drift on wrappers, note-body creole measurement,
stacked-stereotype label splitting, `<style>` blocks. Two entries were
raised by the graphviz-ts npm swap (~0.19px, journaled); one by design
during iter-1's scope-semantics correction.
