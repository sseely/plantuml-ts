/**
 * The four `@plantuml-ts/stdlib*` packages' bundle composition
 * (`plans/si5b-stdlib/decisions.md` D2, `batch-3/overview.md` T8).
 *
 * `packages/stdlib-all` is not listed here -- it has no vendored assets of
 * its own, only a re-export index (`emit-all-index.ts`).
 */

import type { PackageSpec } from './types.js';

const STDLIB_PACKAGE: PackageSpec = {
  packageDir: 'stdlib',
  modules: [
    {
      fileBaseName: 'c4',
      exports: [{ kind: 'concrete', exportName: 'c4', bundleName: 'C4', assetFolder: 'C4' }],
    },
    {
      fileBaseName: 'archimate',
      exports: [
        { kind: 'concrete', exportName: 'archimate', bundleName: 'archimate', assetFolder: 'archimate' },
      ],
    },
    {
      fileBaseName: 'cloudinsight',
      exports: [
        { kind: 'concrete', exportName: 'cloudinsight', bundleName: 'cloudinsight', assetFolder: 'cloudinsight' },
      ],
    },
    {
      fileBaseName: 'cloudogu',
      exports: [
        { kind: 'concrete', exportName: 'cloudogu', bundleName: 'cloudogu', assetFolder: 'cloudogu' },
      ],
    },
    {
      // One module file for the alias/target pair -- `batch-3/overview.md` T8
      // enumerates exactly 5 stdlib subpaths (no separate `/bootstrap1.13.1`),
      // and the two are only useful together (`stdlibStore(bootstrap,
      // bootstrap1_13_1)` -- the alias alone cannot resolve anything).
      fileBaseName: 'bootstrap',
      exports: [
        { kind: 'alias', exportName: 'bootstrap', bundleName: 'bootstrap', aliasOf: 'bootstrap1.13.1' },
        {
          kind: 'concrete',
          exportName: 'bootstrap1_13_1',
          bundleName: 'bootstrap1.13.1',
          assetFolder: 'bootstrap1.13.1',
        },
      ],
    },
  ],
};

const STDLIB_AWS_PACKAGE: PackageSpec = {
  packageDir: 'stdlib-aws',
  modules: [
    {
      fileBaseName: 'awslib14',
      exports: [
        { kind: 'concrete', exportName: 'awslib14', bundleName: 'awslib14', assetFolder: 'awslib14' },
      ],
    },
    {
      fileBaseName: 'awslib',
      exports: [{ kind: 'alias', exportName: 'awslib', bundleName: 'awslib', aliasOf: 'awslib14' }],
    },
  ],
};

const STDLIB_TUPADR3_PACKAGE: PackageSpec = {
  packageDir: 'stdlib-tupadr3',
  modules: [
    {
      fileBaseName: 'tupadr3',
      exports: [
        { kind: 'concrete', exportName: 'tupadr3', bundleName: 'tupadr3', assetFolder: 'tupadr3' },
      ],
    },
  ],
};

export const PACKAGE_SPECS: readonly PackageSpec[] = [
  STDLIB_PACKAGE,
  STDLIB_AWS_PACKAGE,
  STDLIB_TUPADR3_PACKAGE,
];
