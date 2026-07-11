# Architecture decisions (approved 2026-07-10)

## D1 — newpage mirrors NewpagedDiagram at the parser level

`ClassAst` gains `pages?: ClassAst[]` (absent for single-page sources).
`layoutClass` runs the full DOT+layout pipeline once per page (one layout
observer capture per page = parity); the renderer stacks pages vertically in
the single returned SVG. Rendering N pages in one SVG is a deliberate,
CHANGELOG-documented adaptation (upstream CLI emits N files; a library
returning one string cannot). Java: `classdiagram/ClassDiagramFactory.java:105`
registers `CommandNewpage`; `descdiagram/command/CommandNewpage.java:77-88`;
`NewpagedDiagram.java:61-162`.

## D2 — delete class-html-label.ts (mis-modeled)

`buildClassHtmlLabel` models a compartment `<TABLE>` DOT label that upstream
never emits — every normal class is `shape=rect,label=""`
(`svek/SvekNode.java#appendShape:132-166`). The module is dead (never
imported by layout.ts) AND unfaithful. Delete it and its unit test. Do not
rediscover/rewire it.

## D3 — shared files: additive-only

`src/core/graph-layout.types.ts` and `src/core/svek-dot-emit.ts` may gain
optional attrs (`constraint?`, `sametail?`, …) following the existing
`invis`/`xlabel` pattern. No change may alter emission for non-class types;
the description ratchet is the regression gate. Non-additive need = STOP.

## D4 — one oracle jar

`scripts/dot-sync-report.ts` resolves `$PLANTUML_JAR` →
`oracle/dist/plantuml-oracle.jar` → newest in `~/git/plantuml/build/libs`,
so the live report and committed goldens grade against the same
deterministic jar.

## D5 — denominator and ledger policy (exit bar updated 2026-07-10)

Exit bar = 100% of the 645 non-oracle-blind fixtures EQUAL, minus
validated divergences: every non-EQUAL fixture must be a ledgered,
maintainer-validated entry (mechanism + slugs) in ledger.md. The 35
`!pragma layout smetana|elk` fixtures stay excluded (report's `oracleBlind`
bucket). No silent denominator shrinking beyond the pragma rule; ledgering
is the ONLY sanctioned way a fixture may remain non-EQUAL. (Supersedes the
original ≥581/90% bar.)

## D6 — file splits first, as pure-move commits

Batch 1 lifts `parser.ts`'s COMMANDS table → `class-commands.ts` and
`layout.ts`'s DOT builders → `class-dot-graph.ts` as behavior-free commits
before any parity change (500-line-cap lesson from S1L).

---

# Verified upstream facts (Java citations — treat as locked)

- **Normal class node DOT:** `shNNNN [shape=rect,label="",width=…,height=…,
  color="#…"];` regardless of members. Chain:
  `svek/GraphvizImageBuilder.java:227,348-377` →
  `svek/GeneralImageBuilder.java:110-111` (`EntityImageClass`) →
  `svek/SvekNode.java:103-112,132-166`. Members/stereotype/generics/
  visibility affect only measured width/height
  (`svek/image/EntityImageClass.java:100-113`).
- **Degenerate skip:** `svek/GraphvizImageBuilder.java:211-223` —
  `isDegeneratedWithFewEntities(0)` → `EntityImageSimpleEmpty`;
  `(1)` (single root leaf, no links) → `EntityImageDegenerated`. No DOT is
  produced. Description's port: `description/layout-helpers.ts:410`
  (`degenerateSingleLeaf`), used at `description/layout.ts:487-489`.
- **Shielded/qualifier:** `svek/SvekNode.java:383-396` (`isShielded` — node
  is endpoint of a link with a Kal); emitted via `appendHtml`
  (`:148-151,233-267`) as a 3×3 `BORDER="0"` wrapper table, center TD
  `FIXEDSIZE + PORT="h"`. Edge endpoints get `:h` appended:
  `svek/Bibliotekon.java:124-133`; `abel/Link.java:219-231,569-575`.
- **Edge attrs, in order** (`svek/SvekEdge.java:391-483`): decoration
  (SIMPLEST strategy → always `arrowtail=none,arrowhead=none`,
  `decoration/LinkType.java:163-197`); `minlen=length-1` (`--`=1→0,
  `-->`=2→1; `ignoreHorizontalLinks && length==1` bumps to 2, `:412-415`);
  `color`; `label=<…>`/`xlabel=<…>`; `taillabel=<…>`; `headlabel=<…>`;
  `style=invis`; `constraint=false` (`:475-476`); `sametail` (`:478-479`).
  Labels are fixed-size HTML tables (`appendTable:504-523`).
- **useRankSame defaults FALSE** (`skin/SkinParam.java:1146-1148`) — the
  `rank=same` path (`SvekEdge.java:417,492-502`; `Cluster.java:575-638`)
  only activates via skinparam; default path always emits `minlen`.
- **Graph header** (`svek/DotStringFactory.java:116-205`): `digraph unix {`,
  computed `nodesep`/`ranksep` (mins 35px/60px, `:242-258`),
  `remincross=true`, `searchsize=500`, `splines=polyline|ortho`,
  `rankdir=LR` only for left-to-right skinparam. NO `node [...]`/`edge [...]`
  default blocks; no font attrs in DOT ever.
