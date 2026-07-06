# Shape mechanism (P2/i6): ShapeType map + shielded/plaintext entities

Diagnosis for mission dot-oracle-sync, phase 2 iteration 6. Read in full:
`svek/SvekNode.java` (appendShape/appendShapeInternal/appendHtml/
appendLabelHtml/isShielded), `svek/image/EntityImageDescription.java`
(constructor shapeType switch, hideText, getShield),
`svek/GeneralImageBuilder.java` (leaf → EntityImage dispatch),
`decoration/symbol/USymbols.java`, `decoration/symbol/USymbolActor.java`,
`decoration/LinkType.java` (isDoubleDecorated),
`descdiagram/DescriptionDiagram.java` (makeDiagramReady/isUsecase),
`descdiagram/command/CommandLinkElement.java` (getDummy).

## Corrected seed facts

The mission brief's seed fact #2 is **wrong on one point, verified by
drill-down**: `hideText` is set in `EntityImageDescription`'s constructor as
`this.hideText = symbol == USymbols.INTERFACE;` — **only** the INTERFACE
USymbol gets `hideText = true`. Actor is not special-cased anywhere in
`EntityImageDescription` — `USymbolActor` extends `USymbolSimpleAbstract`,
matches none of the constructor's `if` branches (FOLDER/PACKAGE, HEXAGON,
USECASE/USECASE_BUSINESS, INTERFACE), and falls to the `else → RECTANGLE`
default with `hideText = false`. Confirmed via drill-down
`bivira-53-boja685` (usecase): `actor PlantUML` → oracle `sh0006
[shape=rect,...]` — plain rect, never shielded. "Actor-heavy corpus" is
still usecase's real blocker, but not via a per-actor shield rule — it's
because `usecase (...)` entities were emitting `shape=rect` instead of
`shape=ellipse` (the ShapeType map was simply unimplemented), confirmed
clean via `cevuji-49-bile305`: oracle `["ellipse","ellipse","ellipse",
"rect","rect","rect"]` vs ours (pre-fix) `["rect","rect","rect","rect",
"rect","rect"]` — three `usecase` entities, zero shield/plaintext
involved at all.

## 1. ShapeType map (EntityImageDescription constructor, lines ~123-134)

```java
if (symbol == FOLDER || symbol == PACKAGE)      shapeType = FOLDER;
else if (symbol == HEXAGON)                     shapeType = HEXAGON;
else if (symbol == USECASE || USECASE_BUSINESS) shapeType = OVAL;
else if (symbol == INTERFACE)
    shapeType = fixCircleLabelOverlapping() ? RECTANGLE_WITH_CIRCLE_INSIDE
                                             : RECTANGLE;
else                                             shapeType = RECTANGLE;
```

`fixCircleLabelOverlapping()` (`SkinParam.isTrue("fixcirclelabeloverlapping")`)
defaults **false** (unset skinparam) — confirmed by drill-down (`() INT`
with no skinparam produces the plain-shield RECTANGLE path, not
RECTANGLE_WITH_CIRCLE_INSIDE, which upstream renders *unconditionally* via
`appendHtml` regardless of shield size — see `SvekNode.appendShape`). We do
not implement the `fixcirclelabeloverlapping` skinparam this iteration
(consistent with other unimplemented skinparams in the ledger) — INTERFACE
is always the `RECTANGLE` branch here.

`SvekNode.appendShapeInternal` (the DOT `shape=` text for non-shielded
RECTANGLE/FOLDER/etc.): `FOLDER → shape=rect` (the folder tab is drawn in
the actual PNG renderer, not via graphviz's `shape=`, so FOLDER needs no DOT
divergence from plain `rect`), `HEXAGON → shape=hexagon`, `OVAL →
shape=ellipse`, `RECTANGLE → shape=rect` (the default, already our
behavior). `ROUND_RECTANGLE`/`OCTAGON`/`DIAMOND`/`CIRCLE`/
`RECTANGLE_PORT`/`RECTANGLE_HTML_FOR_PORTS` are never produced by
`EntityImageDescription` (they belong to state/activity/port EntityImage
classes, out of scope for description diagrams) — the emitter already
supports them (pre-existing `DotInputNodeShape` union) but description
layout never assigns them.

### Per-symbol shape table (our `USymbol` → emitted Svek shape)

| USymbol(s) | Svek ShapeType | Emitted `shape=` |
|---|---|---|
| `folder`, `package` | FOLDER | `rect` (unchanged — folder tab is render-only) |
| `hexagon` | HEXAGON | `hexagon` |
| `usecase`, `usecase-business` | OVAL | `ellipse` |
| `interface` | RECTANGLE (+ conditional shield) | `rect` (unshielded) or `plaintext` (shielded, §2) |
| `circle` | **not** INTERFACE — see note below | `rect` (unchanged) |
| everything else (`actor`, `actor-business`, `component`, `rectangle`, `node`, `frame`, `cloud`, `database`, `storage`, `artifact`, `card`, `file`, `queue`, `stack`, `agent`, `boundary`, `control`, `entity`, `person`, `label`, `collections`, `port`, `action`, `process`) | RECTANGLE | `rect` (unchanged — already our default) |

**`circle` note (ruled out as an interface-alias):** `USymbols.fromString(s,
skinParam)` maps the bare string `"circle"` to `USymbols.INTERFACE`, but
that helper is used for `descdiagram`'s *link-endpoint* shorthand
resolution (`CommandLinkElement.getDummy`) and other string-driven lookups
— **not** for the dedicated `circle` element keyword.
`CommandCreateElementFull.java:291-293` handles the `circle` keyword as its
own `LeafType.CIRCLE` with `usymbol = null`; `EntityImageDescription
.getUSymbol` then falls back to `getSkinParam().componentStyle()
.toUSymbol()` (the *default component* symbol, not INTERFACE) whenever
`entity.getUSymbol() == null`. So a bare `circle X` element actually
renders with the diagram's default *component* shape — surprising, but
verified from the source, and it already matches our current (unchanged)
default-rect behavior for the `circle` USymbol. Not touched this iteration.

## 2. Shield / plaintext mechanism (SvekNode.appendShape → appendHtml)

```java
if (type == RECTANGLE_WITH_CIRCLE_INSIDE) appendHtml(...);      // always
else if (type == RECTANGLE && isShielded()) appendHtml(...);    // conditional
else appendShapeInternal(...);                                  // plain shape=
```

Since `fixCircleLabelOverlapping` is always false here, INTERFACE is always
the `RECTANGLE && isShielded()` branch. `isShielded()`
(`SvekNode.java:262-272`): the `hasKal1()/hasKal2()` qualifier check is a
class-diagram-only association feature (never true for description-diagram
links), so for description diagrams `isShielded() ⇔ shield().isZero() ==
false`. `EntityImageDescription.getShield` (lines 239-260):

**hideText condition:** `hideText = (symbol == USymbols.INTERFACE)` — set
once in the constructor, independent of any link/skinparam state. It is the
*only* gate on whether shield margins are computed at all; every other
condition below only *suppresses* (zeroes) an already-nonzero shield.

```java
if (hideText == false)                              return NONE;
if (isThereADoubleLink(leaf, links))                 return NONE;
if (!fixCircleLabelOverlapping                       // always true here
    && hasSomeHorizontalLinkVisible(leaf, links))     return NONE;
if (hasSomeHorizontalLinkDoubleDecorated(leaf, links)) return NONE;
// else: real (nonzero) margins from stereo/desc/asSmall dimensions
```

- `isThereADoubleLink`: the entity appears in ≥2 links that share the same
  *other* endpoint (`Set.add` returning `false`) — unconditional suppressor.
- `hasSomeHorizontalLinkVisible`: some link touching the entity has
  `getLength() == 1 && !isInvis()`. Confirmed the precise length semantics
  via drill-down `balopu-66-jagu236` (`node foo` + six link styles to bare
  targets `bar`..`bar5`): the `-left->` direction hint forces `queue = "-"`
  (`CommandLinkElement.executeArg`, ported P2/i4) → `length == 1` — the
  *only* one of the six links with length 1 — and its target (`bar1`, our
  `sh0008`) is the only bare target NOT shielded (`shape=rect`); the other
  five (length-2 `--`/`-[style]->` links, including the `[hidden]` one,
  whose `isInvis()` doesn't matter since its length is 2 anyway) are all
  shielded plaintext tables. This is airtight evidence for the length-1
  trigger, independent of `hidden`.
- `hasSomeHorizontalLinkDoubleDecorated`: some *length-1* link touching the
  entity has decor on both ends (`LinkType.isDoubleDecorated`:
  `decor1 != NONE && decor2 != NONE`) — suppresses even if that same link
  is hidden (no `!isInvis()` guard on this one, unlike the visible-link
  check above).

All three conditions are computable purely from `DescriptiveLink` data
already on the AST (`length`, `hidden`, `tailDecor`, `headDecor`, `from`,
`to`) — no parser changes needed for the shield logic itself.

### Bibliotekon port routing (`:h`)

`Bibliotekon.getNodeUid` (`svek/Bibliotekon.java:124-131`) appends `":h"` to
*every* DOT reference to a shielded node's uid (`if (result.isShielded())
uid = uid + ":h"`) — this applies uniformly to every edge endpoint that
touches a shielded node, regardless of direction, confirmed structurally by
the oracle sample (`sh0006->sh0007:h`, `sh0006->sh0009:h`, …). The `"h"`
port matches `appendLabelHtml`'s inner colored `<TD ... PORT="h">` cell —
the *only* port used by the shield mechanism (distinct from the
`RECTANGLE_HTML_FOR_PORTS`/`RECTANGLE_PORT` port-diagram mechanism, which
uses `PORT="P"` and a different table shape — out of scope, no ports
feature in our AST).

### Shield TABLE structure (`SvekNode.appendLabelHtml`)

3×3 grid: corner cells empty, edge cells `FIXEDSIZE` margin placeholders
(top/bottom row: width=1, height=marginY; middle row: width=marginX,
height=1), center cell `BGCOLOR` + `FIXEDSIZE` + the entity's own
width/height + `PORT="h"`. Margins are symmetric
(`new Margins(suppX/2, suppX/2, y, y)` — X1==X2, Y1==Y2) and derived from
real text-metric dimensions (`stereo`/`desc`/`asSmall` TextBlocks) that we
do not compute for these entities. **Per D1 (node width/height are
reported-not-asserted, Java-text-metric territory) and confirmed against
the comparator** (`tests/oracle/svek-dot.ts`'s `parseNodes` only reads the
top-level `shape=` attribute via regex — it never reads inside a `label=<…>`
HTML value, and `attr(a,'width'/'height')` legitimately returns `undefined`
→ 0 for a plaintext node with no bare `width=`/`height=` attribute, exactly
like the oracle's own shielded nodes), **the exact margin values are
cosmetic-only and ungated.** The emitter reproduces the TABLE's structure
byte-faithfully (3×3 grid, FIXEDSIZE cells, center `PORT="h"` cell sized to
the node's real width/height) but uses nominal constant margins (1px /
16px) rather than replicating the stereo/desc text-metric formula — a
deliberate, documented simplification, not a shortcut on the *shape*
mechanism itself.

## Ledger addition (out of scope this iteration — write-set boundary)

**Bare/quoted auto-created link endpoints hardcode `USymbol: 'rectangle'`**
(`link-grammar.ts#classifyEndpointShape`) instead of upstream's real
mechanism: `CommandLinkElement.getDummy` creates them as
`LeafType.STILL_UNKNOWN` (no USymbol), and `DescriptionDiagram
.makeDiagramReady` (`descdiagram/DescriptionDiagram.java:79-87`) mutes every
still-unknown leaf to `LeafType.DESCRIPTION` with `defaultSymbol =
isUsecase() ? getSkinParam().actorStyle().toUSymbol() : USymbols.INTERFACE`
— `isUsecase()` is true iff the diagram has any `LeafType.USECASE` entity or
any entity whose USymbol equals the skin's actor style (i.e., the diagram
already contains an actor or a usecase). So in a **usecase** diagram, bare
auto-created endpoints become **actors**; in a **component/deployment**
diagram (no actor/usecase present), they become **interface** (shielded,
per §2 above). Fixing this requires touching `link-grammar.ts`/`parser.ts`
(endpoint classification + a diagram-wide `isUsecase()` post-pass) and
possibly `ast.ts` (a still-unknown marker) — outside this iteration's
write-set (`layout.ts`/`layout-helpers.ts`/`graph-layout.types.ts`/
`svek-dot-emit.ts`). Confirmed affected: `balopu-66-jagu236` (component;
5 of 6 bare targets should be shielded-plaintext interfaces, currently
`rectangle`/`rect`). Logged to `ledger.md`.
