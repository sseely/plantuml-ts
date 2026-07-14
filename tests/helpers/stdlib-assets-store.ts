/**
 * Test-side re-export of the assets-backed `StdlibStore` builder
 * (`plans/si5b-stdlib/batch-4/overview.md` T9). The implementation lives
 * under `scripts/` (Node `fs`, shared with `scripts/dot-sync-report.ts`) —
 * this file exists only so oracle harnesses can `import` it from
 * `tests/helpers/` per `~/.claude/rules/naming-conventions.md`'s shared
 * test-utility location without reaching into `scripts/` directly.
 */
export {
  buildStdlibAssetsStore,
  readStdlibAssetsStore,
  parseLinkAlias,
  DEFAULT_ASSETS_STDLIB_DIR,
} from '../../scripts/stdlib-assets-store.js';
