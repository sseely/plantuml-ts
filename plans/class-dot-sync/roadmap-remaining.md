# Remaining-fixture roadmap (triage 2026-07-10, post-iter-9)

Source: exhaustive read-only triage of every non-EQUAL fixture after
EQUAL reached 600. Denominator correction: the corpus now has **715**
class-tagged fixtures — 35 oracle-blind → **680 comparable**; the
brief's original 645 figure is stale. Exit bar = 680 minus validated
ledger entries. Remaining after iteration 9: **80 fixtures** across the
groups below (every slug accounted for; cross-referenced slugs noted).

Ordered queue (count · group · write-set status):

| # | Group | Slugs | WS |
|---|-------|-------|----|
| 1 | Arrow-decoration gaps (`#`,`^`,`o{`/`}o`, inline `#color;attr` before label colon) | cenubi-27-xova754, zerofa-77-caro506, zuramo-86-liku129, nixema-71-tuke505, nuvake-96-gofe203, xoxuni-96-fere626 | in |
| 2 | `$tag` + remove/restore selectors (incl. `@unlinked`) | doseko-41-mavu661, sevaxa-72-pudi231, pijode-83-tiba954, zuxoxu-54-pejo512, verufu-58-jile750, cejili-77-gepe377* | in |
| 3 | Nested-generic / self-qualified-name orphans | bavoxa-34-keje375, cuxebo-14-babu885, xemife-30-cada335 | in |
| 4 | Note-on-entity: same-side merge; `Class::member` targets; note-of-package point anchor | kugasi-68-josu446, sanusa-54-keda128, tenobo-24-liga464, dibinu-95-kavo178, jiceke-84-xoze695, cejili-77-gepe377*, pecabi-95-demu756, sanixi-31-nofa193 | in |
| 5 | Empty/stereotyped/hidden package placeholder anchor | daxeno-00-kasu166, dojanu-92-vizo468, delasa-80-jusu462, xitobu-41-lame230 | in |
| 6 | object-plugin dispatch case-collision (`Object <\|--` steals class diagrams) | fijali-69-pina030, rojoxi-79-vimu822, jinema-90-laga721, vuvico-92-keza999 | **needs maintainer: src/diagrams/object/index.ts** |
| 7 | Namespace-separator / qualified-name handling (custom sep, literal `::`/`.`) | fokudo-49-xiki231, lobofa-60-vexe031, nadono-22-gidu983, ledepo-11-muto607, vuresa-33-kumu160 | in |
| 8 | class-magma standalone-set ignores note targets (murotu/sosono blocker; gatula's variant is core/magma.ts) | murotu-83-cebo380, sosono-24-vuro518 (class-magma.ts — in); gatula-10-bifu561 (core/magma.ts — **needs maintainer**) | mixed |
| 9 | `skinparam nodesep/ranksep` hardcoded to defaults | boseba-99-zopo693, cutasu-32-zete658, xogixe-78-zuro619, vegubu-29-bomu147 | in |
| 10 | Single-dash arrow length → minlen (incl. couple-circle hardcoded length:2) | givoli-70-rade072, nadepi-13-mufu566, tedeba-19-lisi250 (+ jixamu*, vuresa*) | in |
| 11 | Association-couple gaps (shared-vertex double-couple, note-on-couple) | begico-70-guva302, tunelu-64-xica833, vonago-16-zime449, pajoka-72-reju527, jixamu-89-ribo225*, temise-16-neco018 | in |
| 12 | Preprocessor: `!definelong` arity overloading | nagega-30-poso418 | in |
| 13 | `linetype ortho` → label should emit as xlabel | bujedi-30-cize673, jakapi-64-tine258 | in (svek-dot-emit additive) |
| 14 | Role-name `/` multiplicity toggle | mugobo-34-fede498, nenexe-35-zere033 | in |
| 15 | `[[url]]` on relationship/note eats label | fitini-85-kupo803, kutazo-40-texe886 | in |
| 16 | CSS `<style>` edge styleclass drops edge | zapibo-38-kope984, style-stereotype-on-arrow-4 | in |
| 17 | First stereotyped sibling package loses cluster | dativu-93-pona469 | in |
| 18 | Namespace name with `<img:...>` tag | jabama-09-kago823 | in |
| 19 | `!pragma backToLegacyPackage` | tibatu-28-jiro743 | in |
| 20 | Package name collides with class name (oracle folds to one node) | bijeru-39-vefi741 | in |
| 21 | Labeled self-loop circle routing | gujigi-63-roki030 (+ jixamu*) | in |
| 22 | Stacked stereotypes `<<A>><<B>>` | gabejo-44-juki791 | in |
| 23 | `"m1" text "m2"` label decomposition | tilipa-86-suxi130 | in |
| 24 | Malformed link-only members → oracle rejects (0 graphs) | cokeje-99-gede231 | in |
| 25 | Leading `@N` prefix (verify it's a real feature first) | majuva-44-luta965 | in, low priority |
| 26 | Unicode stereotype text (`\w` ASCII regex) | lacote-58-sozu269 | in, check blast radius |
| 27 | Unresolved — needs instrumented tracing | besepi-37-rori892, bicabi-42-coto932, corine-48-pemu761, xamule-03-jeda376 | presumed in |

(*) cross-referenced in multiple groups.

## Status updates (post-iters 10/11 + object fix, 2026-07-10)
- Group 4 DONE (9010471) except dibinu (→ isolated-root ordering edges) and cejili (→ group 2).
- Group 6 DONE (815a69e). Group 8 class-magma half DONE (e7a7192); gatula (core/magma.ts) still needs maintainer extension.
- rotisi-30-loge424 converged EQUAL (side effect of note fixes) — sprites ledger candidate WITHDRAWN.
- EQUAL 613/680 (90%).

## Ledger candidates / pending
- bixogo-47-xulu385, roxosu-00-pini153 — legend-region dispatch (ledgered pending fix; general fix needs core/dispatcher or descriptive-keywords — maintainer extension).
- cezaka-60-jado323 — `mix_*` entities (allowmixing); likely outside class write-set.
- xadado-92-lazo250 — residual now creole `{{ }}` embedding + container notes (out of scope for tim).

## Known stale-brief corrections
- jiceke-84-xoze695 is a note-on-member case, NOT a multi-couple case.
- lenunu-95-bame774 fixed (iter 9).
- Corpus 715/680/35, not 680/645/35.
