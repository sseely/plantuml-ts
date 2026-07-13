# T10 — Verification + close-out

Run by the ORCHESTRATOR directly (Trap 5: run the gates yourself; agent
gate claims from batches 1-4 are inputs, not evidence).

## Steps

1. Full gates on the branch head: `npm test` (record counts + coverage),
   `npm run typecheck`, `npm run lint`, `npm run build`.
2. DOT gate: `npx tsx scripts/dot-sync-report.ts component usecase class
   object state` — assert EXACTLY 251/259, 81/87, 680/680, 78/80, 260/261.
   Any movement: diagnose per diagnosis.md before proceeding (Trap 3).
3. Census: `npx tsx scripts/svg-conformance-census.ts` — record
   before(6/355)/after in the journal and in docs/svg-conformance.md F2.
4. Exit-bar spot checks (jar vs ours, eyeball + structural):
   - buveco-86-tibo673 renders its title (the named fixture)
   - one `title` fixture per gating type (class/state/component/usecase/object)
     from tests/corpus/ — title present, geometry sane vs jar cache svg
   - one header/footer and one legend fixture
5. Docs:
   - `docs/svg-conformance.md`: F2 entry updated (legend/title/header/footer
     now implemented; residual F2 items: `<img>`, monospace creole)
   - `DIVERGENCES.md`: any entries batches produced (e.g. T9 stop branch)
   - `planning/mission-index.md`: flip G0b → done with the standard evidence
     line (date, numbers, plans/g0b-annotations/, residuals)
   - brief README batch checkboxes + summary section (tasks planned/done,
     decisions count, gate results, follow-ups)
6. Merge: merge commit (NOT squash) to main; push; verify main gates green
   post-merge.

## Acceptance criteria

- All numbers recorded in decision-journal.md AND the mission-index flip
  cites them.
- The ~118-fixture reach claim re-measured: count gating fixtures with
  annotations that now render them (a grep + spot-render script is fine;
  record the count).

## Commit(s): `docs(g0b): flip mission done, record census delta` + merge commit.
