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
  strictUml?: boolean;
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
       *  change for every classifier with no `<style>` RoundCorner). */
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
  nodeSep?: number;
  rankSep?: number;
  wrapWidth?: number;
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
  'nodeSep',
  'rankSep',
  'wrapWidth',
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
