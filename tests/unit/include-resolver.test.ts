import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchInclude,
  prefetchIncludes,
  MapIncludeStore,
  CspIncludeError,
  CorsIncludeError,
  IncludeResolveError,
  CircularIncludeError,
  StdlibNotBundledError,
} from '../../src/core/include-resolver.js';

// ---------------------------------------------------------------------------
// prefetchIncludes — the async half of the include seam. It FILLS a store for
// the sync interpreter; it no longer splices text into the source (that pre-pass
// could not see conditionals — see the module header).
// ---------------------------------------------------------------------------

describe('prefetchIncludes — stdlib angle-bracket includes', () => {
  it('throws StdlibNotBundledError instead of silently dropping the line', async () => {
    const source = '!include <tupadr3/common>\nstart\n:step;';
    const fetcher = vi.fn().mockResolvedValue('');
    await expect(prefetchIncludes(source, fetcher)).rejects.toBeInstanceOf(StdlibNotBundledError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('names the bundle a host must supply', async () => {
    const err = await prefetchIncludes('!include <aws/common>', vi.fn())
      .catch((e: unknown) => e) as StdlibNotBundledError;
    expect(err.bundle).toBe('aws');
    expect(err.path).toBe('aws/common');
    expect(err.message).toContain('includeStore');
  });

  it('resolves through the seam when the host supplies the bundle', async () => {
    const base = new MapIncludeStore({ '<aws/common>': '!define AWS_COLOR #FF9900' });
    const fetcher = vi.fn();
    const store = await prefetchIncludes('!include <aws/common>', fetcher, base);
    expect(store.get('<aws/common>')).toBe('!define AWS_COLOR #FF9900');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('accepts a bundle keyed without the angle brackets', async () => {
    const base = new MapIncludeStore({ 'aws/common': 'AWS' });
    const store = await prefetchIncludes('!include <aws/common>', vi.fn(), base);
    expect(store.get('<aws/common>')).toBe('AWS');
  });
});

describe('prefetchIncludes — no !include directives', () => {
  it('returns an empty store and never calls the fetcher', async () => {
    const fetcher = vi.fn();
    const store = await prefetchIncludes('@startuml\nA -> B\n@enduml', fetcher);
    expect(store.get('anything')).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('prefetchIncludes — single !include', () => {
  it('stores the fetched content under the exact target', async () => {
    const source = '@startuml\n!include https://example.com/common.puml\nBob -> Alice\n@enduml';
    const fetcher = vi.fn().mockResolvedValue('skinparam monochrome true');
    const store = await prefetchIncludes(source, fetcher);
    expect(store.get('https://example.com/common.puml')).toBe('skinparam monochrome true');
  });

  it('calls the fetcher with the exact URL from the directive', async () => {
    const url = 'https://example.com/shared/colors.puml';
    const fetcher = vi.fn().mockResolvedValue('');
    await prefetchIncludes(`!include ${url}`, fetcher);
    expect(fetcher).toHaveBeenCalledWith(url);
  });

  it('strips the !block suffix before fetching', async () => {
    const fetcher = vi.fn().mockResolvedValue('@startuml\nA -> B\n@enduml');
    const store = await prefetchIncludes('!include foo.puml!MYID', fetcher);
    expect(fetcher).toHaveBeenCalledWith('foo.puml');
    expect(store.get('foo.puml')).toContain('A -> B');
  });

  it('fetches !include_once / !include_many / !includeurl targets too', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    await prefetchIncludes('!include_once a\n!include_many b\n!includeurl https://c/d', fetcher);
    const calls = fetcher.mock.calls as [string][];
    expect(calls.map((c) => c[0])).toEqual(['a', 'b', 'https://c/d']);
  });
});

describe('prefetchIncludes — !includesub', () => {
  it('fetches the file named by the `file!bloc` form', async () => {
    const fetcher = vi.fn().mockResolvedValue('!startsub S\nA -> B\n!endsub');
    const store = await prefetchIncludes('!includesub shared.puml!S', fetcher);
    expect(fetcher).toHaveBeenCalledWith('shared.puml');
    expect(store.get('shared.puml')).toContain('!startsub S');
  });

  it('never fetches for the bare `!includesub name` form (a same-source sub)', async () => {
    const fetcher = vi.fn();
    await prefetchIncludes('!startsub S\nA -> B\n!endsub\n!includesub S', fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('prefetchIncludes — multiple !include directives', () => {
  it('fetches every target, in document order', async () => {
    const source = [
      '@startuml',
      '!include https://a.example.com/a.puml',
      '!include https://b.example.com/b.puml',
      '@enduml',
    ].join('\n');

    const fetcher = vi.fn()
      .mockResolvedValueOnce('A -> B')
      .mockResolvedValueOnce('B -> C');

    const store = await prefetchIncludes(source, fetcher);
    expect(store.get('https://a.example.com/a.puml')).toBe('A -> B');
    expect(store.get('https://b.example.com/b.puml')).toBe('B -> C');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://a.example.com/a.puml');
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://b.example.com/b.puml');
  });

  it('fetches a diamond-included file only once', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url === 'a' || url === 'b') return Promise.resolve('!include c');
      if (url === 'c') return Promise.resolve('leaf');
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    await prefetchIncludes('!include a\n!include b', fetcher);
    const calls = fetcher.mock.calls as [string][];
    expect(calls.filter((c) => c[0] === 'c')).toHaveLength(1);
  });
});

describe('prefetchIncludes — fetcher error propagation', () => {
  it('propagates errors thrown by the fetcher', async () => {
    const source = '!include https://bad.example.com/missing.puml';
    const fetcher = vi.fn().mockRejectedValue(
      new IncludeResolveError('not found', 'https://bad.example.com/missing.puml'),
    );
    await expect(prefetchIncludes(source, fetcher)).rejects.toBeInstanceOf(IncludeResolveError);
  });
});

describe('prefetchIncludes — whitespace handling', () => {
  it('trims trailing whitespace from the URL in the directive', async () => {
    const fetcher = vi.fn().mockResolvedValue('content');
    await prefetchIncludes('!include https://example.com/file.puml   ', fetcher);
    expect(fetcher).toHaveBeenCalledWith('https://example.com/file.puml');
  });

  it('accepts a leading-indented directive', async () => {
    const fetcher = vi.fn().mockResolvedValue('content');
    await prefetchIncludes('  !include indented.puml', fetcher);
    expect(fetcher).toHaveBeenCalledWith('indented.puml');
  });
});

// ---------------------------------------------------------------------------
// prefetchIncludes — recursive expansion
// ---------------------------------------------------------------------------

describe('prefetchIncludes — recursive expansion', () => {
  it('follows !include directives inside fetched content', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url === 'a') return Promise.resolve('!include b');
      if (url === 'b') return Promise.resolve('hello');
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    const store = await prefetchIncludes('!include a', fetcher);
    expect(store.get('a')).toBe('!include b');
    expect(store.get('b')).toBe('hello');
  });

  it('follows multiple levels of nesting', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url === 'root') return Promise.resolve('!include mid');
      if (url === 'mid') return Promise.resolve('!include leaf');
      if (url === 'leaf') return Promise.resolve('deep content');
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    const store = await prefetchIncludes('!include root', fetcher);
    expect(store.get('leaf')).toBe('deep content');
  });

  it('OVER-FETCHES: a target inside a false !ifdef branch is fetched anyway', async () => {
    // The documented divergence — the prefetch is a text scan, not an evaluation.
    // The interpreter still executes only the live branch.
    const fetcher = vi.fn().mockResolvedValue('never used');
    await prefetchIncludes('!ifdef NOPE\n!include dead.puml\n!endif', fetcher);
    expect(fetcher).toHaveBeenCalledWith('dead.puml');
  });
});

// ---------------------------------------------------------------------------
// prefetchIncludes — circular include detection
// ---------------------------------------------------------------------------

describe('prefetchIncludes — circular include detection', () => {
  it('throws CircularIncludeError on a direct self-include (a → a)', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url === 'a') return Promise.resolve('!include a');
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    await expect(prefetchIncludes('!include a', fetcher))
      .rejects.toBeInstanceOf(CircularIncludeError);
  });

  it('throws CircularIncludeError for an indirect cycle (a → b → a)', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url === 'a') return Promise.resolve('!include b');
      if (url === 'b') return Promise.resolve('!include a');
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    await expect(prefetchIncludes('!include a', fetcher))
      .rejects.toBeInstanceOf(CircularIncludeError);
  });

  it('CircularIncludeError.url is the URL that closed the cycle', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url === 'a') return Promise.resolve('!include a');
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    const err = await prefetchIncludes('!include a', fetcher)
      .catch((e: unknown) => e) as CircularIncludeError;
    expect(err.url).toBe('a');
  });

  it('CircularIncludeError.chain contains the inclusion path leading to the cycle', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url === 'a') return Promise.resolve('!include b');
      if (url === 'b') return Promise.resolve('!include a');
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    const err = await prefetchIncludes('!include a', fetcher)
      .catch((e: unknown) => e) as CircularIncludeError;
    expect(err.chain).toEqual(['a', 'b']);
  });

  it('CircularIncludeError message contains the full chain including the repeated url', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url === 'a') return Promise.resolve('!include b');
      if (url === 'b') return Promise.resolve('!include a');
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    const err = await prefetchIncludes('!include a', fetcher)
      .catch((e: unknown) => e) as CircularIncludeError;
    expect(err.message).toContain('a');
    expect(err.message).toContain('b');
    expect(err.message).toContain('→');
  });

  it('CircularIncludeError.name is CircularIncludeError', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url === 'a') return Promise.resolve('!include a');
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    const err = await prefetchIncludes('!include a', fetcher)
      .catch((e: unknown) => e) as CircularIncludeError;
    expect(err.name).toBe('CircularIncludeError');
  });
});

// ---------------------------------------------------------------------------
// fetchInclude — HTTP error path
// ---------------------------------------------------------------------------

describe('fetchInclude — HTTP error response', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws IncludeResolveError for a non-OK HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));
    await expect(fetchInclude('https://example.com/missing.puml'))
      .rejects.toBeInstanceOf(IncludeResolveError);
  });

  it('includes the HTTP status in the error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));
    const err = await fetchInclude('https://example.com/missing.puml')
      .catch((e: unknown) => e) as IncludeResolveError;
    expect(err.message).toContain('404');
  });

  it('includes the URL in the IncludeResolveError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));
    const url = 'https://example.com/missing.puml';
    const err = await fetchInclude(url).catch((e: unknown) => e) as IncludeResolveError;
    expect(err.url).toBe(url);
  });
});

// ---------------------------------------------------------------------------
// fetchInclude — successful response
// ---------------------------------------------------------------------------

describe('fetchInclude — successful response', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the response text on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('skinparam monochrome true\n'),
    }));
    const result = await fetchInclude('https://example.com/shared.puml');
    expect(result).toBe('skinparam monochrome true\n');
  });
});

// ---------------------------------------------------------------------------
// fetchInclude — CORS error path (GitHub raw URL pattern)
// ---------------------------------------------------------------------------

describe('fetchInclude — CORS error for GitHub raw URLs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const githubUrls = [
    'https://raw.githubusercontent.com/user/repo/main/diagram.puml',
    'https://gist.githubusercontent.com/user/abc123/raw/file.puml',
    'https://raw.github.com/user/repo/main/file.puml',
  ];

  for (const url of githubUrls) {
    it(`throws CorsIncludeError for ${new URL(url).hostname}`, async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      await expect(fetchInclude(url)).rejects.toBeInstanceOf(CorsIncludeError);
    });
  }

  it('CorsIncludeError message identifies a server-side CORS issue and does not suggest a CSP fix', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const url = 'https://raw.githubusercontent.com/user/repo/main/file.puml';
    const err = await fetchInclude(url).catch((e: unknown) => e) as CorsIncludeError;
    expect(err.message).toMatch(/CORS/i);
    // Must not suggest adding to connect-src — that would mislead the user
    expect(err.message).not.toContain('connect-src');
    expect(err.url).toBe(url);
  });

  it('CorsIncludeError name is CorsIncludeError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await fetchInclude(
      'https://raw.githubusercontent.com/user/repo/main/file.puml',
    ).catch((e: unknown) => e) as CorsIncludeError;
    expect(err.name).toBe('CorsIncludeError');
  });
});

// ---------------------------------------------------------------------------
// fetchInclude — generic non-CORS fetch failure
// ---------------------------------------------------------------------------

describe('fetchInclude — generic fetch failure (non-GitHub URL)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws IncludeResolveError for a non-GitHub URL that fails to fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchInclude('https://example.com/file.puml'))
      .rejects.toBeInstanceOf(IncludeResolveError);
  });

  it('IncludeResolveError carries the URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const url = 'https://example.com/file.puml';
    const err = await fetchInclude(url).catch((e: unknown) => e) as IncludeResolveError;
    expect(err.url).toBe(url);
  });
});

// ---------------------------------------------------------------------------
// fetchInclude — CSP error path (browser environment simulation)
// ---------------------------------------------------------------------------

describe('fetchInclude — CSP violation (browser env)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeBrowserEnv(onCspListen: (handler: (evt: Event) => void) => void): void {
    vi.stubGlobal('window', {
      addEventListener: (type: string, handler: EventListener) => {
        if (type === 'securitypolicyviolation') {
          onCspListen(handler);
        }
      },
      removeEventListener: vi.fn(),
    });
  }

  it('throws CspIncludeError when a securitypolicyviolation event fires before fetch failure', async () => {
    const url = 'https://cdn.example.com/styles.puml';
    let capturedHandler: ((evt: Event) => void) | null = null;
    makeBrowserEnv((h) => { capturedHandler = h; });

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      capturedHandler?.({ blockedURI: 'https://cdn.example.com' } as unknown as Event);
      return Promise.reject(new TypeError('Failed to fetch'));
    }));

    await expect(fetchInclude(url)).rejects.toBeInstanceOf(CspIncludeError);
  });

  it('CspIncludeError message includes the connect-src directive with the origin', async () => {
    const url = 'https://cdn.example.com/styles.puml';
    let capturedHandler: ((evt: Event) => void) | null = null;
    makeBrowserEnv((h) => { capturedHandler = h; });

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      capturedHandler?.({ blockedURI: 'https://cdn.example.com' } as unknown as Event);
      return Promise.reject(new TypeError('Failed to fetch'));
    }));

    const err = await fetchInclude(url).catch((e: unknown) => e) as CspIncludeError;
    expect(err.requiredDirective).toContain('connect-src');
    expect(err.requiredDirective).toContain('https://cdn.example.com');
    expect(err.message).toContain('Content-Security-Policy');
  });

  it('CspIncludeError name is CspIncludeError', async () => {
    const url = 'https://cdn.example.com/styles.puml';
    let capturedHandler: ((evt: Event) => void) | null = null;
    makeBrowserEnv((h) => { capturedHandler = h; });

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      capturedHandler?.({ blockedURI: 'https://cdn.example.com' } as unknown as Event);
      return Promise.reject(new TypeError('Failed to fetch'));
    }));

    const err = await fetchInclude(url).catch((e: unknown) => e) as CspIncludeError;
    expect(err.name).toBe('CspIncludeError');
  });

  it('handles a non-URL blockedURI gracefully and falls through to IncludeResolveError', async () => {
    // Covers originOf()'s catch branch: new URL('relative/path') throws
    const url = 'https://cdn.example.com/styles.puml';
    let capturedHandler: ((evt: Event) => void) | null = null;
    makeBrowserEnv((h) => { capturedHandler = h; });

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      capturedHandler?.({ blockedURI: 'relative/path/that/is/not/a/url' } as unknown as Event);
      return Promise.reject(new TypeError('Failed to fetch'));
    }));

    // Origin check fails to match → falls through to IncludeResolveError (not CSP)
    await expect(fetchInclude(url)).rejects.toBeInstanceOf(IncludeResolveError);
  });
});

// ---------------------------------------------------------------------------
// Error class properties
// ---------------------------------------------------------------------------

describe('CspIncludeError — class properties', () => {
  it('stores the url', () => {
    const err = new CspIncludeError('https://example.com/file.puml', 'https://example.com');
    expect(err.url).toBe('https://example.com/file.puml');
  });

  it('requiredDirective includes the origin', () => {
    const err = new CspIncludeError('https://example.com/file.puml', 'https://example.com');
    expect(err.requiredDirective).toContain('https://example.com');
  });
});

describe('CorsIncludeError — class properties', () => {
  it('stores the url', () => {
    const url = 'https://raw.githubusercontent.com/user/repo/main/file.puml';
    const err = new CorsIncludeError(url);
    expect(err.url).toBe(url);
  });
});

describe('IncludeResolveError — class properties', () => {
  it('stores the url', () => {
    const err = new IncludeResolveError('Something went wrong', 'https://example.com/file.puml');
    expect(err.url).toBe('https://example.com/file.puml');
  });

  it('preserves the message', () => {
    const err = new IncludeResolveError('Something went wrong', 'https://example.com/file.puml');
    expect(err.message).toBe('Something went wrong');
  });
});

describe('CircularIncludeError — class properties', () => {
  it('stores the url', () => {
    const err = new CircularIncludeError('a', ['root']);
    expect(err.url).toBe('a');
  });

  it('stores the chain', () => {
    const err = new CircularIncludeError('a', ['root', 'mid']);
    expect(err.chain).toEqual(['root', 'mid']);
  });

  it('chain is readonly (array reference is frozen by spreading)', () => {
    const original = ['root'];
    const err = new CircularIncludeError('a', original);
    expect(err.chain).toEqual(['root']);
  });

  it('message includes the full path joined by →', () => {
    const err = new CircularIncludeError('a', ['root', 'mid']);
    expect(err.message).toContain('root → mid → a');
  });

  it('name is CircularIncludeError', () => {
    const err = new CircularIncludeError('a', []);
    expect(err.name).toBe('CircularIncludeError');
  });
});
