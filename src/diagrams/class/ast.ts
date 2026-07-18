/**
 * AST type definitions for PlantUML class diagrams.
 */

// ---------------------------------------------------------------------------
// Member types — split into class-member-ast.ts to keep this file under the
// line cap; re-exported here so `import type { Member, Visibility } from
// './ast.js'` still works for existing/expected import sites.
// ---------------------------------------------------------------------------

import type { Member, Visibility } from './class-member-ast.js';
export type { Member, Visibility };
import type { UrlInfo } from './class-url.js';
export type { UrlInfo };

import type { DiagramAnnotations } from '../../core/annotations/index.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';

// ---------------------------------------------------------------------------
// Map row types
// ---------------------------------------------------------------------------

/**
 * One `key => value` entry inside a `map Name { ... }` body
 * (`BodierMap`'s `Map<String, String>`). `key`/`value` mirror the raw
 * (trimmed) text either side of `=>` — upstream stores them without further
 * parsing (a map row's value is opaque display text, not a typed member).
 *
 * A row created from the linked-entry form (`key *-> dest`, no `=>`) has
 * `value` = `''` (upstream stores the NUL placeholder `"\0"` — the empty
 * string here has the same "no display value" meaning, since a map row
 * never legitimately has an actual empty-string value from the `=>` form:
 * `BodierMap#addFieldOrMethod` trims the right-hand side but never rejects
 * an empty result) and `linkedCode` set to the resolved destination
 * classifier's id.
 * @see ~/git/plantuml/.../cucadiagram/BodierMap.java
 */
export interface MapRow {
  key: string;
  value: string;
  /**
   * Destination classifier id for a `key *-> dest` linked row — set
   * alongside the {@link ClassDiagramAST.relationships} entry the same body
   * line produces (class-map-commands.ts). Absent for a plain `key => value`
   * row with no link token.
   */
  linkedCode?: string;
}

// ---------------------------------------------------------------------------
// JSON leaf value type — split into class-json-ast.ts to keep this file
// under the line cap; re-exported here so `import type { JsonNode } from
// './ast.js'` still works for existing/expected import sites.
// ---------------------------------------------------------------------------

import type { JsonNode } from './class-json-ast.js';
export type { JsonNode };

// ---------------------------------------------------------------------------
// Classifier types
// ---------------------------------------------------------------------------

export type ClassifierKind =
  | 'class'
  | 'abstract'
  | 'interface'
  | 'enum'
  | 'annotation'
  /**
   * `object Foo` — upstream has NO separate object-diagram engine;
   * `ClassDiagramFactory` registers `CommandCreateEntityObject` directly
   * alongside the class commands, so an object declaration is just another
   * classifier kind in this engine. Renders as a plain rect leaf
   * (`LeafType.OBJECT`), the same DOT shape as `class`.
   *
   * Members are untyped `field = value` display lines (set only by the
   * multi-line body form, `object Foo { field = value }` —
   * `CommandCreateEntityObjectMultilines`, a separate command from the
   * single-line one this file's `kind` value covers): reuses the existing
   * {@link Member} shape with `name` = field, `type` = the raw value string,
   * `visibility` fixed to `'+'` (object fields carry no visibility marker
   * upstream) — mirrors the pre-existing object-diagram parser's
   * `parseField` (`src/diagrams/object/parser.ts`).
   * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateEntityObject.java
   * @see ~/git/plantuml/.../abel/LeafType.java (OBJECT)
   */
  | 'object'
  /**
   * `map Name { key => value ... }` (upstream `CommandCreateMap`,
   * `LeafType.MAP`) — a table-shaped leaf, always multi-line (upstream has
   * no single-line map command). Body rows live in {@link Classifier.rows}
   * (`MapRow[]`), NOT `members` — a map row is a key/value table entry, not
   * a typed class member, and reuses none of {@link Member}'s shape.
   * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateMap.java
   * @see ~/git/plantuml/.../cucadiagram/BodierMap.java
   */
  | 'map'
  /**
   * `json Name { ... }` / `json Name value` (upstream `CommandCreateJson` /
   * `CommandCreateJsonSingleLine`, `LeafType.JSON`) — a table-shaped leaf
   * like `map`, rendering the parsed JSON tree in {@link Classifier.jsonValue}
   * (NOT `members`/`rows` — neither a typed member nor a flat row table).
   * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateJson.java
   * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateJsonSingleLine.java
   * @see ~/git/plantuml/.../cucadiagram/BodierJSon.java
   */
  | 'json'
  /**
   * `entity Foo` — a native class-factory keyword (upstream
   * `CommandCreateEntityObjectMultilines` / `CommandCreateClass`'s TYPE
   * alternation). Renders as a plain rect, like a class.
   */
  | 'entity'
  /**
   * `circle Foo` — a native class-factory keyword (upstream `CommandCreateClass`
   * TYPE alternation). Rendered as the small circle table (svek `shape=plaintext`),
   * the same node shape as a `()` interface lollipop.
   */
  | 'circle'
  /**
   * A descriptive element used as a *leaf* under `allowmixing` (upstream
   * `CommandCreateElementFull2` — `database`, `node`, `component`, `cloud`, …).
   * All render as a plain rect at the DOT level; the specific USymbol icon is a
   * rendering detail. The keyword is preserved in {@link Classifier.usymbol}.
   */
  | 'descriptive'
  /**
   * `usecase Foo` (LeafType.USECASE) — the only descriptive leaf whose svek node
   * shape is not rect: it renders as `shape=ellipse`.
   */
  | 'usecase'
  /** `state Foo` (LeafType.STATE) — classdiagram-only ALL_TYPES addition, not in descdiagram's `ALL_TYPES`; renders `shape=rect,style=rounded`. @see CommandCreateElementFull2.java:84,239-241 */
  | 'state'
  /**
   * An association node declared with `<> name` (upstream
   * CommandDiamondAssociation → LeafType.ASSOCIATION): a small diamond-shaped
   * n-ary/association-class connector, rendered as `shape=diamond`.
   */
  | 'association'
  /**
   * The tiny `shape=circle` connector node synthesised for an association-class
   * couple `(A,B) .. C`: it sits on the A–B association and the association
   * class C attaches to it. Not user-declared — created by the parser.
   */
  | 'assoc-circle'
  /**
   * The interface-lollipop leaf synthesised by the `Name ()-- Existing` /
   * `Existing --() Name` shorthand (upstream `CommandLinkLollipop`) — a
   * DIFFERENT command from both the general relationship arrow's single `(`/`)`
   * decor glyph (class-relationship-parser.ts, `CommandLinkClass`, which only
   * decorates an edge between two already-declared classifiers) and the
   * standalone `() "name"` declaration (class-commands.ts, shape=plaintext,
   * `CommandCreateElementParenthesis`). Renders as `shape=circle` (fixed 10x10
   * size, not text-measured) — see {@link Classifier.lollipopKind} for the
   * required/provided distinction. Not user-declared directly — created by
   * class-lollipop.ts.
   */
  | 'lollipop';

export interface Classifier {
  /** Unique identifier — alias if declared, otherwise display name. */
  id: string;
  display: string;
  kind: ClassifierKind;
  /** Generic type parameters, e.g. ['T', 'U']. */
  typeParams: string[];
  members: Member[];
  stereotype?: string;
  /**
   * G2 N24: the classifier's stereotype, split into individual labels and
   * filtered through `hide|show [<<pattern>>] stereotype(s)` directives
   * (`class-directives.ts#applyStereotypeHideShow`) -- populated for EVERY
   * classifier with a `stereotype`, even when no directive hides anything
   * (in which case it equals the full unfiltered split). Absent when
   * `stereotype` is undefined, or for AST literals built by hand (unit
   * tests) that bypass the post-parse directive pass --
   * `class-layout-helpers.ts#measureGenericClassifier` falls back to
   * `splitStereotypeLabels(stereotype)` unfiltered in that case.
   */
  visibleStereotypeLabels?: string[];
  /**
   * G2 N31: the trailing background/border-color spec off a classifier
   * declaration (`class-declaration-parser.ts#extractDecorations`'s own doc
   * comment for the full grammar -- bare `#colorname`, compound
   * `#part:color;...`, or a `##[style]colorname` LINECOLOR, space-joined
   * when both are present). Consumed by `class-geo-builders.ts` ->
   * `layout.ts#ClassifierGeo.color` -> `renderer-classifier-box.ts
   * #classifierFill`'s bare/`back:`-component background override; the
   * LINECOLOR (`##...`) and non-`back` compound parts (`text:`/`line:`/
   * `shadowing`) are parsed here but not yet consumed by any render-side
   * field -- named remainder, not this iteration's scope.
   * @see ~/git/plantuml/.../klimt/color/ColorParser.java:43-46 (simpleColor(BACK))
   */
  color?: string;
  namespace?: string;
  /**
   * G2 N15 (README item #7): the classifier's own `[[url]]` link -- either
   * from an inline `class Foo [[url]]` declaration suffix, or a later
   * standalone `url [of|for] Foo [is] [[url]]` statement (last-writer-wins,
   * a single field -- mirrors upstream `Entity#addUrl`'s plain `this.url =
   * url` assignment, NOT an accumulating list). Member-line `[[[url]]]`
   * urls are a separate, not-yet-built mechanism (see `class-url.ts`'s
   * module doc comment) and do not populate this field.
   * @see ~/git/plantuml/.../abel/Entity.java:262-281 getUrl99/addUrl
   */
  url?: UrlInfo;
  /**
   * `$tag` names attached via a classifier declaration (`class Foo $a $b`) —
   * upstream `Entity#stereotags()` (`Set<Stereotag>`). Consulted by
   * `remove`/`restore $tag` directives (class-directives.ts#computeRemovedIds).
   * @see ~/git/plantuml/.../stereo/Stereotag.java
   * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClassMultilines.java#addTags
   */
  tags?: string[];
  /** Set to true by hide/show post-processing when the circle badge should be suppressed. */
  hideCircle?: boolean;
  /**
   * G2 N26: entity-qualified `hide <entity> members|fields|attributes|
   * methods` (`CommandHideShowByGender`'s GENDER=entity-id form, applied
   * post-parse by `class-directives.ts#applyHideShowEntityDirectives`) --
   * reuses the SAME per-compartment suppression `preMeasureClassifiers`
   * (layout.ts) already computes for the diagram-global `hide empty
   * fields`/`hide empty methods`/`hide members` directives (N10), just
   * scoped to ONE classifier instead of every classifier. `members` sets
   * BOTH flags (jar-verified: an entity-scoped `hide X members` fully
   * collapses the box exactly like `hide fields` + `hide methods`
   * together, `nirija-04-veti140`).
   */
  suppressFields?: boolean;
  suppressMethods?: boolean;
  /**
   * For `kind: 'descriptive'`, the source keyword (`database`, `node`, …) — the
   * upstream USymbol. Preserved for rendering; does not affect DOT structure.
   */
  usymbol?: string;
  /**
   * For `kind: 'lollipop'` only — `'half'` (required interface / socket, a
   * half-circle notch) vs `'full'` (provided interface, a full circle), from
   * whether the two paren glyphs matched (`((`/`))`) or differed (`()`)
   * (`CommandLinkLollipop#getType`). SVG-rendering-only: the DOT node shape is
   * `circle` either way, so this does not affect layout/DOT parity.
   */
  lollipopKind?: 'full' | 'half';
  /**
   * For `kind: 'map'` only — the table rows collected from the body
   * (`key => value` / `key *-> dest`), in source order. Absent (not `[]`)
   * for a map with no parseable body rows, matching every other optional
   * AST field's absent-vs-empty convention in this file.
   * @see {@link MapRow}
   */
  rows?: MapRow[];
  /**
   * For `kind: 'json'` only — the parsed JSON value. Absent when the JSON
   * failed to parse: upstream creates the leaf entity FIRST (`executeArg0`)
   * then errors on invalid data WITHOUT calling `BodierJSon#setJson` — this
   * parser has no error-diagram machinery (see {@link MapRow}'s duplicate-
   * name doc for the same no-error-channel posture), so the leaf is kept and
   * measured as an empty json object instead (class-json-sizing.ts's
   * empty-node fallback).
   * @see {@link JsonNode}
   */
  jsonValue?: JsonNode;
  /**
   * G2 N2 (mechanism 3, entity/cluster/link `<g>` wrapping + uid assignment):
   * parse-time creation order, mirroring upstream `CucaDiagram#cpt1`'s
   * shared `AtomicInteger` (`getUniqueSequenceValue()`) -- stamped once, at
   * the single classifier-creation chokepoint (`parser.ts#ensureClassifier`),
   * for BOTH an explicit declaration (`class Foo`) and an auto-created
   * relationship-endpoint reference. Absent for a classifier built by hand
   * (most unit tests) or reached via a relationship-creation code path this
   * iteration did not wire (`class-map-commands.ts`/`class-declaration-
   * parser.ts`/`class-lollipop.ts`/`class-assoc-couple.ts` -- see
   * `class/renderer-uid.ts`'s doc comment for the exact/fallback gate this
   * feeds and `plans/g2-class-svg/ledger.md` N2 for the named remainder).
   */
  creationIndex?: number;
  /**
   * G2 N39: source-order count of `<style>` blocks that had ALREADY been
   * dispatched (`ParseState.currentLine` strictly AFTER the block's own
   * `stylePositions` entry) at the moment THIS classifier was created --
   * mirrors upstream `Entity#currentStyleBuilder`, a snapshot of the live
   * `StyleBuilder` captured at `CucaDiagram#createLeaf`/`#createGroup`
   * (`net/atmp/CucaDiagram.java:808-819`), NOT re-resolved against later
   * `<style>` block mutations. Stamped at the SAME chokepoint as
   * {@link creationIndex}
   * (`parser.ts#ensureClassifier`), unconditionally -- like `creationIndex`,
   * absent only for a classifier built by hand (most unit tests construct
   * `Classifier` literals directly, bypassing `ensureClassifier`). Computes
   * to `0` for every classifier when the source carries 0 or 1 `<style>`
   * blocks (the overwhelming majority) -- harmless, since `theme.ts
   * #classTagCascadeGenerations` is itself only ever populated for a
   * source with MORE than one block, so this value is never consulted in
   * that case. See `preprocessor.ts#PreprocessorResult.stylePositions`'s
   * doc comment for the full jar derivation.
   */
  styleGeneration?: number;
  /**
   * G2 N19: for `kind: 'assoc-circle'`/`kind: 'lollipop'` only -- the jar
   * `Entity.getName()` value used for the `<path id="...">` edge-id
   * attribute (`Link#idCommentForSvg()`), DISTINCT from `Classifier.id`
   * (this port's own internal AST key, `__assocN`/`__lolN`) and
   * `Classifier.display` (the rendered label, e.g. a lollipop's own name).
   * `"apoint" + N` for assoc-circle (`AbstractClassOrObjectDiagram
   * .Association`'s ctor, `getUniqueSequence("apoint")`); `"<existingRaw
   * Name>lol" + N` for lollipop (`CommandLinkLollipop`'s `suffix`,
   * `getUniqueSequence("lol")`). `N` is the RAW shared jar creation-counter
   * value at the phantom slot immediately preceding this classifier's own
   * `creationIndex` (see {@link phantomSlot}) -- NOT a dense rank, since
   * this string is directly OBSERVABLE in rendered SVG output (unlike
   * `ent%04d`/`lnkN` uids, which `renderer-uid.ts` deliberately dense-
   * renumbers). Absent for every other classifier kind, and for the
   * `(A,B) arrow (C,D)` double-couple (`associationClass`'s 4-entity
   * overload, module-level `insertPointBetween`) sub-case -- it burns cpt1
   * in a DIFFERENT relative order than the single-coupling `Association`
   * class this field's derivation matches exactly; named remainder,
   * `plans/g2-class-svg/ledger.md` N19. G2 N20: repeat-coupling
   * (`Association#createSecondAssociation`/`createInSecond`) DOES use this
   * SAME ctor-burn shape for its own SECOND circle (`new Association(...)`
   * inside `createSecondAssociation` runs the identical constructor) --
   * landed, see {@link invertedClassEdgeOldCreationIndex}/
   * {@link repeatCoupleInvisLinkCreationIndex} for the two ADDITIONAL
   * repeat-coupling-only burns this field alone doesn't cover.
   * @see ~/git/plantuml/.../objectdiagram/AbstractClassOrObjectDiagram.java:120-121,226,237-248,303-341
   * @see ~/git/plantuml/.../classdiagram/command/CommandLinkLollipop.java:180
   * @see ~/git/plantuml/.../abel/Link.java:106-114 idCommentForSvg
   */
  syntheticIdName?: string;
  /**
   * G2 N19: true when this classifier's `creationIndex` was preceded by a
   * discarded phantom counter slot -- mirrors `ClassNote.phantomSlot`'s
   * doc comment (G2 N15) exactly: jar's shared `cpt1` counter burns TWO
   * consecutive slots per single-coupled assoc-circle/lollipop entity (one
   * for {@link syntheticIdName}'s embedded value, one for the entity's own
   * uid), with no other creation event in between. `renderer-uid.ts` folds
   * the discarded slot into the SAME dense-renumbering merge as a note's
   * `phantomSlot` (a `type: 'phantom'` `Ranked` entry at `creationIndex -
   * 1`, consuming a rank without writing any uid map).
   */
  phantomSlot?: true;
  /**
   * G2 N19: for `kind: 'assoc-circle'` only -- true when this classifier's
   * OWN `creationIndex` slot must ALSO consume a numbering rank without
   * ever writing a `classifierUid` map entry, because
   * `EntityImageAssociationPoint#drawU` never wraps its `<ellipse>` in a
   * `<g id="...">` at all (a bare shape, no group/comment/uid -- unlike
   * `EntityImageLollipopInterface#drawU`, which DOES emit `<g class=
   * "entity" id="ent%04d">` via `UGroupType.DATA_UID`). Distinct from
   * {@link phantomSlot} (the PRECEDING name-slot burn, which ALSO never
   * writes a uid): both consume a rank, this flag names which of the
   * classifier's own two burns is the invisible one. Absent (falsy) for
   * `kind: 'lollipop'`, which gets a normal, rendered `classifierUid`
   * entry at `creationIndex`.
   */
  noUidSlot?: true;
  /**
   * G2 N19: for `kind: 'assoc-circle'` only -- the `creationIndex` of an
   * explicit A-B association this circle SUBSUMED and removed
   * (`class-assoc-couple.ts#subsumeExplicitAssociation`). Jar's shared
   * counter already advanced past that relationship's OWN real `Link()`
   * construction when it was first parsed (e.g. an earlier `A -- B` line) --
   * `Association#createNew`'s `removeLink(existingLink)` branch (no NEW
   * `Link()` call) does not un-burn that slot. `renderer-uid.ts` injects a
   * phantom Ranked entry at this value so dense re-numbering doesn't
   * silently collapse the gap (see `SubsumedLink.creationIndex`'s doc
   * comment, class-assoc-couple.ts, for the jar-verified fixture). Absent
   * when the couple's A-B pair had no explicit association to subsume.
   */
  subsumedLinkCreationIndex?: number;
  /**
   * G2 N20: for `kind: 'assoc-circle'` only, on the OLDER (PRIOR) circle of
   * a repeat-coupled pair -- the class-edge's own creationIndex value
   * BEFORE `Association#createInSecond`'s conditional inversion
   * (`other.pointToAssocied = other.pointToAssocied.getInv()`,
   * `AbstractClassOrObjectDiagram.java:326-330`, fires only when the prior
   * circle's class edge currently points circle->C, i.e. a "leading"-form
   * first coupling). `getInv()` constructs a BRAND NEW `Link` object (a
   * fresh `getUniqueSequence("lnk")` burn) -- the edge's rendered `<g
   * class="link" id="lnkN">` uid must reflect that NEW, later burn (already
   * overwritten onto the SAME `Relationship.creationIndex` in place by
   * `class-assoc-couple.ts#invertPriorClassEdge`), while this field
   * preserves the ORPHANED old rank so `renderer-uid.ts` still consumes it
   * as a phantom (the gap it left in jar's real counter must not be
   * silently collapsed by dense re-numbering -- same principle as {@link
   * subsumedLinkCreationIndex}, just for an edge's own re-burn rather than
   * a removed link). Absent when the inversion never fires (a "trailing"-
   * form first coupling already points C->circle, matching createInSecond's
   * own always-circle-to-C target -- no swap needed, no extra burn).
   */
  invertedClassEdgeOldCreationIndex?: number;
  /**
   * G2 N20: for `kind: 'assoc-circle'` only, on the NEWER (SECOND) circle
   * of a repeat-coupled pair -- `Association#createInSecond`'s FINAL burn,
   * an invisible sibling link connecting the prior circle to this one
   * (`AbstractClassOrObjectDiagram.java:335-339`, `new Link(...,
   * NONE/NONE, ...); lnode.setInvis(true); addLink(lnode);`). The
   * corresponding `Relationship` (pushed with `invis: true`,
   * `class-assoc-couple.ts#makeCoupleCircle`) is filtered OUT of
   * `geo.edges` entirely at layout time (`buildEdgeGeos`'s `if (rel.invis)
   * continue` -- a load-bearing invariant `note-freestanding.ts` also
   * depends on, so it cannot carry its own `creationIndex` through the
   * normal edge-numbering path) -- this classifier-level field is the ONLY
   * way its real jar rank reaches `renderer-uid.ts`'s dense re-numbering,
   * the SAME "standalone phantom rank on a classifier" shape {@link
   * subsumedLinkCreationIndex} already established. Absent for a
   * single (non-repeat) coupling, which never emits this sibling link.
   */
  repeatCoupleInvisLinkCreationIndex?: number;
}

// ---------------------------------------------------------------------------
// Relationship types
// ---------------------------------------------------------------------------

export type RelationshipType =
  | 'extension'      // <|--
  | 'implementation' // <|..
  | 'composition'    // *--
  | 'aggregation'    // o--
  | 'dependency'     // ..>
  | 'association'    // -->
  | 'usage';         // ..

/**
 * The decoration drawn at one end of a link, mirroring upstream's LinkDecor:
 * each arrow end is decorated independently of the semantic {@link
 * RelationshipType}. `none` is a plain (undecorated) end — a plain `--`
 * association has `none` at both ends, unlike a directed `-->` (`open` at the
 * target). Parsed per-end from the arrow token (source/target assigned by the
 * arrow's direction).
 *
 * G2 N28: `square`/`plus`/`parenthesis`/`crowfoot`/`circleCrowfoot`/
 * `circleLine`/`doubleLine`/`lineCrowfoot` — the D6-deferred glyph
 * decorations (`#`, `+`, `)`/`(`, `}`/`{`, `}o`/`o{`, `|o`/`o|`, `||`,
 * `}|`/`|{`) `class-arrow-grammar.ts#headToDecor` previously collapsed to
 * `'none'` (D6's own scope note: "DOT parity only, not SVG rendering").
 * Each maps 1:1 onto an already-built `core/svek/extremity
 * /link-decor.ts#LinkDecorName` (SQUARE/PLUS/PARENTHESIS/CROWFOOT/
 * CIRCLE_CROWFOOT/CIRCLE_LINE/DOUBLE_LINE/LINE_CROWFOOT) — the shape
 * geometry was built for description's edge renderer and is reused
 * unchanged, only the class-side glyph→name wiring was missing.
 * NOT added: `CIRCLE_CONNECT` (`0)`/`(0`) — that is a genuinely different,
 * MID-LINK decoration (upstream's `LinkType#withMiddleCircle*`, parsed via
 * `CommandLinkClass`'s separate `INSIDE` regex group, drawn at the edge's
 * midpoint rather than at an extremity) — surveyed and deferred, see
 * `plans/g2-class-svg/ledger.md` N28.
 */
export type LinkDecor =
  | 'triangle'
  | 'open'
  | 'diamond'
  | 'filledDiamond'
  | 'square'
  | 'plus'
  | 'parenthesis'
  | 'crowfoot'
  | 'circleCrowfoot'
  | 'circleLine'
  | 'doubleLine'
  | 'lineCrowfoot'
  | 'none';

export interface Relationship {
  from: string;
  to: string;
  type: RelationshipType;
  /**
   * Decoration at the source/target end, parsed independently from the arrow
   * token's two heads (D6). Drives the rendered edge markers; does NOT affect
   * the DOT graph (which uses {@link RelationshipType} + `length`). Absent for
   * relationships not built from an arrow token — layout then falls back to a
   * type-derived default.
   */
  sourceDecor?: LinkDecor;
  targetDecor?: LinkDecor;
  /**
   * Body dash-style override, independent of {@link RelationshipType}'s own
   * `EDGE_DECORATION_MAP` default -- G2 N8, `class-assoc-couple.ts`'s
   * `(A,B)` couple mechanism: the couple's class-link edge keeps its own
   * arrow token's dashed-ness (`Association#createNew`'s `linkType` param;
   * upstream `decoration/LinkType.java`'s `linkStyle`, carried unchanged
   * through `getPart1()`/`getPart2()`) rather than the couple's own
   * hardcoded `'association'` {@link RelationshipType} (kept undisturbed --
   * see `sourceDecor`/`targetDecor` above -- to avoid perturbing the
   * DOT-graph `HIERARCHICAL` swap, which keys off `RelationshipType` alone).
   * Absent for every other relationship kind, which continues to derive
   * dashing purely from `type` (`EDGE_DECORATION_MAP[type].dashed`).
   */
  dashed?: boolean;
  fromMultiplicity?: string;
  toMultiplicity?: string;
  /**
   * Role name from `"role"/roleName` (or reversed) association-end syntax
   * (CommandLinkClass FIRST_ROLE/SECOND_ROLE). Falls back to the taillabel/
   * headlabel dot attribute in place of the cardinality when no multiplicity
   * was given on that end (SvekEdge.java:447-466).
   */
  fromRole?: string;
  toRole?: string;
  label?: string;
  /**
   * Port/member name from `Class::member` endpoint syntax (PlantUML reuses
   * the legacy UML `::` namespace separator to target a specific member of
   * a classifier). The edge itself still connects the two classifiers;
   * the port name is metadata for a later shield/port-node rendering pass.
   */
  fromPort?: string;
  toPort?: string;
  /**
   * Qualifier text from qualified-association syntax (`class1 [Qualifier] <--
   * class2`), sided like the multiplicities: the qualifier attaches to whichever
   * endpoint bears the `[...]`. The qualifier-bearing classifier renders as a
   * shielded `shape=plaintext` node in svek.
   */
  fromQualifier?: string;
  toQualifier?: string;
  /**
   * Arrow length: the count of body chars (`-`/`.`/`=`) in the arrow, mirroring
   * upstream `CommandLinkClass.getQueueLength`. Drives the dot `minlen`
   * (`length - 1`): `->` (1) → 0, `-->` (2) → 1, `--->` (3) → 2. Absent ⇒ the
   * default association length of 2 (minlen 1).
   */
  length?: number;
  /**
   * Emit as `style=invis` — an invisible layout constraint edge, not a drawn
   * relationship. Used to tie together the two association-class circles that
   * share an (A,B) pair (`R1..(A,B)` + `(A,B)..R2`).
   */
  invis?: boolean;
  /**
   * Graphviz edge `weight` (rank-assignment tie-breaker; higher pulls the
   * edge straighter/shorter) — from the optional `@N.N` header prefix upstream
   * commands accept (`CommandLinkClass`/`CommandLinkLollipop`'s HEADER group,
   * `Link#setWeight`). Passed straight through to the dot layout engine
   * (graph-layout.ts); not shown in the emitted comparator DOT (matches
   * upstream, where it also only affects internal rank assignment).
   */
  weight?: number;
  /**
   * `note on link: text` attached to this relationship after it was parsed
   * (`CommandFactoryNoteOnLink` → `Link#addNote`, a note carried BY the
   * link, distinct from `label`). Only meaningful while the relationship is
   * still live in `ast.relationships` — an association-class couple
   * (`(A,B) .. C`) that subsumes this link moves the text onto the new
   * circle edge(s), splitting it across both when the couple's own length
   * flips (`Association.createNew`'s `NoteLinkStrategy.HALF_PRINTED_FULL`/
   * `HALF_NOT_PRINTED`; class-assoc-couple.ts).
   */
  linkNote?: string;
  /**
   * Marked by `constraint on links : text` (CommandConstraintOnLinks →
   * `Link#setLinkConstraint`, applied to the two most-recent non-note links).
   * svek emits a fixed 10x10 `label` spot on a constrained edge with no
   * note/label text (SvekEdge.java:430-444, CONSTRAINT_SPOT at :122); the
   * constraint's text itself is drawn post-layout, never in the DOT.
   */
  linkConstraint?: boolean;
  /**
   * G2 N2 (mechanism 3): parse-time creation order -- see
   * {@link Classifier.creationIndex}'s doc comment (same shared counter,
   * same exact/fallback gate). Stamped only at the primary relationship-
   * dispatch site (`class-commands.ts`'s `REL_DISPATCH_RE` handler) --
   * absent for relationships built via `class-map-commands.ts`/`class-
   * declaration-parser.ts`/`class-lollipop.ts`/`class-assoc-couple.ts`
   * (named remainder, `plans/g2-class-svg/ledger.md` N2).
   */
  creationIndex?: number;
  /**
   * G2 N9: Java's `Link#getEntity1()`/`getEntity2()` (cl1/cl2) -- the bare
   * (unqualified, `::port`-stripped) declaration-order entity names the
   * `<path id="...">` attribute is built from (`Link#idCommentForSvg()`,
   * Link.java:106-114). DISTINCT from `from`/`to` above: those are swapped
   * by `swapDirection` (arrowhead-direction, for DOT layout); these are
   * swapped ONLY by `ArrowInfo.upOrLeft` (the explicit `-left-`/`-up-`
   * direction word, `Link#getInv()`) -- the one swap Java's cl1/cl2
   * actually undergo. `class1 [Qualifier] <-- class2` and `MainWindow <|--
   * Gtk::Window` (baneru-00-kuro607, bicabi-42-coto932 -- the two samples
   * that contradicted a naive `sourceDecor`/`targetDecor`-based reading)
   * both resolve correctly under THIS pair: `idEntity1`="class1"/
   * "MainWindow" (cl1, unswapped -- no direction word), `idEntity1Decor`=
   * 'open'/'triangle' (the arrowhead sits at ENT1, decor-at-cl1 nonzero
   * while decor-at-cl2 is 'none' -> `looksLikeRevertedForSvg` -> "backto").
   * Absent for relationships built outside the arrow-token grammar
   * (couples/lollipop/map rows) -- `renderer.ts` falls back to
   * `from`/`to` + `sourceDecor`/`targetDecor` for those (documented
   * best-effort, out of this iteration's arrow-matrix scope).
   * @see ~/git/plantuml/.../classdiagram/command/CommandLinkClass.java:490-497
   * @see ~/git/plantuml/.../abel/Link.java:106-114,145-156
   * @see ~/git/plantuml/.../decoration/LinkType.java:55-68
   */
  idEntity1?: string;
  idEntity2?: string;
  /** Decoration AT `idEntity1`'s end (Java: the value attached to cl1's
   *  end via `LinkType.decor2`, which is always adjacent to `getEntity1()`
   *  -- see this field's sibling doc comment above for the derivation). */
  idEntity1Decor?: LinkDecor;
  /** Decoration AT `idEntity2`'s end (Java: `LinkType.decor1`, adjacent to
   *  `getEntity2()`). */
  idEntity2Decor?: LinkDecor;
  /**
   * G2 N30: the FULL (namespace-qualified, un-leaf-stripped) DOT-node id
   * `idEntity1`/`idEntity2` were leaf-stripped FROM (`left.id`/`right.id`
   * picked via the same `upOrLeft` swap, before `idLeaf()`) -- distinct
   * from `idEntity1`/`idEntity2` (display-name use, the `<path id>`
   * string) and from `from`/`to` (DOT-layout use, swapped by
   * `swapDirection` instead). Consumed ONLY by `class-geo-builders.ts
   * #buildEdgeGeos`'s path-direction normalization, jar's `SvekEdge.java
   * #solveLine:637-654`: after layout, if the raw dot-returned spline's
   * start point sits closer to `idEntity2FullId`'s node center than
   * `idEntity1FullId`'s (and its end point correspondingly closer to
   * `idEntity1FullId`'s), the WHOLE point list is reversed so the drawn
   * `<path d>` always runs `idEntity1FullId` -> `idEntity2FullId` --
   * independent of any DOT-ranking swap applied for hierarchical
   * (extension/implementation) edges. Absent under the same conditions as
   * `idEntity1`/`idEntity2` (couples/lollipop/map rows) -- those edges
   * fall back to the pre-existing `swappedEdges`-index reversal.
   * @see ~/git/plantuml/.../svek/SvekEdge.java:637-654
   */
  idEntity1FullId?: string;
  idEntity2FullId?: string;
  /**
   * G2 N9: 0-indexed source line (jar's `<path codeLine="...">`, `Link
   * #getCodeLine()` -> `location.getPosition()`), stamped from `ParseState
   * .currentLine` at the same dispatch site as `creationIndex` above.
   * Absent under the same conditions as `idEntity1`/`idEntity2`, PLUS
   * whenever the block's `UmlSource` carries no `linePositions` (e.g. a
   * hand-built literal fixture in a unit test).
   */
  sourceLine?: number;
  /**
   * G2 N19: true when this relationship's `creationIndex` was preceded by a
   * discarded phantom counter slot -- mirrors `Classifier.phantomSlot`'s
   * doc comment exactly, but for the SYNTHETIC DEFAULT link jar's couple
   * machinery constructs purely to supply default type/length values
   * (`Association#createNew`/`createInSecond`: `existingLink = foundLink
   * (entity1, entity2); if (existingLink == null) existingLink = new Link
   * (..., LinkDecor.NONE, LinkDecor.NONE, ...);` -- a REAL `Link` ctor call,
   * burning a real cpt1 slot, but never `addLink`ed, so it never manifests
   * as an `EdgeGeo` of its own). Set on the FIRST edge
   * (`class-assoc-couple.ts`'s `aEdge`) synthesised immediately after this
   * burn, when the couple's own A-B pair had NO subsumed explicit
   * association to reuse (`buvake-41-vulu531`'s `(A,B) .. C` with no prior
   * `A--B` line, jar-verified: the couple's edges numbered one higher than
   * a same-shaped fixture WITH a subsumed link, e.g. `bosiki-11-xaza958`).
   */
  phantomSlot?: true;
  /**
   * G2 N26: `WithLinkType.applyStyle`/`applyOneStyle`'s bracket-modifier
   * `dashed`/`dotted`/`bold` keyword (`decoration/WithLinkType.java:126-
   * 166`) -- the SAME method `Link extends WithLinkType` (`abel/Link.java:
   * 65`) and description's `DescriptiveLink` bracket grammar both go
   * through (`CommandLinkClass.java:368`'s `link.applyStyle(arg.getLazzy(
   * "ARROW_STYLE", 0))` call). Overrides the type-derived
   * `EDGE_DECORATION_MAP[type].dashed` default (`class-geo-builders.ts
   * #buildEdgeGeos`) via the shared `core/svek/svek-edge-stroke.ts
   * #strokeForStyle` formula (`LinkStyle#getStroke3()`, the exact upstream
   * dash/thickness recipe description's own edge renderer already uses).
   * Parsed by `class-arrow-grammar.ts#parseArrowStyleOverrides`; ported
   * class-side rather than importing description's `link-grammar.ts`
   * directly, to avoid a cross-diagram-type dependency (same upstream
   * method, independently faithful port).
   */
  lineStyleOverride?: 'solid' | 'dashed' | 'dotted' | 'bold';
  /**
   * `WithLinkType.goThickness` (bracket `thickness=N` token) -- same
   * field/semantics as description's `DescriptiveLink.thicknessOverride`,
   * ported class-side. `LinkStyle.getStroke3()`'s BOLD-ignores-thickness
   * quirk is preserved in `strokeForStyle` (svek-edge-stroke.ts), not
   * re-implemented here.
   */
  thicknessOverride?: number;
  /**
   * `WithLinkType.applyOneStyle`'s color-token else-branch
   * (`HColorSet.getColorOrWhite(s)`) -- same field/semantics as
   * description's `DescriptiveLink.colorOverride`. Leading `#` already
   * stripped by the parser (grammar-mandatory, matches the established
   * inline-color-override convention). Resolved through
   * `klimt/color/HColorSet.ts#resolveColorToSvgHex` at render time
   * (`renderer.ts#renderEdge`) -- unlike description's own `colorOverride`
   * (I2-ledgered gap, named colors pass through unresolved there), class
   * already resolves every other fill/stroke through that table
   * (`renderer.ts`'s own doc comment), so this field gets the same
   * treatment for free.
   */
  colorOverride?: string;
}

// ---------------------------------------------------------------------------
// Note types
// ---------------------------------------------------------------------------

export type NotePosition = 'left' | 'right' | 'top' | 'bottom';

/**
 * A note. Two forms:
 *  - `note <pos> of <Entity>` — attached to a classifier; PlantUML lays this
 *    out as its own graphviz node connected to the host by a plain
 *    connector edge. `target` and `position` are set.
 *  - `note as <alias> ... end note` — freestanding/unattached; still becomes
 *    its own graph node (inside its enclosing package, if any), but has no
 *    host classifier and no position until/unless a later relationship
 *    line connects it to something. `target` and `position` are undefined;
 *    `id` is the user-declared alias so relationship endpoints can resolve
 *    to it.
 */
export interface ClassNote {
  /** Generated layout id (e.g. `__note_0`) for attached notes; the
   *  user-declared alias (e.g. `N3`) for freestanding notes. */
  id: string;
  /** Host classifier id the note is attached to (attached notes only). */
  target?: string;
  /**
   * Member/port name from `note <pos> of Class::member` syntax — mirrors
   * `Relationship.fromPort`/`toPort` (same `::` grammar, split the same way
   * via `splitEndpointPort`). The note still anchors to the host classifier
   * (`target`); this is metadata only. Notes anchored to a specific member
   * lay out with an invisible connector (svek routes member-anchored notes
   * as a layout-only constraint, unlike a plain classifier note's visible
   * connector) — see note-layout.ts's `buildNoteGraphParts`.
   * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java
   */
  targetPort?: string;
  /**
   * True when `target` came from falling back to the last-created entity —
   * a bare `note <pos>` with no `of <Entity>` clause at all — rather than an
   * explicit `of` reference. `CommandFactoryNote` (bare) and
   * `CommandFactoryNoteOnEntity` (`of`) are separate upstream commands with
   * different merge behavior: only explicit-`of` notes on the same
   * (host, side) merge into one svek node (verified: zepeki-75-pifo352 — a
   * bare `note left` and an explicit `note left of test::member`, same host
   * and side, stay TWO separate oracle nodes). See note-layout.ts's
   * `groupNotes`.
   */
  implicitTarget?: true;
  position?: NotePosition;
  /** Note body (may contain newlines for multi-line notes). */
  text: string;
  /**
   * G2 N34: the note's own `#color` override (`note <pos> [of X] #green: ...`
   * / `note "text" as N1 #blue`) -- mirrors {@link Classifier.color} exactly
   * (same `ColorParser.simpleColor(BACK)` grammar, same bare/compound-`back:`
   * extraction at the render boundary, `renderer-note.ts#resolveNoteBackground`).
   * Takes precedence over any `<style> note { BackgroundColor ... }` bucket
   * default (`EntityImageNote.java`'s ctor: `entity.getColors().getColor(BACK)`
   * wins over the style-merged value) -- the LINECOLOR/`text:`/`line:`/
   * `shadowing` compound parts are captured here but not yet consumed by any
   * render-side field, same named-remainder posture as `Classifier.color`'s
   * own doc comment.
   * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:312
   */
  color?: string;
  /**
   * `$tag` names attached to a freestanding single-line note declaration
   * (`note "text" as N1 $z`) — mirrors {@link Classifier.tags}. In practice
   * these are rarely consulted directly: a note used as a relationship
   * endpoint delegates its `remove`/`restore` status entirely to that
   * neighbor (upstream `CucaDiagram#isNoteWithSingleLinkAttachedTo` —
   * see class-directives.ts#computeRemovedIds), so this field only matters
   * when the note has no single non-invisible neighbor to delegate to.
   * @see ~/git/plantuml/.../command/note/CommandFactoryNote.java
   */
  tags?: string[];
  /**
   * Enclosing namespace id, if the note was declared inside a `package`/
   * namespace block — mirrors `Classifier.namespace`. A note's DOT node id
   * (`id` above) is registered bare into `Namespace.classifiers` (same as any
   * other member), which is the sole source `buildDotClusters` uses for
   * cluster membership; upstream has no separate field since notes and
   * classifiers are both leaves in the same Quark tree.
   * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:175-184 getCurrentGroup
   */
  namespace?: string;
  /**
   * G2 N37: the note's own `<<stereotype>>` label (`note left of A
   * <<faint>>: text`) -- mirrors {@link Classifier.stereotype} (same
   * `<<...>>` capture grammar, `NOTE_STEREO_CAPTURE` in class-notes.ts).
   * Feeds ONLY the `.tagname` `<style>` cascade (`note { .faint {
   * BackgroundColor red } } }`, `renderer-note.ts#resolveNoteBackground`)
   * -- unlike a classifier, a note never DRAWS its own stereotype text, so
   * there is no visible/invisible-bracket-count distinction to track here
   * (`class-stereotype.ts#splitStereotypeStyleTags` is reused as-is for the
   * tag-membership split, since a note's stereotype blob follows the SAME
   * `<<A>><<B>>` stacking grammar as a classifier's).
   */
  stereotype?: string;
  /**
   * G2 N15: parse-time creation order, mirroring {@link Classifier
   * .creationIndex}'s shared-counter scheme -- but a note consumes a
   * DIFFERENT number of counter increments depending on which upstream
   * command created it:
   *  - `note <pos> [of <Entity>]` (attached, `targetPort` undefined --
   *    `CommandFactoryNoteOnEntity`) ALWAYS calls `diagram.getUniqueSequence
   *    ("GMN")` (a phantom quark-code slot, never visible as an `entN` id)
   *    BEFORE its own `reallyCreateLeaf` -> `Entity` ctor consumes the REAL
   *    slot this field stores -- two counter increments per note, jar-
   *    verified against `fezugi-39-fujo327` (`ent0002` expected `ent0003`,
   *    the class `a` alone consumes slot 1, the note's phantom GMN consumes
   *    slot 2, the note's own uid is slot 3).
   *  - `note "text" as N1` (freestanding -- `CommandFactoryNote`) has no GMN
   *    call at all; only the `Entity` ctor's own slot is consumed (one
   *    increment).
   *  - `note <pos> of Class::member` (member-tip, `targetPort` defined --
   *    `CommandFactoryTipOnEntity`) ALSO has no GMN call, but MERGES: only
   *    the group's FIRST tip (per host+position) creates a real `Entity`
   *    (`if (tips == null) { tips = reallyCreateLeaf(...); }`), later
   *    members of the same group reuse it and consume NOTHING. This port
   *    does not model that merge at parse time (grouping is computed later,
   *    in `note-layout.ts`) -- left `undefined` for tip notes, which keeps
   *    N13's already jar-verified tip numbering on the pre-existing
   *    fallback path (`renderer-uid.ts`'s doc comment).
   * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:327
   * @see ~/git/plantuml/.../command/note/CommandFactoryNote.java:197
   * @see ~/git/plantuml/.../command/note/CommandFactoryTipOnEntity.java:218-220
   * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:725-731
   */
  creationIndex?: number;
  /**
   * G2 N15: true when this note's `creationIndex` was preceded by a
   * discarded phantom "GMN" counter slot (see {@link creationIndex}'s doc
   * comment) -- `renderer-uid.ts#assignExact`'s dense re-numbering must
   * NOT collapse that gap the way it collapses a genuinely absent geo item
   * (e.g. `ensureClassifier`'s package-endpoint phantom stub, that
   * function's own module doc comment): the GMN slot corresponds to no
   * drawn entity at all, so it must still consume a numbering RANK without
   * being written to any uid map, keeping `creationIndex - 1` a real gap
   * in the final `ent%04d` sequence (jar-verified: `fezugi-39-fujo327`'s
   * note is `ent0003`, with `ent0002` never assigned to anything).
   */
  phantomSlot?: true;
}

// ---------------------------------------------------------------------------
// Namespace types
// ---------------------------------------------------------------------------

export interface Namespace {
  id: string;
  display: string;
  /** Classifier ids contained within this namespace. */
  classifiers: string[];
  /**
   * Enclosing namespace id for nested packages/namespaces (dotted names split
   * on the namespace separator, e.g. `a.b.c` → nested `a` > `a.b` > `a.b.c`);
   * absent ⇒ top-level. Mirrors upstream's Quark hierarchy.
   */
  parentId?: string;
  /**
   * G2 N2 (mechanism 3): parse-time creation order -- see
   * {@link Classifier.creationIndex}'s doc comment (same shared counter,
   * same exact/fallback gate).
   */
  creationIndex?: number;
}

// ---------------------------------------------------------------------------
// Hide/show directives
// ---------------------------------------------------------------------------

export type HideTarget =
  | 'empty members'
  | 'members'
  | 'circle'
  | 'empty fields'
  | 'empty methods'
  // G2 N27: bare (non-"empty") global `hide fields`/`hide methods`
  // (`CommandHideShowByGender`, GENDER absent -> every classifier, no
  // `empty` qualifier -> unconditional, not emptiness-gated).
  | 'fields'
  | 'methods';

export interface HideShowDirective {
  kind: 'hideshow';
  action: 'hide' | 'show';
  target: HideTarget;
}

/**
 * `hide|show [<<stereotype-pattern>>] stereotype(s)` (upstream
 * `CommandHideShowByGender`, `PORTION=stereotype`, G2 N24) — suppresses the
 * classifier-header stereotype TEXT ROW itself (not the classifier), either
 * for every classifier (`pattern` absent, bare `hide stereotype`) or only
 * for classifiers carrying a stereotype LABEL matching `pattern` exactly
 * (`net.atmp.CucaDiagram#isStereotypeLabelShown`'s per-label string-equality
 * check, NOT a wildcard/substring match). Distinct from
 * {@link HideShowPatternDirective} (`hide <<stereotype>>` alone hides the
 * whole ENTITY; this hides only the stereotype LABEL text, entity still
 * draws) and from {@link HideShowVisibilityDirective} (member-visibility
 * filtered, not stereotype-filtered).
 * @see ~/git/plantuml/.../classdiagram/command/CommandHideShowByGender.java
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#isStereotypeLabelShown
 */
export interface HideStereotypeDirective {
  kind: 'hidestereotype';
  action: 'hide' | 'show';
  /** The `<<...>>`-bracketed label pattern (including the brackets, matching
   *  {@link Classifier.stereotype}'s own guillemet-free storage AFTER a
   *  `splitStereotypeLabels`-style unwrap would strip them -- comparison is
   *  done against the wrapped form, `class-directives.ts#isStereotypeLabelHidden`'s
   *  own doc comment). Absent for the bare `hide stereotype` form (matches
   *  every stereotype label). */
  pattern?: string;
}

// ---------------------------------------------------------------------------
// Remove/restore directives
// ---------------------------------------------------------------------------

/**
 * A `remove`/`restore` directive (upstream `CommandRemoveRestore`). Unlike
 * `hide`/`show` (which only ever gates rendering — `isHidden` is never
 * consulted at the svek export boundary), `remove`/`restore` excludes the
 * matched entities from the exported graph entirely: nodes disappear and any
 * relationship/note-connector touching a removed entity is dropped too.
 * @see ~/git/plantuml/.../classdiagram/command/CommandRemoveRestore.java
 */
export interface RemoveRestoreDirective {
  kind: 'removerestore';
  action: 'remove' | 'restore';
  /**
   * Raw target expression, interpreted by
   * class-directives.ts#computeRemovedIds (mirrors `HideOrShow#isApplyable`):
   * `*` (or any `*`-wildcard pattern) matches every entity by name; `$tag`
   * matches {@link Classifier.tags}/{@link ClassNote.tags}; `<<stereotype>>`
   * matches {@link Classifier.stereotype}; `@unlinked` matches entities with
   * no non-invisible incident relationship/note-connector
   * (`Entity#isAloneAndUnlinked`); anything else is a bare/wildcard
   * id match.
   */
  what: string;
}

/**
 * A `hide`/`show <entity|$tag|<<stereotype>>|*|@unlinked>` directive (upstream
 * `CommandHideShow2#executeArg` -> `CucaDiagram#hideOrShow2`, accumulated into
 * `hides2` -- a SEPARATE list from `removed`, sharing the exact same `HideOrShow`
 * matcher class upstream). Unlike `RemoveRestoreDirective`, this ONLY gates
 * rendering (`Entity#isHidden` -> `SvekResult`'s `UHidden` wrap at draw time) --
 * the matched entity keeps its svek/DOT node (position, creationIndex/uid slot)
 * exactly as if it were never hidden; only its drawn content disappears. Ported
 * separately from the compound `hide <name> circle|methods|fields|attributes`
 * qualifier forms (`CommandHideShowByGender`/`CommandHideShowByVisibility`) --
 * upstream's own regex for THIS command requires `what` to contain no
 * whitespace unless bracketed, which is exactly the discriminator
 * `parseHideShowDirective` uses to route between the two. The
 * entity-qualified compound form is {@link HideShowEntityDirective} (G2 N26).
 * @see ~/git/plantuml/.../classdiagram/command/CommandHideShow2.java
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#hideOrShow2,isHidden
 */
export interface HideShowPatternDirective {
  kind: 'hideshowpattern';
  action: 'hide' | 'show';
  /** Same grammar as {@link RemoveRestoreDirective.what}. */
  what: string;
}

/**
 * `hide|show <entity> circle|circles|circled|members|member|fields|field|
 * attributes|attribute|methods|method` (upstream `CommandHideShowByGender`,
 * GENDER = a single bare/quoted entity id -- the type-keyword
 * (`class`/`object`/…) and `<<stereotype>>` GENDER forms are NOT ported,
 * see `class-directives.ts#parseHideShowEntityDirective`'s doc comment).
 * `target` reuses `HideTarget`'s `'circle'`/`'members'` spelling for those
 * two portions; `'fields'`/`'methods'` are the entity-scoped, NOT-
 * `empty`-qualified compartment-suppression portions (jar-verified:
 * unconditional, not emptiness-gated like `HideTarget`'s `'empty
 * fields'`/`'empty methods'`, `nujiga-81-peno983`).
 * @see ~/git/plantuml/.../classdiagram/command/CommandHideShowByGender.java
 */
export interface HideShowEntityDirective {
  kind: 'hideshowentity';
  action: 'hide' | 'show';
  entityId: string;
  target: 'circle' | 'members' | 'fields' | 'methods';
}

/**
 * `hide|show [public,private,protected,package] members|fields|methods`
 * (upstream `CommandHideShowByVisibility`, G2 N12) — a member-level filter
 * keyed on visibility char x field/method-ness, DISTINCT from
 * {@link HideShowDirective}'s fixed `members`/`empty members` targets (those
 * are unconditional or emptiness-gated; this one is visibility-gated) and
 * from {@link HideShowPatternDirective} (that one matches ENTITIES by
 * id/tag/stereotype, not member visibility). `visibilities` is empty for a
 * directive with no visibility token at all (`hide members` alone never
 * reaches this parser — `parseHideShowDirective`'s fixed-target map claims
 * it first — but upstream's own grammar permits an empty visibility list
 * syntactically, silently ignored at execution, `explainArg`'s own comment).
 * @see ~/git/plantuml/.../classdiagram/command/CommandHideShowByVisibility.java
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#hideOrShowVisibilityModifier
 */
export interface HideShowVisibilityDirective {
  kind: 'hideshowvisibility';
  action: 'hide' | 'show';
  visibilities: Array<'public' | 'private' | 'protected' | 'package'>;
  /** `'member'` covers BOTH fields and methods (upstream's EntityPortion.MEMBER). */
  portion: 'field' | 'method' | 'member';
}

// ---------------------------------------------------------------------------
// Root AST
// ---------------------------------------------------------------------------

export interface ClassDiagramAST {
  classifiers: Classifier[];
  relationships: Relationship[];
  namespaces: Namespace[];
  directives: HideShowDirective[];
  /**
   * Additive (optional, unlike `directives` above) so existing AST literal
   * constructors elsewhere (object-diagram parser reuse, unit-test fixtures)
   * are unaffected — absent is equivalent to `[]` everywhere this is read
   * (class-directives.ts#computeRemovedIds, layout.ts).
   */
  removeDirectives?: RemoveRestoreDirective[];
  /**
   * `hide`/`show` entity-pattern directives (G2 N7) -- see
   * {@link HideShowPatternDirective}. Additive/optional for the same reason
   * as `removeDirectives`: absent is equivalent to `[]` everywhere this is
   * read (class-directives.ts#computeHiddenIds, layout.ts).
   */
  hidePatternDirectives?: HideShowPatternDirective[];
  /**
   * `hide`/`show <entity> circle|members|fields|methods` directives (G2
   * N26) -- see {@link HideShowEntityDirective}. Additive/optional for the
   * same reason as `removeDirectives`/`hidePatternDirectives` -- absent is
   * equivalent to `[]` everywhere this is read
   * (class-directives.ts#applyHideShowEntityDirectives).
   */
  hideEntityDirectives?: HideShowEntityDirective[];
  /**
   * `hide`/`show <visibility> members|fields|methods` directives (G2 N12) --
   * see {@link HideShowVisibilityDirective}. Additive/optional for the same
   * reason as `removeDirectives`/`hidePatternDirectives` -- absent is
   * equivalent to `[]` everywhere this is read
   * (class-directives.ts#applyVisibilityHideShow).
   */
  hideVisibilityDirectives?: HideShowVisibilityDirective[];
  /**
   * `hide`/`show [<<pattern>>] stereotype(s)` directives (G2 N24) -- see
   * {@link HideStereotypeDirective}. Additive/optional for the same reason
   * as `hideVisibilityDirectives` -- absent is equivalent to `[]` everywhere
   * this is read (`class-directives.ts#isStereotypeLabelHidden`).
   */
  hideStereotypeDirectives?: HideStereotypeDirective[];
  notes: ClassNote[];
  /**
   * Set to `'LR'` by `left to right direction` (upstream CommandRankDir →
   * skinparam Rankdir=LEFT_TO_RIGHT). Absent = top-to-bottom default (svek emits
   * no `rankdir` attribute then).
   */
  rankdir?: 'LR';
  /**
   * All pages, in source order, when the source contains `newpage`
   * (upstream `NewpagedDiagram`) — the first element is this same AST
   * object. Absent for single-page sources so existing callers/tests that
   * only look at the top-level AST fields are unaffected.
   * @see ~/git/plantuml/.../NewpagedDiagram.java:61-162
   */
  pages?: ClassDiagramAST[];
  /**
   * title/caption/legend/header/footer/mainframe chrome, populated by
   * {@link matchAnnotationCommand} at the parser's command-dispatch position
   * (mission G0b, decisions.md D3). Optional (unlike `directives`) so
   * existing hand-authored AST literal fixtures compile unchanged; a real
   * `parseClass()` call always sets it via `createAnnotations()` --
   * `isEmpty()` distinguishes "no chrome present" from "not yet populated".
   */
  annotations?: DiagramAnnotations;
  /**
   * `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4),
   * populated by {@link matchSpriteCommand} at the SAME dispatch position
   * as {@link matchAnnotationCommand} (tried immediately after it, mirroring
   * upstream's `CommonCommands.addTitleCommands` then `addCommonCommands2`
   * registration order). Optional so hand-authored AST literal fixtures
   * compile unchanged; a real `parseClass()` call always sets it via
   * `createSpriteRegistry()`.
   */
  sprites?: SpriteRegistry;
}
