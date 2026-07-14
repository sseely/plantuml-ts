#!/usr/bin/env node
/**
 * Generator for the four `@plantuml-ts/stdlib*` npm packages (mission SI5b
 * batch-3, T8): reads `assets/stdlib/` (the SI5b T1 vendor pipeline's
 * output) and writes a gitignored `generated/` tree into each of
 * `packages/{stdlib,stdlib-aws,stdlib-tupadr3,stdlib-all}/` containing
 * `BundleData`-shaped ESM modules (`src/core/tim/StdlibStore.ts`'s
 * contract) plus a per-package `index.{js,d.ts}`.
 *
 * Emission is plain ESM JS + hand-paired `.d.ts` (no `tsc` compile step for
 * the generated data itself -- `plans/si5b-stdlib/batch-3/overview.md` T8:
 * 'tsconfig or plain-JS emission, pick the simplest that yields working ESM
 * + .d.ts'). Each package's own `tsconfig.json` (extending
 * `packages/tsconfig.base.json`) type-checks the resulting `.d.ts` files
 * against `plantuml-ts`'s `BundleData` export -- see `npm run build:stdlib`
 * in the root `package.json`.
 *
 * Usage:
 *   jiti scripts/build-stdlib-packages.ts
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emitAllIndexDts, emitAllIndexJs } from './build-stdlib-packages/emit-all-index.js';
import { emitIndexDts, emitIndexJs } from './build-stdlib-packages/emit-index.js';
import { emitModuleDts, emitModuleJs } from './build-stdlib-packages/emit-module.js';
import { PACKAGE_SPECS } from './build-stdlib-packages/package-specs.js';
import type { PackageSpec } from './build-stdlib-packages/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const ASSETS_STDLIB_DIR = join(REPO_ROOT, 'assets', 'stdlib');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');

function freshGeneratedDir(packageDir: string): string {
  const generatedDir = join(PACKAGES_DIR, packageDir, 'generated');
  rmSync(generatedDir, { recursive: true, force: true });
  mkdirSync(generatedDir, { recursive: true });
  return generatedDir;
}

function buildPackage(spec: PackageSpec): void {
  const generatedDir = freshGeneratedDir(spec.packageDir);

  for (const mod of spec.modules) {
    writeFileSync(join(generatedDir, `${mod.fileBaseName}.js`), emitModuleJs(mod, ASSETS_STDLIB_DIR), 'utf8');
    writeFileSync(join(generatedDir, `${mod.fileBaseName}.d.ts`), emitModuleDts(mod), 'utf8');
  }

  writeFileSync(join(generatedDir, 'index.js'), emitIndexJs(spec), 'utf8');
  writeFileSync(join(generatedDir, 'index.d.ts'), emitIndexDts(spec), 'utf8');
}

function buildAllPackage(): void {
  const generatedDir = freshGeneratedDir('stdlib-all');
  writeFileSync(join(generatedDir, 'index.js'), emitAllIndexJs(), 'utf8');
  writeFileSync(join(generatedDir, 'index.d.ts'), emitAllIndexDts(), 'utf8');
}

/** Generates every `@plantuml-ts/stdlib*` package's `generated/` tree from
 * `assets/stdlib/`. Exported so `tests/unit/stdlib-packages.test.ts` can
 * invoke it directly rather than shelling out. */
export function buildStdlibPackages(): void {
  if (!existsSync(ASSETS_STDLIB_DIR)) {
    throw new Error(
      `Cannot build stdlib packages: ${ASSETS_STDLIB_DIR} does not exist. ` +
        'Run `jiti scripts/vendor-stdlib.ts` first.',
    );
  }

  for (const spec of PACKAGE_SPECS) {
    buildPackage(spec);
  }
  buildAllPackage();
}

const isMain = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  buildStdlibPackages();
  // eslint-disable-next-line no-console
  console.log('Generated packages/{stdlib,stdlib-aws,stdlib-tupadr3,stdlib-all}/generated/.');
}
