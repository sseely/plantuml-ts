# Licenses — @plantuml-ts/stdlib-all

This meta-package's own code is MIT (see `LICENSE`) and carries no vendored
third-party content directly. It depends on and re-exports:

| Dependency | License |
|---|---|
| `@plantuml-ts/stdlib` | MIT (each bundle's own license — see its `LICENSES.md`) |
| `@plantuml-ts/stdlib-aws` | Mixed — CC BY-ND 2.0 icon artwork + MIT glue (see its `LICENSES.md`) |
| `@plantuml-ts/stdlib-tupadr3` | Mixed — MIT glue + third-party icon-font artwork licenses (see its `LICENSES.md`) |

`adaml` (GPL) is deliberately **excluded** from this package and from every
other `@plantuml-ts/stdlib*` package (maintainer ruling,
`plans/si5b-stdlib/decisions.md` D2, in the plantuml-ts source repo) —
GPL code must never ship inside an MIT-licensed aggregate. It will be
published later as its own separately GPL-licensed package, if at all.

Consult each dependency's own `LICENSE(S)` before redistributing content
that originates from it — this package changes nothing about those terms.
