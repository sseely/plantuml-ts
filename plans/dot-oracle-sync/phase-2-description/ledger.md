# Description divergence ledger

Every non-EQUAL fixture at phase exit has an entry here (loop-protocol.md
step 8). Empty at phase start.

## kermor pragma changes ranksep floor
- Mechanism: `!pragma kermor on` lowers upstream's ranksep floor 60→40
  (Java: `DotStringFactory.getMinRankSep()`; ours: no pragma support at all)
- Disposition: blocked-on pragma subsystem (unimplemented; broader than svek)
- Slugs: fojamu-08-veku866 (+2 component ranksepOk residuals from i1 report)

## dispatcher misroute: alias syntax not in description grammar
- Mechanism: `Admin as :Main Admin:` isn't parsed by description, so
  `accepts()` rejects and the block falls through to the json engine
  (ours: `src/diagrams/json/layout.ts:551-557` supplied the LR/20/40 attrs)
- Disposition: needs-iteration (real grammar gap — fold into the
  auto-create/endpoint-grammar iteration, category 3)
- Slugs: zilisi-99-rate911

## rich-text label measurement (markup + hyperlinks)
- Mechanism: labels with `<b><size:13>`, `<color:green>`, `\n`, `[[url]]`
  are measured as raw literals; upstream measures the rendered text, so
  dzeta-derived nodesep differs (formula itself verified correct)
- Disposition: blocked-on creole-aware label measurement (text-metrics
  sub-problem, D1 tolerance territory)
- Slugs: jecici-56-bimu826, malumi-33-safu797
