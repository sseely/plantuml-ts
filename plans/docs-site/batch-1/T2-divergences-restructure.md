# T2 — DIVERGENCES.md restructure per diagram type

## Context
plantuml-ts. DIVERGENCES.md currently has topic sections (Preprocessor,
JSON diagrams, …). Maintainer decision (decisions.md#d3): reorganize
per diagram type with a leading **General** section for cross-cutting
entries.

## Task
Restructure: `## General` first (preprocessor entries incl. the
!import/!include deferral), then one `## <Diagram type>` section per
type in alphabetical order (JSON, …). Every existing entry keeps its
text VERBATIM — this is a move, not a rewrite. Keep the intro/category
legend at top. Update all repo-internal links to changed anchors
(`grep -rn 'DIVERGENCES.md#' --include='*.md' --include='*.ts' .`).

## Write-set
- DIVERGENCES.md
- Any file with an inbound anchor link (grep first; expected: few/none)

## Read-set
- DIVERGENCES.md (whole)
- plans/docs-site/decisions.md#d3

## Interface contracts (consumed by T4)
Section order General-then-per-type; H2 headers named exactly
`General` / `<Diagram type>`.

## Acceptance criteria
- Given the restructure, when read, then General holds all
  cross-cutting entries and each remaining entry sits under its
  diagram type with content unchanged (diff shows only moves).
- Given the anchor grep, then zero broken inbound links.

## Observability
N/A.

## Rollback
Reversible.

## Commit
`docs: organize DIVERGENCES.md per diagram type`
