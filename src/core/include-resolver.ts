/**
 * The ASYNC half of the include seam.
 *
 * Provides:
 *   - prefetchIncludes()  — async pass that walks !include targets transitively
 *                           and fills an IncludeStore for the SYNC interpreter
 *   - fetchInclude()      — built-in browser fetcher with CORS/CSP error differentiation
 *   - CspIncludeError     — CSP connect-src violation with actionable directive hint
 *   - CorsIncludeError    — CORS failure with explanation and workaround suggestions
 *   - IncludeResolveError — generic resolution failure
 *   - CircularIncludeError — cycle detected in !include chain
 *
 * Batch SI5a-5 REPLACEMENT: `resolveIncludes()` — a TEXTUAL pre-pass that
 * spliced fetched content into the source BEFORE the preprocessor ran — is
 * gone. It was a structural divergence from upstream, which resolves includes
 * inside the interpreter: a pre-pass cannot see conditionals (an `!include`
 * inside a false `!ifdef` was fetched AND inlined anyway), cannot expand a
 * variable-built include path, and cannot express `!includesub` at all. The
 * interpreter now resolves includes itself (`tim/IncludeExecutor.ts`), reading
 * content from a sync `IncludeStore`; this module's job is to FILL that store.
 *
 * PLANTUML-TS DIVERGENCE — the prefetch OVER-FETCHES. It is a text scan, not an
 * evaluation: it cannot know which branch of an `!ifdef` will be taken, so it
 * fetches include targets in BOTH branches. The interpreter then executes only
 * the live one. Consequence: a file named by a dead branch is fetched (a wasted
 * request), and a fetch error there is still an error. Upstream, single-pass and
 * synchronous, never issues that request. Accepted: the alternative is either an
 * async interpreter (forbidden — `renderSync` is public API) or a re-run loop
 * that fetches, interprets, discovers new includes, and repeats.
 *
 * The converse limit: a path this scan cannot see statically — `!include $path`,
 * or an include inside a `!procedure` body invoked with computed arguments —
 * is not prefetched. Supply those through `options.includeStore` directly.
 *
 * CSP and CORS failures are distinct and require different remediation:
 *   - CSP: update the page's Content-Security-Policy connect-src directive.
 *   - CORS: the remote server must send Access-Control-Allow-Origin; CSP changes won't help.
 */

import {
  MapIncludeStore,
  StdlibNotBundledError,
  stdlibPathOf,
  type IncludeStore,
} from './tim/IncludeStore.js';

export {
  MapIncludeStore,
  IncludeNotFoundError,
  StdlibNotBundledError,
  EMPTY_INCLUDE_STORE,
  type IncludeStore,
} from './tim/IncludeStore.js';

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
// !include prefetch pass
// ---------------------------------------------------------------------------

/**
 * Every directive that names an external target. `!includeurl` / `!include_once`
 * / `!include_many` are spellings of `!include` (`TLineType#PATTERN_INCLUDE`);
 * `!includesub file!bloc` names a file too (the bare `!includesub name` form
 * does not — it replays a `!startsub` block from the same source).
 *
 * `!includedef` and `!import` are NOT scanned: neither names a fetchable file in
 * this port (see `IncludeExecutor#executeIncludeDef` / `#executeImport`).
 */
const INCLUDE_RE = /^\s*!include(?:url|_once|_many)?\s+(\S.*?)\s*$/;
const INCLUDESUB_RE = /^\s*!includesub\s+(\S.*?)\s*$/;

/** Strip the block selector: `!include foo.puml!SUB` fetches `foo.puml`. */
function fileOf(target: string): string {
  const idx = target.lastIndexOf('!');
  return idx === -1 ? target : target.substring(0, idx);
}

/** The include targets named on one line, if any. */
function targetOf(line: string): string | undefined {
  const include = INCLUDE_RE.exec(line);
  if (include !== null) return fileOf(include[1]!);

  const sub = INCLUDESUB_RE.exec(line);
  if (sub === null) return undefined;

  const what = sub[1]!;
  const idx = what.indexOf('!');
  // Bare `!includesub name`: a same-source !startsub block, nothing to fetch.
  return idx === -1 ? undefined : what.substring(0, idx);
}

async function prefetchInner(
  source: string,
  fetcher: IncludeFetcher,
  store: MapIncludeStore,
  visited: ReadonlySet<string>,
  chain: string[],
): Promise<void> {
  for (const line of source.split('\n')) {
    const url = targetOf(line);
    if (url === undefined) continue;

    if (visited.has(url)) throw new CircularIncludeError(url, chain);

    const stdlib = stdlibPathOf(url);
    if (stdlib !== undefined) {
      // The bundled-stdlib form. plantuml-ts vendors no stdlib (mission SI5b), and
      // a bundle is not something to go fetch over the network — a host supplies it
      // through the store. Present? Nothing to do. Absent? Say so, loudly: silently
      // dropping the line (what resolveIncludes did) left every macro the bundle
      // defines unexpanded and rendered a quietly wrong diagram.
      if (store.has(url)) continue;

      throw new StdlibNotBundledError(url, stdlib);
    }

    if (store.has(url)) continue; // already fetched (diamond include), or host-supplied

    const content = await fetcher(url);
    store.set(url, content);
    await prefetchInner(content, fetcher, store, new Set([...visited, url]), [...chain, url]);
  }
}

/**
 * Walk `source`'s `!include` / `!includesub` targets transitively and fetch each
 * one into an {@link IncludeStore}, so that the synchronous TIM interpreter can
 * resolve them (see the module header, and `tim/IncludeStore.ts`).
 *
 * Circular includes (direct or transitive) throw {@link CircularIncludeError}.
 * A `<bundle/thing>` target that `base` does not already carry throws
 * {@link StdlibNotBundledError} — this port vendors no stdlib.
 *
 * @param source  Raw PlantUML source (may contain include directives).
 * @param fetcher Async function resolving a target to its content.
 *                Defaults to the built-in {@link fetchInclude}.
 * @param base    Content the caller already has (stdlib bundles, in-memory
 *                files). Never fetched, never mutated — copied into the result.
 */
export async function prefetchIncludes(
  source: string,
  fetcher: IncludeFetcher = fetchInclude,
  base?: IncludeStore,
): Promise<IncludeStore> {
  const store = new BackedIncludeStore(base);
  await prefetchInner(source, fetcher, store, new Set<string>(), []);
  return store;
}

/** A {@link MapIncludeStore} that falls back to a read-only base store on a miss. */
class BackedIncludeStore extends MapIncludeStore {
  private readonly base: IncludeStore | undefined;

  constructor(base: IncludeStore | undefined) {
    super();
    this.base = base;
  }

  override get(path: string): string | undefined {
    return super.get(path) ?? this.base?.get(path);
  }

  override has(path: string): boolean {
    return this.get(path) !== undefined;
  }
}
