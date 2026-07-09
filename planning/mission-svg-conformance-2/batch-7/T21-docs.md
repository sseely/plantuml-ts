# T21 — Docs: catalog, conformance doc, CHANGELOG

## Context
Close the documentation loop: future agents must find the new modules,
and the deliberate output-shape change must be visible to consumers.

## Task
1. `.claude/catalog.md` (on-disk; gitignored — repo convention): add
   Done entries for `src/core/decoration/symbol/**`, `src/core/svek/**`,
   `src/core/measurer-jar.ts` (+ data), the survey/dashboard/overlay
   scripts, the description ratchet; update the description-engine entry
   (now klimt-drawn); update `svg.ts` legacy entry's consumer list
   (description removed).
2. `docs/svg-conformance.md`: add the Brief 2 sections — ratchet
   workflow (add/remove rules, DOT-EQUAL eligibility), survey/dashboard
   usage (`svg:survey`/`svg:dashboard`), overlay triage, and the
   description-engine conformance status.
3. `CHANGELOG.md` (create if absent — check repo root first): entry for
   the description SVG output-shape change (markers → drawn polygon
   arrowheads, entity `<g>` wrappers + comments, klimt preamble attrs),
   framed per the friction principle: deliberate divergence, documented,
   jar-conformant.

## Write-set
- `.claude/catalog.md`, `docs/svg-conformance.md`, `CHANGELOG.md`

## Read-set
- `.claude/catalog.md` (format), `docs/svg-conformance.md` (existing)
- `../decision-journal.md` (what actually happened — cite real state,
  not planned state)

## Acceptance criteria
1. Given the catalog, then every new module is findable with a one-line
   API surface, and svg.ts's remaining consumers are accurate.
2. Given the conformance doc, then a new contributor can run
   survey → overlay → fix → ratchet without reading the mission brief.
3. Given the CHANGELOG, then a downstream consumer understands exactly
   what changed in description SVG output and why.

## Observability / Rollback
N/A. / Reversible.

## Quality bar
`npm run lint` green; docs reflect ACTUAL end-state (read the journal).

## Commit
`docs(T21): catalog + conformance workflow + output-change changelog`
