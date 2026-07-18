/**
 * Note-on-entity layout for class diagrams.
 *
 * PlantUML's Svek lays a `note <pos> of <Entity>` out as its own graphviz
 * node connected to the host by a connector edge. This module measures
 * notes, groups same-side notes on the same host into a single merged svek
 * node (see `groupNotes`), contributes the seam nodes + connector edges, and
 * maps the layout result back to `NoteGeo[]` for the renderer — one geo per
 * ORIGINAL note, stacked within its group's laid-out box. Kept separate from
 * layout.ts so the note feature doesn't grow that already-large module.
 *
 * G2/N13: member-tip notes (`note <left|right> of Class::member`, `invis`
 * groups below) draw via the Opale zigzag-notch mechanism instead of a
 * plain folded box + separate connector — `mapNoteGeos` now also resolves
 * each member-tip note's target row (fuzzy match, `note-opale.ts`) and
 * computes its notch anchor points; see that function's own doc comment.
 */
import type { ClassNote, NotePosition } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type {
  DotInputNode,
  DotInputEdge,
  DotLayoutResult,
} from '../../core/graph-layout.js';
import type { EdgeGeo } from './layout.js';
import type { EnhancedBodyGeo } from './class-body-enhanced-layout.js';
import { getBestMatchRow, buildOpaleNoteGeo, type OpalePoint, type OpaleDirection } from './note-opale.js';
import { ROW_TEXT_LEFT_MARGIN } from './class-layout-helpers.js';
import { javaRound4 } from '../../core/number-format.js';
import { resolveTextEscapes } from '../../core/text-escapes.js';
import {
  buildMemberAtoms,
  resolveMemberAtoms,
  memberBaseFont,
  buildWrappedMemberRows,
  atomsToPlainText,
  type MemberRenderAtom,
} from './class-member-creole.js';

export interface NoteGeo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Note body split into render lines. */
  lines: string[];
  /** G2/N21: each line's OWN measured text width (`javaRound4`-rounded),
   *  parallel to `lines` -- `renderer-note.ts#renderNoteText`'s per-row
   *  `textLength` attribute must use the line's real width, not the note
   *  box's shared (max-line-driven) width; jar-verified against
   *  `sisolu-74-minu975`'s 3-line note (line 1 == box max width, lines 2-3
   *  strictly narrower, each with its own distinct `textLength`).
   */
  lineWidths: number[];
  /**
   * G2 N55: each line's flat `MemberRenderAtom[]` run sequence, parallel to
   * `lines`/`lineWidths` -- routes note body text through the SAME shared
   * creole atom engine `class-member-creole.ts` already wires for classifier
   * member rows (G2 N22), so a note line carrying `**bold**`/`//italic//`/
   * `<color:...>`/etc. markup draws as its jar-real per-RUN `<text>` sequence
   * instead of one plain `<text>` of the literal (unrendered) source markup
   * -- jar-verified against `tenobo-24-liga464`'s `Yet **another**` note line
   * (jar: two `<text>` runs, "Yet" plain + "another" `font-weight="700"`, x
   * split at the FIRST run's own measured width). ALWAYS populated by
   * `measureNote` (production geo builders never omit it, mirroring
   * `ClassifierGeo.rows[].atoms`'s own "always set at layout time" contract,
   * `class-member-rows.ts`) -- optional ONLY so a hand-built `NoteGeo`
   * literal (test fixtures that construct one directly, bypassing
   * `note-layout.ts`) can omit it and fall back to the pre-cutover plain-line
   * rendering path (`renderer-note.ts#renderNoteText`'s own fallback
   * branch), matching `ClassifierGeo.rows[].atoms`'s identical optional-
   * with-fallback precedent (`renderer-classifier-box.ts#renderRowText`).
   */
  lineAtoms?: readonly (readonly MemberRenderAtom[])[];
  /**
   * G2 N56: each line's own drawn height (`Math.max(atom.font.size, 10)`
   * across every 'text' atom on that line, jar's real `AtomText.
   * calculateDimensionSlow`'s per-atom floor) -- parallel to `lines`/
   * `lineAtoms`. Jar's `Sea`/`Position`/`SheetBlock1#initMap` stack stripes
   * by each stripe's OWN height (`y += sea.getHeight()`), not a flat
   * `NOTE_FONT_SIZE` -- a `<size:18>` run on an otherwise-13pt line makes
   * THAT line 18pt tall and shifts every line below it (jar-verified
   * `fogexa-30-zupo141`/`vicuro-37-tese143`: box height 54 = 18+13+13+2*5,
   * this port's pre-N56 formula emitted 49 = 3*13+10). ALWAYS populated by
   * `measureNote` (mirrors `lineAtoms`'s own "always set at layout time,
   * optional only for a hand-built test literal" contract) -- `undefined`
   * falls back to the note's flat resolved `fontSize` per line, matching
   * the pre-N56 formula exactly (see `renderer-note.ts#renderNoteText`).
   */
  lineHeights?: readonly number[];
  /** Routed connector points from the note to its host classifier. Empty
   *  for a member-tip note (G2/N13 — the connector is a notch merged into
   *  the note's own outline instead, see `tip` below). */
  connector: Array<{ x: number; y: number }>;
  /**
   * G2/N13: true when a member-tip note's `::member` target could not be
   * resolved against any row of its host — `EntityImageTips#drawU`'s
   * `bestMatch == null` early return, which draws NOTHING for this note (no
   * box, no notch, no text). The renderer skips it entirely; ink-extent
   * walkers must too (jar's canvas excludes a dropped tip's space).
   */
  dropped?: boolean;
  /**
   * G2/N13: present only for a RESOLVED member-tip note — the zigzag notch
   * replaces the plain folded-corner box + separate dashed connector every
   * other note kind draws. `pp1`/`pp2` are LOCAL to this note's own
   * (0,0)-at-top-left frame (`note-opale.ts#OpaleConnector`).
   */
  tip?: { direction: 'left' | 'right'; pp1: OpalePoint; pp2: OpalePoint };
  /**
   * G2/N14: present only for a RESOLVED general "opalisable" note (a
   * single-link `note <pos> of X`, NOT a member-tip — `EntityImageNote
   * .java`'s `opaleLine` branch). Same zigzag-notch mechanism as `tip`
   * above, but ALL FOUR directions are reachable (`getOpaleStrategy`,
   * geometry-driven, not derived from the note's own declared position
   * keyword) and `pp1`/`pp2` come from the routed DOT connector spline
   * instead of a fixed member-row anchor.
   */
  opale?: { direction: OpaleDirection; pp1: OpalePoint; pp2: OpalePoint };
  /**
   * G2 N15: copied from `ClassNote.creationIndex` (that field's own doc
   * comment covers the phantom-GMN-slot derivation) — `undefined` for a
   * member-tip note (unchanged fallback numbering) or a dropped note.
   */
  creationIndex?: number;
  /** G2 N15: copied from `ClassNote.phantomSlot` — see that field's doc
   *  comment (`renderer-uid.ts#assignExact` consumes it). */
  phantomSlot?: true;
  /** G2 N34: copied from `ClassNote.color` — see that field's doc comment
   *  (`renderer-note.ts#resolveNoteBackground` consumes it). Absent for a
   *  dropped note (no box is drawn, so no fill to resolve). */
  color?: string;
  /** G2 N37: copied from `ClassNote.stereotype` — see that field's doc
   *  comment (`renderer-note.ts#resolveNoteBackground` consumes it for the
   *  `.tagname` `<style>` cascade). Absent for a dropped note. */
  stereotype?: string;
  /**
   * G2 N52: the host classifier's `Classifier.id` this note is attached to
   * (`ClassNote.target`, copied verbatim -- NOT the `::member` port suffix,
   * which stays in `ClassNote.targetPort` and has no renderer-side use here).
   * `undefined` for a freestanding note (no `of <Entity>` clause) or a note
   * whose `of`-target didn't resolve to an actual drawn classifier.
   * `renderer.ts` uses this to draw a note immediately after its host in
   * document order (jar draws every classifier/note as a graph NODE in real
   * creation order, then every edge -- `renderer.ts`'s own fixed classifier-
   * then-edges-then-notes phase order previously pushed EVERY note to the
   * very end regardless of source position; jar-verified via `dozugo-00-
   * jado141`/`refeku-65-gapu585`/`janeba-15-duja043`/`cajicu-52-cego765`,
   * each showing the note's `<g>` sitting between its host and the NEXT
   * classifier in jar's own output, not trailing after every classifier and
   * edge). A note with no resolved host keeps the old trailing position.
   */
  hostId?: string;
  /**
   * G2 N53: copied from `ClassNote.tipGroupPhantomIndex` -- see that
   * field's doc comment (ast.ts) and `renderer-uid.ts#assignExact` (which
   * consumes it as TWO phantom ranks). `undefined` for every note except a
   * member-tip group's leader.
   */
  tipGroupPhantomIndex?: number;
}

/**
 * Minimal classifier-position + row-text view `mapNoteGeos` needs to resolve
 * a member-tip note's connector — a local subset of `layout.ts#ClassifierGeo`
 * (importing that type directly would cycle: `layout.ts` imports
 * `mapNoteGeos` from this module).
 */
export interface ClassifierAnchor {
  id: string;
  x: number;
  y: number;
  /**
   * G2 N34: `indent` (`ClassifierGeo.rows[].indent`'s own doc comment --
   * "this row's real left-edge offset from `geo.x`") is REQUIRED, not
   * derived from a flat margin constant -- `tipAnchor` below reads it for
   * the row's TEXT-run right edge (`rowMaxX`, a visibility-icon row's own
   * text starts `ICON_WIDTH`, 14px, past the plain text margin -- jar-
   * verified `rubuxe-58-peba652`). The row's LEFT edge (`rowMinX`) stays a
   * flat margin regardless of `indent` (see `tipAnchor`'s own doc comment
   * for why the two ends of one row aren't symmetric upstream).
   */
  rows: ReadonlyArray<{ text: string; y: number; width?: number; indent: number }>;
  /**
   * G2 N47: copied unchanged from `ClassifierGeo.enhancedBody` when present
   * -- `class-layout-helpers.ts`'s enhanced-body branch leaves `rows` at
   * JUST `[...stereoRows, headerRow]` (member content lives entirely in
   * `enhancedBody.parts` instead, `renderer-body-enhanced.ts`'s own draw
   * path), so a member-tip note's `::member` target has nothing to match
   * against `rows.slice(1)` for an enhanced-body host -- every such note
   * was silently dropped (jar-verified `fopose-13-kase592`: `note right of
   * A::attr` on a class whose body triggers `isBodyEnhanced` via a bare
   * `..` separator line -- jar draws the note, this port dropped it).
   * `memberAnchorRows` below reads this to fall back to `enhancedBody`'s
   * OWN row list (already `ClassifierGeo['rows']`-shaped, N42-verified
   * byte-exact for the render path) when the classic `rows` array carries
   * no member content.
   */
  enhancedBody?: EnhancedBodyGeo;
}

/**
 * G2 N47: a host's member rows for `::member` tip-note matching --
 * `host.rows.slice(1)` (drops the header row) for a classic-body
 * classifier, or `host.enhancedBody`'s OWN flattened row list for an
 * enhanced-body one (whose `host.rows` carries no member content at all,
 * see {@link ClassifierAnchor.enhancedBody}'s doc comment). Tree rows
 * (`EnhancedTreePart`) participate too -- a tree leaf's row is exactly as
 * matchable as a plain enhanced row, same `{text, y, indent, width}` shape.
 */
function memberAnchorRows(
  host: ClassifierAnchor,
): ReadonlyArray<{ text: string; y: number; width?: number; indent: number }> {
  if (host.enhancedBody === undefined) return host.rows.slice(1);
  const out: Array<{ text: string; y: number; width?: number; indent: number }> = [];
  for (const part of host.enhancedBody.parts) {
    if (part.kind === 'rows' || part.kind === 'tree') out.push(...part.rows);
  }
  return out;
}

/** `plantuml.skin`'s `note { FontSize 13 }` default — one point smaller
 *  than the diagram's normal text. G2 N39: the DEFAULT only -- a `<style>
 *  note { FontSize N }` block (or flat `skinparam noteFontSize N`) override
 *  is threaded via `theme.colors.elements['note'].fontSize` (`ELEMENT_
 *  BUCKET_SNAMES`'s pre-existing 'note' entry, G2 N34 -- the bucket was
 *  already populated, this constant just never consulted it, jar-verified
 *  `xokipa-29-rafu481`). */
const NOTE_FONT_SIZE = 13;
/** `Opale.java`'s `marginX1`/`marginX2`/`marginY` — the note text's own
 *  inset from the folded-corner box (asymmetric: more room on the right,
 *  where the fold lives). */
const NOTE_MARGIN_X1 = 6;
const NOTE_MARGIN_X2 = 15;
const NOTE_MARGIN_Y = 5;
/** `EntityImageTips.java`'s `ySpacing` — vertical gap between stacked
 *  member-tip notes merged onto the same (host, side). */
const OPALE_Y_SPACING = 10;

/** Edge direction + minlen per note position (Svek note-on-entity). */
const NOTE_EDGE: Record<NotePosition, { fromNote: boolean; minLen: number }> = {
  left: { fromNote: true, minLen: 0 },
  right: { fromNote: false, minLen: 0 },
  top: { fromNote: true, minLen: 1 },
  bottom: { fromNote: false, minLen: 1 },
};

interface NoteMeasurement {
  width: number;
  height: number;
  lines: string[];
  lineWidths: number[];
  /** G2 N55: see `NoteGeo.lineAtoms`'s own doc comment -- ALWAYS populated
   *  here (this is the one production builder, unlike the geo's own optional
   *  field which also serves hand-built test literals). */
  lineAtoms: readonly (readonly MemberRenderAtom[])[];
  /** G2 N56: see `NoteGeo.lineHeights`'s own doc comment -- ALWAYS populated
   *  here, same "production builder always sets it" contract as `lineAtoms`
   *  above. */
  lineHeights: readonly number[];
}

/**
 * G2/N13: corrected to the real `Opale.java` formula — `getWidth`/
 * `getHeight` (`textWidth + marginX1 + marginX2`, `textBlockHeight +
 * 2*marginY`) at the note-specific font size 13, one line == `NOTE_FONT_
 * SIZE` tall (mirrors `class-layout-helpers.ts`'s own "row height ==
 * fontSize, not `*1.4`" convention, G2 N4). Jar-verified byte-exact against
 * `cajicu-52-cego765` (single line: width 7.2313+21=28.2313, height
 * 13+10=23) and `tenobo-24-liga464` (multi-line notes, same per-line
 * height). The PREVIOUS formula (`fontSize*1.4` line height, `+16+10`
 * margin, at the diagram's normal font size) was never jar-verified — no
 * fixture reached zero-diff through it (see ledger.md N6-N12's own
 * "diagnosed, not fixed" note-connector entries).
 */
function measureNote(
  text: string,
  theme: Theme,
  measurer: StringMeasurer,
): NoteMeasurement {
  // G2/N21: `<U+XXXX>` unicode-codepoint / `&#NNN;` HTML entity escapes,
  // resolved BEFORE measuring/splitting -- shared with description's
  // identical AtomText-derived mechanism (`core/text-escapes.ts`),
  // jar-verified against `pacuve-18-gaso238`'s `<U+005C>` (a literal `\`).
  const rawLines = resolveTextEscapes(text).split('\n');
  // G2 N39: `<style> note { FontSize N }` / `skinparam noteFontSize N`
  // override -- see `NOTE_FONT_SIZE`'s own doc comment above.
  const fontSize = theme.colors.elements?.['note']?.fontSize ?? NOTE_FONT_SIZE;
  const fontSpec = { family: theme.fontFamily, size: fontSize };
  // G2 N55: each line routes through the SAME shared creole atom engine
  // `class-member-creole.ts` wires for classifier member rows (`buildMember
  // Atoms`/`resolveMemberAtoms`, N22's own `classifyStripeLine` -> `build
  // StripeAtoms`/`buildLiteralAtoms` dispatch) -- `memberBaseFont(fontSpec,
  // {})` with an EMPTY member object (a note line has no `{abstract}`/
  // `{static}` modifier concept) yields the exact `{family, size, color:
  // null, styles: new Set()}` base font, whose `atomFontSpec` projection is
  // BYTE-IDENTICAL to the pre-cutover `fontSpec` local below (no `weight`/
  // `style` keys) -- this is the mission's own measurement-identity proof:
  // for a line with NO creole markup, `buildStripeAtoms` returns EXACTLY one
  // `{kind:'text', text: line, font}` atom (`StripeSimple.ts`'s own doc
  // comment guarantee) and `resolveMemberAtoms` measures it via `measurer
  // .measure(line, atomFontSpec(font))` -- the SAME call, SAME arguments,
  // as the removed direct `measurer.measure(ln, fontSpec).width` line this
  // replaces (see `class-member-creole.test.ts`'s identical proof for
  // member rows, N22's own precedent).
  const font = memberBaseFont(fontSpec, {});
  // G2 N66 (item 35's own named remainder, N65): `<style> note { MaximumWidth
  // N } }` / `element { MaximumWidth N } }` word-wrap -- `EntityImageNote`'s
  // OWN style signature (`theme.ts#noteCascadeMaximumWidth`'s own doc
  // comment). Reuses item 35's `buildWrappedMemberRows` (Fission) PER
  // already-`\n`-split source line -- each stripe wraps INDEPENDENTLY (a
  // hard break from the source text never merges across the wrap, matching
  // `wrapPlainTextLine`'s identical "flatMap over already-split lines"
  // shape for the classifier header, N65) -- `maxWidth<=0` (the
  // overwhelming majority of notes) short-circuits every line to the SAME
  // single-build result the pre-N66 direct call produced, byte-identical.
  const maxWidth = theme.colors.graph.noteCascadeMaximumWidth ?? 0;
  const lines: string[] = [];
  const lineWidths: number[] = [];
  const lineAtoms: (readonly MemberRenderAtom[])[] = [];
  for (const ln of rawLines) {
    const builds = maxWidth > 0
      ? buildWrappedMemberRows(ln, {}, fontSpec, measurer, maxWidth)
      : [resolveMemberAtoms(buildMemberAtoms(ln, font), font, measurer)];
    // G2 N66: mirrors `buildWrappedSectionRowBuilds`'s own convention --
    // the SINGLE-row case (the overwhelming majority) keeps the source
    // line's ORIGINAL text verbatim; only a GENUINELY wrapped (2+ row)
    // line rebuilds each row's own text from its wrapped atoms
    // (`atomsToPlainText`, `class-member-rows.ts#buildWrappedSectionRowBuilds`'s
    // own doc comment for why `row.text` is otherwise unconsumed whenever
    // `row.atoms`/`lineAtoms` is set).
    for (const build of builds) {
      lines.push(builds.length === 1 ? ln : atomsToPlainText(build.atoms));
      lineWidths.push(javaRound4(build.width));
      lineAtoms.push(build.atoms);
    }
  }
  // G2 N56: per-line height, see `NoteGeo.lineHeights`'s own doc comment.
  const lineHeights = lineAtoms.map((atoms) => noteLineHeight(atoms, fontSize));
  const maxW = Math.max(...lineWidths);
  return {
    lines,
    lineWidths,
    lineAtoms,
    lineHeights,
    width: maxW + NOTE_MARGIN_X1 + NOTE_MARGIN_X2,
    height: lineHeights.reduce((sum, h) => sum + h, 0) + NOTE_MARGIN_Y * 2,
  };
}

/**
 * G2 N56: one note line's own height -- jar's real `Sea`/`Position` math
 * (`SheetBlock1#initMap`'s `sea.doAlign()` + `getHeight() == getMaxY() -
 * getMinY()`) reduces, for every NORMAL (non-superscript/subscript,
 * `FontPosition.getSpace() == 0`) atom, to a flat MAX over each atom's OWN
 * `AtomText#calculateDimensionSlow` height (`stringBounder.calculateDimension
 * (...).getHeight()`, floored at 10) -- NOT an ascent/descent-weighted SUM
 * (confirmed algebraically: every atom's measured-rect BOTTOM edge aligns to
 * the SAME shared y=0, so the stripe's total span is exactly the tallest
 * atom's own height; re-derivation cross-checked against `fogexa-30-
 * zupo141`'s real per-run baselines -- "In java," @ y=26.1111 (13pt),
 * "every" @ y=25 (18pt, `<size:18>`) on the SAME physical line, delta
 * 1.1111 == the two sizes' own `size/4.5` descent difference, and the NEXT
 * line's baseline sits EXACTLY 18 (not 13) below this line's own top,
 * proving the cumulative stack advances by each line's own MAX height).
 * Scoped to 'text' atoms only -- an 'image'/'vector' atom's own height
 * contribution is UNCONFIRMED by any corpus fixture (`AtomOpenIconic`'s own
 * `getStartingAltitude` is `-3*factor`, NOT the 0 every 'text'/'image' atom
 * uses, so the same "align bottoms to 0" derivation would need independent
 * verification before extending to it -- deliberately NOT guessed here, see
 * `renderer-note.ts#renderNoteLineAtoms`'s matching scope note). A line with
 * no 'text' atom at all (an image-only line, zero corpus reach) falls back
 * to `fallbackFontSize`, matching this function's pre-N56 flat behavior for
 * that unconfirmed case.
 */
function noteLineHeight(atoms: readonly MemberRenderAtom[], fallbackFontSize: number): number {
  let max = -Infinity;
  for (const atom of atoms) {
    if (atom.kind !== 'text') continue;
    const h = Math.max(atom.font.size, 10);
    if (h > max) max = h;
  }
  return max === -Infinity ? Math.max(fallbackFontSize, 10) : max;
}

/**
 * A run of one or more `ClassNote`s that collapse into a single svek node —
 * upstream merges every note attached to the SAME SIDE of the SAME HOST into
 * one graphviz box, even when each targets a different `::member` suffix
 * (verified against the oracle: kugasi-68-josu446, sanusa-54-keda128,
 * tenobo-24-liga464 each have 2+ `note left/right of Host::member`
 * statements on one side of one host, and the oracle svek DOT emits exactly
 * ONE node for that side, not one per statement). Freestanding notes (no
 * target/position) and notes on different sides or hosts never merge — each
 * gets its own singleton group.
 */
interface NoteGroup {
  /** Dot node id — the first member note's id, reused so downstream
   *  position lookups have a stable key. */
  id: string;
  target?: string;
  position?: NotePosition;
  /**
   * Member-anchored (`Class::member`) notes route as an invisible
   * layout-only edge; plain-classifier notes (including package anchors)
   * get a visible connector — verified against the oracle (kugasi/sanusa/
   * tenobo's `::member` notes are `style=invis`; dibinu/cejili's
   * plain-entity notes and pecabi/sanixi's package notes are not).
   */
  invis: boolean;
  /** Indices into the original `notes` array, in stacking order. */
  memberIndices: number[];
}

/** A singleton group for a freestanding note or a note's first appearance
 *  on a given (host, side). */
function newGroup(note: ClassNote, i: number): NoteGroup {
  return {
    id: note.id,
    ...(note.target !== undefined ? { target: note.target } : {}),
    ...(note.position !== undefined ? { position: note.position } : {}),
    invis: note.target !== undefined && note.targetPort !== undefined,
    memberIndices: [i],
  };
}

/** Only an EXPLICIT `of <Entity>` note is merge-eligible — a bare
 *  `note <pos>` (implicitTarget, falls back to lastEntity) never merges,
 *  even onto the same (host, side) as an explicit one (zepeki-75-pifo352). */
function mergeKey(note: ClassNote): string | undefined {
  if (note.target === undefined || note.position === undefined) return undefined;
  if (note.implicitTarget === true) return undefined;
  return `${note.target}|${note.position}`;
}

function groupNotes(notes: ClassNote[]): NoteGroup[] {
  const groups: NoteGroup[] = [];
  const bySameSideHost = new Map<string, NoteGroup>();
  for (const [i, note] of notes.entries()) {
    const key = mergeKey(note);
    const existing = key === undefined ? undefined : bySameSideHost.get(key);
    if (existing !== undefined) {
      existing.memberIndices.push(i);
      continue;
    }
    const group = newGroup(note, i);
    if (key !== undefined) bySameSideHost.set(key, group);
    groups.push(group);
  }
  return groups;
}

/**
 * Merged box for a group: as wide as its widest member, tall enough to
 * stack all of them (the renderer draws each member as its own
 * folded-corner box within this reserved column — see mapNoteGeos).
 *
 * G2 N34: a member-tip group (`group.invis`, `EntityImageTips.java`'s
 * `calculateDimensionSlow`) reserves `dim.getHeight() + ySpacing` PER TIP,
 * unconditionally — even a LONE tip gets one `ySpacing` (10px) added, not
 * just a between-tips gap. jar-verified via the cached DOT (`gerima-02-
 * fade831`'s single-tip node: `height=0.458333in` = 33px = 23 (this port's
 * own `measureNote` height) + 10 (`OPALE_Y_SPACING`), NOT 23 alone) and the
 * rendered SVG gap between two stacked tips (`tenobo-24-liga464`: box 1
 * spans y=19-42, box 2 starts at y=52 — a 10px gap, not flush). A plain
 * (non-tip) merged group has no such term — `EntityImageNote.java`'s own
 * `calculateDimensionSlow` is bare `getPreferredHeight` (no `ySpacing`
 * add) — so this only applies when `group.invis` is true.
 */
function groupNodeSize(
  group: NoteGroup,
  notes: ClassNote[],
  measurements: Map<string, NoteMeasurement>,
): { width: number; height: number } {
  const sizes = group.memberIndices.map((i) => measurements.get(notes[i]!.id)!);
  const spacingPerMember = group.invis ? OPALE_Y_SPACING : 0;
  return {
    width: Math.max(...sizes.map((m) => m.width)),
    height: sizes.reduce((sum, m) => sum + m.height + spacingPerMember, 0),
  };
}

/**
 * The group's connector edge, or `undefined` for a freestanding note (no
 * host/position — any connector for it is a regular relationship line). A
 * package/namespace target routes to its `zaent-*` point anchor.
 *
 * G2/N14: `noArrow: true` always -- a note connector NEVER draws a real
 * arrowhead (merged into the note's own Opale outline when opalisable, a
 * bare undecorated dashed line otherwise, `renderer-note.ts#renderNote`'s
 * own connector draw has no marker) -- without it, graphviz-ts reserves its
 * default ~10-11px arrowhead-clip gap when trimming the routed spline to
 * the note's box boundary (`core/graph-layout.ts#addEdges`'s own doc
 * comment), which made `resolveOpaleConnector`'s notch anchor land ~11px
 * short of the real box edge (jar-verified wrong against `fezugi-39-
 * fujo327` before this fix).
 */
function groupEdge(group: NoteGroup, anchors: ReadonlyMap<string, string>): DotInputEdge | undefined {
  if (group.target === undefined || group.position === undefined) return undefined;
  const dir = NOTE_EDGE[group.position];
  const to = anchors.get(group.target) ?? group.target;
  const attributes: NonNullable<DotInputEdge['attributes']> = { minLen: dir.minLen, noArrow: true };
  if (group.invis) attributes.invis = true;
  return {
    id: `__noteedge_${group.id}`,
    from: dir.fromNote ? group.id : to,
    to: dir.fromNote ? to : group.id,
    attributes,
  };
}

/**
 * Build the seam nodes + connector edges for note-on-entity.
 *
 * `anchors` maps a package/namespace id to its `zaent-*` point-anchor id
 * (see class-layout-helpers.ts's `packageEndpointAnchors`) — a
 * `note <pos> of <package>` target routes its connector to that anchor
 * instead of the package's own id, the same substitution relationship
 * edges get when a package is used as an endpoint.
 */
export function buildNoteGraphParts(
  notes: ClassNote[],
  theme: Theme,
  measurer: StringMeasurer,
  anchors: ReadonlyMap<string, string>,
): {
  nodes: DotInputNode[];
  edges: DotInputEdge[];
  measurements: Map<string, NoteMeasurement>;
  groups: NoteGroup[];
} {
  const measurements = new Map<string, NoteMeasurement>();
  for (const note of notes) measurements.set(note.id, measureNote(note.text, theme, measurer));

  const groups = groupNotes(notes);
  const nodes: DotInputNode[] = groups.map((group) => ({
    id: group.id,
    ...groupNodeSize(group, notes, measurements),
  }));
  const edges: DotInputEdge[] = [];
  for (const group of groups) {
    const edge = groupEdge(group, anchors);
    if (edge !== undefined) edges.push(edge);
  }
  return { nodes, edges, measurements, groups };
}

/**
 * Resolve a member-tip group's shared direction + host offset once (every
 * member in the group targets the SAME host+side, `mergeKey`'s own
 * invariant) — `EntityImageTips.java`'s `getPosition()`/`reverseDirection()`
 * plus its one-sided flip correction.
 * @see ~/git/plantuml/.../svek/image/EntityImageTips.java#drawU
 */
function resolveTipDirection(
  position: NotePosition,
  hostX: number,
  noteX: number,
): 'left' | 'right' {
  // Position.LEFT.reverseDirection() === RIGHT; Position.RIGHT.reverseDirection() === LEFT.
  const initial: 'left' | 'right' = position === 'left' ? 'right' : 'left';
  const xRaw = hostX - noteX;
  return initial === 'right' && xRaw < 0 ? 'left' : initial;
}

/** Per-group constants `tipAnchor`/`buildTipNoteGeo` need, resolved once per
 *  group rather than threaded as separate parameters (complexity-hook
 *  param cap). */
interface TipContext {
  direction: 'left' | 'right';
  host: ClassifierAnchor;
  notePos: { x: number; y: number };
  baselineOffset: number;
  rowHeight: number;
}

/**
 * `group.invis`'s host + direction, or `undefined` for any group that isn't
 * a resolvable member-tip group (freestanding, host-less, or a host that no
 * longer exists post `remove`/`hide`).
 * @see ~/git/plantuml/.../svek/image/EntityImageTips.java#drawU
 */
function resolveGroupTipContext(
  group: NoteGroup,
  pos: { x: number; y: number },
  classifierById: ReadonlyMap<string, ClassifierAnchor>,
  baselineOffset: number,
  rowHeight: number,
): TipContext | undefined {
  if (!group.invis || group.target === undefined || group.position === undefined) return undefined;
  const host = classifierById.get(group.target);
  if (host === undefined) return undefined;
  const direction = resolveTipDirection(group.position, host.x, pos.x);
  return { direction, host, notePos: pos, baselineOffset, rowHeight };
}

/**
 * The zigzag notch's host-side anchor point (`pp2`, LOCAL to the note's own
 * frame) for one resolved member-tip row.
 * @see ~/git/plantuml/.../svek/image/EntityImageTips.java#drawU
 */
function tipAnchor(
  ctx: TipContext,
  row: { y: number; width?: number; indent: number },
  heightAccum: number,
): OpalePoint {
  const { direction, host, notePos, baselineOffset, rowHeight } = ctx;
  const rowCenterY = row.y - baselineOffset + rowHeight / 2;
  // G2 N34: jar's real anchor is the row's OWN rendered bounding box
  // (`memberPosition.getMinX()`/`getMaxX()`, `EntityImageTips.java#drawU`).
  // `getMinX()` is the ROW's own left edge -- the icon-zone reservation
  // STARTS there whether or not this particular row has an icon, so it
  // stays the flat `ROW_TEXT_LEFT_MARGIN` constant regardless (jar-verified
  // `sanusa-54-keda128`: icon rows, anchor lands at `host.x + 6`, NOT
  // `host.x + row.indent`). `getMaxX()` is the row's TEXT run's own right
  // edge -- `row.indent` (icon-zone-aware) + the text's own measured
  // width (jar-verified `rubuxe-58-peba652`: `+attribute`, anchor lands at
  // `host.x + row.indent + row.width`, NOT `host.x + ROW_TEXT_LEFT_MARGIN +
  // row.width`). The two ends of the SAME row's bounding box are simply
  // measured from different reference points upstream -- not a symmetric
  // pair.
  const rowMinX = ROW_TEXT_LEFT_MARGIN;
  const rowMaxX = row.indent + (row.width ?? 0);
  const xRaw = host.x - notePos.x;
  return {
    x: xRaw + (direction === 'left' ? rowMaxX : rowMinX),
    y: host.y - notePos.y - heightAccum + rowCenterY,
  };
}

/**
 * One resolved member-tip note's geo, or `undefined` when its `::member`
 * target didn't match any host row (the caller marks it — and every later
 * member in the group — `dropped` instead).
 */
function buildTipNoteGeo(
  note: ClassNote,
  m: NoteMeasurement,
  origin: { x: number; y: number },
  ctx: TipContext,
  heightAccum: number,
): NoteGeo | undefined {
  const match = getBestMatchRow(memberAnchorRows(ctx.host), note.targetPort!);
  if (match === undefined) return undefined;
  const pp2 = tipAnchor(ctx, match, heightAccum);
  return {
    id: note.id, x: origin.x, y: origin.y, width: m.width, height: m.height, lines: m.lines,
    lineWidths: m.lineWidths,
    lineAtoms: m.lineAtoms,
    lineHeights: m.lineHeights,
    connector: [],
    tip: { direction: ctx.direction, pp1: { x: 0, y: m.height / 2 }, pp2 },
    ...(note.color !== undefined ? { color: note.color } : {}),
    ...(note.stereotype !== undefined ? { stereotype: note.stereotype } : {}),
  };
}


/** One dropped (unresolved `::member`) note's geo — no box, no notch, no
 *  text; kept in the output only so ink-extent walkers and uid assignment
 *  have a stable slot to skip. */
function droppedNoteGeo(note: ClassNote, m: NoteMeasurement, origin: { x: number; y: number }): NoteGeo {
  return { id: note.id, x: origin.x, y: origin.y, width: m.width, height: m.height, lines: m.lines, lineWidths: m.lineWidths, lineAtoms: m.lineAtoms, lineHeights: m.lineHeights, connector: [], dropped: true };
}

/** A plain (non-tip) note's geo — the shared shape both the tip and
 *  non-tip stacking branches would otherwise repeat inline. */
function plainNoteGeo(note: ClassNote, m: NoteMeasurement, origin: { x: number; y: number }, connector: Array<{ x: number; y: number }>): NoteGeo {
  return {
    id: note.id, x: origin.x, y: origin.y, width: m.width, height: m.height, lines: m.lines, lineWidths: m.lineWidths,
    lineAtoms: m.lineAtoms,
    lineHeights: m.lineHeights,
    connector,
    ...(note.creationIndex !== undefined ? { creationIndex: note.creationIndex } : {}),
    ...(note.phantomSlot !== undefined ? { phantomSlot: note.phantomSlot } : {}),
    ...(note.color !== undefined ? { color: note.color } : {}),
    ...(note.stereotype !== undefined ? { stereotype: note.stereotype } : {}),
  };
}

/** `notes`/`measurements` are always threaded together — bundled into one
 *  parameter (complexity-hook param cap). */
interface NoteDataset {
  notes: ClassNote[];
  measurements: Map<string, NoteMeasurement>;
}

/** One member-tip note's own identity + measurement + stacked position —
 *  bundled into one parameter for `resolveTipMember` (complexity-hook
 *  param cap). */
interface TipMember {
  note: ClassNote;
  m: NoteMeasurement;
  origin: { x: number; y: number };
}

/** One member-tip note's outcome within its group's stacking loop — either
 *  its resolved geo, or a dropped placeholder plus the abort signal every
 *  LATER member in the same group must also honor. */
function resolveTipMember(
  member: TipMember,
  tipCtx: TipContext,
  aborted: boolean,
  heightAccum: number,
): { geo: NoteGeo; dropped: boolean } {
  const { note, m, origin } = member;
  const geo = aborted ? undefined : buildTipNoteGeo(note, m, origin, tipCtx, heightAccum);
  return geo === undefined ? { geo: droppedNoteGeo(note, m, origin), dropped: true } : { geo, dropped: false };
}

/**
 * One group's members, stacked. G2/N13: a member-tip note's OWN drawn
 * width/height is its INDIVIDUAL measurement (`m.width`/`m.height`), not
 * the shared group's `pos.width` — upstream stacks each tip as its own
 * independently-sized box within the group's reserved (max-width) DOT
 * column, left-aligned, not stretched to a common width (jar-verified:
 * `tenobo-24-liga464`'s two right-side tips draw at the SAME x but
 * DIFFERENT widths, 160.425 and 248.0938). A member-tip row that matches
 * NOTHING marks the note (and every LATER member in the same group)
 * `dropped` — mirrors `EntityImageTips#drawU`'s mid-loop early return,
 * which leaves already-drawn tips alone but aborts every remaining one.
 */
/**
 * G2 N53: splice `ClassNote.tipGroupPhantomIndex` onto its produced
 * `NoteGeo` -- applied uniformly across every branch of {@link
 * mapGroupNoteGeos}'s loop (tip/opale/plain/dropped) since a tip group's
 * LEADER can, in principle, fall through to a non-tip branch when its host
 * doesn't resolve (`tipCtx === undefined`) while still having burned its
 * parse-time phantom ranks -- the numbering consequence is independent of
 * which shape ends up drawn.
 */
function withTipGroupPhantom(geo: NoteGeo, note: ClassNote): NoteGeo {
  return note.tipGroupPhantomIndex !== undefined
    ? { ...geo, tipGroupPhantomIndex: note.tipGroupPhantomIndex }
    : geo;
}

function mapGroupNoteGeos(
  group: NoteGroup,
  data: NoteDataset,
  pos: { x: number; y: number },
  connectorPoints: Array<{ x: number; y: number }>,
  tipCtx: TipContext | undefined,
  // G2 N57 item 37: `GraphvizImageBuilder.java#isOpalisable`'s FIRST guard
  // clause -- `if (dotData.getSkinParam().strictUmlStyle()) return false;`
  // -- `skinparam style strictuml` disables the Opale merge UNCONDITIONALLY
  // for every single-link note, forcing the plain folded-corner box +
  // separate dashed connector shape instead (jar-verified: `fogexa-30-
  // zupo141`'s real golden SVG has `<path stroke-dasharray:7,7 .../>` as a
  // SEPARATE element, not a merged notch -- its `in.puml` carries `skinparam
  // style strictuml`). Every OTHER `isOpalisable` condition (leafType==NOTE,
  // exactly-one-link, other-end-not-a-note) is already faithfully
  // reproduced by `findUniqueTouching`/this function's own singleton-group
  // branch below -- this was the ONE missing guard.
  strictUml: boolean,
): NoteGeo[] {
  const out: NoteGeo[] = [];
  let yOffset = 0;
  let tipHeightAccum = 0;
  let aborted = false;
  for (const [memberOrder, i] of group.memberIndices.entries()) {
    const note = data.notes[i]!;
    const m = data.measurements.get(note.id)!;
    const origin = { x: pos.x, y: pos.y + yOffset };
    // G2 N34: a RESOLVED tip's own visual stacking advance is `m.height +
    // OPALE_Y_SPACING`, mirroring `groupNodeSize`'s identical DOT-height
    // term (`EntityImageTips.java`'s `ySpacing`, jar-verified via
    // `tenobo-24-liga464`'s rendered 10px inter-tip gap) -- a DROPPED tip
    // (or a non-tip member) advances by `m.height` alone, matching jar's
    // `drawU`'s early `return` (no `ug.apply`/`height +=` call at all) once
    // a `::member` match fails.
    let advance = m.height;

    if (tipCtx !== undefined && note.targetPort !== undefined) {
      const { geo, dropped } = resolveTipMember({ note, m, origin }, tipCtx, aborted, tipHeightAccum);
      out.push(withTipGroupPhantom(geo, note));
      aborted = dropped;
      if (!dropped) {
        tipHeightAccum += m.height + OPALE_Y_SPACING;
        advance += OPALE_Y_SPACING;
      }
    } else if (group.memberIndices.length === 1) {
      // G2/N14: singleton group with a real connector -- try the general
      // opalisable mechanism first, fall back to the plain fold box when
      // the connector doesn't resolve (freestanding note, degenerate spline).
      // G2 N57 item 37: `strictUml` skips the Opale attempt entirely --
      // see this function's own `strictUml` param doc comment.
      const geo = strictUml
        ? plainNoteGeo(note, m, origin, connectorPoints)
        : (buildOpaleNoteGeo(note, m, origin, connectorPoints) ?? plainNoteGeo(note, m, origin, connectorPoints));
      out.push(withTipGroupPhantom(geo, note));
    } else {
      out.push(withTipGroupPhantom(plainNoteGeo(note, m, origin, memberOrder === 0 ? connectorPoints : []), note));
    }
    yOffset += advance;
  }
  return out;
}

/**
 * Map the dot layout result back to `NoteGeo[]` for the renderer. Each
 * original note keeps its own visual box — a merged group's members stack
 * vertically within the group's laid-out bounding rect (matches the oracle
 * SVG: same-side notes render as separate folded-corner boxes flush against
 * each other, sharing one reserved layout column); see `mapGroupNoteGeos`
 * for the per-member stacking/tip-resolution rules.
 */
export function mapNoteGeos(
  notes: ClassNote[],
  result: DotLayoutResult,
  noteParts: { measurements: Map<string, NoteMeasurement>; groups: NoteGroup[] },
  anchorCtx: { classifiers: ReadonlyArray<ClassifierAnchor>; theme: Theme; measurer: StringMeasurer },
  /** G2/N16 Kind B: a freestanding note's ONE real relationship connector,
   *  keyed by note id (`note-freestanding.ts`); consulted only when the
   *  group has no synthetic `__noteedge_*` (a freestanding note has no
   *  `target`/`position`). */
  freestandingConnectors?: ReadonlyMap<string, EdgeGeo>,
): NoteGeo[] {
  const { measurements, groups } = noteParts;
  const { classifiers, theme, measurer } = anchorCtx;
  const posMap = new Map(result.nodes.map((n) => [n.id, n]));
  const classifierById = new Map(classifiers.map((c) => [c.id, c]));
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const baselineOffset = fontSpec.size - measurer.getDescent(fontSpec, '');
  const rowHeight = fontSpec.size;
  const data: NoteDataset = { notes, measurements };

  const out: NoteGeo[] = [];
  for (const group of groups) {
    const pos = posMap.get(group.id);
    if (pos === undefined) continue;
    const noteEdge = result.edges.find((e) => e.id === `__noteedge_${group.id}`);
    const points = noteEdge?.points ?? freestandingConnectors?.get(group.id)?.points ?? [];
    const tipCtx = resolveGroupTipContext(group, pos, classifierById, baselineOffset, rowHeight);
    const geos = mapGroupNoteGeos(group, data, pos, points, tipCtx, theme.strictUml === true);
    // G2 N52: `NoteGeo.hostId`'s own doc comment -- only meaningful when the
    // target actually resolved to a drawn classifier (`classifierById`
    // mirrors the SAME lookup `resolveGroupTipContext` above already made).
    if (group.target !== undefined && classifierById.has(group.target)) {
      for (const g of geos) g.hostId = group.target;
    }
    out.push(...geos);
  }
  return out;
}
