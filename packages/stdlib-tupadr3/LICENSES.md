# Licenses — @plantuml-ts/stdlib-tupadr3

`tupadr3`'s own glue code (the `.puml` macro/sprite-wrapper definitions,
`common.puml`) is **MIT**, copyright tupadr3 — see [`LICENSE`](./LICENSE)
(fetched verbatim from
https://github.com/tupadr3/plantuml-icon-font-sprites/blob/master/LICENSE.md).
This package's own generated wrapper code carries the same MIT license.

`tupadr3` re-packages several third-party icon fonts as PlantUML sprites.
The **artwork** (the pixel/vector shapes each sprite encodes) keeps its own
upstream license, independent of tupadr3's MIT glue:

| Category | Icon set | Artwork license (best available; see note) | Source |
|---|---|---|---|
| `font-awesome`, `font-awesome-5`, `font-awesome-6` | Font Awesome (4 / 5 / 6 Free) | CC BY 4.0 | https://fontawesome.com/license/free |
| `devicons`, `devicons2` | Devicons | MIT | https://github.com/devicons/devicon/blob/master/LICENSE |
| `material` | Material Design Icons (Google) | Apache License 2.0 | https://github.com/google/material-design-icons/blob/main/LICENSE |
| `weather` | Weather Icons (erikflowers/weather-icons) | Not independently re-verified in this packaging pass; upstream historically ships as SIL OFL 1.1 (font) / MIT (CSS) but no LICENSE file was found at the pinned source | https://github.com/erikflowers/weather-icons |
| `govicons` | Government icon font | Not independently re-verified in this packaging pass — no license metadata is embedded in the vendored `.puml` sprites | (bundled via tupadr3; no separate upstream repo was traced) |

**Verdict** (per `planning/s4-stdlib-audit.md`'s 2026-07-12 license audit in
the plantuml-ts source repo): VENDOR-OK, attribution required. CC BY 4.0 and
Apache-2.0 both permit redistribution with attribution inside an
MIT-licensed package as mixed-license assets; this file is that attribution.
The `weather` and `govicons` categories were captured under the same D1
"capture everything verbatim" policy but their exact artwork license has not
been independently confirmed — flagged here for maintainer follow-up before
relying on redistribution terms beyond what tupadr3's own MIT glue license
already covers.

Source: https://github.com/tupadr3/plantuml-icon-font-sprites (vendored via
https://github.com/plantuml/plantuml-stdlib, commit
`bdbb819f76c75e7a23af582b2a63ea7dc43eed7c`). Per-file sha256 checksums are
committed at `assets/manifests/tupadr3.json` in the plantuml-ts source repo
and are re-verified by `tests/unit/stdlib-packages.test.ts`.
