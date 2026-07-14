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
| `aws`, `awslib`, `awslib14`, `awslib10` | MIT (`LICENSE-CODE`) | CC BY-ND 2.0 (`LICENSE`) | **VENDOR-OK — verbatim only, attribution + license text required** |
| `bootstrap` (added 2026-07-13) | — | MIT (Bootstrap Icons, twbs/icons, per stdlib metadata v1.13.1) | **VENDOR-OK** |
| `cloudogu` (added 2026-07-13) | — | MIT (cloudogu/plantuml-cloudogu-sprites; stdlib metadata license field is empty but the source repo is MIT) | **VENDOR-OK** |

### AWS — CORRECTED 2026-07-12

**An earlier draft of this audit called AWS `NOT VENDORABLE`. That was wrong**,
and it was wrong twice over: the verdict was relayed from a research pass without
reading the license text, and it was internally inconsistent with the `tupadr3`
row (which was approved despite CC BY 4.0 artwork — the only delta is `ND`, and
verbatim vendoring is not a derivative).

Reading the actual license
([LICENSE](https://raw.githubusercontent.com/awslabs/aws-icons-for-plantuml/main/LICENSE),
fetched 2026-07-12) settles it:

- **§3(a)** grants the right "to reproduce the Work, to incorporate the Work into
  one or more Collective Works, and to reproduce the Work as incorporated in the
  Collective Works"; **§3(b)** grants distribution "including as incorporated in
  Collective Works."
- **§1(a)** defines a Collective Work as the Work "in its entirety in unmodified
  form" assembled with other independent works, and states it "will **not** be
  considered a Derivative Work for the purposes of this License."
- **§4(a)** — the clause that disposes of the licensing-conflict argument: "The
  above applies to the Work as incorporated in a Collective Work, but **this does
  not require the Collective Work apart from the Work itself to be made subject
  to the terms of this License.**" Our MIT package does **not** become CC BY-ND;
  only the AWS files stay CC BY-ND. This is the same mixed-license arrangement
  already accepted for `tupadr3`.
- The "**non-sublicensable**" objection is structurally answered: §4(a) forbids
  *sublicensing*, and we would not sublicense — under Creative Commons the
  downstream recipient is licensed **directly by the Licensor**. Redistribution
  inside a Collective Work is the mechanism the license itself contemplates.

The `ND` restriction bites **only on modification**. awslabs ships pre-built
sprite `.puml` files; copying those verbatim is reproduction, not derivation.

**Conditions if we vendor AWS:**
1. **Verbatim only.** Copy awslabs' built sprites. Never regenerate, re-encode,
   recolor, or resize — any of those makes a Derivative Work and voids the grant.
2. Ship the CC BY-ND 2.0 text (or its URI) alongside them (§4(a)).
3. Keep all copyright notices intact; credit Amazon "at least as prominent as
   such other comparable authorship credit" (§4(b)).
4. No technological measures restricting access/use (§4(a)).
5. Scope to `stdlib/aws/` with its own LICENSE — do **not** sweep the files under
   our MIT (§4(a): may not "alter or restrict the terms of this License").
6. Honor the §4(a) removal-on-request clause.

**Remaining open item (narrow):** ~~the AWS Architecture Icons *Terms of Use*
page has not been read~~ — **read 2026-07-13** (aws.amazon.com/architecture/icons):
the page states no icon-specific terms beyond a general permission ("We allow
customers and partners to use these toolkits and assets to create architecture
diagrams" incl. whitepapers/presentations/datasheets/posters) and links only to
AWS's generic /legal/ and /terms/ pages. No redistribution, modification, or
attribution conditions beyond the repo LICENSE were found. What we would vendor
is the awslabs/aws-icons-for-plantuml repo's pre-built `.puml` sprites, governed
by that repo's own LICENSE (CC BY-ND 2.0, analyzed above) — the icons-page terms
add nothing that contradicts the verdict.

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

**Coverage:** all five top bundles are vendorable, so vendoring covers ~48 of ~48
top-5 stdlib fixtures (and ~60 of ~60 including the ≤2-fixture tail, if we go
that far). **No bundle is excluded on licensing grounds.**

**Recommended ruling (revised):** vendor `c4`, `archimate`, `tupadr3`,
`cloudinsight`, **and `aws`/`awslib*`** — each under `stdlib/<bundle>/` carrying
its own upstream LICENSE file, with a consolidated `stdlib/LICENSES.md` listing
attributions. Our MIT covers our code; the vendored assets keep their own
licenses (explicitly permitted — CC BY-ND §4(a), and the analogous CC BY 4.0 /
SIL OFL terms). The only hard operational constraint is **verbatim copying** —
a build step that regenerates or re-encodes any sprite would void the AWS grant,
so the vendoring pipeline must be a straight file copy with a checksum, not a
transform.

Awaiting maintainer sign-off. Read the AWS Architecture Icons Terms of Use first
(see open item above).

## Consequences for the mission index

- **S4 → done.** Bundle priority list delivered (Finding 1).
- **SI5 splits.** `SI5a` preprocessor/TIM completion — unblocked, ~200 fixtures,
  cross-type, retires silito-78 and the TIM-json ledger entry. `SI5b` stdlib
  bundling — blocked on the licensing ruling, ~60 fixtures, and only ever worth
  the top-5 bundles.
- **D15 (C4) and the AWS/archimate breadth types** depend on `SI5b`, not `SI5a`.
