# SI5b+E2r decisions (maintainer-confirmed 2026-07-13/14 unless noted)

## D1 — Capture everything; publish the audited set

`scripts/vendor-stdlib.ts` copies EVERY child folder of
`~/git/plantuml-stdlib/stdlib/` verbatim (one bundle per folder) into
gitignored `assets/stdlib/`, pinned to a recorded plantuml-stdlib commit
SHA, with a COMMITTED `assets/stdlib.manifest.json` (per-file sha256 + the
SHA + per-bundle `link:`/license metadata from each README.md). No
allowlist at capture. Packaging (D2) is where the audit gate lives.

## D2 — Four packages (npm workspaces in this repo)

| Package | Contents | Notes |
|---|---|---|
| `@plantuml-ts/stdlib` | C4, archimate, cloudinsight, cloudogu, bootstrap (+bootstrap1.13.1 target, alias honored) | all MIT/audited, ~5MB |
| `@plantuml-ts/stdlib-aws` | awslib14 + `awslib` alias | CC BY-ND assets; LICENSE + notice per D4 |
| `@plantuml-ts/stdlib-tupadr3` | tupadr3 | MIT glue + CC BY 4.0/Apache/OFL artwork, attribution file |
| `@plantuml-ts/stdlib-all` | meta-package: depends on + re-exports the three above (and future NON-GPL additions) | one-call register-everything |

Subpath exports per bundle within packages. Core `plantuml-ts` package
untouched (~2MB). Unaudited bundles (azure, office, ibm, logos, material*,
gcp, k8s, elastic, osa*, aws-v1, awslib10/20, …) stay captured-only until
their licenses are read. `adaml` (GPL): publishable LATER as its own
GPL-licensed artifact; NEVER inside the MIT packages and NEVER in `-all`
(maintainer ruling — scanner hygiene). Legacy `aws` v1 (112MB, 5 fixtures):
deferred.

## D3 — Verbatim is a hard licensing constraint

The pipeline is copy + sha256, never a transform. For the AWS CC BY-ND
assets ANY regenerate/re-encode/recolor voids the grant (audit
`planning/s4-stdlib-audit.md`). PNG-in-PUML data URIs pass through to our
SVG output byte-verbatim (D7).

## D4 — Attribution

Each packaged bundle dir carries its upstream LICENSE verbatim; each
package has a LICENSES.md; the AWS package README names CC BY-ND 2.0,
links https://github.com/awslabs/aws-icons-for-plantuml/blob/main/LICENSE
and credits the source repo (maintainer's wording preference). Keep all
upstream copyright headers inside the .puml files (they're part of the
verbatim bytes anyway).

## D5 — Resolution mirrors Stdlib.java exactly

Lowercase everything; strip trailing `.puml`; bundle = substring to FIRST
`/`; `<bundle>` alone resolves to NOTHING (upstream returns null); honor
`link:` aliases (awslib→awslib14, bootstrap→bootstrap1.13.1, material*→…);
NO include-once dedup and NO `!SUB` handling in the stdlib branch
(TContext.java:792-856, Stdlib.java:98-114 — key semantics quoted in T3).
The `StdlibNotBundledError` throw remains for bundles absent from the
supplied store.

## D6 — Sync decode: port upstream's own code

`AsciiEncoder` (PlantUML's 6-bit alphabet — NOT base64) and the raw-DEFLATE
`code/deflate/Decompressor` are ported faithfully (sync, zero deps,
browser-safe). Browser `DecompressionStream` rejected (async breaks
renderSync); fflate rejected (new dep).

## D7 — Image emission

Sprites: decode → tint via the SpriteMonochrome gradient/alpha port → a
minimal deterministic STORED-block PNG encoder (no compression; ~100 lines;
no canvas) → one SVG `<image>` with a PNG data URI (matches the jar's
shape: SvgGraphics.svgImage). `<img data:image/png;base64,…>`: passed
through VERBATIM with width/height parsed from the PNG IHDR — the jar
decodes and RE-encodes, so our href bytes deliberately differ
(DIVERGENCES.md entry; geometry identical). http(s) fetch: out of scope.

## D8 — Sprite registry ownership

Per-diagram, mirroring upstream SkinParam.sprites: a shared
sprite-definition matcher (same pattern as the G0b annotation matcher)
feeds a registry carried with the diagram's skinparam/theme context and
consulted by creole rendering.

## D9 — Measurement is part of rendering

Sprite/img atoms contribute their (scaled) pixel dims to label
measurement — this is what moves the 6 fixtures' DOT. The measurement path
must use IHDR/sprite dims, not text heuristics.

## Operational readiness

Library + build tooling: observability N/A (gates are the instruments);
rollback = revert the merge (assets are gitignored + regenerable; packages
unpublished until the maintainer publishes); public API: core adds an
optional `includeStore` already present since SI5a — no breaking change;
CI: the vendor step needs the plantuml-stdlib checkout (pinned SHA) — cache
keyed on the SHA, task T1 owns the CI wiring.
