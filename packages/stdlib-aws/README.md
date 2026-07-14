# @plantuml-ts/stdlib-aws

Vendored AWS Architecture Icons for PlantUML (`awslib14`, plus the `awslib`
alias) — packaged as [plantuml-ts](https://github.com/plantuml/plantuml-ts)
`BundleData` values, for use with `plantuml-ts`'s `stdlibStore()` /
`withStdlib()` include seam.

## Attribution and license

The icon artwork in this package (`awslib14` — the `.puml` sprite files
under `generated/`) is licensed under **Creative Commons
Attribution-NoDerivatives 2.0 (CC BY-ND 2.0)** by Amazon.com, Inc. or its
affiliates. Full text: [`LICENSE`](./LICENSE).

- Upstream license (canonical):
  https://github.com/awslabs/aws-icons-for-plantuml/blob/main/LICENSE
- Source repository (credit):
  https://github.com/awslabs/aws-icons-for-plantuml — "AWS Icons for
  PlantUML", awslabs.

This package vendors those files **byte-verbatim** (copy + sha256 checksum,
never a transform — see `plans/si5b-stdlib/decisions.md` D1/D3 in the
plantuml-ts source repo). The ND (No-Derivatives) term forbids modifying,
re-encoding, or recoloring the artwork; verbatim reproduction inside this
"Collective Work" is permitted (CC BY-ND 2.0 §3(a)/§4(a) — see
`planning/s4-stdlib-audit.md`'s license analysis in the plantuml-ts source
repo). This package's own glue code (the `.puml` macro definitions that
accompany each sprite, and the generated `BundleData` wrapper) is MIT —
see [`LICENSE-CODE`](./LICENSE-CODE), matching upstream's own split between
`LICENSE` (icons) and `LICENSE-CODE` (macros).

## Install

```sh
npm install plantuml-ts @plantuml-ts/stdlib-aws
```

`plantuml-ts` is a peer dependency — this package supplies data, not the
renderer.

## Usage

```ts
import { renderSync, stdlibStore, withStdlib, MapIncludeStore } from 'plantuml-ts';
import { awslib14 } from '@plantuml-ts/stdlib-aws';

const includeStore = withStdlib(new MapIncludeStore(), stdlibStore(awslib14));

const svg = renderSync(
  ['@startuml', '!include <awslib14/General/User>', '@enduml'].join('\n'),
  { includeStore },
);
```

`awslib` (the alias `link:` target upstream registers for the "current"
release) is also exported and resolves through to `awslib14`:

```ts
import { awslib, awslib14 } from '@plantuml-ts/stdlib-aws';
// stdlibStore(awslib, awslib14) resolves `<awslib/...>` via the `awslib14` files.
```
