import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchInclude,
  resolveIncludes,
  CspIncludeError,
  CorsIncludeError,
  IncludeResolveError,
} from '../../src/core/include-resolver.js';

// ---------------------------------------------------------------------------
// resolveIncludes — custom fetcher injection
// ---------------------------------------------------------------------------

describe('resolveIncludes — no !include directives', () => {
  it('returns the source unchanged when there are no !include lines', async () => {
    const source = '@startuml\nA -> B\n@enduml';
    const fetcher = vi.fn();
    const result = await resolveIncludes(source, fetcher);
    expect(result).toBe(source);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('resolveIncludes — single !include', () => {
  it('replaces the !include line with the fetched content', async () => {
    const source = '@startuml\n!include https://example.com/common.puml\nBob -> Alice\n@enduml';
    const fetcher = vi.fn().mockResolvedValue('skinparam monochrome true');
    const result = await resolveIncludes(source, fetcher);
    expect(result).toContain('skinparam monochrome true');
    expect(result).toContain('Bob -> Alice');
    expect(result).not.toContain('!include');
  });

  it('calls the fetcher with the exact URL from the directive', async () => {
    const url = 'https://example.com/shared/colors.puml';
    const source = `!include ${url}`;
    const fetcher = vi.fn().mockResolvedValue('');
    await resolveIncludes(source, fetcher);
    expect(fetcher).toHaveBeenCalledWith(url);
  });
});

describe('resolveIncludes — multiple !include directives', () => {
  it('expands all !include lines in document order', async () => {
    const source = [
      '@startuml',
      '!include https://a.example.com/a.puml',
      '!include https://b.example.com/b.puml',
      '@enduml',
    ].join('\n');

    const fetcher = vi.fn()
      .mockResolvedValueOnce('A -> B')
      .mockResolvedValueOnce('B -> C');

    const result = await resolveIncludes(source, fetcher);
    expect(result).toContain('A -> B');
    expect(result).toContain('B -> C');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://a.example.com/a.puml');
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://b.example.com/b.puml');
  });
});

describe('resolveIncludes — fetcher error propagation', () => {
  it('propagates errors thrown by the fetcher', async () => {
    const source = '!include https://bad.example.com/missing.puml';
    const fetcher = vi.fn().mockRejectedValue(
      new IncludeResolveError('not found', 'https://bad.example.com/missing.puml'),
    );
    await expect(resolveIncludes(source, fetcher)).rejects.toBeInstanceOf(IncludeResolveError);
  });
});

describe('resolveIncludes — whitespace handling', () => {
  it('trims trailing whitespace from the URL in the directive', async () => {
    const source = '!include https://example.com/file.puml   ';
    const fetcher = vi.fn().mockResolvedValue('content');
    await resolveIncludes(source, fetcher);
    expect(fetcher).toHaveBeenCalledWith('https://example.com/file.puml');
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
