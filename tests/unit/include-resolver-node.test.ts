import { describe, it, expect, vi } from 'vitest';
import type { IncludeFetcher } from '../../src/core/include-resolver.js';
import { IncludeResolveError } from '../../src/core/include-resolver.js';
import { makeNodeFsFetcher } from '../../src/core/include-resolver-node.js';

// ---------------------------------------------------------------------------
// makeNodeFsFetcher accepts an injectable readFileFn so tests never touch
// the real filesystem. The second parameter defaults to node:fs/promises
// readFile in production — tests supply a vi.fn() instead.
// ---------------------------------------------------------------------------

const BASE = '/base/dir';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('makeNodeFsFetcher — return type', () => {
  it('returns a value that satisfies the IncludeFetcher type', () => {
    const fetcher: IncludeFetcher = makeNodeFsFetcher(BASE, vi.fn());
    expect(typeof fetcher).toBe('function');
  });
});

describe('makeNodeFsFetcher — successful read', () => {
  it('reads a file within basePath and returns its content', async () => {
    const readFile = vi.fn().mockResolvedValue('skinparam monochrome true\n');
    const fetcher = makeNodeFsFetcher(BASE, readFile);
    const result = await fetcher('foo.puml');
    expect(result).toBe('skinparam monochrome true\n');
  });

  it('calls readFile with the resolved absolute path', async () => {
    const readFile = vi.fn().mockResolvedValue('');
    const fetcher = makeNodeFsFetcher(BASE, readFile);
    await fetcher('foo.puml');
    expect(readFile).toHaveBeenCalledWith(`${BASE}/foo.puml`, 'utf-8');
  });

  it('resolves relative paths correctly (subdir/file.puml)', async () => {
    const readFile = vi.fn().mockResolvedValue('content');
    const fetcher = makeNodeFsFetcher(BASE, readFile);
    await fetcher('subdir/file.puml');
    expect(readFile).toHaveBeenCalledWith(`${BASE}/subdir/file.puml`, 'utf-8');
  });

  it('normalises ./ prefixes before resolving', async () => {
    const readFile = vi.fn().mockResolvedValue('content');
    const fetcher = makeNodeFsFetcher(BASE, readFile);
    await fetcher('./common.puml');
    expect(readFile).toHaveBeenCalledWith(`${BASE}/common.puml`, 'utf-8');
  });
});

describe('makeNodeFsFetcher — path traversal protection', () => {
  it('throws IncludeResolveError for a single-level traversal (../secret)', async () => {
    const fetcher = makeNodeFsFetcher(BASE, vi.fn());
    await expect(fetcher('../secret')).rejects.toBeInstanceOf(IncludeResolveError);
  });

  it('error message contains "escapes" for single-level traversal', async () => {
    const fetcher = makeNodeFsFetcher(BASE, vi.fn());
    const err = await fetcher('../secret').catch((e: unknown) => e) as IncludeResolveError;
    expect(err.message).toContain('escapes');
  });

  it('throws IncludeResolveError for a deep traversal (../../etc/passwd)', async () => {
    const fetcher = makeNodeFsFetcher(BASE, vi.fn());
    await expect(fetcher('../../etc/passwd')).rejects.toBeInstanceOf(IncludeResolveError);
  });

  it('error message contains "escapes" for deep traversal', async () => {
    const fetcher = makeNodeFsFetcher(BASE, vi.fn());
    const err = await fetcher('../../etc/passwd').catch((e: unknown) => e) as IncludeResolveError;
    expect(err.message).toContain('escapes');
  });

  it('IncludeResolveError.url is the original target for traversal errors', async () => {
    const fetcher = makeNodeFsFetcher(BASE, vi.fn());
    const err = await fetcher('../secret').catch((e: unknown) => e) as IncludeResolveError;
    expect(err.url).toBe('../secret');
  });

  it('does not throw for a path that stays within basePath', async () => {
    const readFile = vi.fn().mockResolvedValue('ok');
    const fetcher = makeNodeFsFetcher(BASE, readFile);
    await expect(fetcher('a/b/c.puml')).resolves.toBe('ok');
  });
});

describe('makeNodeFsFetcher — readFile ENOENT', () => {
  it('throws IncludeResolveError when readFile throws ENOENT', async () => {
    const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
    const readFile = vi.fn().mockRejectedValue(enoent);
    const fetcher = makeNodeFsFetcher(BASE, readFile);
    await expect(fetcher('missing.puml')).rejects.toBeInstanceOf(IncludeResolveError);
  });

  it('IncludeResolveError message includes the original error message on ENOENT', async () => {
    const enoent = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
    const readFile = vi.fn().mockRejectedValue(enoent);
    const fetcher = makeNodeFsFetcher(BASE, readFile);
    const err = await fetcher('missing.puml').catch((e: unknown) => e) as IncludeResolveError;
    expect(err.message).toContain('ENOENT');
  });

  it('IncludeResolveError.url is the original target on ENOENT', async () => {
    const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
    const readFile = vi.fn().mockRejectedValue(enoent);
    const fetcher = makeNodeFsFetcher(BASE, readFile);
    const err = await fetcher('missing.puml').catch((e: unknown) => e) as IncludeResolveError;
    expect(err.url).toBe('missing.puml');
  });
});
