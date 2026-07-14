/**
 * SI5b+E2r T9 -- the assets-backed `StdlibStore` builder
 * (`scripts/stdlib-assets-store.ts`) the DOT-sync harness needs to feed
 * `!include <bundle/thing>` fixtures into layout.
 *
 * Two layers:
 *   1. `parseLinkAlias` -- pure YAML-front-matter parsing (no fs), pinned
 *      against the real bundle README shapes seen in `assets/stdlib/`.
 *   2. `readStdlibAssetsStore` -- fs integration over a synthetic bundle
 *      tree (mkdtemp), proving the key transform + alias wiring + the
 *      missing-directory remediation message.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseLinkAlias, readStdlibAssetsStore } from '../../scripts/stdlib-assets-store.js';

// ---------------------------------------------------------------------------
// 1. parseLinkAlias -- pure YAML front-matter parsing.
// ---------------------------------------------------------------------------

describe('parseLinkAlias', () => {
  it('reads the link: value out of YAML front matter (awslib -> awslib14)', () => {
    const readme = [
      '---',
      'name: awslib',
      'display_name: Awslib',
      'source: https://github.com/awslabs/aws-icons-for-plantuml',
      'link: awslib14',
      'origin: ',
      '---',
      '',
      'Information about the `awslib` Standard Library.',
    ].join('\n');
    expect(parseLinkAlias(readme)).toBe('awslib14');
  });

  it('reads a link: value with a dotted target (bootstrap -> bootstrap1.13.1)', () => {
    const readme = ['---', 'name: bootstrap', 'link: bootstrap1.13.1', '---', 'body text'].join('\n');
    expect(parseLinkAlias(readme)).toBe('bootstrap1.13.1');
  });

  it('returns undefined when there is no link: field', () => {
    const readme = ['---', 'name: cloudogu', 'license: MIT', '---', 'body'].join('\n');
    expect(parseLinkAlias(readme)).toBeUndefined();
  });

  it('returns undefined when there is no front matter at all', () => {
    expect(parseLinkAlias('just a plain README, no front matter\nmore text')).toBeUndefined();
  });

  it('returns undefined for unterminated front matter (no closing ---)', () => {
    const readme = ['---', 'name: broken', 'link: somewhere'].join('\n');
    expect(parseLinkAlias(readme)).toBeUndefined();
  });

  it('ignores a "link:"-looking line in the README body, outside front matter', () => {
    const readme = ['---', 'name: bootstrap', '---', '', 'See the link: here for icon names.'].join('\n');
    expect(parseLinkAlias(readme)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. readStdlibAssetsStore -- fs integration over a synthetic bundle tree.
// ---------------------------------------------------------------------------

describe('readStdlibAssetsStore', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function makeAssetsDir(): string {
    dir = mkdtempSync(join(tmpdir(), 'plantuml-ts-stdlib-assets-'));
    return dir;
  }

  it('reads a concrete bundle\'s .puml files with the Stdlib.java key transform', () => {
    const assetsDir = makeAssetsDir();
    const bundleDir = join(assetsDir, 'cloudogu');
    mkdirSync(join(bundleDir, 'dogus'), { recursive: true });
    writeFileSync(join(bundleDir, 'common.puml'), '!define COMMON(x) x', 'utf8');
    writeFileSync(join(bundleDir, 'dogus', 'Jenkins.puml'), '!define DOGU_JENKINS(a,b) a b', 'utf8');
    writeFileSync(join(bundleDir, 'README.md'), '---\nname: cloudogu\n---\nbody', 'utf8');

    const store = readStdlibAssetsStore(assetsDir);
    expect(store.getPumlResource('cloudogu/common')).toBe('!define COMMON(x) x');
    expect(store.getPumlResource('cloudogu/dogus/Jenkins')).toBe('!define DOGU_JENKINS(a,b) a b');
  });

  it('excludes non-.puml files (README.md, _examples_) from the resolvable keys', () => {
    const assetsDir = makeAssetsDir();
    const bundleDir = join(assetsDir, 'x');
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(join(bundleDir, 'thing.puml'), 'class Thing', 'utf8');
    writeFileSync(join(bundleDir, 'README.md'), 'no front matter', 'utf8');

    const store = readStdlibAssetsStore(assetsDir);
    expect(store.getPumlResource('x/thing')).toBe('class Thing');
    expect(store.getPumlResource('x/README')).toBeUndefined();
  });

  it('resolves an alias bundle (link: front matter) through to its target', () => {
    const assetsDir = makeAssetsDir();
    const target = join(assetsDir, 'awslib14');
    mkdirSync(join(target, 'General'), { recursive: true });
    writeFileSync(join(target, 'General', 'User.puml'), 'class User', 'utf8');

    const alias = join(assetsDir, 'awslib');
    mkdirSync(alias, { recursive: true });
    writeFileSync(join(alias, 'README.md'), '---\nname: awslib\nlink: awslib14\n---\n', 'utf8');

    const store = readStdlibAssetsStore(assetsDir);
    expect(store.getPumlResource('awslib/General/User')).toBe('class User');
  });

  it('throws a remediation-bearing error when the assets directory is absent', () => {
    const missing = join(tmpdir(), 'plantuml-ts-stdlib-assets-does-not-exist');
    expect(() => readStdlibAssetsStore(missing)).toThrow(
      /does not exist.*npx tsx scripts\/vendor-stdlib\.ts/s,
    );
  });
});
