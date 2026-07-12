# S4 — stdlib include surface audit

**Status:** done (2026-07-12). **Exit bar:** frequency table of `!include <…>`
across the pdiff corpus → bundle priority list. Met; see below.

**Headline:** the audit inverts SI5's assumed shape. Stdlib *bundling* is a
small, licensing-gated tail (~60 fixtures). The *preprocessor* half — the TIM
subsystem — is 3–4× larger, unblocked, spans every diagram type, and owns A1's
last open drill. **SI5 should be split: preprocessor first, bundling deferred
behind a maintainer licensing decision.**

## Measurement

Corpus: `~/git/pdiff/{input,dbhum}` — 5,688 `.puml` fixtures.

```sh
grep -rlEi '^\s*!include' ~/git/pdiff/input ~/git/pdiff/dbhum | wc -l
grep -rhoEi '^\s*!include(sub|url)?\s*<[^/>]+' ~/git/pdiff/input ~/git/pdiff/dbhum \
  | sed -E 's/.*<//' | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn
```

## Finding 1 — `!include` is rare: 69 / 5,688 fixtures (1.2%)

Stdlib includes are a long, thin tail. Distinct fixtures per bundle:

| Fixtures | Bundle | Notes |
|---|---|---|
| 19 | `tupadr3` | Font Awesome / Devicons / Google Material icons |
| 10 | `c4` | C4-PlantUML |
| 8 | `cloudinsight` | |
| 6 | `archimate` | |
| 5 | `aws` | + `awslib` 2, `awslib14` 2, `awslib10` 1 |
| 2 | `osa2`, `office`, `material2.1.19` | |
| 1 | `osa`, `kubernetes`, `elastic`, `cloudogu`, `classy-c4`, `azure` | |

Top 5 bundles cover ~48 of ~60 stdlib-include fixtures. **Bundle priority list
(the exit-bar deliverable): tupadr3 → c4 → cloudinsight → archimate → aws.**

This is a much smaller family than SI5's "biggest breadth unblocker" note
implied. It matches the A1 ledger, where the stdlib entry is 6 fixtures
(5 usecase + 1 component: bootstrap-0, fariba-82, kofuca-08, ruziru-69,
vivido-49, xusuxe).

## Finding 2 — the preprocessor half is the real mass

Directive usage, by distinct fixture:

| Fixtures | Directive | Implemented today? |
|---|---|---|
| 123 | `!define` | yes |
| 50 | `!procedure` | yes (incl. `!unquoted` / `!final`) |
| 48 | `!unquoted` | yes (as a procedure/function modifier) |
| 46 | `!function` | **partial** — call-site matching only; no declare/return |
| 42 | `!definelong` | yes (but see silito-78 below) |
| 38 | `!theme` | yes |
| 7 | `!startsub` | **no** |

Union is ~200 fixtures, cross-type. This is where SI5's value actually is.

## Finding 3 — TIM is started, not absent; the gap is sized

`src/core/tim/` exists and is a faithful partial port. Present: `FunctionsSet`,
`EaterDeclareProcedure`, `EaterFunctionCall` (call-site matching),
`TContext.expandProcedureCalls`, `expression.ts`, `legacy-define.ts`,
`split-top-level.ts`, and **2 builtins** (`%invoke_procedure`,
`%retrieve_procedure`). `preprocessor.ts` additionally owns `!define` /
`!definelong` / `!ifdef` / `!ifndef` / `!else` / `!endif` / `!undefine` /
`!theme` / skinparam+style blocks. `include-resolver.ts` handles `!include <url>`
with fetch, CSP/CORS surfacing, and circular detection.

Upstream (`~/git/plantuml/.../net/sourceforge/plantuml/tim/`) has **76 builtin
functions** and **~30 `Eater*` classes**. The delta — the SI5 preprocessor
work-list:

- **Loops:** `EaterForeach` / `EaterWhile` + `ExecutionContextForeach` /
  `ExecutionContextWhile` (`!foreach`, `!while`) — zero support today.
- **Return-functions:** `EaterDeclareReturnFunction`, `EaterReturn` —
  `!function` currently has no declare/return path (46 fixtures).
- **Variables:** `EaterAffectation` / `EaterAffectationDefine` (`!$var = …`),
  plus the scoping model (`TMemory` / `TMemoryGlobal` / `TMemoryLocal` /
  `VariableManager` / `TVariableScope`).
- **Sub-includes:** `EaterStartsub` / `EaterIncludesub` (`!startsub` /
  `!endsub` / `!includesub`) — 7 fixtures.
- **Builtins:** 74 of 76 missing. The A1-ledgered "TIM-json family"
  (zoriso-46, sidame) is exactly this — `!$json` vars + `%get_json_keys`
  (`GetJsonKey`, `GetJsonType`, `JsonAdd`, …).
- **`!elseif`** (`EaterElseIf`), `!import`, `!log`, `!assert`.
- **Angle-bracket include form:** `include-resolver.ts`'s `INCLUDE_RE` treats the
  argument as a URL; the stdlib `!include <bundle/thing>` form needs its own
  resolution path (this is the seam bundling would plug into).
- **silito-78** — A1's one open drill: `!definelong` emits 3 identical links
  where the oracle emits 1. Stopped without root cause per `diagnosis.md`
  (single-keyword dedup and node-dedup both ruled out; `WithLinkType.isSingle`
  confirmed dead code upstream). Lives in this subsystem; retire it here.

Reuse target is a direct 1:1 package port: upstream `tim/` → `src/core/tim/`.

## Finding 4 — bundling is licensing-gated (maintainer decision)

There is **no `stdlib/` directory in the repo**. Bundling is greenfield and means
vendoring third-party icon/macro libraries into an MIT-licensed npm package.
The top bundles carry their own upstream licenses, and the *artwork* license
routinely differs from the *macro glue* license (Font Awesome splits SIL OFL /
CC BY 4.0 / MIT; AWS Architecture Icons carry redistribution and modification
terms). CLAUDE.md requires MIT-compatible dependencies.

**Blocked on a maintainer ruling.** Options on the table: (a) vendor only what is
cleanly MIT-compatible and ledger the rest; (b) ship no assets and resolve
stdlib includes through the existing `include-resolver` callback so users supply
their own copies; (c) defer entirely. Per-bundle license audit completed
2026-07-12 — see below.

## License audit (2026-07-12)

> Research finding with primary-source citations, **not legal advice.** The AWS
> call is the consequential one and should be confirmed by the maintainer before
> anything is vendored.

| Bundle | Glue license | Artwork license | Verdict |
|---|---|---|---|
| `c4` | MIT | none (pure macro lib) | **VENDOR-OK** |
| `archimate` | MIT | none (pure macro lib) | **VENDOR-OK** |
| `tupadr3` | MIT | CC BY 4.0 (Font Awesome) / MIT (Devicons) / Apache-2.0 (Material) | **VENDOR-OK, attribution required** |
| `cloudinsight` | MIT | SIL OFL 1.1 + MIT | **VENDOR-OK, attribution required** |
| `aws`, `awslib`, `awslib14`, `awslib10` | MIT (code) | **CC BY-ND 2.0** | **NOT VENDORABLE** |

**AWS is the one blocker.** Two independent problems: (1) the icons are
CC BY-**ND** — "NoDerivatives" — and converting them to PlantUML sprites is
plausibly a derivative work; (2) the [AWS IP License
Terms](https://aws.amazon.com/legal/aws-ip-license-terms/) are explicitly
**non-sublicensable and non-transferable**, which is what redistributing inside
an npm package would require. Sources:
[aws-icons-for-plantuml LICENSE](https://github.com/awslabs/aws-icons-for-plantuml/blob/main/LICENSE),
[CC BY-ND 2.0](https://creativecommons.org/licenses/by-nd/2.0/).

**Everything else clears.** CC BY 4.0 (Font Awesome) and SIL OFL 1.1 both permit
redistribution and derivatives with notice; both are compatible with shipping
inside an MIT-licensed package as *mixed-license assets* — the MIT license
covers our code, the asset licenses ride along with a `stdlib/LICENSES.md` notice
file. Sources: [Font Awesome Free](https://fontawesome.com/license/free),
[C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML/blob/master/LICENSE),
[Archimate-PlantUML](https://github.com/plantuml-stdlib/Archimate-PlantUML/blob/master/LICENSE),
[cicon-plantuml-sprites](https://github.com/plantuml-stdlib/cicon-plantuml-sprites/blob/master/LICENSE),
[Devicons](https://github.com/devicons/devicon/blob/master/LICENSE),
[Material Icons](https://github.com/google/material-design-icons/blob/main/LICENSE).

**Coverage if we vendor the four clean bundles:** 43 of ~48 top-5 stdlib
fixtures. AWS costs us 10 fixtures total (`aws` 5 + `awslib` 2 + `awslib14` 2 +
`awslib10` 1) — and those stay reachable via the existing `include-resolver`
callback, so users in the AWS ecosystem can supply their own copies.

**Recommended ruling:** option (a) — vendor `c4`, `archimate`, `tupadr3`,
`cloudinsight` with a `stdlib/LICENSES.md` attribution file; ledger the AWS
family as an unsupported-include bucket with an error message pointing at the
resolver callback; note the exclusion in `DIVERGENCES.md`. Awaiting maintainer
sign-off.

## Consequences for the mission index

- **S4 → done.** Bundle priority list delivered (Finding 1).
- **SI5 splits.** `SI5a` preprocessor/TIM completion — unblocked, ~200 fixtures,
  cross-type, retires silito-78 and the TIM-json ledger entry. `SI5b` stdlib
  bundling — blocked on the licensing ruling, ~60 fixtures, and only ever worth
  the top-5 bundles.
- **D15 (C4) and the AWS/archimate breadth types** depend on `SI5b`, not `SI5a`.
