/**
 * Theme system for plantuml-ts.
 *
 * Defines the visual appearance of all diagram types via a single Theme
 * interface. The resolveTheme helper normalises string aliases and deep-merges
 * partial overrides without mutating the built-in theme objects.
 */

import { BUILTIN_THEMES } from './themes-builtin.js';
import type { Paint } from './paint.js';

/**
 * Per-element (SName) color overrides — decision D4. Each role may hold a solid
 * color or a gradient {@link Paint}; unset roles cascade to the root/graph
 * default via {@link resolveElementPaint}.
 */
export interface ElementColors {
  background?: Paint;
  border?: Paint;
  font?: Paint;
  /** `<sname>FontSize` skinparam (flat or block form) / `<style> <sname> {
   *  FontSize N }` — G1 I4b. Overrides the entity/cluster TITLE text size
   *  (`FontParam.<SNAME>`'s per-diagram default, `klimt/font/FontParam.java`
   *  — every reachable entry is size 14). */
  fontSize?: number;
  /** `<sname>StereotypeFontSize` skinparam (flat or block form) / `<style>
   *  <sname> { stereotype { FontSize N } } }` — G1 I4b. Overrides the
   *  STEREOTYPE text size for the same element (`FontParam.<SNAME>_STEREOTYPE`
   *  — same 14pt default as the title, jar-verified I2). Falls back to
   *  `fontSize` when absent — mirrors upstream's `StyleSignatureBasic`
   *  hierarchical cascade (a less-specific `[element,<sname>]` style rule
   *  applies to the more-specific `[element,<sname>,stereotype]` query unless
   *  overridden — `FromSkinparamToStyle.java`'s `addConFont`/`addMagic`
   *  register both as SEPARATE style rules, merged by signature specificity).
   *  Not independently jar-verified against a fixture combining both on one
   *  element (no sampled I4 fixture does) — the cascade fallback is the
   *  most defensible reading of the style system's own architecture, not a
   *  guess from nothing. */
  stereotypeFontSize?: number;
  /** `<style> <sname> { header { BackgroundColor/FontColor/FontSize } } }`
   *  -- G3/O4, `EntityImageObject`/`Map`/`Json`'s own `getStyleHeader()`
   *  nested `header` sub-selector (`StyleSignatureBasic.of(root, element,
   *  objectDiagram, <sname>, header)`), scoped to the same three kinds
   *  `stereotypeFontSize` above already narrows to via `ELEMENT_BUCKET_
   *  SNAMES` gating at the parse site (`style-map-element.ts#collect
   *  ElementStyleBuckets`). `headerBackground` draws a SEPARATE half-
   *  rounded rect over ONLY the title/header area
   *  (`renderer-classifier-box.ts#buildHeaderPrimitive`) whenever it
   *  differs from the bare bucket's own `background` -- mirrors jar's own
   *  `headerBackcolor != null && !backcolor.equals(headerBackcolor)` gate
   *  (`EntityImageObject.java:199`). `headerFont`/`headerFontSize` win over
   *  the bare bucket's `font`/`fontSize` for the NAME row text ONLY
   *  (member rows keep the bare bucket's own values) -- jar-verified
   *  `soxufi-98-nita528`. Absent = no header-specific override (the
   *  common case). */
  headerBackground?: Paint;
  headerFont?: Paint;
  headerFontSize?: number;
}

export interface Theme {
  fontFamily: string;
  fontSize: number;
  /** `skinparam linetype ortho|polyline` — svek routes edge labels through
   *  xlabel and emits splines=ortho under ortho (SvekEdge.java:434-441,
   *  DotStringFactory.java:160-168). Absent = default splines. */
  linetype?: 'ortho' | 'polyline';
  /** `skinparam fixCircleLabelOverlapping` — when true, disables the shield
   *  suppression on interfaces that have a horizontal visible link
   *  (EntityImageDescription.getShield: `fixCircleLabelOverlapping == false
   *  && hasSomeHorizontalLinkVisible`). Default false. */
  fixCircleLabelOverlapping?: boolean;
  /** `skinparam componentStyle uml2|uml1|rectangle` (SkinParam.componentStyle).
   *  Default `uml2` draws the corner component icon; `uml1`/`rectangle` render
   *  components as plain boxes (changes node sizing). Absent = uml2. */
  componentStyle?: 'uml2' | 'uml1' | 'rectangle';
  /** G2 N18: `skinparam style strictuml` — a global sharp-corner style flag
   *  (`SkinParam.java`'s `getStyle() == UmlDiagramType.STRICT`... actually
   *  a bare boolean toggle checked by `USymbolFolder#drawFolder`'s
   *  `roundCorner=0` `UPolygon` branch, jar-verified via
   *  `jinibe-02-tebi269`'s own `<polygon points="...">` package outline —
   *  a plain `<path>` with rounded arcs otherwise). Class is this field's
   *  first consumer this iteration (`class-namespace-shape.ts`); scope
   *  limited to the package/namespace folder-tab corner style, matching
   *  this iteration's own write-set — NOT threaded into classifier-box
   *  rounding or any other strictuml-affected shape. */
  /** G2 N61: `skinparam monochrome true|reverse` -- `TitledDiagram.java
   *  #muteColorMapper` swaps in `ColorMapper.MONOCHROME`/`MONOCHROME_REVERSE`
   *  for the diagram's ENTIRE draw pass (`klimt/color/ColorMapper.java:
   *  80-91`), a uniform YIQ grayscale transform applied to every drawn
   *  color, LAST, regardless of where that color's own value came from.
   *  Class has no single terminal draw call to hook this into (unlike jar's
   *  `UGraphic`) -- consumed as a single post-processing pass over the
   *  ASSEMBLED SVG fragment instead (`class-monochrome.ts
   *  #applyMonochromeToFragment`, `renderer.ts#renderClass`'s own return
   *  point). Class is this field's first consumer this iteration; NOT
   *  wired into description/other diagram types (no corpus sample exercised
   *  this iteration -- same "no evidence it's wrong elsewhere" scoping this
   *  file's other fields already establish, e.g. `strictUml`'s doc comment).
   *  `SkinParam.isDark(...)`'s own DARK_MODE branch (jar's FIRST check,
   *  ahead of `monochrome`) is unmodeled -- `!theme dark`-interaction
   *  untraced this iteration, named remainder. */
  monochrome?: 'true' | 'reverse';
  strictUml?: boolean;
  /** G2 N59: `skinparam packageStyle rect|rectangle` -- selects the plain
   *  `<rect>` package/namespace outline (`svek/PackageStyle.java
   *  #RECTANGLE`) instead of the default folder-tab notch shape, jar-
   *  verified via `mucuxi-36-beku683`'s own childCount-2 `<rect>`+`<text>`
   *  output (no hline, centered title -- `USymbolRectangle#asBig`, NOT
   *  `USymbolFolder#asBig`). Other `PackageStyle` enum values (NODE/FRAME/
   *  CLOUD/DATABASE/COMPONENT1/COMPONENT2/STORAGE/AGENT/ARTIFACT/CARD) are
   *  NOT modeled -- absent/any other value falls back to the pre-existing
   *  FOLDER default, matching this port's minimal-scope convention (no
   *  corpus sample exercises them for class diagrams yet). */
  packageStyle?: 'rect';
  /** `skinparam nodesep N` (px) — when set (nonzero), unconditionally
   *  replaces the clamped default DOT nodesep (SkinParam.java:847-851
   *  getAsInt("nodesep",0); DotStringFactory.java:117-124). Absent = engine
   *  default (min-clamped dzeta). */
  nodeSep?: number;
  /** `skinparam ranksep N` (px) — same override semantics as nodeSep
   *  (SkinParam.java:852-856; DotStringFactory.java:125-133). */
  rankSep?: number;
  /** `skinparam wrapWidth N` (px) — `style.wrapWidth()`'s
   *  `PName.MaximumWidth` (`FromSkinparamToStyle.java:250`). Threaded ONLY
   *  to a descdiagram entity's `desc`/note body text block
   *  (`EntityImageDescription.java`'s `desc`, `EntityImageNote.java`'s
   *  `textBlock` — NOT the title/stereotype text blocks, which upstream
   *  never passes `wrapWidth()` to). E2r/L3, `Fission.ts#getSplitted`.
   *  Absent/0 = no default (upstream sets none anywhere — jar-verified,
   *  `Fission.ts`'s doc comment) — word-wrap is a no-op unless a diagram
   *  explicitly sets this skinparam. */
  wrapWidth?: number;
  /** `skinparam tabSize N` -- `SkinParam#getTabSize()` (default 8, no style
   *  cascade). Threaded to object-field text runs containing a literal
   *  `\t` (`AtomText#getTabSize`/`drawU`'s tab-stop expansion) -- G3/O4.
   *  Absent = upstream default (8). */
  tabSize?: number;
  colors: {
    background: string;
    /** Default fill for action/node shapes (separate from canvas background). */
    nodeBackground: string;
    border: string;
    text: string;
    arrow: string;
    note: string;
    // NOTE: upstream default is '#FBFB77' (HColors.COL_FBFB77 in ColorParam.java).
    // This value intentionally diverges. Tracked in plans/skinparam/decision-journal.md.
    noteBackground: string;
    lifeline: string;
    activation: string;
    frame: string;
    divider: string;
    error: string;
    /** Per-element (SName) color buckets — decision D4. Populated by skinparam
     *  (T4) and element-scoped style blocks (T5); read via
     *  {@link resolveElementPaint}, which cascades element-specific → root
     *  default. This is where gradient (Paint) colors live — the flat fields
     *  below stay `string` (widening them ripples into ~20 not-yet-Paint-aware
     *  renderers with no gradient need; see decision-journal.md T3). */
    elements?: Partial<Record<string, ElementColors>>;
    /** G2 N37: the SAME `.tagname` stereotype-name style-cascade
     *  sub-selector as `graph.classTagCascade` above, applied to the NOTE
     *  bucket (`note { .faint { BackgroundColor red } } }`,
     *  `xokipa-29-rafu481`/`fabuje-68-gona310`/`neruke-07-ruce381`) --
     *  keyed by the SAME cleaned tag name; `renderer-note.ts
     *  #resolveNoteBackground` reads `.background` between a note's own
     *  explicit `#color` override and the bare `elements.note` bucket. */
    noteTagCascade?: Readonly<Record<string, ElementColors>>;
    graph: {
      classBackground: string;
      interfaceBackground: string;
      enumBackground: string;
      actorStroke: string;
      packageBackground: string;
      packageBorder: string;
      /** G2 N18: `skinparam packageBorderThickness N` / `skinparam
       *  package { BorderThickness N }` -- the folder-tab outline's own
       *  stroke width (jar default 1.5, `class-namespace-shape.ts
       *  #PACKAGE_STROKE_WIDTH`). NOTE: the title's own FontSize/FontColor
       *  overrides are NOT dedicated fields here -- class reads the
       *  generic `colors.elements.package.{fontSize,font}` bucket instead
       *  (shared with description's package/folder USymbol rendering, see
       *  `class-namespace-shape.ts#titleFont`'s doc comment). */
      packageBorderThickness?: number;
      /** G2 N51: `skinparam classBorderColor #X` / `skinparam class {
       *  BorderColor #X }` -- the classifier box's own bare (non-`<style>`,
       *  non-tag) LineColor override (`FromSkinparamToStyle.java:183`:
       *  `element.class_` LineColor -- the SAME StyleSignature
       *  `classCascadeBorder` above models for `<style>` blocks). Read by
       *  `renderer-classifier-box.ts#classBorder` as the fallback tier
       *  BELOW the `.tagname`/`classCascadeBorder` cascade and ABOVE the
       *  plain `theme.colors.border` default -- mirrors the PRE-EXISTING
       *  `classBackground`/`classCascadeBackground` two-tier precedent
       *  exactly (`classifierFill`'s own doc comment), jar-verified
       *  `cunavo-77-filo788` (`classBorderColor #F0F`, no `<style>` block,
       *  no stereotype tag match -- box `stroke`/both divider `stroke`s all
       *  render `#FF00FF`). */
      classBorder?: string;
      /** G2 N51: `skinparam classBorderThickness N` / `skinparam class {
       *  BorderThickness N }` -- the classifier box outline's + divider
       *  lines' own stroke-width override (`FromSkinparamToStyle.java:195`:
       *  `element.class_` LineThickness), jar default `0.5`
       *  (`renderer-classifier-box.ts`'s own pre-existing hardcoded
       *  literal). Read by `renderer-classifier-box.ts#classBorderStrokeWidth`
       *  BELOW the per-stereotype `classBorderThicknessByStereo` bucket and
       *  ABOVE the `0.5` default -- jar-verified `vaxeku-10-peko225`
       *  (`classBorderThickness .5`, matches the pre-existing default
       *  coincidentally -- already zero-diff before this field existed). */
      classBorderThickness?: number;
      /** G2 N51: `skinparam classBorderThickness<<stereo>> N` --
       *  `SkinParam#getThickness(LineParam, Stereotype)` (`SkinParam.java
       *  :904-938`): a STEREOTYPE-QUALIFIED skinparam key, resolved by
       *  DIRECT VALUE LOOKUP (`param.name() + "thickness" +
       *  stereotype.getLabel(...)`), NOT via the `<style>`/StyleSignature
       *  cascade `classTagCascade`/`resolveClassTagCascadeEntry` model for
       *  `.tagname` sub-selectors -- a genuinely separate mechanism that
       *  happens to share the `<<stereotype>>` suffix syntax. Keyed by the
       *  LOWERCASED stereotype label (matching `resolveClassTagCascadeEntry`'s
       *  own case-insensitive comparison against `geo.stereotypeLabels`).
       *  Wins over the plain `classBorderThickness` above when the
       *  classifier's OWN stereotype matches a key here -- jar-verified
       *  `ragona-89-fadi984` (`class A <<stereo>>` renders stroke-width 5,
       *  `class B` with no stereotype stays at the 0.5 default). */
      classBorderThicknessByStereo?: Readonly<Record<string, number>>;
      /** G2 N51: `skinparam arrowThickness N` -- `FromSkinparamToStyle.java
       *  :150`: `SName.arrow` LineThickness, the DEFAULT stroke-width every
       *  edge draws at when it carries no `-[thickness=N]->`/`-[bold]->`
       *  bracket override of its own (`LinkType#getStroke3(UStroke
       *  defaultThickness)`, `decoration/LinkType.java:245-256`: a bracket
       *  override always wins; absent one, this skinparam's value is
       *  applied to the edge's OWN dash-pattern via `LinkStyle#goThickness`
       *  -- BOLD edges still hardcode thickness 2 regardless, per that
       *  function's existing doc comment). Read by
       *  `class-geo-builders.ts#buildStrokeOverride` as the fallback
       *  passed to the SAME `svek-edge-stroke.ts#strokeForStyle` formula
       *  the bracket-override path already uses -- jar-verified
       *  `jezepa-12-padu194`/`vufuko-05-lapu034`. */
      arrowThickness?: number;
      /** G2 N23/N32: `skinparam class { AttributeFontSize N }` / `skinparam
       *  classAttributeFontSize N` -- upstream `FontParam.CLASS_ATTRIBUTE`'s
       *  dedicated size override, style-mapped by `FromSkinparamToStyle
       *  .java:190` to the `element.class` style selector (the WHOLE box,
       *  fields+methods). N23 believed this was member-row-only and
       *  independent of the header's own font (`FontParam.CLASS`) -- WRONG,
       *  corrected N32: `element.class.header` (the header's style
       *  signature, `classFontSize` below) CASCADES from `element.class`
       *  when it carries no override of its own (CSS-selector-specificity
       *  semantics, `EntityImageClassHeader#getStyleSignature`'s more
       *  specific selector wins only when it actually sets the property).
       *  Jar-verified `jisanu-32-gado231` (AttributeFontSize/Name only, no
       *  ClassFontSize/Name set) -- the header text ALSO renders at the
       *  overridden size/family, not just member rows. `classFontSize`'s own
       *  doc comment covers the header-overrides-cascade case
       *  (`xabije-20-xusi569`, both pairs set, header and members diverge).
       *  `SkinParam#getFontSize`'s real lookup key is `p.name() + "fontsize"`
       *  where `p.name()` is the Java enum constant `"CLASS_ATTRIBUTE"` --
       *  underscore-stripped, that is EXACTLY `"class" + "attributefontsize"`,
       *  the same block-context + inner-key concatenation this port's own
       *  `skinparam class { AttributeFontSize N }` parsing already produces
       *  (`preprocessor.ts`'s `SkinLoader`-mirroring collector). */
      classAttributeFontSize?: number;
      /** Same mechanism, `FontParam.CLASS_ATTRIBUTE`'s font-family override
       *  (`skinparam class { AttributeFontName X }` / `classAttributeFontName
       *  X`). */
      classAttributeFontFamily?: string;
      /** G2 N32: `skinparam class { AttributeFontStyle italic|bold }` /
       *  `classAttributeFontStyle <tokens>` -- `SkinParam#getFontFace`'s real
       *  parsing rule (`contains("bold")`/`contains("italic")` substring
       *  match on the lowercased value, BOTH may be set simultaneously, e.g.
       *  `"bold italic"`) applied to the SAME `element.class` selector as
       *  `classAttributeFontSize` above. Member-row-only when `classFontStyle`
       *  (below) is ALSO set for a given classifier; the header cascade
       *  applies here too when it is not. */
      classAttributeFontBold?: boolean;
      classAttributeFontItalic?: boolean;
      /** G2 N32: `skinparam classFontSize N` / `classFontName X` /
       *  `classFontStyle <tokens>` -- `FromSkinparamToStyle.java:185-188`'s
       *  `element.class.header` selector, the classifier HEADER's own
       *  font override (name text + kind-badge row), independent of
       *  `classAttributeFont*` above -- jar-verified `xabije-20-xusi569`:
       *  `ClassFontSize 14`/`ClassFontStyle bold` render on the header
       *  ("Class", size 14, `font-weight="700"`) while `ClassAttributeFontSize
       *  18`/`ClassAttributeFontStyle italic` render on the member rows
       *  (size 18, `font-style="italic"`) -- the two axes genuinely diverge
       *  for a real multi-compartment class (N23's "one shared font" was
       *  only correct by coincidence for the enum single-compartment case,
       *  where `MethodsOrFieldsArea` folds header+members into one region).
       *  Unset (the overwhelmingly common case) falls back to
       *  `classAttributeFont*` first, then `theme.fontFamily`/`fontSize` --
       *  see `class-layout-helpers.ts#measureClassifier`'s cascade. */
      classFontSize?: number;
      classFontFamily?: string;
      classFontBold?: boolean;
      classFontItalic?: boolean;
      /** G2 N39: `skinparam classStereotypeFontSize N` / `classStereotype
       *  FontName X` / `classStereotypeFontStyle <tokens>` --
       *  `FontParam.CLASS_STEREOTYPE` (`klimt/font/FontParam.java:61`,
       *  default size 12, ALWAYS italic by default), the font BOTH the
       *  classifier's `<<stereotype>>` label row(s) AND its `<T>` generic
       *  type-parameter tag box share (`EntityImageClassHeader.java:124-132`
       *  and `:144-148` both call the identical `FontConfiguration.create
       *  (skinParam, FontParam.CLASS_STEREOTYPE, stereotype)` -- confirmed
       *  by direct read, not inferred) -- a SEPARATE `FontParam` from
       *  `classFontSize`/`classAttributeFontSize` above (N32's header-vs-
       *  attribute split), disambiguated from `circledCharacterFontSize`
       *  (G2 N38, which drives ONLY the badge) by `datugo-88-sote552`'s own
       *  byte-exact formula match. `classStereotypeFontStyle`'s parsing
       *  mirrors `classFontStyle`'s substring rule EXACTLY, but the
       *  UNSET-vs-SET distinction matters more here: `FontParam
       *  .CLASS_STEREOTYPE`'s own default face is italic (unlike
       *  class/classAttribute's plain default), so `classStereotypeFontBold`/
       *  `Italic` unset means "italic, not bold" (the upstream default),
       *  NOT "neither" -- jar-verified `teluve-08-moco846` (FontSize+FontName
       *  only, no FontStyle: renders `font-style="italic"`) vs `datugo-88-
       *  sote552` (FontStyle bold: renders `font-weight="700"`, NO
       *  `font-style` attribute at all -- an explicit override REPLACES the
       *  default face, it does not add to it). See `class-stereotype.ts
       *  #CLASS_STEREOTYPE_FONT_SIZE`'s own doc comment for the consuming
       *  side (`measureStereoLabelWidths`/`stereoBlockDim`/`buildStereoRows`/
       *  `measureGenericTagDim`/`buildGenericTagGeo`). */
      classStereotypeFontSize?: number;
      classStereotypeFontFamily?: string;
      classStereotypeFontBold?: boolean;
      classStereotypeFontItalic?: boolean;
      /** G2 N36: the "classDiagram class-selector cascade reaching
       *  classifier boxes" mechanism -- `<style> classDiagram { BackGround
       *  Color }`/`root {}`/nested `classDiagram { class { ... } } }` all
       *  cascade DOWN to a classifier box's own BackGroundColor/LineColor/
       *  FontColor (upstream `EntityImageClass.getStyleSignature() =
       *  {root,element,classDiagram,class_}`, a pure SName-subset test --
       *  see `style-map-element.ts#resolveStyleCascade`'s own doc comment).
       *  Pre-resolved to an SVG-ready hex string at Theme-build time
       *  (`style-map-theme.ts#applyStyleMap`), matching the existing
       *  inline-`#color`-override precedent -- unlike the PRE-EXISTING,
       *  narrower `classBackground` above (bare `class {}` selector only,
       *  RAW/unresolved), `classCascadeBackground` additionally covers the
       *  `classDiagram`/`root` ancestor layer and nested `classDiagram
       *  .class {}`, and always wins when set (a strict superset of what
       *  `classBackground` could ever populate from the SAME StyleMap).
       *  `classCascadeFontColor` is the member-row/box-level FontColor
       *  cascade; `classCascadeHeaderFontColor` additionally allows a MORE
       *  specific nested `... { header { FontColor } } }` override to win
       *  for the header row alone (`class-badge.ts`/`renderer-classifier-
       *  box.ts#renderRowText`'s own doc comment, jar-verified `bikuka-40-
       *  pezi068`/`cilaba-36-zogi212`/`momaku-69-duxe918`). */
      classCascadeBackground?: string;
      classCascadeBorder?: string;
      classCascadeFontColor?: string;
      classCascadeHeaderFontColor?: string;
      /** G2 N65 item 35: `<style> class { MaximumWidth N } }`'s word-wrap
       *  cascade -- `Style#wrapWidth` (`Style.java:292-295`, `PName
       *  .MaximumWidth`) resolved against the SAME two style signatures the
       *  FontColor pair above already models: `classCascadeMaximumWidth`
       *  is `EntityImageClass.getStyleSignature()` (`{root,element,
       *  classDiagram,class_}`, `CLASS_SNAMES`) -- feeds a member/field ROW's
       *  own word-wrap (`MethodsOrFieldsArea#createTextBlock`,
       *  java:255-256/264-265). `classCascadeHeaderMaximumWidth` is
       *  `EntityImageClassHeader.getStyleSignature()` (adds `header`,
       *  `HEADER_SNAMES`) -- feeds the classifier NAME's own word-wrap
       *  (`EntityImageClassHeader.java:108`). A bare `class { MaximumWidth
       *  N }` selector (this mission's own 2 named reach fixtures,
       *  `nufini-44-jofo787`/`nucite-98-kuga991`) sets BOTH fields to the
       *  SAME value (`HEADER_SNAMES` is a strict superset of
       *  `CLASS_SNAMES`, so the identical cascade lookup matches under
       *  either signature) -- a `... { header { MaximumWidth N } } }`
       *  override (unsampled in this mission's corpus) would diverge them,
       *  matching the FontColor pair's own precedent exactly. Absent = 0 =
       *  no wrap (upstream sets no built-in default for `PName
       *  .MaximumWidth` anywhere, `Fission.ts`'s own doc comment). NOT
       *  `.tagname`-cascaded (unlike RoundCorner/FontColor/FontStyle above)
       *  -- zero corpus reach for a stereotype-scoped MaximumWidth override,
       *  scoped out deliberately rather than guessed. */
      classCascadeMaximumWidth?: number;
      classCascadeHeaderMaximumWidth?: number;
      /** G2 N66: `EntityImageNote`'s OWN `Style#wrapWidth` cascade -- a
       *  class-diagram NOTE's body text has a SEPARATE style signature from
       *  a classifier's (`EntityImageNote.getStyleSignature()`, `{root,
       *  element,classDiagram,note}` -- `NOTE_SNAMES` in `style-cascade-
       *  class.ts`, identical to `CLASS_SNAMES` except its trailing token is
       *  `note` not `class_`), so a bare `class { MaximumWidth N } }`
       *  selector does NOT reach a note (`class_` != `note`), but the SHARED
       *  ancestor tokens (`element`/`classDiagram`/`root`) do -- jar-verified
       *  `rubecu-40-cixu870` (`element { MaximumWidth 100 } }` wraps BOTH the
       *  classifier box, via `classCascadeMaximumWidth`, AND the note body,
       *  via this field) and `nufini-44-jofo787` (an EXPLICIT `note {
       *  MaximumWidth 100 } }` block, distinct from its own sibling `class {
       *  MaximumWidth 150 } }` block -- the two fields diverge). Consumed by
       *  `note-layout.ts#measureNote`. Absent = 0 = no wrap, matching
       *  `classCascadeMaximumWidth`'s own "no built-in default" contract. NOT
       *  `.tagname`-cascaded (zero corpus reach for a stereotype-scoped
       *  note MaximumWidth, matching the class-side field's own scoping). */
      noteCascadeMaximumWidth?: number;
      /** G2 N67 item 49: `EntityImageNote`'s OWN FontColor cascade -- the
       *  SAME `NOTE_SNAMES` style signature (`{root,element,classDiagram,
       *  note}`) `noteCascadeMaximumWidth` above already established for
       *  `MaximumWidth`, wired here for `FontColor` -- mirrors
       *  `classCascadeFontColor`'s exact mechanism (`cascadeFontColorHex`,
       *  including the `#?light:dark[:transparent]` conditional path,
       *  `style-cascade-class.ts`) applied to the note signature instead of
       *  `CLASS_SNAMES`. Unlike `classCascadeFontColor`/
       *  `classCascadeHeaderFontColor`, there is no header-split sibling --
       *  a note body has no separate "header" sub-selector upstream
       *  (`EntityImageNote` never nests a `header {}` selector the way
       *  `EntityImageClassHeader` does). Consumed by `renderer-note.ts
       *  #renderNoteLineAtoms`/`renderNoteText` as the fallback tier BELOW
       *  an atom's own explicit `<color>` creole run (unchanged precedence)
       *  and ABOVE the hardcoded `'#000000'` default that function's own
       *  pre-N67 doc comment documented as having "no per-tag/theme cascade
       *  fallback tier" -- jar-verified `nufini-44-jofo787` (`<style> note {
       *  Fontcolor red } }`, distinct from its own sibling `class { Fontcolor
       *  green } }` block -- the two fields diverge exactly like the
       *  MaximumWidth pair). Absent = no override = the hardcoded black
       *  default, matching every other cascade field's "no built-in
       *  default" contract. NOT `.tagname`-cascaded (zero corpus reach for a
       *  stereotype-scoped note FontColor, matching `noteCascadeMaximumWidth`'s
       *  own scoping). */
      noteCascadeFontColor?: string;
      /** G2 N36: `<style> classDiagram { LineColor }`/`root { LineColor
       *  }`/nested `classDiagram { arrow { LineColor } } }` -- the SAME
       *  ancestor cascade applied to an EDGE's own style signature
       *  (`SvekEdge.java:819`: `{root,element,classDiagram,arrow}`,
       *  jar-verified `bikuka-40-pezi068`/`rakici-44-tivo701`). Read by
       *  `renderer.ts#renderEdge` as the default stroke color, below the
       *  per-edge `-[#color]->` bracket override (`geo.colorOverride`,
       *  N26) and above `theme.colors.arrow` (the cross-diagram-type
       *  global default -- never overwritten directly, to avoid bleeding a
       *  class-only cascade into description/other diagram types that
       *  share this Theme shape). */
      classCascadeArrowColor?: string;
      /** G2 N36: the badge/spot `<style>` cascade's ONLY possible ancestor
       *  layer -- `EntityImageClassHeader.java#spotStyleSignature` is
       *  `{root,element,spot,spot<Kind>}`, which has NO `classDiagram`
       *  token, so (unlike the box/text/edge fields above) a bare
       *  `classDiagram {}`/nested `classDiagram.class {}` selector can
       *  NEVER reach the badge -- only a bare `root {}` selector can
       *  (jar-verified `bikuka-40-pezi068`: badge ellipse/glyph pick up
       *  `root`'s BackGroundColor/FontColor while the SAME fixture's
       *  `classDiagram { BackGroundColor Green }` correctly does NOT tint
       *  the badge). Sits BELOW the existing `spot<Kind>` bucket
       *  (`theme.colors.elements['spotclass'/...]`, G2 N32) and ABOVE the
       *  hardcoded kind default in `class-badge.ts#resolveBadgeFill`/
       *  `resolveBadgeBorder`/`resolveBadgeGlyphColor`. */
      spotCascadeBackground?: string;
      spotCascadeBorder?: string;
      spotCascadeFont?: string;
      /** G2 N37: the `.tagname` stereotype-name style-cascade sub-selector
       *  (`classDiagram { RoundCorner 15 }` -- the ANCESTOR-only, non-tag
       *  half; a classifier box's own corner radius has NO prior mechanism
       *  at all -- `renderer-classifier-box.ts#buildHeaderPrimitive`
       *  hardcoded `rx: 2.5, ry: 2.5` (jar's default) unconditionally.
       *  `EntityImageClass.getStyleSignature()` (`{root,element,
       *  classDiagram,class_}`) carries `RoundCorner` the SAME way it
       *  carries BackGroundColor/LineColor -- `resolveStyleCascade`'s
       *  general subset-match resolver already covers this, this field
       *  just stores the RAW (unhalved) style value; `rx`/`ry` = value/2
       *  (`URectangle.ts#build().rounded()`'s existing halving convention,
       *  jar-verified `dozude-05-jeve029`: `RoundCorner 15` -> `rx="7.5"`).
       *  Absent = the pre-existing hardcoded 2.5 default (zero behavior
       *  change for every classifier with no `<style>` RoundCorner).
       *  G2 N65 item 47: ALSO populated by a bare `skinparam RoundCorner N`
       *  (`resolveSkinparam`, no `<style>` block at all) -- jar's own
       *  `FromSkinparamToStyle.java:164` (`addConvert("roundCorner",
       *  PName.RoundCorner, SName.root)`) converts that skinparam into a
       *  style declaration at `SName.root` scope, i.e. a bare skinparam and
       *  `<style> root { RoundCorner N }` are the SAME upstream mechanism,
       *  not two competing ones -- reusing this one field (rather than a
       *  second, parallel field) mirrors that identity directly. Precedence
       *  follows source-pipeline order (`index.ts`: `resolveSkinparam` runs
       *  before `applyStyleMap`): a real `<style>` block's own
       *  CLASS_SNAMES-cascade value (`style-cascade-class.ts
       *  #computeClassStyleCascadeOverrides`) overwrites the
       *  skinparam-sourced baseline when BOTH are present (`Object.assign`
       *  only clobbers the key when the style-block computation actually
       *  returns a defined value) -- jar-verified against `dofima-22-
       *  kofe334` (`skinparam RoundCorner 20`, no competing `<style>`
       *  block): `rect/@rx`/`@ry` 10 (was 2.5). */
      classCascadeRoundCorner?: number;
      /** G2 N37: the `.tagname` stereotype-name style-cascade sub-selector
       *  itself (`classDiagram { .mystyle { BackgroundColor cyan; RoundCorner
       *  5; FontStyle Bold; FontColor red } } }` / a top-level bare `.tag {
       *  ... }`) -- `StyleSignatureBasic#matchAllImpl`'s SECOND subset test
       *  (`element.stereotypes.containsAll(declaration.stereotypes)`,
       *  `style-map-element.ts#resolveStyleCascade`'s own doc comment for
       *  the full two-dimensional-match derivation). Keyed by the CLEANED
       *  tag name (`cleanStereotypeToken` -- lowercase, `_`/`.` stripped,
       *  mirrors upstream `StyleSignatureBasic#clean`) so a classifier's own
       *  `<<mystyle>>`/`<<<mystyle>>>` stereotype label(s) look themselves up
       *  directly. Each entry is the FULLY cascade-resolved value for that
       *  tag (ancestor cascade already folded in when the tag itself sets no
       *  override of its own -- computed by calling the SAME
       *  `resolveStyleCascade` with this one tag in its `stereotypeTags`
       *  query, so ordinary last-registered-wins semantics apply uniformly).
       *  A classifier carrying MULTIPLE simultaneous tags with DIFFERING
       *  overrides picks its FIRST matching label's entry (`renderer-
       *  classifier-box.ts#resolveClassTagCascade`'s own doc comment) -- no
       *  sampled corpus fixture combines multiple simultaneously-tagged,
       *  differently-overridden labels on one classifier, so exact upstream
       *  cross-tag registration-order fidelity is out of this iteration's
       *  scope. */
      classTagCascade?: Readonly<Record<string, {
        background?: string;
        border?: string;
        fontColor?: string;
        roundCorner?: number;
        fontBold?: boolean;
        fontItalic?: boolean;
      }>>;
      /** G2 N39: `classTagCascade`, snapshotted PER `<style>`-block boundary
       *  -- index `g` is the cascade as resolved from only the FIRST `g`
       *  `<style>` blocks in source order (index 0 = no blocks applied yet,
       *  index `preprocessed.styles.length` = the SAME value as
       *  {@link classTagCascade} itself). Upstream captures a classifier's
       *  style resolution AT ITS OWN CREATION TIME (`Entity
       *  #currentStyleBuilder`, `net/atmp/CucaDiagram.java:808-819`) rather
       *  than deferring to a single document-wide final merge -- a SECOND
       *  `<style>` block redefining the SAME selector only affects
       *  classifiers declared AFTER it (jar-verified `fexuta-62-piko653`,
       *  see `preprocessor.ts#PreprocessorResult.stylePositions`'s doc
       *  comment for the full derivation). Populated ONLY when the source
       *  carries MORE THAN ONE `<style>` block (`style-cascade-class.ts
       *  #computeClassTagCascadeGenerations`) -- undefined for every
       *  single-or-no-block fixture (the overwhelming majority), which
       *  falls back to the single {@link classTagCascade} field unchanged
       *  (zero behavior change). Read by `style-cascade-class.ts
       *  #resolveClassTagCascadeEntry` via a classifier's own `Classifier
       *  .styleGeneration` (`ast.ts`'s doc comment). */
      classTagCascadeGenerations?: readonly (Readonly<Record<string, {
        background?: string;
        border?: string;
        fontColor?: string;
        roundCorner?: number;
        fontBold?: boolean;
        fontItalic?: boolean;
      }>> | undefined)[];
      /** G2 N27: `skinparam guillemet <value>` -- `Guillemet.
       *  fromDescription`'s resolved start/end wrapper strings for
       *  stereotype text (`«Foo»` by default). Both unset means the
       *  render-side default (`«`/`»`, upstream's `Guillemet.GUILLEMET`)
       *  applies -- covers every unrecognized/spaceless override value too,
       *  matching `fromDescription`'s own bottom fallback. See
       *  `class-stereotype.ts#wrapGuillemet`/`class-object-map-sizing.ts
       *  #wrapGuillemet`, the two call sites that read this pair.
       *  @see ~/git/plantuml/.../text/Guillemet.java#fromDescription */
      guillemetStart?: string;
      guillemetEnd?: string;
      /** G2 N38: `skinparam circledCharacterFontSize N` -- `FontParam
       *  .CIRCLED_CHARACTER`'s own font-size override (default 17,
       *  `klimt/font/FontParam.java:55`). Drives BOTH the badge glyph's
       *  actual rendered size AND (via `SkinParam#getCircledCharacter
       *  Radius()`, `skin/SkinParam.java:542-545`) the badge ellipse's
       *  radius when no explicit `circledCharacterRadius` override is set
       *  -- see `class-badge.ts#resolveBadgeRadius`'s own doc comment for
       *  the jar-verified formula (`floor(fontSize/3)+6`, 12/12 corpus
       *  samples matched exactly). */
      circledCharacterFontSize?: number;
      /** G2 N38: `skinparam circledCharacterRadius N` -- an explicit
       *  override that WINS over the fontSize-derived formula above
       *  unconditionally (`SkinParam#getCircledCharacterRadius()`'s own
       *  `value == -1 ? ... : value` short-circuit). Jar-verified
       *  `depulu-53-xoca727` (radius 13, fontSize 20 -- the formula alone
       *  would predict 12) and `gateja-70-losi738` (radius 18, fontSize
       *  30 -- formula alone would predict 16). */
      circledCharacterRadius?: number;
      /** G2 N47: `skinparam circledCharacterFontName <family>`/
       *  `circledCharacterFontStyle <Bold|Italic|...>` -- badge glyph
       *  OUTLINE selection only (NOT sizing/radius, both handled above).
       *  A non-default family/style draws a STRUCTURALLY different AWT
       *  glyph outline, not a scaled one (`class-badge-sized-glyphs.ts`'s
       *  own doc comment: `datugo-88-sote552`'s Helvetica 'C' at size 18
       *  has 32 coordinate pairs vs the default Monospaced capture's 34,
       *  x-extent 11.52 vs 8.17). `resolveAnnotationStyles`-style per-
       *  element cascades don't apply here -- this is `FromSkinparamToStyle
       *  .java`'s flat `CIRCLED_CHARACTER` `FontParam`, same axis as
       *  `circledCharacterFontSize` above, not a `<style>`-scoped bucket. */
      circledCharacterFontFamily?: string;
      circledCharacterFontBold?: boolean;
      circledCharacterFontItalic?: boolean;
      /** G2 N40: `skinparam pathHoverColor <color>` -- emits a global
       *  `<defs><style>path:hover { stroke: <color> !important;}</style>
       *  </defs>` CSS rule (`klimt/drawing/svg/SvgGraphics.java`'s own
       *  `getPathHover` -- already ported as shared, unwired machinery in
       *  `core/klimt/drawing/svg/svg-graphics-core.ts#getPathHover`, this
       *  is the class-render-side wiring that actually populates it).
       *  Unset means no `<style>` block is emitted at all (upstream only
       *  writes the rule when the skinparam is set -- `SvgOption
       *  #getHoverPathColor() != null`). Jar-verified `dasagu-52-
       *  vani172`. */
      pathHoverColor?: string;
      /** G2 N66: `skinparam diagramBorderColor <color>` -- jar's
       *  `TextBlockExporter#maybeDrawBorder` (`core/TextBlockExporter.java:
       *  215-232`) draws a whole-canvas `<rect fill="none">` border, one
       *  layer OUTSIDE the diagram's own content -- a universal, diagram-
       *  type-agnostic export-layer mechanism (`ColorParam.diagramBorder`),
       *  not scoped to class specifically, though this mission only found
       *  class-diagram corpus reach (`vinujo-78-kapo329`). Stored RAW (not
       *  pre-resolved to hex) -- mirrors `classBackground`/`noteBackground`'s
       *  own "resolve at the render site" convention, NOT `classCascade
       *  Background`'s N36 eager-hex convention (which only applies to the
       *  `<style>`-cascade machinery). `undefined` means jar draws no
       *  border at all (`stroke = skinParam.getThickness(...) == null &&
       *  color == null` short-circuits `maybeDrawBorder`'s own early
       *  return) -- zero behavior change for every fixture with no such
       *  skinparam. Border THICKNESS/ROUNDCORNER (`LineParam.diagramBorder`/
       *  `CornerParam.diagramBorder`) are NOT modeled -- zero corpus reach
       *  for either, jar's own default (`UStroke.simple()`, thickness 1,
       *  square corners) is what `renderer-shell.ts` hardcodes instead. */
      diagramBorderColor?: string;
      /** G2 N54: `skinparam icon<Kind>Color`/`icon<Kind>BackgroundColor`
       *  (`Kind` in Private/Package/Protected/Public) -- the member-row
       *  visibility icon's own LineColor/BackgroundColor overrides
       *  (`FromSkinparamToStyle.java:232-239`, mapped to the
       *  `element.visibilityIcon.<kind>` StyleSignature `VisibilityModifier
       *  .java` reads). No `IEMandatory` entry exists upstream (the `*`
       *  icon's black fill has no skinparam override path at all -- see
       *  `class-visibility-icon.ts#colorsFor`'s doc comment). Read by
       *  `class-visibility-icon.ts#colorsFor` as the override tier ABOVE
       *  the hardcoded `VISIBILITY_COLORS` defaults, per-visibility-char --
       *  jar-verified `lufide-34-cexu026` (all 8 keys set; only
       *  `iconProtectedBackgroundColor` actually diverges from the
       *  hardcoded default, `#FECF6C` vs `#FFFF44`). */
      iconPrivateColor?: string;
      iconPrivateBackgroundColor?: string;
      iconPackageColor?: string;
      iconPackageBackgroundColor?: string;
      iconProtectedColor?: string;
      iconProtectedBackgroundColor?: string;
      iconPublicColor?: string;
      iconPublicBackgroundColor?: string;
      edgeLabel: string;
      // NOTE: upstream actor head (via Fashion.apply in ActorStickMan.java) inherits
      // the root skin BackgroundColor (#f1f1f1 via --common-background). Current
      // renderer hardcodes fill="none" for the head circle. Divergence preserved
      // intentionally to match existing rendering behavior.
      actorFill: string;
      // NOTE: upstream usecase ellipse (USymbolUsecase.java) inherits root
      // BackgroundColor (#f1f1f1). Current renderer uses theme.colors.background
      // (#FFFFFF in default theme). Divergence preserved intentionally.
      usecaseFill: string;
      // Same divergence note as actorFill; business variant of stickman actor
      // (USymbolActorBusiness.java / ActorStickMan with isBusiness=true).
      businessActorFill: string;
      // Same divergence note as usecaseFill; business variant of usecase ellipse
      // (USymbolUsecase.java with isBusiness=true).
      businessUsecaseFill: string;
      activity?: {
        background?: string;        // ActivityBackgroundColor — action box fill
        border?: string;            // ActivityBorderColor — action box stroke
        barColor?: string;          // ActivityBarColor — fork/join bar fill
        diamondBackground?: string; // ActivityDiamondBackgroundColor
        diamondBorder?: string;     // ActivityDiamondBorderColor
        startColor?: string;        // ActivityStartColor — filled start circle
        endColor?: string;          // ActivityEndColor — end/terminate circle
        swimlaneBorder?: string;    // SwimlaneHeaderBackgroundColor — lane header
      };
      json?: {
        keyText?: string;
        stringValue?: string;
        numberValue?: string;
        booleanValue?: string;
        nullValue?: string;
        background?: string;
        border?: string;
        headerBackground?: string;
        highlightBackground?: string;
        arrowColor?: string;
        /** True when element.header { FontStyle: bold } is set. */
        headerFontBold?: boolean;
        // jsonDiagram { node { … } } style block properties
        /** Border rx (rounded corners) from jsonDiagram.node.RoundCorner */
        roundCorner?: number;
        /** Maximum value-column pixel width before word-wrap kicks in */
        maximumWidth?: number;
        /** Text alignment within cells: left (default), center, or right */
        textAlign?: 'left' | 'center' | 'right';
        /** Border stroke width from jsonDiagram.node.LineThickness */
        nodeLineThickness?: number;
        /** Value-cell font color from jsonDiagram.node.FontColor */
        nodeFontColor?: string;
        /** Value-cell font size from jsonDiagram.node.FontSize */
        nodeFontSize?: number;
        /** Value-cell font family from jsonDiagram.node.FontName */
        nodeFontFamily?: string;
        /** Bold override from jsonDiagram.node.FontStyle/FontWeight */
        nodeFontBold?: boolean;
        /** Italic override from jsonDiagram.node.FontStyle */
        nodeFontItalic?: boolean;
        /** Dash pattern for the outer node border (from jsonDiagram.node.LineStyle) */
        nodeLineDasharray?: string;
        // jsonDiagram { arrow { … } }
        /** Arrow/edge stroke width from jsonDiagram.arrow.LineThickness */
        arrowThickness?: number;
        /** Arrow/edge dash pattern from jsonDiagram.arrow.LineStyle */
        arrowDasharray?: string;
        // jsonDiagram { node { separator { … } } }
        /** Separator line color (overrides border for row dividers) */
        separatorColor?: string;
        /** Separator line thickness */
        separatorThickness?: number;
        /** Separator line dash pattern */
        separatorDasharray?: string;
        // jsonDiagram { node { highlight { … } } }
        /** Highlighted row font color */
        highlightFontColor?: string;
        /** Highlighted row font bold */
        highlightFontBold?: boolean;
        /** Highlighted row font italic */
        highlightFontItalic?: boolean;
        /** Per-class highlight overrides keyed by style class name (e.g. "h1") */
        highlightClasses?: Record<string, {
          background?: string;
          fontColor?: string;
          fontBold?: boolean;
          fontItalic?: boolean;
        }>;
      };
    };
  };
  sequence: {
    /** Horizontal padding inside a participant box */
    participantPadding: number;
    /** Minimum participant box width */
    participantMinWidth: number;
    /** Horizontal gap between adjacent participant boxes */
    participantGap: number;
    /** Vertical gap between messages */
    messageSpacing: number;
    /** Width of the activation box drawn on a lifeline */
    activationWidth: number;
    /** Gap between a note and the nearest participant */
    noteMargin: number;
    /** Height of the frame label area */
    frameHeaderHeight: number;
    /** Extra lifeline length below the last message */
    lifelineExtension: number;
  };
}

export const defaultTheme: Theme = {
  fontFamily: 'sans-serif',
  fontSize: 14,
  colors: {
    background: '#FFFFFF',
    nodeBackground: '#F1F1F1',
    border: '#181818',
    text: '#181818',
    arrow: '#181818',
    note: '#FEFECE',
    noteBackground: '#FEFECE',
    lifeline: '#181818',
    activation: '#DDDDDD',
    frame: '#999999',
    divider: '#999999',
    error: '#CC0000',
    graph: {
      // D2: upstream's authoritative Style-system default fill is #F1F1F1
      // (resources/skin/plantuml.skin), superseding the legacy ColorParam
      // yellow (#FEFECE). See DIVERGENCES.md and decisions.md#D2.
      classBackground: '#F1F1F1',
      interfaceBackground: '#B4D7ED',
      enumBackground: '#F1F1F1',
      actorStroke: '#181818',
      packageBackground: 'none',
      // G2 N17: jar-verified '#000000' for the class-diagram folder-tab
      // border (finono-05-cuvu171, jinibe-02-tebi269, ...) -- was an
      // unverified #999999. Class is this field's ONLY consumer
      // (description deliberately avoids it -- renderer-cluster.ts's own
      // doc comment), so the default is safe to correct here.
      packageBorder: '#000000',
      edgeLabel: '#444444',
      actorFill: 'none',
      usecaseFill: '#FFFFFF',
      businessActorFill: 'none',
      businessUsecaseFill: '#FFFFFF',
      json: {
        // keyText is intentionally absent so the renderer's fallback chain
        // reaches nodeFontColor (from jsonDiagram.node.FontColor style blocks).
        // Themes that want an explicit key color set it directly (e.g. darkTheme).
        stringValue:         '#3A6E96',
        numberValue:         '#A67F52',
        booleanValue:        '#BE5D47',
        nullValue:           '#767676',
        // plantuml.skin sets jsonDiagram.node.BackGroundColor #F1F1F1 as the default.
        // Named themes override this via their compiled graph.json entry.
        background:          '#F1F1F1',
        border:              '#181818',
        highlightBackground: '#CCFF02',
        arrowColor:          '#181818',
      },
    },
  },
  sequence: {
    participantPadding: 10,
    participantMinWidth: 80,
    participantGap: 20,
    messageSpacing: 20,
    activationWidth: 10,
    noteMargin: 5,
    frameHeaderHeight: 20,
    lifelineExtension: 20,
  },
};

export const darkTheme: Theme = {
  fontFamily: defaultTheme.fontFamily,
  fontSize: defaultTheme.fontSize,
  colors: {
    background: '#1E1E1E',
    nodeBackground: '#2D2D2D',
    border: '#CCCCCC',
    text: '#CCCCCC',
    arrow: '#CCCCCC',
    note: '#3C3C3C',
    noteBackground: '#2D2D2D',
    lifeline: '#888888',
    activation: '#444444',
    frame: '#666666',
    divider: '#555555',
    error: defaultTheme.colors.error,
    graph: {
      ...defaultTheme.colors.graph,
      usecaseFill: '#1E1E1E',
      businessUsecaseFill: '#1E1E1E',
      json: {
        keyText:             '#CCCCCC',
        stringValue:         '#6A9FBF',
        numberValue:         '#C9985A',
        booleanValue:        '#D47070',
        nullValue:           '#999999',
        background:          '#2D2D2D',
        border:              '#CCCCCC',
        headerBackground:    '#3C3C3C',
        highlightBackground: '#555500',
        arrowColor:          '#CCCCCC',
      },
    },
  },
  sequence: { ...defaultTheme.sequence },
};

export const sketchyTheme: Theme = {
  ...defaultTheme,
};

export const monochromeTheme: Theme = {
  ...defaultTheme,
};

/**
 * Deep-partial theme override, safe to compose onto a base Theme.
 *
 * Unlike Partial<Theme> (which is only one level deep), colors and its nested
 * fields may each be partially specified. deepMergeTheme accepts this type and
 * fills missing fields from the base.
 */
export type ThemeOverride = {
  fontFamily?: string;
  fontSize?: number;
  linetype?: 'ortho' | 'polyline';
  fixCircleLabelOverlapping?: boolean;
  componentStyle?: 'uml2' | 'uml1' | 'rectangle';
  strictUml?: boolean;
  monochrome?: 'true' | 'reverse';
  packageStyle?: 'rect';
  nodeSep?: number;
  rankSep?: number;
  wrapWidth?: number;
  tabSize?: number;
  colors?: {
    background?: string;
    nodeBackground?: string;
    border?: string;
    text?: string;
    arrow?: string;
    note?: string;
    noteBackground?: string;
    lifeline?: string;
    activation?: string;
    frame?: string;
    divider?: string;
    error?: string;
    elements?: Partial<Record<string, ElementColors>>;
    graph?: Partial<Theme['colors']['graph']> & {
      activity?: Partial<NonNullable<Theme['colors']['graph']['activity']>>;
      json?: Partial<NonNullable<Theme['colors']['graph']['json']>>;
    };
  };
  sequence?: Partial<Theme['sequence']>;
};

/**
 * Deep-merge a partial Theme on top of a base Theme.
 *
 * Returns a new Theme object — neither `base` nor `partial` is mutated.
 * Nested objects (`colors`, `colors.graph`, `colors.graph.activity`,
 * `colors.graph.json`, `sequence`) are merged one level deep; scalar fields
 * use nullish coalescing so that explicit `undefined` falls through to the
 * base value.
 */
/** Merge the nested `colors.graph` block (activity/json one level deep). */
function mergeGraphColors(
  base: Theme,
  partial: ThemeOverride,
): Theme['colors']['graph'] {
  const pg = partial.colors?.graph;
  return {
    ...base.colors.graph,
    ...(pg ?? {}),
    activity: {
      ...(base.colors.graph.activity ?? {}),
      ...(pg?.activity ?? {}),
    },
    json: {
      ...(base.colors.graph.json ?? {}),
      ...(pg?.json ?? {}),
    },
  };
}

/** Top-level optional scalar fields copied verbatim during a merge. */
const OPTIONAL_SCALAR_KEYS = [
  'linetype',
  'fixCircleLabelOverlapping',
  'componentStyle',
  'strictUml',
  'monochrome',
  'packageStyle',
  'nodeSep',
  'rankSep',
  'wrapWidth',
  'tabSize',
] as const;

/** Copy the top-level optional scalars, preferring `partial` then `base`. */
function applyOptionalScalars(
  merged: Theme,
  base: Theme,
  partial: ThemeOverride,
): void {
  for (const key of OPTIONAL_SCALAR_KEYS) {
    const value = partial[key] ?? base[key];
    if (value !== undefined) {
      (merged as Record<typeof key, unknown>)[key] = value;
    }
  }
}

export function deepMergeTheme(base: Theme, partial: ThemeOverride): Theme {
  const merged: Theme = {
    fontFamily: partial.fontFamily ?? base.fontFamily,
    fontSize: partial.fontSize ?? base.fontSize,
    colors: {
      ...base.colors,
      ...(partial.colors ?? {}),
      graph: mergeGraphColors(base, partial),
    },
    sequence: {
      ...base.sequence,
      ...(partial.sequence ?? {}),
    },
  };
  applyOptionalScalars(merged, base, partial);
  return merged;
}

/**
 * Resolve a theme option to a concrete Theme object.
 *
 * - String aliases: 'default' → defaultTheme, 'dark' → darkTheme,
 *   'sketchy' → sketchyTheme, 'monochrome' → monochromeTheme.
 * - Any other string: looked up in BUILTIN_THEMES, merged onto defaultTheme.
 *   Unknown names fall back to defaultTheme.
 * - ThemeOverride object: deep-merged on top of defaultTheme. The original
 *   defaultTheme is never mutated.
 * - undefined / omitted: returns defaultTheme.
 */
export function resolveTheme(
  option?: ThemeOverride | string,
): Theme {
  if (option === undefined || option === 'default') {
    return defaultTheme;
  }

  if (option === 'dark') {
    return darkTheme;
  }

  if (option === 'sketchy') {
    return sketchyTheme;
  }

  if (option === 'monochrome') {
    return monochromeTheme;
  }

  if (typeof option === 'string') {
    const builtin = BUILTIN_THEMES[option];
    if (builtin !== undefined) return deepMergeTheme(defaultTheme, builtin);
    return defaultTheme;
  }

  // Partial<Theme> deep-merge — produce a new object, never mutate defaultTheme
  return deepMergeTheme(defaultTheme, option);
}

/**
 * Resolve the {@link Paint} for one element's color role, cascading
 * element-specific (SName) bucket → root default (decision D4). Never throws on
 * an unrecognized `sname` — it falls through to the root default.
 *
 * `background` resolves to the root node fill (`nodeBackground`, `#F1F1F1` by
 * default), NOT the class-specific `classBackground`, so a `database` (or any
 * non-`class` element) is not tinted with the class color.
 */
export function resolveElementPaint(
  theme: Theme,
  sname: string,
  role: 'background' | 'border' | 'font',
): Paint {
  const specific = theme.colors.elements?.[sname]?.[role];
  if (specific !== undefined) return specific;
  switch (role) {
    case 'background':
      return theme.colors.nodeBackground;
    case 'border':
      return theme.colors.border;
    case 'font':
      return theme.colors.text;
  }
}

/**
 * Resolve the entity/cluster text FONT SIZE override for one element's
 * `sname` and text role, cascading STEREOTYPE-specific → the element's own
 * plain override → `undefined` (caller applies its own `theme.fontSize +
 * sizeDelta` default — G1 I4b, `renderer-symbol.ts#textFont`). Mirrors
 * `resolveElementPaint`'s cascade shape but returns `undefined` rather than
 * a hard default, since the numeric default varies by caller (title vs
 * stereotype vs a role-specific `sizeDelta`).
 */
export function resolveElementFontSize(
  theme: Theme,
  sname: string,
  role: 'title' | 'stereotype',
): number | undefined {
  const bucket = theme.colors.elements?.[sname];
  if (bucket === undefined) return undefined;
  if (role === 'stereotype' && bucket.stereotypeFontSize !== undefined) return bucket.stereotypeFontSize;
  return bucket.fontSize;
}
