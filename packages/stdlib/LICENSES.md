# Licenses — @plantuml-ts/stdlib

This package's own glue code (the generated `BundleData` wrapper modules) is
MIT-licensed — see `LICENSE`. It bundles five vendored PlantUML stdlib
folders verbatim (copy + sha256 checksum, never a transform — see
`plans/si5b-stdlib/decisions.md` D1/D3 in the plantuml-ts source repo). Each
bundle keeps its own upstream license.

| Bundle | Subpath export | License | Source | Notes |
|---|---|---|---|---|
| C4 | `@plantuml-ts/stdlib/c4` | MIT | https://github.com/plantuml-stdlib/C4-PlantUML | `licenses/C4/LICENSE` |
| archimate | `@plantuml-ts/stdlib/archimate` | MIT | https://github.com/plantuml-stdlib/Archimate-PlantUML | `licenses/archimate/LICENSE` |
| cloudinsight | `@plantuml-ts/stdlib/cloudinsight` | MIT | https://github.com/plantuml-stdlib/cicon-plantuml-sprites | `licenses/cloudinsight/LICENSE` |
| cloudogu | `@plantuml-ts/stdlib/cloudogu` | MIT (per source repo; no LICENSE file is vendored — cloudogu/plantuml-cloudogu-sprites ships none. Its README credits "Cloudogu GmbH under MIT License", linking https://cloudogu.com/en/license/.) | https://github.com/cloudogu/plantuml-cloudogu-sprites | see note above |
| bootstrap1.13.1 | `@plantuml-ts/stdlib/bootstrap` | MIT | https://github.com/twbs/icons | `licenses/bootstrap1.13.1/LICENSE`. `bootstrap` is a `link:` alias resolving to `bootstrap1.13.1` (upstream `Stdlib.java` alias semantics — see `StdlibStore.ts`), matching the version pinned in `assets/stdlib.manifest.json`. |

Vendored at plantuml-stdlib commit `bdbb819f76c75e7a23af582b2a63ea7dc43eed7c`
(https://github.com/plantuml/plantuml-stdlib). Per-file sha256 checksums are
committed at `assets/manifests/<bundle>.json` in the plantuml-ts source repo
and are re-verified by this repo's `tests/unit/stdlib-packages.test.ts`.

License texts above were fetched directly from each bundle's own upstream
source repository (not from plantuml-stdlib, which does not vendor
third-party LICENSE files into its bundle folders) on 2026-07-13.
