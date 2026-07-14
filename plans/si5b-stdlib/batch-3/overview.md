# Batch 3 — SVG emission + packages (parallel, needs batch 2)

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T7 | SVG `<image>` emission: sprite + img atoms render in the description label path; jar-relation-verified | typescript-pro | the description creole→SVG render path (where creole tokens become text today — trace from renderer-entity/renderer-cluster label drawing + core/svg text emission; likely creole.ts's spansToTspan gains an image branch OR a sibling emitter), tests/unit/creole-img-render.test.ts, tests/integration additions | T4, T5, T6 | [x] |
| T8 | npm workspaces + the four packages, built from assets | typescript-pro | package.json (workspaces field + files exclusions), packages/{stdlib,stdlib-aws,stdlib-tupadr3,stdlib-all}/** (new: package.json, build script generating per-bundle modules from assets/stdlib per the manifest, LICENSE/LICENSES.md/README per D4), scripts/build-stdlib-packages.ts (new), tests/unit/stdlib-packages.test.ts (pack + import smoke via workspace) | T1, T3 | [x] |

T7 emission rules (jar shape, research §3/§4): one `<image>` element per
atom with x/y/width/height + `data:image/png;base64,…` href; sprites get
the T5-encoded tinted PNG; `<img data:…>` hrefs pass through VERBATIM (D7);
scale multiplies the IHDR/sprite dims. Baseline behavior when a sprite name
is unknown: NOTHING is rendered (upstream StripeSimple skips the atom).
Byte-stability: diagrams without img/sprite atoms must render byte-identical
(the emitter only activates on the new atom kinds).

T7 jar verification: build a small probe (sprite defined inline + `<$name>`
+ an `<img data:…>` from a real awslib14 file) through
`java -jar oracle/dist/plantuml-oracle.jar -tsvg -pipe`; pin RELATIONS
(element kind, x/y/w/h arithmetic, scale math) — NOT href bytes (jar
re-encodes; ours pass through / stored-block encode; DIVERGENCES.md entry
is T10's).

T8 package mechanics: each generated bundle module =
`export const files: Record<string,string>` (lowercased keys per D5) +
`export const bundle: BundleData` (T3 contract); package root re-exports
`stdlibStore`-ready BundleData per bundle via subpath exports
(`@plantuml-ts/stdlib/c4` etc.) and an index registering all of the
package's bundles; `-all` = dependencies on the three + a re-export index
(NO adaml, D2). Generated code is emitted by scripts/build-stdlib-packages.ts
at build time from assets/ (gitignored dist inside packages), NOT committed.
`npm pack --dry-run` per package must show expected size ceilings
(stdlib ~<8MB, -aws ~<15MB, -tupadr3 ~<35MB tarballs) and the LICENSE files.
Root `npm test`/build must be unaffected by the workspaces conversion
(additive only — stop condition otherwise).

Gates after batch: full gates + DOT FROZEN exact.
