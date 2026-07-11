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
  color?: string;
  namespace?: string;
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
 */
export type LinkDecor =
  | 'triangle'
  | 'open'
  | 'diamond'
  | 'filledDiamond'
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
}

// ---------------------------------------------------------------------------
// Hide/show directives
// ---------------------------------------------------------------------------

export type HideTarget =
  | 'empty members'
  | 'members'
  | 'circle'
  | 'empty fields'
  | 'empty methods';

export interface HideShowDirective {
  kind: 'hideshow';
  action: 'hide' | 'show';
  target: HideTarget;
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
}
