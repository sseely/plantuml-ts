# T6 — Deploy workflow + final verification

## Context
Model: `~/git/graphviz-ts/.github/workflows/docs.yml` (read whole —
push-to-main + workflow_dispatch, pages/id-token permissions,
concurrency group, build job uploading docs-site/.vitepress/dist,
deploy job). NOTE: this repo has NO .github/ directory yet — docs.yml
is its first workflow; create the directory, follow the model's
node-version.

## Task
1. Port docs.yml (adjust artifact path if needed; pin action versions
   like the model does).
2. End-to-end verification: `npm run docs:build` from clean;
   spot-check dist for index/playground/parity/divergences/guide pages
   and working inter-links (grep the HTML for hrefs).
3. Flip F3 → done in planning/mission-index.md with the site URL
   (https://sseely.github.io/plantuml-ts/) and the note that the Pages
   source toggle is the maintainer's one manual step.

## Write-set
- .github/workflows/docs.yml (new), planning/mission-index.md

## Read-set
- ~/git/graphviz-ts/.github/workflows/docs.yml (whole)
- existing .github/workflows/* (conventions)

## Acceptance criteria
- Given a push to main (post-merge), when docs.yml runs, then build
  produces the artifact and deploy targets Pages (verifiable only
  after the maintainer flips the Pages source — note it, don't block).
- Given the built dist, then all five page groups render and
  interlink.

## Observability
The workflow status IS the alarm (decisions.md operational notes).

## Rollback
Reversible.

## Commit
`ci(docs): GitHub Pages deploy workflow`
