# T1 — Near-verbatim harness port (normalize + compare) + xmldom devDep

## Context
graphviz-ts's golden methodology (D1′/D7): xmldom-normalized trees, 6-sig-fig
numbers, sorted attrs, positional tree-walk with per-attribute numeric
tolerances, XPath-anchored `Diff[]`, 0.01 conformance band. With the klimt
emitter mirroring upstream, this ports near-verbatim — including the walker
that plan-A had to discard.

## Task
Create `tests/oracle/svg-conformance/normalize.ts` + `compare.ts` + tests.
Add `@xmldom/xmldom` to `devDependencies` only (D6).

**Port verbatim** from `~/git/graphviz-ts/test/golden/normalize.ts` (163 ln)
and `compare.ts` (~400 ln; read both fully first): `NUMERIC_ATTRS`,
`normalizeNumber` (toPrecision(6) + trailing-zero strip), `d`/`points`/
`viewBox`/`transform` re-serialization, `NormalizedNode`, `convertNode`,
`normalizeSvg`; `TOLERANCES` (rename classes if you wish but keep
`deterministic: 0.01`), `Diff`, `extractNumbers`, path-command structural
check, transform parsing, `compareNodes` walker, `compareSvg`, CLI entry.

**plantuml adaptations** (in normalize, journal them):
1. Resolve `style="k:v;…"` declarations into individual attrs (style wins
   over same-named presentation attr), then drop `style`.
2. Strip `data-*` attrs during conversion.
3. Skip comments/PI (the source already does — keep it).

## Write-set
- `tests/oracle/svg-conformance/{normalize,compare}.ts` (new)
- `tests/oracle/svg-conformance/{normalize,compare}.test.ts` (new)
- `package.json`, `package-lock.json` (devDep only)

## Read-set
- `~/git/graphviz-ts/test/golden/normalize.ts` (all), `compare.ts` (all)
- `../decisions.md` — D1′, D6, D7, adaptation seams, jar preamble sample
- One cached jar SVG: `test-results/dot-cache/component/<any>/in.svg`

## Interface contracts (consumed by T6, and Brief 2)
```ts
export interface NormalizedNode { type: 'element'|'text'; tag?: string;
  attrs?: Record<string,string>; text?: string; children?: NormalizedNode[] }
export function normalizeSvg(svg: string): NormalizedNode;
export interface Diff { path: string; actual: string; expected: string;
  delta?: number; tolerance: number }
export function compareSvg(actual: string, reference: string,
  toleranceClass: string, toleranceOverride?: number):
  { pass: boolean; diffs: Diff[] };
```

## Acceptance criteria
1. Given two byte-identical SVGs, when compared, then `pass` and `diffs=[]`.
2. Given `cx` drifted by 0.009, then pass; by 0.011, then one diff with
   `delta` and path like `svg/g[1]/ellipse[1]/@cx`.
3. Given jar `style="stroke:#181818;fill:none;"`, when normalized, then
   `stroke`/`fill` attrs present, no `style` key.
4. Given `<!--entity X-->`, `<?plantuml $version$?>`, `data-qualified-name`,
   when normalized, then all absent.
5. Given a real cached jar SVG, when normalized, then no throw, root `svg`.

## Observability / Rollback
N/A — pure library. / Reversible.

## Quality bar
Standard gates green; modules ≥90/90/90. Hook: files ≤500 ln (split compare
if needed); string-built regexes for `<>{}` classes.

## Commit
`feat(T1): port graphviz-ts golden SVG harness (0.01 conformance band)`
