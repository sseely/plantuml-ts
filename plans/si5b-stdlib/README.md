# Mission SI5b+E2r — stdlib vendoring, packages, and sprite/img rendering

**Objective.** (1) Vendor the ENTIRE plantuml-stdlib tree verbatim (one bundle
per child folder, pinned SHA, committed sha256 manifest, gitignored assets)
and resolve `!include <bundle/...>` through the SI5a IncludeStore seam with
upstream's exact key semantics. (2) Port the sprite/img rendering half of E2
(6-bit+raw-DEFLATE sprite decode, creole `<img>`/`<$sprite>` atoms,
deterministic PNG raster, SVG `<image>` emission) so vendored icons draw and
measure. (3) Publish four npm packages (workspaces): `@plantuml-ts/stdlib`
(commons), `-aws`, `-tupadr3`, and `-all` (meta, non-GPL aggregate).
(4) Drill the 6 SI5b-blocked conformance fixtures to DOT-EQUAL — this
unblocks G1.

Maintainer rulings baked in (2026-07-13/14, chat): vendor verbatim
(checksummed copy, NEVER transform — AWS CC BY-ND voids on any re-encode);
capture ALL bundles blindly, publish only audited ones; adaml ships later as
its own GPL artifact, never inside MIT packages nor `-all`; AWS attribution =
CC BY-ND notice + link to github.com/awslabs/aws-icons-for-plantuml;
subpath exports, whole bundles, separate packages per the size/license table.

- Branch: `feat/si5b-stdlib` (from current main)
- Merge: merge commit. Orchestrator owns all commits (one per task).
- Agents: NEVER git checkout/reset/stash/clean; read-only git.

## Quality Gates (per batch)

```
npm test (≥90/90/90) · npm run typecheck · npm run lint · npm run build
npx tsx scripts/dot-sync-report.ts component usecase class object state
  FROZEN through batch 3: component 261/262 · usecase 85/90 · class 708/708
  · object 78/80 · state 266/267. Batch 4 (T9) is the ONE sanctioned move:
  numerators rise by exactly the drilled fixtures (target 262/262, 90/90).
docs build must stay green if DIVERGENCES.md is touched (npm run docs:build).
```

## Batches

| Batch | Tasks | Status |
|---|---|---|
| [batch-1](batch-1/overview.md) — capture + decode + resolution (parallel) | T1 vendor pipeline, T2 deflate/ascii port, T3 stdlib resolution | [ ] |
| [batch-2](batch-2/overview.md) — sprite + png + creole (parallel) | T4 sprite subsystem, T5 png encoder+tint, T6 creole atoms+measurement | [ ] |
| [batch-3](batch-3/overview.md) — emission + packages (parallel) | T7 SVG emission, T8 workspaces+packages | [ ] |
| [batch-4](batch-4/overview.md) — drill + close | T9 fixture drill, T10 close-out (orchestrator) | [ ] |

## Key documents

- [decisions.md](decisions.md) — D1–D9 (packaging table, licensing constraints, ports)
- [decision-journal.md](decision-journal.md)
- Research: upstream mechanisms are embedded in task read-sets (Stdlib.java
  resolution, SpriteGrayLevel z-decode, SvgGraphics.svgImage emission —
  file:line refs in each task file).

## Stop conditions

- ANY transform of vendored bytes anywhere in the pipeline (copy+checksum
  only) — this is a licensing constraint, not a style rule.
- DOT gate movement outside T9's sanctioned drill.
- Writes outside a task's write-set; 2 consecutive gate failures on one
  check; 3 same-location changes for one failing check.
- Sprite decode output mismatching the jar on a real stdlib sprite after 2
  diagnosis rounds (per diagnosis.md — journal and stop, don't guess).
- npm workspace conversion breaking the root build in a way that needs
  vite/tsconfig surgery beyond additive config.

**Push-forward:** jar-verified constants; alias/metadata details from the
stdlib repo; package.json mechanics; test placement.

**Standing rules:** grep upstream at ~/git/plantuml/src/main/java/net/
(whole tree); browser-safe src/ (no Node built-ins/Date.now/Math.random —
scripts/ and packages/ build scripts may use Node); do not refactor while
porting; preserve upstream names (Stdlib, SpriteGrayLevel, SpriteMonochrome,
AsciiEncoder, AtomImg, AtomSprite); tests in tests/unit/ (hook-exempt);
complexity-hook playbook per project memory; npm run typecheck is the truth;
orchestrator re-runs all gates. Multi-line inline code spans containing
`<...>` must stay on one line in DIVERGENCES.md (docs-site constraint).

## Oracle verification

```sh
java -jar oracle/dist/plantuml-oracle.jar -tsvg -pipe < x.puml
# the 6 target fixtures: component xusuxe-62-guba767; usecase fariba-82,
# kofuca-08, ruziru-69, bootstrap-0, vivido-49 (cached in test-results/dot-cache/)
```

## Out of scope

Publishing to the npm registry (packages are built + pack-verified locally;
actual `npm publish` is the maintainer's); license reads for unaudited
bundles (captured, not packaged); the non-sprite E2 creole extras
(`<size:>`, `<back:>`, `<U+NNNN>` — separate E2 remainder); http(s) image
fetching (SecurityProfile — browser fetch is out; data URIs only);
`data:image/svg+xml` atoms unless a target fixture needs them.
