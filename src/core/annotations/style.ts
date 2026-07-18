/**
 * Annotation chrome style resolution.
 *
 * Base values are the `document{}` (+ sibling `mainframe{}`) block of
 * upstream `plantuml.skin`, overlaid with `skinparam` Title/Header/
 * Footer/Caption/Legend keys, then `<style> title|header|footer|
 * caption|legend|mainframe { ... }` selectors (mission G0b decisions.md D6).
 * Layering order: skin defaults < skinparam < `<style>` — matches the
 * Stage 2 (skinparam) -> Stage 3 (style) order `buildTheme` in
 * `src/index.ts:131-160` applies for every other Theme field.
 *
 * `theme` (the resolved base Theme, post named-theme-resolution) is
 * accepted per the T2 interface contract. G2 N48: `theme.colors.background`
 * is now read as the local-paint-background for `#?light:dark[:transparent]`
 * FontColor resolution (item 29, `resolveConditionalColor`) -- every OTHER
 * per-element document-chrome field the T2 contract anticipated is still
 * unwired: the `Theme` type models no such fields (fontFamily/colors.text
 * are the closest analogs but D6 only lists skinparam + style as override
 * sources, not theme). The dark-theme document overrides at
 * `plantuml.skin:561-576` (header/footer FontColor #7, legend BackGroundColor
 * #2, frame LineColor white) are therefore recorded here but NOT wired —
 * flagged for the orchestrator/T9 once dark-mode chrome is in scope.
 *
 * @see ~/git/plantuml/src/main/resources/skin/plantuml.skin:1-90 (root {},
 *   document {}, mainframe {} — the verbatim base values below)
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/font/FontParam.java
 *   (HEADER/FOOTER hardcode defaultColor "#888888" — matches plantuml.skin's
 *   `#8` shorthand; TITLE/CAPTION/LEGEND fall back to FontParamConstant.COLOR
 *   "black", i.e. the root default)
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/FromSkinparamToStyle.java:87-176
 *   (authoritative skinparam key list — `addConFont("title"/"header"/
 *   "footer"/"caption"/"legend", ...)` for Font{Size,Style,Color,Name}, plus
 *   title/legend-only `*BorderColor`/`*BackgroundColor`/`*BorderRoundCorner`.
 *   No `mainframe*` entries exist upstream — mainframe has no skinparam keys.)
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/style/ClockwiseTopRightBottomLeft.java#read
 *   (Padding/Margin 1/2/3/4-number shorthand — ported in {@link parseClockwise})
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/color/HColorSet.java:122-133
 *   (single-hex-digit gray shorthand `#8` -> `#888888`, `#D` -> `#DDDDDD` —
 *   ported in {@link expandGrayShorthand})
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/DiagramChromeFactory.java:263
 *   (`StyleSignatureBasic.of(SName.root, SName.document, SName.mainframe)` —
 *   confirms `mainframe` is a bare, non-diagram-type-scoped `<style>` selector,
 *   same tier as title/caption/header/footer; only `legend` is diagram-type
 *   scoped per decisions.md D7)
 */

import type { Theme } from '../theme.js';
import type { StyleMap } from '../skinparam.js';
import { HorizontalAlignment } from '../klimt/geom/HorizontalAlignment.js';
import { resolveColorToSvgHex, resolveConditionalColor } from '../klimt/color/HColorSet.js';

// ---------------------------------------------------------------------------
// Public types (interface contract consumed by T4)
// ---------------------------------------------------------------------------

export interface BoxSides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface AnnotationBoxStyle {
  fontSize: number;
  fontStyle: 'plain' | 'bold' | 'italic';
  fontColor: string;
  fontFamily: string;
  backgroundColor: string | null;
  lineColor: string | null;
  roundCorner: number;
  /** G2 N50: `PName.LineThickness` -- upstream's `root{}` default is `1.0`
   *  (`plantuml.skin:15`); `mainframe{}` is the ONE annotation element with
   *  its own override (`1.5`, `plantuml.skin:85`, a `root{}` SIBLING block,
   *  not inherited through `document{}`). Only `title`/`legend` expose a
   *  skinparam key for it (`titleBorderThickness`/`legendBorderThickness`,
   *  {@link applyBoxSuffix}'s `borderthickness` case) -- see this file's own
   *  module doc comment for the full title/legend-only `Box*` key list this
   *  mirrors. */
  lineThickness: number;
  padding: BoxSides;
  margin: BoxSides;
  /** D8: for `title`/`caption`, `DiagramChromeFactory.addTitle`/`addCaption`
   *  hard-code CENTER at draw time regardless of this stored value — that
   *  quirk belongs to T9's draw-time geometry, not to resolution here. This
   *  field always carries the faithfully-resolved skin/skinparam/style value. */
  horizontalAlignment: HorizontalAlignment;
}

export type AnnotationElement = 'title' | 'caption' | 'header' | 'footer' | 'legend' | 'mainframe';

const ANNOTATION_ELEMENTS: readonly AnnotationElement[] = [
  'title',
  'caption',
  'header',
  'footer',
  'legend',
  'mainframe',
];

// ---------------------------------------------------------------------------
// Gray shorthand color expansion
// ---------------------------------------------------------------------------

function hexNibble(ch: string): number {
  const lower = ch.toLowerCase();
  if (lower >= '0' && lower <= '9') return lower.charCodeAt(0) - '0'.charCodeAt(0);
  if (lower >= 'a' && lower <= 'f') return lower.charCodeAt(0) - 'a'.charCodeAt(0) + 10;
  return -1;
}

/**
 * Expand PlantUML's single-hex-digit gray shorthand (`#8` -> `#888888`,
 * `#D` -> `#DDDDDD`). Any other value (named colors, `transparent`, 3/6/8
 * digit hex) is returned unchanged — SVG/CSS already understand those.
 *
 * @see HColorSet.java#parseSimpleColor, len==1 branch:
 *   `v = (d<<4)|d; rgb = (v<<16)|(v<<8)|v`.
 */
export function expandGrayShorthand(value: string): string {
  if (value.length !== 2 || value[0] !== '#') return value;
  const d = hexNibble(value[1] ?? '');
  if (d < 0) return value;
  const nibble = ((d << 4) | d).toString(16).toUpperCase().padStart(2, '0');
  return `#${nibble}${nibble}${nibble}`;
}

/** `transparent` (case-insensitive) resolves to `null` (no paint), matching
 *  the `string | null` contract; everything else runs through
 *  {@link expandGrayShorthand}. */
function resolveChromeColor(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === 'transparent') return null;
  return expandGrayShorthand(trimmed);
}

// ---------------------------------------------------------------------------
// Padding / Margin shorthand — ClockwiseTopRightBottomLeft.read
// ---------------------------------------------------------------------------

const ZERO_SIDES: BoxSides = { top: 0, right: 0, bottom: 0, left: 0 };
const CLOCKWISE_NUMBERS_ONLY = /^[0-9 ]+$/;

/**
 * Parse a Padding/Margin declaration using upstream's 1/2/3/4-number
 * shorthand. Non-numeric or malformed input (including a value containing
 * a decimal point or a sign) yields `{0,0,0,0}` — upstream's `none()`
 * fallback, since `NUMBERS_ONLY` (`[0-9 ]+`) rejects both.
 *
 * @see ClockwiseTopRightBottomLeft.java#read
 */
export function parseClockwise(value: string): BoxSides {
  const trimmed = value.trim();
  if (!CLOCKWISE_NUMBERS_ONLY.test(trimmed)) return ZERO_SIDES;
  const parts = trimmed.split(/\s+/).map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n))) return ZERO_SIDES;
  const [a, b, c, d] = parts;
  switch (parts.length) {
    case 1:
      return { top: a as number, right: a as number, bottom: a as number, left: a as number };
    case 2:
      return { top: a as number, right: b as number, bottom: a as number, left: b as number };
    case 3:
      return { top: a as number, right: b as number, bottom: c as number, left: b as number };
    case 4:
      return { top: a as number, right: b as number, bottom: c as number, left: d as number };
    default:
      return ZERO_SIDES;
  }
}

// ---------------------------------------------------------------------------
// Base defaults — plantuml.skin document{} / mainframe{} blocks, verbatim
// ---------------------------------------------------------------------------

/** G2 N45: `plantuml.skin`'s own literal `FontName SansSerif` is Java's
 *  INTERNAL AWT logical-font name, not the CSS-ready value the jar's SVG
 *  writer actually emits (`FontStack#getSvgFamily` maps the logical name to
 *  the CSS generic family at serialization time -- `klimt/font/FontStack
 *  .java:187`). Every OTHER font-family default in this port already
 *  resolved to the CSS name (`theme.ts#defaultTheme.fontFamily ===
 *  'sans-serif'`) -- this was the one remaining raw-logical-name literal,
 *  discovered via `svg/g/g/text/@font-family` (85-fixture reach in the
 *  class census alone, `plans/g2-class-svg/ledger.md` N45). `blocks.ts
 *  #drawLine` passes this straight through to `core/svg.ts#text()`, which
 *  does no logical->CSS mapping of its own (`toSvgFontFamily` only swaps
 *  quote characters) -- the value must already be CSS-ready at the source.
 *  Measurement is UNAFFECTED: neither `WidthTableMeasurer`
 *  (`DeterministicMeasurer`, font-agnostic) nor `JarMeasurer` (selects its
 *  metrics table by `font.weight`, never `font.family`) reads this string
 *  for width lookup -- see `measurer.ts`/`measurer-jar.ts`'s own doc
 *  comments. */
const ROOT_FONT_FAMILY = 'sans-serif';
const ROOT_FONT_COLOR = 'black';
const ROOT_FONT_STYLE = 'plain' as const;
const ROOT_ROUND_CORNER = 0;
const ROOT_LINE_COLOR = '#181818';
/** `plantuml.skin:15` (`root{}`'s own `LineThickness 1.0`). */
const ROOT_LINE_THICKNESS = 1;

const BASE_DEFAULTS: Record<AnnotationElement, AnnotationBoxStyle> = {
  // plantuml.skin:30-38
  title: {
    horizontalAlignment: HorizontalAlignment.CENTER,
    fontSize: 14,
    fontStyle: 'bold',
    fontColor: ROOT_FONT_COLOR,
    fontFamily: ROOT_FONT_FAMILY,
    backgroundColor: null,
    lineColor: null,
    roundCorner: ROOT_ROUND_CORNER,
    lineThickness: ROOT_LINE_THICKNESS,
    padding: { top: 5, right: 5, bottom: 5, left: 5 },
    margin: { top: 5, right: 5, bottom: 5, left: 5 },
  },
  // plantuml.skin:23-29 (Padding/Margin unset anywhere in the cascade -> 0)
  header: {
    horizontalAlignment: HorizontalAlignment.RIGHT,
    fontSize: 10,
    fontStyle: ROOT_FONT_STYLE,
    fontColor: expandGrayShorthand('#8'),
    fontFamily: ROOT_FONT_FAMILY,
    backgroundColor: null,
    lineColor: null,
    roundCorner: ROOT_ROUND_CORNER,
    lineThickness: ROOT_LINE_THICKNESS,
    padding: ZERO_SIDES,
    margin: ZERO_SIDES,
  },
  // plantuml.skin:39-45
  footer: {
    horizontalAlignment: HorizontalAlignment.CENTER,
    fontSize: 10,
    fontStyle: ROOT_FONT_STYLE,
    fontColor: expandGrayShorthand('#8'),
    fontFamily: ROOT_FONT_FAMILY,
    backgroundColor: null,
    lineColor: null,
    roundCorner: ROOT_ROUND_CORNER,
    lineThickness: ROOT_LINE_THICKNESS,
    padding: ZERO_SIDES,
    margin: ZERO_SIDES,
  },
  // plantuml.skin:54-61
  caption: {
    horizontalAlignment: HorizontalAlignment.CENTER,
    fontSize: 14,
    fontStyle: ROOT_FONT_STYLE,
    fontColor: ROOT_FONT_COLOR,
    fontFamily: ROOT_FONT_FAMILY,
    backgroundColor: null,
    lineColor: null,
    roundCorner: ROOT_ROUND_CORNER,
    lineThickness: ROOT_LINE_THICKNESS,
    padding: ZERO_SIDES,
    margin: { top: 1, right: 1, bottom: 1, left: 1 },
  },
  // plantuml.skin:46-53 (HorizontalAlignment unset here and in document{} ->
  // falls back to root{}'s "HorizontalAlignment left", plantuml.skin:12)
  legend: {
    horizontalAlignment: HorizontalAlignment.LEFT,
    fontSize: 14,
    fontStyle: ROOT_FONT_STYLE,
    fontColor: ROOT_FONT_COLOR,
    fontFamily: ROOT_FONT_FAMILY,
    backgroundColor: expandGrayShorthand('#D'),
    lineColor: 'black',
    roundCorner: 15,
    lineThickness: ROOT_LINE_THICKNESS,
    padding: { top: 5, right: 5, bottom: 5, left: 5 },
    margin: { top: 12, right: 12, bottom: 12, left: 12 },
  },
  // plantuml.skin:85-89 (mainframe is a root{} sibling, not a document{}
  // child — unset fields fall back straight to root{}, not through
  // document{}'s BackGroundColor white; LineThickness 1.5 is out of scope,
  // no `lineThickness` field on AnnotationBoxStyle per the T2 contract)
  mainframe: {
    horizontalAlignment: HorizontalAlignment.LEFT,
    fontSize: 14,
    fontStyle: ROOT_FONT_STYLE,
    fontColor: ROOT_FONT_COLOR,
    fontFamily: ROOT_FONT_FAMILY,
    backgroundColor: null,
    lineColor: ROOT_LINE_COLOR,
    roundCorner: ROOT_ROUND_CORNER,
    // plantuml.skin:85 -- mainframe's OWN LineThickness override (1.5),
    // not root's 1.0 -- see this field's doc comment on the interface.
    lineThickness: 1.5,
    padding: { top: 1, right: 5, bottom: 1, left: 5 },
    margin: { top: 10, right: 5, bottom: 10, left: 5 },
  },
};

function cloneBoxStyle(style: AnnotationBoxStyle): AnnotationBoxStyle {
  return { ...style, padding: { ...style.padding }, margin: { ...style.margin } };
}

// ---------------------------------------------------------------------------
// skinparam overrides — FromSkinparamToStyle.java:87-176
// ---------------------------------------------------------------------------

/**
 * Normalize a raw skinparam key for annotation-key matching: trim, lowercase,
 * strip underscores/dots. This is a deliberate scoped subset of upstream
 * `SkinParam.cleanForKeySlow` (ported in full as `skinparam.ts`'s private
 * `normaliseKey`) — none of Title/Header/Footer/Caption/Legend's key names
 * hit the sequence-prefix / arrow-prefix / align-suffix special cases that
 * function also handles, so this local subset is sufficient and avoids
 * exporting a private symbol from that (CCN-flagged) module.
 */
function normaliseAnnotationKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_.]/g, '');
}

type FontSuffix = 'fontsize' | 'fontstyle' | 'fontcolor' | 'fontname';
const FONT_SUFFIXES: readonly FontSuffix[] = ['fontsize', 'fontstyle', 'fontcolor', 'fontname'];

function applyFontSuffix(
  style: AnnotationBoxStyle,
  suffix: FontSuffix,
  value: string,
  documentBackgroundHex: string,
): void {
  switch (suffix) {
    case 'fontsize': {
      const n = Number.parseInt(value.trim(), 10);
      if (Number.isFinite(n)) style.fontSize = n;
      break;
    }
    case 'fontstyle': {
      const v = value.trim().toLowerCase();
      if (v === 'plain' || v === 'bold' || v === 'italic') style.fontStyle = v;
      break;
    }
    case 'fontcolor': {
      // G2 N48 (item 29): `#?light:dark[:transparent]` (`HColorScheme`) --
      // see `resolveConditionalColor`'s own doc comment for the local-
      // background semantics; every chrome element sits directly on the
      // document canvas, so that IS the local paint background here.
      const trimmed = value.trim();
      style.fontColor = resolveConditionalColor(trimmed, documentBackgroundHex) ?? expandGrayShorthand(trimmed);
      break;
    }
    case 'fontname':
      style.fontFamily = value.trim();
      break;
  }
}

// title/legend additionally expose Border*/Background* skinparam keys
// (FromSkinparamToStyle.java:166-176); header/footer/caption do not.
const BOX_KEY_ELEMENTS: ReadonlySet<AnnotationElement> = new Set(['title', 'legend']);

function applyBoxSuffix(style: AnnotationBoxStyle, suffix: string, value: string): boolean {
  switch (suffix) {
    case 'bordercolor':
      style.lineColor = resolveChromeColor(value);
      return true;
    case 'backgroundcolor':
      style.backgroundColor = resolveChromeColor(value);
      return true;
    case 'borderroundcorner': {
      const n = Number.parseInt(value.trim(), 10);
      if (Number.isFinite(n)) style.roundCorner = n;
      return true;
    }
    case 'borderthickness': {
      // G2 N50: `titleBorderThickness`/`legendBorderThickness` ->
      // `PName.LineThickness` (`FromSkinparamToStyle.java:166,172`) --
      // `parseFloat` (not `parseInt`) since the jar accepts fractional
      // values (`BorderThickness 5.0`, jar-verified `cifeta-62-xodi576`).
      const n = Number.parseFloat(value.trim());
      if (Number.isFinite(n)) style.lineThickness = n;
      return true;
    }
    default:
      return false;
  }
}

// Every annotation element except `mainframe` has upstream skinparam keys
// named after itself (`titleFontSize`, `headerFontColor`, ...). `mainframe`
// has none — confirmed absent from FromSkinparamToStyle.java's knowledge
// table (CommandMainframe parses its own inline args instead, per D9).
const SKINPARAM_PREFIXES: Partial<Record<AnnotationElement, string>> = {
  title: 'title',
  header: 'header',
  footer: 'footer',
  caption: 'caption',
  legend: 'legend',
};

function applySkinparamOverrides(
  element: AnnotationElement,
  style: AnnotationBoxStyle,
  skinparam: ReadonlyMap<string, string>,
  documentBackgroundHex: string,
): void {
  const prefix = SKINPARAM_PREFIXES[element];
  if (prefix === undefined) return;

  for (const [rawKey, value] of skinparam) {
    const key = normaliseAnnotationKey(rawKey);
    if (!key.startsWith(prefix)) continue;
    const suffix = key.slice(prefix.length);

    if ((FONT_SUFFIXES as readonly string[]).includes(suffix)) {
      applyFontSuffix(style, suffix as FontSuffix, value, documentBackgroundHex);
      continue;
    }
    if (BOX_KEY_ELEMENTS.has(element)) applyBoxSuffix(style, suffix, value);
  }
}

// ---------------------------------------------------------------------------
// <style> overrides — parseStyleBlock's already-parsed StyleMap
// ---------------------------------------------------------------------------

type StyleSetter = (style: AnnotationBoxStyle, value: string) => void;

const STYLE_PROPERTY_SETTERS: ReadonlyArray<readonly [key: string, apply: StyleSetter]> = [
  [
    'fontsize',
    (s, v) => {
      const n = Number.parseInt(v.trim(), 10);
      if (Number.isFinite(n)) s.fontSize = n;
    },
  ],
  [
    'fontstyle',
    (s, v) => {
      const val = v.trim().toLowerCase();
      if (val === 'plain' || val === 'bold' || val === 'italic') s.fontStyle = val;
    },
  ],
  ['fontcolor', (s, v) => { s.fontColor = expandGrayShorthand(v.trim()); }],
  ['fontname', (s, v) => { s.fontFamily = v.trim(); }],
  ['linecolor', (s, v) => { s.lineColor = resolveChromeColor(v); }],
  ['backgroundcolor', (s, v) => { s.backgroundColor = resolveChromeColor(v); }],
  [
    'roundcorner',
    (s, v) => {
      const n = Number.parseInt(v.trim(), 10);
      if (Number.isFinite(n)) s.roundCorner = n;
    },
  ],
  ['padding', (s, v) => { s.padding = parseClockwise(v); }],
  ['margin', (s, v) => { s.margin = parseClockwise(v); }],
  [
    'horizontalalignment',
    (s, v) => {
      const val = v.trim().toUpperCase();
      if (val === HorizontalAlignment.LEFT || val === HorizontalAlignment.CENTER || val === HorizontalAlignment.RIGHT) {
        s.horizontalAlignment = val;
      }
    },
  ],
];

function applyDeclarations(
  style: AnnotationBoxStyle,
  declarations: ReadonlyMap<string, string>,
  documentBackgroundHex: string,
): void {
  for (const [key, apply] of STYLE_PROPERTY_SETTERS) {
    const value = declarations.get(key);
    if (value !== undefined) apply(style, value);
  }
  // G2 N48 (item 29): `<style> ... { FontColor #?light:dark[:transparent] }
  // }` -- STYLE_PROPERTY_SETTERS' plain 'fontcolor' setter above already
  // ran (and stored the raw, un-resolved literal); re-resolve it here now
  // that every declaration for THIS selector has been applied, so a later
  // conditional spec in the SAME block still wins over an earlier one
  // (matching every other property's own last-wins order). A no-op for a
  // plain (non-`#?`) FontColor value (`resolveConditionalColor` returns
  // `undefined`, `style.fontColor` is left as the plain setter's own
  // result).
  const fontColorRaw = declarations.get('fontcolor');
  if (fontColorRaw !== undefined) {
    const conditional = resolveConditionalColor(fontColorRaw.trim(), documentBackgroundHex);
    if (conditional !== undefined) style.fontColor = conditional;
  }
}

/**
 * D7: `legend`'s upstream style signature is diagram-type-scoped
 * (`root,document,<type>,legend`); title/caption/header/footer/mainframe are
 * bare (`root,document,<element>` — confirmed for mainframe via
 * `DiagramChromeFactory.java:263`). `resolveAnnotationStyles` has no
 * `diagramType` parameter (locked T2 interface: theme/skinparam/styleMap
 * only), so every `<type>.legend` selector `parseStyleBlock` can produce
 * (its 2-level nesting cap fits `sequenceDiagram { legend { ... } }` exactly)
 * is applied regardless of the diagram actually being rendered. Flagged for
 * T4/orchestrator: threading a `diagramType` parameter through is the correct
 * fix once available.
 */
function applyStyleOverrides(
  element: AnnotationElement,
  style: AnnotationBoxStyle,
  styleMap: StyleMap,
  documentBackgroundHex: string,
): void {
  // G2 N48: `root` is the LOWEST-priority member of the `root,document,
  // <element>` style signature (this function's own D7 doc comment) --
  // never checked here before (a pre-existing gap, not something T7's own
  // `document.<element>` fix addressed) -- applied FIRST so the
  // more-specific selectors below still win when a source sets both.
  const root = styleMap.get('root');
  if (root !== undefined) applyDeclarations(style, root, documentBackgroundHex);

  const bare = styleMap.get(element);
  if (bare !== undefined) applyDeclarations(style, bare, documentBackgroundHex);

  // T7 bug fix (jar-verified against tests/corpus/class/A0005_Test.puml's
  // `document { title { BackGroundColor yellow } } }` -- the jar's SVG
  // contains `fill=\x22#FFFF00\x22` on the title rect): the upstream style
  // signature for every chrome element is `root,document,<element>` (this
  // function's own D7 doc comment, above) -- `parseStyleBlock`'s dot-joined
  // selector for a `document { <element> { ... } } }` block is literally
  // \x22document.<element>\x22, which was never checked here (only the bare,
  // un-nested `<element>` key was). Applied AFTER the bare form so the more
  // path-specific selector wins when a source carries both.
  const documentScoped = styleMap.get('document.' + element);
  if (documentScoped !== undefined) applyDeclarations(style, documentScoped, documentBackgroundHex);

  if (element !== 'legend') return;
  for (const [selector, declarations] of styleMap) {
    // \x22document.legend\x22 is already applied above (documentScoped); skip
    // it here so it is not re-applied a second, redundant time.
    if (selector !== 'legend' && selector !== 'document.legend' && selector.endsWith('.legend')) {
      applyDeclarations(style, declarations, documentBackgroundHex);
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Resolve the six annotation-chrome element styles: skin defaults (verbatim
 * `plantuml.skin` values) overlaid with skinparam, then `<style>` overrides
 * (style wins — see module doc for the layering rationale).
 *
 * G2 N48: `theme.colors.background` is now read (item 29's local-paint-
 * background for `#?light:dark[:transparent]` FontColor resolution --
 * every chrome element sits directly on the document canvas). Every other
 * use of `theme` the T2 interface contract anticipated is still unwired
 * (see module doc).
 */
export function resolveAnnotationStyles(
  theme: Theme,
  skinparam: ReadonlyMap<string, string>,
  styleMap: StyleMap,
): Record<AnnotationElement, AnnotationBoxStyle> {
  const documentBackgroundHex = resolveColorToSvgHex(theme.colors.background);
  const result = {} as Record<AnnotationElement, AnnotationBoxStyle>;
  for (const element of ANNOTATION_ELEMENTS) {
    const style = cloneBoxStyle(BASE_DEFAULTS[element]);
    // G2 N46 (near-zero harvest): `skinparam DefaultFontName X` maps to
    // `PName.FontName` at `SName.root` (`FromSkinparamToStyle.java:156`,
    // `addConvert("defaultFontName", PName.FontName, SName.root)`) --
    // root is the common ancestor of every chrome element's OWN style
    // cascade (`StyleSignatureBasic.of(SName.root, SName.document,
    // SName.title)` etc, this module's own doc comment), so a global
    // `DefaultFontName` overrides every element's `ROOT_FONT_FAMILY`
    // default UNLESS that element sets its own more-specific FontName
    // (per-element skinparam/`<style>`, applied AFTER this and so still
    // wins) -- jar-verified `boduli-27-zufa581` (`skinparam DefaultFontName
    // Helvetica` + `Title ...`, title `<text font-family="Helvetica">`).
    // Applied BEFORE the per-element overrides below so a more specific
    // override still wins (root < document < element cascade specificity).
    const defaultFontName = skinparam.get('defaultfontname');
    if (defaultFontName !== undefined) style.fontFamily = defaultFontName.trim();
    applySkinparamOverrides(element, style, skinparam, documentBackgroundHex);
    applyStyleOverrides(element, style, styleMap, documentBackgroundHex);
    result[element] = style;
  }
  return result;
}
