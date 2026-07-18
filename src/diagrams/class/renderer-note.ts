/**
 * Note rendering — folded-corner box + dashed connector, or the Opale
 * zigzag-notch member-tip shape (G2/N13). Split out of `renderer.ts` to
 * keep that file under the project's 500-line file cap (mirrors
 * `renderer-arrowhead.ts`/`renderer-group.ts`/`renderer-uid.ts`'s own
 * "split purely for size, no behavior change" precedent).
 */
import type { NoteGeo } from './note-layout.js';
import type { EdgeGeo } from './layout.js';
import type { Theme } from '../../core/theme.js';
import type { Paint } from '../../core/paint.js';
import { text, path, polygon, image, linkWrap } from '../../core/svg.js';
import { resolveColorToSvgHex } from '../../core/klimt/color/HColorSet.js';
import { resolveBareOrBackColor } from './class-color-override.js';
import { splitStereotypeStyleTags } from './class-stereotype.js';
import { cleanStereotypeToken } from '../../core/style-map-element.js';
import {
  opalePolygonLeft,
  opalePolygonRight,
  opalePolygonUp,
  opalePolygonDown,
  opaleCorner,
  type OpaleBox,
  type OpaleConnector,
  type OpaleDirection,
} from './note-opale.js';
import { FontStyle } from '../../core/klimt/shape/UText.js';
import type { MemberRenderAtom } from './class-member-creole.js';
import { javaRound4 } from '../../core/number-format.js';
import { renderOpenIconicAtom } from './renderer-openiconic.js';

/**
 * Bezier-spline or polyline path data for a routed connector — the SAME
 * shape `renderer.ts#renderEdge` builds for a normal relationship edge
 * (`(points.length - 1) % 3 === 0` and `>= 4` points ⇒ well-formed cubic
 * bezier chain, else a plain polyline fallback for the degenerate 2-point
 * case). Duplicated rather than imported: `renderer.ts` itself imports this
 * module, so importing back would cycle; both copies are pure functions
 * with no shared state, kept in lockstep by doc-comment cross-reference.
 * @see renderer.ts#buildPathData
 */
function buildConnectorPathData(points: EdgeGeo['points']): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (first === undefined) return '';
  const start = `M${first.x},${first.y}`;

  const isBezierSpline = points.length >= 4 && (points.length - 1) % 3 === 0;
  if (isBezierSpline) {
    const segments: string[] = [];
    for (let i = 1; i < points.length; i += 3) {
      const c1 = points[i]!;
      const c2 = points[i + 1]!;
      const end = points[i + 2]!;
      segments.push(`C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`);
    }
    return [start, ...segments].join(' ');
  }

  const segments = rest.map((p) => `L${p.x},${p.y}`);
  return [start, ...segments].join(' ');
}

/**
 * G2 N34: jar's `EntityImageNote` ctor default (`ColorParam.noteBackground`,
 * `plantuml.skin`) -- the fallback when NEITHER the note's own explicit
 * `#color` NOR a `<style> note { BackgroundColor ... }` bucket applies.
 */
const NOTE_FILL = '#FEFFDD';

/**
 * G2 N34: a note's own fill color, cascading explicit `#color` override
 * (`ClassNote.color`, highest precedence -- `EntityImageNote.java`'s ctor:
 * `entity.getColors().getColor(BACK)` wins outright) -> the `<style> note
 * { BackgroundColor ... } </style>` bucket default -> the hardcoded
 * `NOTE_FILL`. Reads `theme.colors.elements.note` directly rather than via
 * `resolveElementPaint` (`theme.ts`) -- that helper's own generic "no
 * bucket" fallback is `nodeBackground` (`#F1F1F1`, the class-box default),
 * NOT jar's real note default (`ColorParam.noteBackground`, `#FEFFDD`) --
 * using it here would silently wrongize every note with no override. The
 * nested `.tagname` stereotype-cascade sub-selector (`note { .faint { ...
 * } }`) is a SEPARATE, deeper mechanism -- surveyed, not built (ledger).
 */
function resolveNoteBackground(
  color: string | undefined,
  theme: Theme,
  // G2 N37: the note's OWN `<<stereotype>>` (`ClassNote.stereotype`) --
  // resolves the `.tagname` `<style>` cascade (`note { .faint {
  // BackgroundColor red } } }`) between the explicit `#color` override and
  // the bare `note {}` bucket default. Optional/trailing so every
  // pre-existing call site (no stereotype) is behavior-unchanged.
  stereotype?: string,
): Paint {
  const override = resolveBareOrBackColor(color);
  if (override !== undefined) return resolveColorToSvgHex(override);
  const tagBackground = resolveNoteTagBackground(theme, stereotype);
  if (tagBackground !== undefined) return tagBackground;
  const bucket = theme.colors.elements?.['note']?.background;
  if (bucket === undefined) return NOTE_FILL;
  // A `<style> note { BackgroundColor red }` bucket value is a raw
  // `parseColor` result (`core/paint.ts`) -- a plain color NAME still needs
  // HColorSet resolution (`resolveColorToSvgHex`, same as the explicit-
  // override branch above); a Gradient object is already a resolved `Paint`
  // and passes through unchanged (`core/svg.ts#resolvePaint` handles it).
  return typeof bucket === 'string' ? resolveColorToSvgHex(bucket) : bucket;
}

/**
 * G2 N37: `theme.colors.noteTagCascade` lookup, resolving the note's own
 * (possibly multi-label) stereotype the SAME way {@link
 * splitStereotypeStyleTags} splits a classifier's -- a note's stereotype
 * blob follows the identical `<<A>><<B>>` stacking grammar. Returns the
 * FIRST matching label's background (already a resolved `Paint` from
 * `computeNoteStyleTagCascade`'s `parseColor` call), or `undefined`.
 */
function resolveNoteTagBackground(theme: Theme, stereotype: string | undefined): Paint | undefined {
  if (stereotype === undefined) return undefined;
  const cascade = theme.colors.noteTagCascade;
  if (cascade === undefined) return undefined;
  for (const label of splitStereotypeStyleTags(stereotype)) {
    const bg = cascade[cleanStereotypeToken(label)]?.background;
    if (bg !== undefined) return bg;
  }
  return undefined;
}
/** `Opale.java`'s `cornersize` -- the folded-corner triangle size, shared by
 *  BOTH the plain fold (this file) and the zigzag-notch tip outline
 *  (`note-opale.ts#opaleCorner`, the SAME upstream constant). */
const NOTE_FOLD = 10;
/** `Opale.java`'s `marginX1`/`marginY` -- text inset from the note box's
 *  own top-left corner (matches `note-layout.ts#measureNote`'s sizing). */
const NOTE_MARGIN_X1 = 6;
const NOTE_MARGIN_Y = 5;
/** `plantuml.skin`'s `note { FontSize 13 }` default -- one point smaller
 *  than the diagram's normal text (matches `note-layout.ts#NOTE_FONT_SIZE`).
 *  G2 N39: the DEFAULT only -- see that constant's own doc comment for the
 *  `theme.colors.elements['note'].fontSize` override this renderer now also
 *  consults (`renderNoteText`'s own `fontSize` local). */
const NOTE_FONT_SIZE = 13;
/** `note { LineThickness 0.5 }` (`plantuml.skin`) -- both the outline/
 *  corner paths and the plain connector line. */
const NOTE_STROKE_WIDTH = 0.5;

/** `FontStyle` set -> the SVG `text-decoration` attribute value -- exact
 *  duplicate of `renderer-classifier-box.ts`'s private `memberAtomDecoration`
 *  (that file's own doc comment explains why class's renderer has no shared
 *  `UDriver`/`UGraphic` seam to hang a common import off of; this note-local
 *  copy follows the SAME precedent `buildConnectorPathData` above already
 *  set for this file). */
function noteAtomDecoration(styles: ReadonlySet<FontStyle>): string | undefined {
  const parts: string[] = [];
  if (styles.has(FontStyle.UNDERLINE)) parts.push('underline');
  if (styles.has(FontStyle.STRIKE)) parts.push('line-through');
  if (styles.has(FontStyle.WAVE)) parts.push('wavy underline');
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * G2 N55: draws ONE note line's per-atom creole content -- the note-local
 * mirror of `renderer-classifier-box.ts`'s private `renderRowAtoms` (same
 * per-atom-kind switch, same `javaRound4`-per-atom-`textLength`/unrounded-
 * x-advance convention, same doc-comment-cited rounding rule) -- duplicated
 * rather than imported since that function is private to a file this module
 * does not otherwise depend on (mirrors `buildConnectorPathData`'s own
 * "duplicated to avoid a needless cross-file dependency" precedent above).
 * `fallbackFontColor` is always `'#000000'` here (notes have no per-tag/
 * theme cascade fallback tier the way classifier rows do, G2 N36 -- every
 * note's plain text has always hardcoded `fill="#000000"`, unchanged by
 * this cutover) -- an atom's OWN creole-resolved color (a `<color>` command)
 * still wins when set, matching `renderRowAtoms`'s identical precedence.
 */
function renderNoteLineAtoms(
  atoms: readonly MemberRenderAtom[],
  startX: number,
  lineTop: number,
  lineHeight: number,
  theme: Theme,
  // The SAME per-line baseline offset `renderNoteText` already computed
  // (`fontSize - fontSize/4.5`, at the note's OWN resolved font size, NOT
  // `theme.fontSize` -- a note draws at `NOTE_FONT_SIZE`/its own override,
  // never the diagram's general body font size). G2 N56: kept ONLY for
  // 'vector'/'image' atoms -- zero corpus reach for either inside a note
  // body (grep-verified against every `note-creole-markup`-tagged fixture),
  // so their placement rule stays EXACTLY the pre-N56 formula (a flat offset
  // off the note's OWN base font, not the per-line `lineHeight` a 'text'
  // atom now uses) rather than guessing an extension `AtomOpenIconic`/
  // `AtomImg`'s own `getStartingAltitude` (0 and -3*factor respectively,
  // NEITHER of which this port's Sea-alignment model currently threads)
  // would need to justify -- see `note-layout.ts#noteLineHeight`'s matching
  // scope note.
  baselineOffset: number,
): string {
  let x = startX;
  let out = '';
  const legacyY = lineTop + baselineOffset;
  for (const atom of atoms) {
    if (atom.kind === 'text') {
      // G2 N56: jar's real per-atom baseline -- `lineTop + lineHeight -
      // descent(atom)`, `descent == atom.font.size / 4.5` (the SAME formula
      // `renderNoteText`'s own flat `baselineOffset` already used, now
      // applied PER ATOM instead of once per line) -- every atom's own
      // measured-rect BOTTOM aligns to `lineTop + lineHeight`, jar-verified
      // against `fogexa-30-zupo141`'s mixed-size line (`note-layout.ts
      // #noteLineHeight`'s own doc comment has the full derivation).
      const y = lineTop + lineHeight - atom.font.size / 4.5;
      const decoration = noteAtomDecoration(atom.font.styles);
      // G2 N57 item 38: `atom.renderText`/`renderWidth` are set ONLY for a
      // whitespace-only run (`DriverTextSvg.java`'s NBSP-substitution
      // branch, `class-member-creole.ts#MemberRenderAtom`'s own doc
      // comment) -- the DRAWN text/textLength use them when present, but
      // x-advance below stays on `atom.width` (the LAYOUT value) always.
      const rendered = text(x, y, atom.renderText ?? atom.text, {
        fontFamily: atom.font.family,
        fontSize: atom.font.size,
        fill: atom.font.color ?? '#000000',
        lengthAdjust: 'spacing',
        textLength: javaRound4(atom.renderWidth ?? atom.width),
        ...(atom.font.styles.has(FontStyle.BOLD) ? { fontWeight: '700' as const } : {}),
        ...(atom.font.styles.has(FontStyle.ITALIC) ? { fontStyle: 'italic' as const } : {}),
        ...(decoration !== undefined ? { textDecoration: decoration } : {}),
      });
      out += atom.url !== undefined ? linkWrap(rendered, atom.url) : rendered;
      x += atom.width;
      continue;
    }
    if (atom.kind === 'vector') {
      out += renderOpenIconicAtom(atom, x, legacyY, theme);
      x += atom.width;
      continue;
    }
    // 'image': jar's `AtomImg`/`AtomSprite` sit at the line's TOP (altitude
    // 0), not the text baseline -- same placement rule `renderRowAtoms`
    // applies for a classifier member row's inline atom.
    out += image(x, legacyY - baselineOffset, atom.width, atom.height, atom.href);
    x += atom.width;
  }
  return out;
}

/**
 * Note body text, one line per row, LEFT-anchored.
 *
 * G2 N55: when `note.lineAtoms` is present (every note built by
 * `note-layout.ts#measureNote` -- the ONLY production path -- always sets
 * it), each line draws as its own per-RUN creole atom sequence via {@link
 * renderNoteLineAtoms} instead of one plain `<text>` of the literal source
 * string -- jar-verified against `tenobo-24-liga464`'s `Yet **another**`
 * note line (two `<text>` runs, "Yet" plain + "another" bold, x split at the
 * first run's own measured width). `note.lineAtoms` is OPTIONAL only for a
 * hand-built `NoteGeo` test literal that constructs one directly, bypassing
 * `note-layout.ts` (`renderer-note.test.ts`'s pre-cutover fixtures) -- that
 * case falls back to the ORIGINAL single-`<text>`-per-line rendering below,
 * unchanged, matching `renderer-classifier-box.ts#renderRowText`'s identical
 * `row.atoms !== undefined` optional-with-fallback precedent (G2 N22).
 *
 * G2/N21: `textLength` uses EACH line's own measured width
 *  (`note.lineWidths[i]`, `note-layout.ts#measureNote`), not the note box's
 *  shared max-line-driven width -- jar draws every line's `<text>` with its
 *  OWN `textLength`, so a multi-line note whose lines have different widths
 *  (the common case) previously emitted the SAME (longest-line) value on
 *  every row; jar-verified against `sisolu-74-minu975`. */
function renderNoteText(note: NoteGeo, theme: Theme): string {
  const parts: string[] = [];
  // G2 N39: `<style> note { FontSize N }` / `skinparam noteFontSize N`
  // override -- see `NOTE_FONT_SIZE`'s own doc comment. `baselineOffset`'s
  // formula (`fontSize - descent`, `descent == size/4.5`) is recomputed here
  // per-note rather than as a module constant, since it now varies with the
  // resolved size.
  const fontSize = theme.colors.elements?.['note']?.fontSize ?? NOTE_FONT_SIZE;
  const baselineOffset = fontSize - fontSize / 4.5;
  // G2 N56: cumulative running top-of-line, mirroring jar's real `SheetBlock1
  // #initMap`'s `y += sea.getHeight()` stack -- each line's OWN resolved
  // height (`note.lineHeights[i]`, `note-layout.ts#measureNote`) advances the
  // NEXT line's top, not a flat `fontSize` (see `note-layout.ts
  // #noteLineHeight`'s own doc comment for the jar derivation). `note
  // .lineHeights` is OPTIONAL only for a hand-built `NoteGeo` test literal
  // that constructs one directly (mirrors `lineAtoms`'s identical optional-
  // with-fallback contract) -- `undefined` falls back to the flat `fontSize`
  // per line, BYTE-IDENTICAL to the pre-N56 formula.
  let lineTop = note.y + NOTE_MARGIN_Y;
  note.lines.forEach((ln, i) => {
    const lineHeight = note.lineHeights?.[i] ?? fontSize;
    if (note.lineAtoms !== undefined) {
      parts.push(
        renderNoteLineAtoms(note.lineAtoms[i]!, note.x + NOTE_MARGIN_X1, lineTop, lineHeight, theme, baselineOffset),
      );
      lineTop += lineHeight;
      return;
    }
    const y = lineTop + baselineOffset;
    parts.push(
      text(
        note.x + NOTE_MARGIN_X1,
        y,
        ln,
        {
          fontFamily: theme.fontFamily,
          fontSize,
          fill: '#000000',
          lengthAdjust: 'spacing',
          textLength: note.lineWidths[i]!,
        },
      ),
    );
    lineTop += lineHeight;
  });
  return parts.join('');
}

/** Plain note: folded-corner box + a separate dashed connector line to its
 *  host (or no connector at all for a freestanding note) -- every note
 *  kind EXCEPT a resolved member-tip (`renderTipNote` below). */
export function renderNote(note: NoteGeo, theme: Theme): string {
  const parts: string[] = [];

  const connector = buildConnectorPathData(note.connector);
  if (connector !== '') {
    parts.push(
      path(connector, { stroke: theme.colors.arrow, strokeWidth: NOTE_STROKE_WIDTH, strokeDasharray: '4 4' }),
    );
  }

  const fill = resolveNoteBackground(note.color, theme, note.stereotype);
  const { x, y, width: w, height: h } = note;
  const f = NOTE_FOLD;
  parts.push(
    polygon(
      [
        { x, y },
        { x: x + w - f, y },
        { x: x + w, y: y + f },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      { fill, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH },
    ),
  );
  const fold = `M ${x + w - f},${y} L ${x + w - f},${y + f} L ${x + w},${y + f}`;
  parts.push(path(fold, { stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }));
  parts.push(renderNoteText(note, theme));

  return parts.join('');
}

/**
 * A resolved member-tip note (`note <left|right> of Class::member`): the
 * connector is a zigzag notch cut directly into the note's own outline
 * (`note-opale.ts`), not a separate line -- and the whole thing draws
 * UNWRAPPED (no `<g class="entity">`, no id, no comment), matching
 * `EntityImageTips`'s draw path -- upstream never routes a tip through the
 * normal per-entity `<g>`-wrapping machinery other leaf kinds get (mirrors
 * `renderAssocPoint`'s identical unwrapped precedent, G2 N8).
 * @see ~/git/plantuml/.../svek/image/EntityImageTips.java#drawU
 */
export function renderTipNote(note: NoteGeo, theme: Theme): string {
  const tip = note.tip!;
  const box: OpaleBox = { origin: { x: note.x, y: note.y }, width: note.width, height: note.height };
  const connector: OpaleConnector = { pp1: tip.pp1, pp2: tip.pp2 };
  const outline = tip.direction === 'left' ? opalePolygonLeft(box, connector) : opalePolygonRight(box, connector);
  const fill = resolveNoteBackground(note.color, theme, note.stereotype);
  const parts: string[] = [
    path(outline, { fill, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }),
    path(opaleCorner({ x: note.x, y: note.y }, note.width), { fill, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }),
  ];
  parts.push(renderNoteText(note, theme));
  return parts.join('');
}

/** Dispatch to the right `opalePolygon*` function by direction --
 *  `Opale.java#drawU`'s own `strategy` switch, shared by {@link renderTipNote}
 *  (LEFT/RIGHT only) and {@link renderOpaleNote} (all four). */
function opaleOutline(direction: OpaleDirection, box: OpaleBox, connector: OpaleConnector): string {
  switch (direction) {
    case 'left': return opalePolygonLeft(box, connector);
    case 'right': return opalePolygonRight(box, connector);
    case 'up': return opalePolygonUp(box, connector);
    case 'down': return opalePolygonDown(box, connector);
  }
}

/**
 * A RESOLVED general "opalisable" note (G2/N14, `note <pos> of X` with a
 * single non-invisible connection to a non-note entity) -- the SAME
 * zigzag-notch merged outline as a member-tip note, but WRAPPED in the
 * normal `<g class="entity">` (upstream never special-cases the wrapping
 * for this mechanism the way it does for member-tips -- `EntityImageNote`
 * draws through the ordinary per-entity `<g>` path, jar-verified:
 * `fezugi-39-fujo327`'s note is `<g class="entity" data-qualified-name=
 * "GMN2" id="ent0003" data-source-line="7">`). No separate `<g
 * class="link">` connector draws at all -- `SvekEdge#drawU`'s `if (opale)
 * return;` -- the caller must not emit one for this note's own connector
 * edge.
 * @see ~/git/plantuml/.../svek/image/EntityImageNote.java#drawU
 */
export function renderOpaleNote(note: NoteGeo, theme: Theme): string {
  const opale = note.opale!;
  const box: OpaleBox = { origin: { x: note.x, y: note.y }, width: note.width, height: note.height };
  const connector: OpaleConnector = { pp1: opale.pp1, pp2: opale.pp2 };
  const fill = resolveNoteBackground(note.color, theme, note.stereotype);
  const parts: string[] = [
    path(opaleOutline(opale.direction, box, connector), { fill, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }),
    path(opaleCorner({ x: note.x, y: note.y }, note.width), { fill, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }),
  ];
  parts.push(renderNoteText(note, theme));
  return parts.join('');
}
