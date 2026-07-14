# @plantuml-ts/stdlib-all

Meta-package: depends on and re-exports every non-GPL
[plantuml-ts](https://github.com/plantuml/plantuml-ts) stdlib package
(`@plantuml-ts/stdlib`, `@plantuml-ts/stdlib-aws`,
`@plantuml-ts/stdlib-tupadr3`) so a consumer can register every packaged
bundle in one call. `adaml` (GPL) is deliberately never included — see
[`LICENSES.md`](./LICENSES.md).

## Install

```sh
npm install plantuml-ts @plantuml-ts/stdlib-all
```

## Usage

```ts
import { renderSync, stdlibStore, withStdlib, MapIncludeStore } from 'plantuml-ts';
import * as stdlib from '@plantuml-ts/stdlib-all';

const includeStore = withStdlib(
  new MapIncludeStore(),
  stdlibStore(...Object.values(stdlib)),
);

const svg = renderSync(
  ['@startuml', '!include <C4/C4_Context>', '@enduml'].join('\n'),
  { includeStore },
);
```

Prefer the individual `@plantuml-ts/stdlib*` packages directly if you only
need one or two bundles — `-all` pulls in every dependency's data (tupadr3
alone is the bulk of it).
