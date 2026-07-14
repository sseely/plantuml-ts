# @plantuml-ts/stdlib-tupadr3

The `tupadr3` PlantUML stdlib bundle (Font Awesome 4/5/6, Devicons,
Devicons2, Material, Weather, Govicons — ~6,850 icon-font sprites) —
packaged as a single [plantuml-ts](https://github.com/plantuml/plantuml-ts)
`BundleData` value, for use with `plantuml-ts`'s `stdlibStore()` /
`withStdlib()` include seam.

Only an index export is provided (no per-category subpaths): `tupadr3` is a
single resolution unit in upstream's `Stdlib.java` (one bundle name, e.g.
`<tupadr3/font-awesome-5/ban>`), so splitting `BundleData` across
subpath-exported category modules would not compose back into one bundle for
`stdlibStore()` — passing multiple partial `BundleData` values sharing the
name `'tupadr3'` overwrites rather than merges (`stdlibStore`'s `byName` map
keys on the last value with that name). Bundlers still tree-shake unused
sprite keys from the single `files` map at the object-property level.

## Install

```sh
npm install plantuml-ts @plantuml-ts/stdlib-tupadr3
```

`plantuml-ts` is a peer dependency — this package supplies data, not the
renderer.

## Usage

```ts
import { renderSync, stdlibStore, withStdlib, MapIncludeStore } from 'plantuml-ts';
import { tupadr3 } from '@plantuml-ts/stdlib-tupadr3';

const includeStore = withStdlib(new MapIncludeStore(), stdlibStore(tupadr3));

const svg = renderSync(
  ['@startuml', '!include <tupadr3/font-awesome-5/ban>', '@enduml'].join('\n'),
  { includeStore },
);
```

## Licensing

Mixed licensing — MIT glue plus several third-party icon-font artwork
licenses. See [`LICENSES.md`](./LICENSES.md).
