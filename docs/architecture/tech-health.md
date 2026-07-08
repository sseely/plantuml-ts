# Technology Health

EOL and CVE assessment for the distinct runtimes/frameworks found in the
inventory. Checked July 2026 against endoflife.date, official release
policies, and CVE data (SentinelOne / GitHub Advisory). Confidence:
**MEDIUM** — versions are read from `package.json` ranges, not resolved
lockfiles, except where noted.

| Repo | Component | Version | EOL Date | CVEs (High+) | Action |
|------|-----------|---------|----------|--------------|--------|
| plantuml-ts | Node.js (target) | 18+ (README); local dev 25.2.1 | Node 18 EOL Apr 2025; 20 EOL 2026 | — | Update available — target Node 24 LTS |
| plantuml-ts | TypeScript | ^5.4 | 5.x superseded by 6.0 (Mar 2026) | — | Update available |
| plantuml-ts | Vite | ^5.0 | v5 no longer security-supported | — | Update available — Vite 6.4+/7.3+ |
| plantuml-ts | Vitest | ^1.0 | 1.x unsupported (current 4.1) | — | Update available |
| plantuml-ts | KaTeX | ^0.16.45 | supported line | CVE-2025-23207 (XSS, fixed 0.16.21) | OK — pinned range already patched |
| plantuml-ts | jsonc-parser | ^3.3.1 | supported | — | OK |
| plantuml-ts | Playwright | ^1.40 | rolling | — | Update available (minor) |
| graphviz-ts | Node.js (engines) | 26.3.1 | Node 26 → LTS Oct 2026 | — | OK (Current line) |
| graphviz-ts | TypeScript | ^6.0 + native-preview 7.x | current | — | OK |
| graphviz-ts | esbuild | ^0.28.1 | rolling | — | OK |
| graphviz-ts | Vitest | ^4.1.9 | current | — | OK |
| graphviz-ts | Peggy | ^5.0 | current | — | OK |
| plantuml | JVM / PlantUML | 1.2026.7beta3 | upstream, not shipped here | (upstream-tracked) | N/A — reference only |

## Notes and reasoning

### Node.js
Node 18 (the README's stated floor) reached **EOL in April 2025** and
Node 20 EOLs in 2026. The **Active LTS is Node 24** (EOL Apr 30 2028;
enters Maintenance Oct 2026). Node 22 is Maintenance LTS (EOL Apr 2027).
Node 26 (graphviz-ts's `engines` pin) is the **Current** line, promoted
to LTS in October 2026. From Node 27 the odd/even distinction is dropped
— annual April majors, LTS every October.
**Recommendation:** raise plantuml-ts's supported floor to Node 24 LTS;
graphviz-ts's Node 26 pin is fine but is a Current (not yet LTS) line.

### TypeScript
**TypeScript 6.0 shipped March 2026** (6.0.3 on Apr 16 2026) as the last
JS-based compiler, a transition release toward the Go-based **TS 7.0**
(native port, mid/late 2026). 6.0 turns `--strict` on by default, drops
ES5 targets and classic Node module resolution. plantuml-ts on `^5.4` is
a major behind; graphviz-ts is already on `^6.0` and trialing the TS 7
native preview (`@typescript/native-preview`).
**Recommendation:** plan the 5.4 → 6.0 migration for plantuml-ts
(strict-by-default and module-resolution changes are the main risks).

### Vite
**Vite 5 is no longer receiving security support.** Supported lines are
Vite 6.4+, 7.3+, and 8.0+ (8.0 swaps esbuild/Rollup for Rolldown/Oxc).
Vite 7 dropped Node 18. plantuml-ts is on `^5.0`.
**Recommendation:** upgrade to Vite 7.x (requires Node ≥ 20).

### Vitest
Vitest **1.x is EOL**; only 4.1 (and the immediately prior minor/major)
receive fixes. plantuml-ts is on `^1.0`; graphviz-ts on `^4.1.9`.
**Recommendation:** upgrade plantuml-ts to Vitest 4.x (coincides with
Vite upgrade; the two share a release train).

### KaTeX — the one CVE that matters
**CVE-2025-23207** — XSS in `renderToString` via malicious `\htmlData`
commands, affecting KaTeX **< 0.16.21**. plantuml-ts pins **`^0.16.45`**,
which is already past the fix, so the dependency is **not vulnerable** as
specified. Keep it pinned ≥ 0.16.21. If plantuml-ts ever renders
untrusted math with the `trust` option enabled, also forbid `\htmlData`
per the advisory's mitigation.
Source: [CVE-2025-23207 (SentinelOne)](https://www.sentinelone.com/vulnerability-database/cve-2025-23207/).

### Summary
No **active** high-severity CVE exposure was found in the specified
dependency ranges (the one relevant CVE, KaTeX XSS, is already patched by
the pinned range). The health gap is **staleness, not vulnerability**:
plantuml-ts's build/test toolchain (Node floor, TypeScript, Vite,
Vitest) trails current supported lines by roughly one major each and
should be modernized together. graphviz-ts is current.

## Sources
- [Node.js — endoflife.date](https://endoflife.date/nodejs)
- [Node.js Releases (nodejs.org)](https://nodejs.org/en/about/previous-releases)
- [Announcing TypeScript 6.0 (Microsoft)](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [Vite Releases / support policy](https://vite.dev/releases)
- [Vitest Releases / support policy](https://github.com/vitest-dev/vitest/releases)
- [CVE-2025-23207: KaTeX XSS (SentinelOne)](https://www.sentinelone.com/vulnerability-database/cve-2025-23207/)
