# Licenses — @plantuml-ts/stdlib-aws

| Component | License | File |
|---|---|---|
| AWS icon artwork (`awslib14` `.puml` sprites) | CC BY-ND 2.0, Amazon.com, Inc. or its affiliates | [`LICENSE`](./LICENSE) |
| AWS macro/glue code (`.puml` `!define`/`!function` wrappers) | MIT, Amazon.com, Inc. | [`LICENSE-CODE`](./LICENSE-CODE) |
| This package's own generated wrapper code | MIT | same as `LICENSE-CODE` |

`awslib` is a `link:` alias (upstream `Stdlib.java` alias semantics) that
resolves to `awslib14` and carries no separate license — see
[`../stdlib/README.md`](../stdlib/README.md) for the alias-resolution
mechanism shared across every packaged bundle.

Both license files are also kept per-bundle under `licenses/awslib14/` for
consistency with the other `@plantuml-ts/stdlib*` packages' provenance
layout.

Source: https://github.com/awslabs/aws-icons-for-plantuml (vendored via
https://github.com/plantuml/plantuml-stdlib, commit
`bdbb819f76c75e7a23af582b2a63ea7dc43eed7c`). Per-file sha256 checksums are
committed at `assets/manifests/awslib14.json` and `assets/manifests/awslib.json`
in the plantuml-ts source repo and are re-verified by
`tests/unit/stdlib-packages.test.ts`.
