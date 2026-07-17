/**
 * Skinparam resolution pipeline for plantuml-ts.
 *
 * Provides two public entry points:
 *   - resolveSkinparam: maps a raw skinparam map onto a Theme
 *   - parseStyleBlock: converts the content of a <style> block into a
 *     StyleMap with hierarchical selector paths
 *
 * Key normalisation follows SkinParam.cleanForKeySlow in upstream
 * SkinParam.java, which is NOT a simple toLowerCase(). The exact sequence
 * is preserved here so that keys like "classArrowColor",
 * "sequenceArrowColor", and "arrowColor" all normalise to "arrowcolor".
 */

import { deepMergeTheme } from './theme.js';
import type { Theme, ElementColors } from './theme.js';
import { parseColor } from './paint.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SkinparamResult {
  theme: Theme;
  unknown: string[];
}

/**
 * Hierarchical style map produced by parseStyleBlock.
 *
 * Outer key: dot-separated lowercase selector path (e.g. "actor",
 *   "actor.business", "" for top-level bare declarations).
 * Inner key: lowercased property name.
 * Inner value: trimmed value string (trailing ";" stripped).
 */
export type StyleMap = Map<string, Map<string, string>>;

// ---------------------------------------------------------------------------
// Key normalisation — mirrors SkinParam.cleanForKeySlow
// ---------------------------------------------------------------------------

/**
 * Resolve a PlantUML color value to a plain CSS color.
 *
 * PlantUML supports gradient specs in the form "startColor-endColor"
 * (e.g. "#AAAAAA-white" or "#AAAAAA-red").  SVG does not understand this
 * syntax, so we extract the end color and use it as a solid fallback.
 * The end color is typically the more visually prominent tone.
 */
export function resolveColor(value: string): string {
  const m = /^(.+)-([a-zA-Z]+|#[0-9A-Fa-f]{3,8})$/.exec(value);
  return m ? (m[2] ?? value) : value;
}

/**
 * Normalise a raw skinparam key to its canonical lowercase form.
 *
 * Ported from SkinParam.java:cleanForKeySlow. The sequence matters:
 *  1. Trim whitespace and convert to lowercase
 *  2. Strip underscores and dots (so "class_background_color" == "classbackgroundcolor")
 *  3. Collapse "sequenceparticipant" / "sequenceactor" prefixes to plain
 *     "participant" / "actor" (upstream stores these without the "sequence" prefix)
 *  4. Collapse diagram-type arrow prefixes — activityarrow, classarrow,
 *     componentarrow, objectarrow, sequencearrow, statearrow, usecasearrow —
 *     all become plain "arrow" so they share one slot in the mapping table
 *  5. Normalise "align" suffix to "alignment"
 */
function normaliseKey(raw: string): string {
  let key = raw.trim().toLowerCase();
  // Step 1: strip underscores and dots
  key = key.replace(/[_.]/g, '');
  // Step 2: collapse sequenceparticipant / sequenceactor prefix
  key = key.replace(/sequence(participant|actor)/g, '$1');
  // Step 3: collapse diagram-type arrow prefixes to plain "arrow"
  key = key.replace(
    /(?:activity|class|component|object|sequence|state|usecase)arrow/g,
    'arrow',
  );
  // Step 4: normalise "align" suffix to "alignment"
  key = key.replace(/align$/, 'alignment');
  return key;
}

// ---------------------------------------------------------------------------
// resolveSkinparam
// ---------------------------------------------------------------------------

/**
 * Map a raw skinparam key→value map onto a Theme, returning both the merged
 * Theme and a list of any keys that could not be mapped.
 *
 * The caller supplies a `base` Theme; matched keys are merged on top via
 * deepMergeTheme. Unmatched keys and stereotype-qualified keys (containing
 * "<<") are collected in `unknown[]` — they do not cause errors.
 *
 * Key normalisation follows SkinParam.cleanForKeySlow (see normaliseKey).
 */
/**
 * Descriptive/deployment SNames that carry per-element color buckets (D4).
 * These `<sname>(Background|Border|Font)Color` keys previously fell through to
 * `unknown`; T4 routes them into the theme's per-element buckets. Flat-scoped
 * keys (class/interface/enum/package/note/activity) keep their explicit cases.
 */
/**
 * Descriptive/deployment SNames carrying per-element style buckets (D4,
 * widened G1 I4b). Matches upstream `FromSkinparamToStyle.java`'s `addMagic`
 * registration list (`agent, artifact, boundary, card, cloud, collections,
 * component, control, database, entity, file, folder, frame, hexagon,
 * interface_, node, package_, person, queue, rectangle, stack, storage,
 * usecase` plus the four early-registered `boundary, control, collections,
 * actor, database, entity`), restricted to SNames reachable from a
 * component/usecase diagram (`descriptive-keywords.ts`'s `USymbol` union) —
 * the flat-scoped keywords (class/interface as a class-diagram concept/enum/
 * note/activity) keep their own explicit `resolveSkinparam` cases. `label`
 * is additionally included though it has no upstream `addMagic` entry: it is
 * a valid `<style> label { ... }` selector target regardless (style-block
 * routing does not go through `addMagic`, only skinparam-key translation
 * does — `collectElementStyleBuckets` shares this same allowlist for both
 * mechanisms), jar-verified via `zonobi-55-zuna105`'s `<style>label{FontSize
 * 19}` fixture.
 */
export const ELEMENT_BUCKET_SNAMES = new Set([
  'database',
  'component',
  'node',
  'actor',
  'usecase',
  'artifact',
  'rectangle',
  'agent',
  'boundary',
  'card',
  'cloud',
  'collections',
  'control',
  'entity',
  'file',
  'folder',
  'frame',
  'hexagon',
  'interface',
  'package',
  'person',
  'queue',
  'stack',
  'storage',
  'label',
  // G2 N32: the class-diagram kind BADGE's own spot color (`element.spot
  // .spot<Kind>`, `EntityImageClassHeader.java#spotStyleSignature` /
  // `FromSkinparamToStyle.java:254-267`) -- reachable via a bare `<style>
  // spotClass { BackgroundColor; LineColor; FontColor }` selector (this
  // bucket mechanism, for FREE) AND the legacy flat `stereotype<X>
  // BackgroundColor`/`stereotype<X>BorderColor` skinparam form (X in
  // A/C/E/I/N -- `matchStereotypeSpotColorKey` below translates the letter
  // to the SAME sname). Scoped to the 5 badge kinds this port's own
  // `class-badge.ts#badgeFill` supports (class/abstract/interface/enum/
  // annotation) -- upstream also has `spotRecord`/`spotDataClass`
  // (stereotypeR/D), unsurveyed, no `ClassifierKind` member exists for
  // either yet (narrower scope, matches `badgeFill`'s own precedent).
  'spotclass',
  'spotabstractclass',
  'spotinterface',
  'spotenum',
  'spotannotation',
  // G2 N34: class-diagram note bucket (`<style> note { BackgroundColor ...
  // } </style>`, `EntityImageNote.java#getStyleSignature` -- `SName.note`
  // under `SName.element`) -- reachable for FREE via this same generic
  // per-element-bucket mechanism, mirroring N32's `spotclass` precedent.
  // The nested `.tagname` sub-selector (`note { .faint { ... } }`, matching
  // a note's OWN `<<stereotype>>` via `withTOBECHANGED`) is a SEPARATE,
  // deeper mechanism -- surveyed, not built (G2 N34 ledger).
  'note',
]);

type ElementColorRole = 'background' | 'border' | 'font';

const ELEMENT_ROLE_SUFFIXES: ReadonlyArray<
  readonly [suffix: string, role: ElementColorRole]
> = [
  ['backgroundcolor', 'background'],
  ['bordercolor', 'border'],
  ['fontcolor', 'font'],
];

/**
 * Numeric font-size suffixes (G1 I4b) — kept separate from
 * `ELEMENT_ROLE_SUFFIXES` because the stored value is a `number`, not a
 * `Paint` (`parseColor` does not apply). `stereotypefontsize` is checked
 * ahead of `fontsize` for readability only — both suffixes are tried
 * independently per key regardless of order (a key can match at most one).
 */
const ELEMENT_FONT_SIZE_SUFFIXES: ReadonlyArray<
  readonly [suffix: string, role: 'fontSize' | 'stereotypeFontSize']
> = [
  ['stereotypefontsize', 'stereotypeFontSize'],
  ['fontsize', 'fontSize'],
];

/**
 * If `key` is a normalized element-scoped color key
 * (`<sname>(background|border|font)color` for a bucket SName), return its
 * `sname`/`role`; otherwise `undefined`.
 */
function matchElementColorKey(
  key: string,
): { sname: string; role: ElementColorRole } | undefined {
  for (const [suffix, role] of ELEMENT_ROLE_SUFFIXES) {
    if (key.endsWith(suffix)) {
      const sname = key.slice(0, key.length - suffix.length);
      if (ELEMENT_BUCKET_SNAMES.has(sname)) return { sname, role };
    }
  }
  return undefined;
}

/**
 * G2 N32: `stereotype<X>BackgroundColor`/`stereotype<X>BorderColor` (X in
 * A/C/E/I/N) -- upstream's LEGACY flat-key spelling for the SAME `spot<Kind>`
 * style bucket `matchElementColorKey` reaches via the modern `<style>
 * spotClass { ... }` selector spelling (`FromSkinparamToStyle.java:254-267`
 * explicitly converts one into the other). No `FontColor` legacy key exists
 * upstream for this family -- `font` (glyph color) is `<style>`-only,
 * matches `matchElementColorKey`'s own 3-role shape returning only
 * background/border for this matcher.
 */
const STEREOTYPE_SPOT_LETTER_SNAME: Readonly<Record<string, string>> = {
  a: 'spotabstractclass',
  c: 'spotclass',
  e: 'spotenum',
  i: 'spotinterface',
  n: 'spotannotation',
};

function matchStereotypeSpotColorKey(
  key: string,
): { sname: string; role: ElementColorRole } | undefined {
  const m = /^stereotype([acein])(background|border)color$/.exec(key);
  if (m === null) return undefined;
  const sname = STEREOTYPE_SPOT_LETTER_SNAME[m[1]!];
  if (sname === undefined) return undefined;
  return { sname, role: m[2] === 'background' ? 'background' : 'border' };
}

/**
 * If `key` is a normalized element-scoped font-size key
 * (`<sname>(Stereotype)?FontSize` for a bucket SName — G1 I4b, mirrors
 * `matchElementColorKey`), return its `sname`/`role`; otherwise `undefined`.
 */
function matchElementFontSizeKey(
  key: string,
): { sname: string; role: 'fontSize' | 'stereotypeFontSize' } | undefined {
  for (const [suffix, role] of ELEMENT_FONT_SIZE_SUFFIXES) {
    if (key.endsWith(suffix)) {
      const sname = key.slice(0, key.length - suffix.length);
      if (ELEMENT_BUCKET_SNAMES.has(sname)) return { sname, role };
    }
  }
  return undefined;
}

export function resolveSkinparam(
  skinparams: ReadonlyMap<string, string>,
  base: Theme,
): SkinparamResult {
  // #lizard forgives — faithful 1:1 port of upstream SkinParam.java's key
  // switch; its CCN is inherent to PlantUML's skinparam key space, and
  // porting discipline forbids restructuring it (see decision-journal.md T4).
  const unknown: string[] = [];
  // Per-element (SName) color buckets — decision D4.
  const elements: Record<string, ElementColors> = {};

  // Accumulate partial overrides; only populate what we actually see.
  let fontFamily: string | undefined;
  let fontSize: number | undefined;
  let linetype: 'ortho' | 'polyline' | undefined;
  let nodeSep: number | undefined;
  let rankSep: number | undefined;
  let wrapWidth: number | undefined;
  let componentStyle: 'uml2' | 'uml1' | 'rectangle' | undefined;
  let strictUml: boolean | undefined;
  let fixCircleLabelOverlapping: boolean | undefined;
  let background: string | undefined;
  let border: string | undefined;
  let text: string | undefined;
  let arrow: string | undefined;
  let noteBackground: string | undefined;
  let classBackground: string | undefined;
  let interfaceBackground: string | undefined;
  let enumBackground: string | undefined;
  let actorStroke: string | undefined;
  let packageBackground: string | undefined;
  let packageBorder: string | undefined;
  // G2 N18: `packageBorderThickness` -- the folder-tab outline's own stroke
  // width. NOTE: `packageFontSize`/`packageFontColor` are DELIBERATELY not
  // given dedicated cases here -- both already route through the generic
  // per-element bucket (`ELEMENT_BUCKET_SNAMES` includes 'package', G1
  // I4b) into `theme.colors.elements.package.{fontSize,font}`, shared with
  // description's package/folder USymbol rendering
  // (`renderer-symbol.ts#textFontColor`'s identical precedent) -- class
  // reads that SAME bucket (`class-namespace-shape.ts#titleFont`/
  // `renderNamespaceFolder`) rather than duplicating the mechanism into a
  // second, competing theme field.
  let packageBorderThickness: number | undefined;
  // G2 N23: `skinparam class { AttributeFontSize/AttributeFontName }` --
  // `FontParam.CLASS_ATTRIBUTE`'s member-row font override (see
  // `theme.ts#classAttributeFontSize`'s doc comment for the exact upstream
  // key-derivation evidence). Dedicated cases (not the generic
  // `ELEMENT_BUCKET_SNAMES` mechanism) -- "classattribute" is not a real
  // per-element SName bucket, just this one FontParam's own lookup key.
  let classAttributeFontSize: number | undefined;
  let classAttributeFontFamily: string | undefined;
  // G2 N32: `classAttributeFontStyle`/`classFontSize`/`classFontName`/
  // `classFontStyle` -- the header-vs-attribute font-role split
  // (`theme.ts#classFontSize`'s doc comment for the full jar evidence).
  let classAttributeFontBold: boolean | undefined;
  let classAttributeFontItalic: boolean | undefined;
  let classFontSize: number | undefined;
  let classFontFamily: string | undefined;
  let classFontBold: boolean | undefined;
  let classFontItalic: boolean | undefined;
  // G2 N38: `circledCharacterFontSize`/`circledCharacterRadius` -- the
  // badge-radius formula's two inputs (`class-badge.ts#resolveBadgeRadius`'s
  // own doc comment for the jar-verified `SkinParam#getCircledCharacter
  // Radius()` derivation). Dedicated cases (not the generic
  // `ELEMENT_BUCKET_SNAMES` mechanism) -- neither is a per-element SName
  // bucket, just this one FontParam's own lookup key plus its sibling
  // radius override.
  let circledCharacterFontSize: number | undefined;
  let circledCharacterRadius: number | undefined;
  // G2 N27: `skinparam guillemet <value>` -- start/end wrapper strings
  // for stereotype text (`Guillemet.fromDescription`). Both stay unset
  // for the default/unrecognized case (render-side falls back to
  // `«`/`»`).
  let guillemetStart: string | undefined;
  let guillemetEnd: string | undefined;
  let activityBackground: string | undefined;
  let activityBorder: string | undefined;
  let activityBarColor: string | undefined;
  let activityDiamondBackground: string | undefined;
  let activityDiamondBorder: string | undefined;
  let activityStartColor: string | undefined;
  let activityEndColor: string | undefined;
  let swimlaneBorder: string | undefined;

  for (const [rawKey, value] of skinparams) {
    // Stereotype-qualified keys are unsupported — Theme has no stereotype concept.
    if (rawKey.includes('<<')) {
      unknown.push(normaliseKey(rawKey));
      continue;
    }

    const key = normaliseKey(rawKey);
    const color = resolveColor(value);

    switch (key) {
      case 'backgroundcolor':
        background = color;
        break;
      case 'bordercolor':
        border = color;
        break;
      case 'fontcolor':
      case 'defaultfontcolor':
        text = color;
        break;
      case 'arrowcolor':
      case 'defaultarrowcolor':
        arrow = color;
        break;
      case 'notebackgroundcolor':
        noteBackground = color;
        break;
      case 'fontname':
      case 'defaultfontname':
        fontFamily = value; // not a color — use raw value
        break;
      case 'fontsize':
      case 'defaultfontsize':
        fontSize = Number(value); // not a color — use raw value
        break;
      case 'linetype': {
        const v = value.trim().toLowerCase();
        if (v === 'ortho' || v === 'polyline') linetype = v;
        break;
      }
      case 'nodesep':
      case 'ranksep': {
        const v = Number.parseInt(value.trim(), 10);
        if (Number.isFinite(v) && v !== 0) {
          if (key === 'nodesep') nodeSep = v; else rankSep = v;
        }
        break;
      }
      case 'wrapwidth': {
        const v = Number.parseInt(value.trim(), 10);
        if (Number.isFinite(v) && v !== 0) wrapWidth = v;
        break;
      }
      case 'componentstyle': {
        const v = value.trim().toLowerCase();
        if (v === 'uml2' || v === 'uml1' || v === 'rectangle') componentStyle = v;
        break;
      }
      case 'style':
        // G2 N18: `skinparam style strictuml` -- a global sharp-corner
        // toggle, class's first consumer (`class-namespace-shape.ts`'s
        // folder-tab outline). Any other `style` value is left unmatched
        // (falls to `unknown`), matching this iteration's minimal scope.
        if (value.trim().toLowerCase() === 'strictuml') strictUml = true;
        break;
      case 'fixcirclelabeloverlapping':
        fixCircleLabelOverlapping = value.trim().toLowerCase() === 'true';
        break;
      case 'classbackgroundcolor':
        classBackground = color;
        break;
      case 'interfacebackgroundcolor':
        interfaceBackground = color;
        break;
      case 'enumbackgroundcolor':
        enumBackground = color;
        break;
      case 'actorbordercolor':
        actorStroke = color;
        break;
      case 'packagebackgroundcolor':
        packageBackground = color;
        break;
      case 'packagebordercolor':
        packageBorder = color;
        break;
      case 'packageborderthickness': {
        const v = Number.parseFloat(value.trim());
        if (Number.isFinite(v)) packageBorderThickness = v;
        break;
      }
      case 'classattributefontsize': {
        const v = Number(value);
        if (Number.isFinite(v)) classAttributeFontSize = v;
        break;
      }
      case 'classattributefontname':
        classAttributeFontFamily = value; // not a color — use raw value
        break;
      case 'classattributefontstyle': {
        // G2 N32: `SkinParam#getFontFace`'s real substring-match rule --
        // "bold"/"italic" may both appear (e.g. "bold italic"), matched
        // independently, case-insensitively, anywhere in the value.
        const lower = value.trim().toLowerCase();
        classAttributeFontBold = lower.includes('bold');
        classAttributeFontItalic = lower.includes('italic');
        break;
      }
      case 'classfontsize': {
        const v = Number(value);
        if (Number.isFinite(v)) classFontSize = v;
        break;
      }
      case 'classfontname':
        classFontFamily = value; // not a color — use raw value
        break;
      case 'classfontstyle': {
        const lower = value.trim().toLowerCase();
        classFontBold = lower.includes('bold');
        classFontItalic = lower.includes('italic');
        break;
      }
      case 'circledcharacterfontsize': {
        const v = Number(value);
        if (Number.isFinite(v)) circledCharacterFontSize = v;
        break;
      }
      case 'circledcharacterradius': {
        const v = Number(value);
        if (Number.isFinite(v)) circledCharacterRadius = v;
        break;
      }
      case 'guillemet': {
        // `Guillemet.fromDescription` (java): "false"/"<< >>" -> the
        // literal << >> pair; "none" -> both empty; any OTHER value
        // containing a space -> tokenize into (start, end); anything else
        // (including a garbage spaceless value) falls through to the
        // default GUILLEMET wrapper, left unset here.
        const raw = value.trim();
        const lower = raw.toLowerCase();
        if (lower === 'false' || lower === '<< >>') {
          guillemetStart = '<<';
          guillemetEnd = '>>';
        } else if (lower === 'none') {
          guillemetStart = '';
          guillemetEnd = '';
        } else if (raw.includes(' ')) {
          const tokens = raw.split(/\s+/).filter((t) => t !== '');
          if (tokens.length >= 2) {
            guillemetStart = tokens[0];
            guillemetEnd = tokens[1];
          }
        }
        break;
      }
      case 'activitybackgroundcolor':
        activityBackground = color;
        break;
      case 'activitybordercolor':
        activityBorder = color;
        break;
      case 'activitybarcolor':
        activityBarColor = color;
        break;
      case 'activitydiamondbackgroundcolor':
        activityDiamondBackground = color;
        break;
      case 'activitydiamondforegroundcolor':
      case 'activitydiamondbordercolor':
        activityDiamondBorder = color;
        break;
      case 'activitystartcolor':
        activityStartColor = color;
        break;
      case 'activityendcolor':
        activityEndColor = color;
        break;
      case 'swimlanebordercolor':
      case 'swimlaneheaderbackgroundcolor':
        swimlaneBorder = color;
        break;
      default: {
        // Element-scoped color (e.g. `databaseBackgroundColor`) → per-element
        // bucket via parseColor (gradients become a Gradient Paint). D1/D4.
        const elem = matchElementColorKey(key) ?? matchStereotypeSpotColorKey(key);
        if (elem !== undefined) {
          const bucket = (elements[elem.sname] ??= {});
          bucket[elem.role] = parseColor(value);
          break;
        }
        // Element-scoped font size (`<sname>FontSize` /
        // `<sname>StereotypeFontSize`) → per-element bucket, numeric. G1 I4b.
        const fontElem = matchElementFontSizeKey(key);
        if (fontElem !== undefined) {
          const size = Number(value);
          if (Number.isFinite(size)) {
            const bucket = (elements[fontElem.sname] ??= {});
            bucket[fontElem.role] = size;
            break;
          }
        }
        unknown.push(key);
      }
    }
  }

  // Build a Partial<Theme> only for the keys that were actually seen.
  const hasActivityOverride =
    activityBackground !== undefined ||
    activityBorder !== undefined ||
    activityBarColor !== undefined ||
    activityDiamondBackground !== undefined ||
    activityDiamondBorder !== undefined ||
    activityStartColor !== undefined ||
    activityEndColor !== undefined ||
    swimlaneBorder !== undefined;

  const hasGraphOverride =
    classBackground !== undefined ||
    interfaceBackground !== undefined ||
    enumBackground !== undefined ||
    actorStroke !== undefined ||
    packageBackground !== undefined ||
    packageBorder !== undefined ||
    packageBorderThickness !== undefined ||
    classAttributeFontSize !== undefined ||
    classAttributeFontFamily !== undefined ||
    classAttributeFontBold !== undefined ||
    classAttributeFontItalic !== undefined ||
    classFontSize !== undefined ||
    classFontFamily !== undefined ||
    classFontBold !== undefined ||
    classFontItalic !== undefined ||
    circledCharacterFontSize !== undefined ||
    circledCharacterRadius !== undefined ||
    guillemetStart !== undefined ||
    guillemetEnd !== undefined ||
    hasActivityOverride;

  const hasElements = Object.keys(elements).length > 0;

  const hasColorsOverride =
    background !== undefined ||
    border !== undefined ||
    text !== undefined ||
    arrow !== undefined ||
    noteBackground !== undefined ||
    hasElements ||
    hasGraphOverride;

  const partial: Partial<Theme> = {};

  if (fontFamily !== undefined) partial.fontFamily = fontFamily;
  if (fontSize !== undefined) partial.fontSize = fontSize;
  if (linetype !== undefined) partial.linetype = linetype;
  if (nodeSep !== undefined) partial.nodeSep = nodeSep;
  if (rankSep !== undefined) partial.rankSep = rankSep;
  if (wrapWidth !== undefined) partial.wrapWidth = wrapWidth;
  if (componentStyle !== undefined) partial.componentStyle = componentStyle;
  if (strictUml !== undefined) partial.strictUml = strictUml;
  if (fixCircleLabelOverlapping !== undefined) partial.fixCircleLabelOverlapping = fixCircleLabelOverlapping;

  if (hasColorsOverride) {
    const graphOverride: Partial<Theme['colors']['graph']> = {};
    if (classBackground !== undefined) graphOverride.classBackground = classBackground;
    if (interfaceBackground !== undefined)
      graphOverride.interfaceBackground = interfaceBackground;
    if (enumBackground !== undefined) graphOverride.enumBackground = enumBackground;
    if (actorStroke !== undefined) graphOverride.actorStroke = actorStroke;
    if (packageBackground !== undefined) graphOverride.packageBackground = packageBackground;
    if (packageBorder !== undefined) graphOverride.packageBorder = packageBorder;
    if (packageBorderThickness !== undefined)
      graphOverride.packageBorderThickness = packageBorderThickness;
    if (classAttributeFontSize !== undefined)
      graphOverride.classAttributeFontSize = classAttributeFontSize;
    if (classAttributeFontFamily !== undefined)
      graphOverride.classAttributeFontFamily = classAttributeFontFamily;
    if (classAttributeFontBold !== undefined)
      graphOverride.classAttributeFontBold = classAttributeFontBold;
    if (classAttributeFontItalic !== undefined)
      graphOverride.classAttributeFontItalic = classAttributeFontItalic;
    if (classFontSize !== undefined) graphOverride.classFontSize = classFontSize;
    if (classFontFamily !== undefined) graphOverride.classFontFamily = classFontFamily;
    if (classFontBold !== undefined) graphOverride.classFontBold = classFontBold;
    if (classFontItalic !== undefined) graphOverride.classFontItalic = classFontItalic;
    if (circledCharacterFontSize !== undefined)
      graphOverride.circledCharacterFontSize = circledCharacterFontSize;
    if (circledCharacterRadius !== undefined)
      graphOverride.circledCharacterRadius = circledCharacterRadius;
    if (guillemetStart !== undefined) graphOverride.guillemetStart = guillemetStart;
    if (guillemetEnd !== undefined) graphOverride.guillemetEnd = guillemetEnd;

    if (hasActivityOverride) {
      const actOverride: NonNullable<Theme['colors']['graph']['activity']> = {};
      if (activityBackground !== undefined) actOverride.background = activityBackground;
      if (activityBorder !== undefined) actOverride.border = activityBorder;
      if (activityBarColor !== undefined) actOverride.barColor = activityBarColor;
      if (activityDiamondBackground !== undefined)
        actOverride.diamondBackground = activityDiamondBackground;
      if (activityDiamondBorder !== undefined)
        actOverride.diamondBorder = activityDiamondBorder;
      if (activityStartColor !== undefined) actOverride.startColor = activityStartColor;
      if (activityEndColor !== undefined) actOverride.endColor = activityEndColor;
      if (swimlaneBorder !== undefined) actOverride.swimlaneBorder = swimlaneBorder;
      graphOverride.activity = actOverride;
    }

    const colorsOverride: Partial<Theme['colors']> = {};
    if (background !== undefined) colorsOverride.background = background;
    if (border !== undefined) colorsOverride.border = border;
    if (text !== undefined) colorsOverride.text = text;
    if (arrow !== undefined) colorsOverride.arrow = arrow;
    if (noteBackground !== undefined) colorsOverride.noteBackground = noteBackground;
    if (hasElements) colorsOverride.elements = elements;
    if (hasGraphOverride) {
      colorsOverride.graph = graphOverride as Theme['colors']['graph'];
    }

    partial.colors = colorsOverride as Theme['colors'];
  }

  const theme = deepMergeTheme(base, partial);
  return { theme, unknown };
}

// ---------------------------------------------------------------------------
// parseStyleBlock — internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize raw style block content so that braces appear on their own lines.
 *
 * This mirrors the upstream StyleParser's character-level tokenizer (StyleParser.java),
 * which treats '{' and '}' as token boundaries independent of line structure.
 * The normalization allows compact single-line syntax such as
 *   "actor { BackGroundColor: blue; }"
 * to parse identically to the equivalent multi-line form.
 *
 * Semicolons are also normalized to newlines so that declarations terminated
 * with ';' on the same line as a closing brace are correctly separated.
 */
function normalizeStyleInput(raw: string): string {
  // #lizard forgives — false positive: this is ~12 lines (CCN 1), but lizard
  // miscounts the function span because of the brace/quote regex literals below.
  // Keep '{' on the same line as the selector name (so selectorOpen matches),
  // but move any content after '{' to the next line.
  // Move '}' so it always starts on a fresh line.
  // Replace ';' with newline (acts as statement separator, matching upstream tokenizer).
  return raw
    .replace(/\{/g, '{\n')
    .replace(/\}/g, '\n}')
    // Replace bare semicolons with newlines, but preserve semicolons inside
    // double-quoted strings (e.g. LineStyle "1;5" must not be split).
    .replace(/"[^"]*"|;/g, (m) => (m === ';' ? '\n' : m));
}

// ---------------------------------------------------------------------------
// parseStyleBlock
// ---------------------------------------------------------------------------

/**
 * Parse the raw string content of a single `<style>` block into a
 * hierarchical selector-path → declarations map.
 *
 * The input must NOT include the surrounding `<style>` / `</style>` tags —
 * those are stripped by the preprocessor before calling this function.
 *
 * Algorithm (matches upstream StyleParser context-stack behaviour):
 *  0. Normalize braces and semicolons onto their own lines (handles compact
 *     single-line syntax like "actor { BackGroundColor: blue; }").
 *  1. Split on newlines; strip any trailing \r from each line (CRLF support).
 *  2. A line matching /^\s*([\w.-]+)\s*\{/ opens a selector — push the
 *     lowercased selector name onto the stack. Nesting depth > 2 throws.
 *  3. A line matching /^\s*\}\s*$/ closes a block — pop the stack.
 *  4. A line matching /^\s*([\w-]+)\s*:\s*(.+)$/ is a declaration:
 *       - selector path = stack joined with "." (empty string if stack empty)
 *       - key = match[1].toLowerCase()
 *       - value = match[2].trim(), with trailing ";" stripped
 *     The (path, key, value) triple is stored in the StyleMap.
 *  5. All other lines are silently skipped.
 *
 * Returns a StyleMap that maps selector paths to their declaration maps.
 */
export function parseStyleBlock(raw: string): StyleMap {
  const result: StyleMap = new Map();
  if (raw.length === 0) return result;

  // Normalize to ensure braces appear on their own lines (token boundary
  // normalization matching upstream's character-level tokenizer).
  const normalized = normalizeStyleInput(raw);

  // Selector-open: a dot-led class selector may contain internal spaces
  // (upstream `StyleParser.readString`: `if (ch == ' ' && result.charAt(0)
  // != '.') break;` — a token starting with '.' does NOT stop at spaces,
  // unlike every other token). `.static lib { ... }` is therefore ONE
  // selector, `.static lib`, not two. The dot-branch consumes everything up
  // to the opening brace (trimmed below); the non-dot branch is unchanged
  // (stops at the first space, exactly as before).
  const selectorOpen = /^\s*(\.[^{]+|[\w.-]+)\s*\{/;
  const blockClose = /^\s*\}\s*$/;
  const declaration = /^\s*([\w-]+)(?:\s*:\s*|\s+)(.+)$/;

  const stack: string[] = [];

  for (const rawLine of normalized.split('\n')) {
    // Strip trailing \r so that CRLF line endings are handled cleanly.
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    const openMatch = selectorOpen.exec(line);
    if (openMatch !== null) {
      const selector = openMatch[1]!.trim().toLowerCase();
      stack.push(selector);
      continue;
    }

    if (blockClose.test(line)) {
      stack.pop();
      continue;
    }

    const m = declaration.exec(line);
    if (m !== null) {
      const selectorPath = stack.join('.');
      const key = m[1]!.toLowerCase();
      let value = m[2]!.trim();
      // Strip trailing semicolon if present (may appear after normalization
      // when a semicolon immediately followed a closing brace or similar).
      if (value.endsWith(';')) {
        value = value.slice(0, -1).trimEnd();
      }
      // Strip surrounding double-quotes so callers receive the bare value
      // (e.g. LineStyle "1;5" stores as "1;5" in raw input but value is 1;5).
      if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
        value = value.slice(1, -1);
      }

      let inner = result.get(selectorPath);
      if (inner === undefined) {
        inner = new Map<string, string>();
        result.set(selectorPath, inner);
      }
      inner.set(key, value);
    }
    // Lines matching none of the above are silently skipped
  }

  return result;
}
