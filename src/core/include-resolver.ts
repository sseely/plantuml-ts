/**
 * !include directive resolver for PlantUML source files.
 *
 * Provides:
 *   - resolveIncludes()   — async pre-pass that expands !include directives
 *   - fetchInclude()      — built-in browser fetcher with CORS/CSP error differentiation
 *   - CspIncludeError     — CSP connect-src violation with actionable directive hint
 *   - CorsIncludeError    — CORS failure with explanation and workaround suggestions
 *   - IncludeResolveError — generic resolution failure
 *   - CircularIncludeError — cycle detected in !include chain
 *
 * CSP and CORS failures are distinct and require different remediation:
 *   - CSP: update the page's Content-Security-Policy connect-src directive.
 *   - CORS: the remote server must send Access-Control-Allow-Origin; CSP changes won't help.
 */

export type IncludeFetcher = (url: string) => Promise<string>;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Thrown when a CSP connect-src policy blocks an include fetch.
 * The `requiredDirective` property contains the exact directive the page needs.
 */
export class CspIncludeError extends Error {
  readonly url: string;
  readonly requiredDirective: string;

  constructor(url: string, origin: string) {
    const directive = `connect-src 'self' ${origin}`;
    super(
      `CSP blocked !include fetch from ${url}.\n` +
      `Add the following to your Content-Security-Policy to allow it:\n` +
      `  Content-Security-Policy: ${directive}`,
    );
    this.name = 'CspIncludeError';
    this.url = url;
    this.requiredDirective = directive;
  }
}

/**
 * Thrown when a CORS failure prevents an include fetch.
 * Browsers hide the CORS detail — this error is inferred from URL patterns.
 * Updating CSP will not resolve a CORS issue.
 */
export class CorsIncludeError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(
      `CORS error fetching !include from ${url}.\n` +
      `The server does not send Access-Control-Allow-Origin headers; browsers block the response.\n` +
      `Updating your Content-Security-Policy will not help — this is a server-side CORS issue.\n` +
      `Options:\n` +
      `  • Bundle the include content at build time using a local resolver\n` +
      `  • Host the file on a server that sends CORS headers\n` +
      `  • Use a CORS proxy service`,
    );
    this.name = 'CorsIncludeError';
    this.url = url;
  }
}

/**
 * Thrown when include resolution fails for a reason other than CSP or CORS.
 */
export class IncludeResolveError extends Error {
  readonly url: string;

  constructor(message: string, url: string) {
    super(message);
    this.name = 'IncludeResolveError';
    this.url = url;
  }
}

/**
 * Thrown when a circular !include chain is detected.
 * The `chain` property contains the inclusion path leading to the cycle.
 */
export class CircularIncludeError extends Error {
  readonly url: string;
  readonly chain: readonly string[];

  constructor(url: string, chain: string[]) {
    super(
      `Circular !include detected: ${[...chain, url].join(' → ')}`,
    );
    this.name = 'CircularIncludeError';
    this.url = url;
    this.chain = chain;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GITHUB_RAW_PATTERN =
  /^https?:\/\/(?:raw\.githubusercontent\.com|gist\.githubusercontent\.com|raw\.github\.com)\//;

function isGithubRawUrl(url: string): boolean {
  return GITHUB_RAW_PATTERN.test(url);
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Built-in browser fetcher with CORS/CSP error differentiation
// ---------------------------------------------------------------------------

/**
 * Fetch a URL for !include resolution, with differentiated CORS and CSP error messages.
 *
 * In browser environments, listens for `securitypolicyviolation` events so that a
 * CSP-blocked fetch produces a message with the exact connect-src directive needed,
 * rather than the opaque "Failed to fetch" TypeError that both CSP and CORS produce.
 *
 * GitHub raw URLs (raw.githubusercontent.com, gist.githubusercontent.com,
 * raw.github.com) are detected and always reported as CORS errors, because those
 * servers do not send Access-Control-Allow-Origin headers.
 */
export async function fetchInclude(url: string): Promise<string> {
  const inBrowser =
    typeof window !== 'undefined' && typeof window.addEventListener === 'function';

  let cspViolationOrigin: string | null = null;

  const cspHandler = (evt: Event): void => {
    const secEvt = evt as SecurityPolicyViolationEvent;
    const blocked = secEvt.blockedURI ?? '';
    if (originOf(url) === originOf(blocked) || url.startsWith(blocked)) {
      cspViolationOrigin = originOf(url);
    }
  };

  if (inBrowser) {
    window.addEventListener('securitypolicyviolation', cspHandler);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new IncludeResolveError(
        `Failed to fetch !include ${url}: HTTP ${response.status} ${response.statusText}`,
        url,
      );
    }
    return await response.text();
  } catch (err) {
    // Yield the microtask queue so any synchronously queued CSP violation events can fire.
    await Promise.resolve();

    if (cspViolationOrigin !== null) {
      throw new CspIncludeError(url, cspViolationOrigin);
    }

    if (err instanceof IncludeResolveError) throw err;

    if (isGithubRawUrl(url)) {
      throw new CorsIncludeError(url);
    }

    throw new IncludeResolveError(
      `Failed to fetch !include ${url}: ${(err as Error).message ?? String(err)}`,
      url,
    );
  } finally {
    if (inBrowser) {
      window.removeEventListener('securitypolicyviolation', cspHandler);
    }
  }
}

// ---------------------------------------------------------------------------
// !include pre-pass
// ---------------------------------------------------------------------------

const INCLUDE_RE = /^!include\s+(\S.*?)\s*$/;

async function resolveIncludesInner(
  source: string,
  fetcher: IncludeFetcher,
  visited: ReadonlySet<string>,
  chain: string[],
): Promise<string> {
  const lines = source.split('\n');
  const resolved: string[] = [];

  for (const line of lines) {
    const match = INCLUDE_RE.exec(line);
    if (match !== null) {
      const url = match[1]!;
      if (visited.has(url)) {
        throw new CircularIncludeError(url, chain);
      }
      const content = await fetcher(url);
      const expanded = await resolveIncludesInner(
        content,
        fetcher,
        new Set([...visited, url]),
        [...chain, url],
      );
      resolved.push(expanded);
    } else {
      resolved.push(line);
    }
  }

  return resolved.join('\n');
}

/**
 * Expand !include directives in a PlantUML source string.
 *
 * Each `!include <url>` line is replaced with the content returned by `fetcher`.
 * Includes are resolved recursively — if fetched content itself contains
 * `!include` directives, those are expanded depth-first.
 *
 * Circular includes (direct or transitive) throw `CircularIncludeError`.
 *
 * @param source   Raw PlantUML source (may contain !include lines).
 * @param fetcher  Async function to resolve a URL to its content.
 *                 Defaults to the built-in fetchInclude.
 */
export async function resolveIncludes(
  source: string,
  fetcher: IncludeFetcher = fetchInclude,
): Promise<string> {
  return resolveIncludesInner(source, fetcher, new Set<string>(), []);
}
