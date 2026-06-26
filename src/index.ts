import { preprocess } from './core/preprocessor.js';
import { extractBlocks } from './core/block-extractor.js';
import { registry } from './core/dispatcher.js';
import { resolveTheme, deepMergeTheme } from './core/theme.js';
import { resolveSkinparam, parseStyleBlock, resolveColor } from './core/skinparam.js';
import { CanvasMeasurer, FormulaMeasurer } from './core/measurer.js';
import { sequencePlugin } from './diagrams/sequence/index.js';
import { classPlugin } from './diagrams/class/index.js';
import { componentPlugin } from './diagrams/component/index.js';
import { statePlugin } from './diagrams/state/index.js';
import { usecasePlugin } from './diagrams/usecase/index.js';
import { activityPlugin } from './diagrams/activity/index.js';
import { objectPlugin } from './diagrams/object/index.js';
import { jsonPlugin } from './diagrams/json/index.js';
import { yamlPlugin } from './diagrams/yaml/index.js';
import { hclPlugin } from './diagrams/hcl/index.js';
import { boardPlugin } from './diagrams/board/index.js';
import { chronologyPlugin } from './diagrams/chronology/index.js';
import { filesPlugin } from './diagrams/files/index.js';
import { packetdiagPlugin } from './diagrams/packetdiag/index.js';
import { chartPlugin } from './diagrams/chart/index.js';
import { dotPlugin } from './diagrams/dot/index.js';
import type { Theme } from './core/theme.js';
import type { StyleMap } from './core/skinparam.js';
import type { StringMeasurer } from './core/measurer.js';
import type { IncludeFetcher } from './core/include-resolver.js';
import { resolveIncludes } from './core/include-resolver.js';
import type { PreprocessorResult } from './core/preprocessor.js';

// Register plugins in specificity order — most specific first, sequence last.
// Sequence plugin uses broad arrow heuristics (-->) that overlap with graph
// diagram types; graph plugins match unique structural keywords that sequence
// diagrams never contain.
registry.register(objectPlugin);
registry.register(classPlugin);
registry.register(statePlugin);
registry.register(componentPlugin);
registry.register(activityPlugin);
registry.register(usecasePlugin);
registry.register(yamlPlugin);
registry.register(jsonPlugin);
registry.register(hclPlugin);
registry.register(boardPlugin);
registry.register(chronologyPlugin);
registry.register(filesPlugin);
registry.register(packetdiagPlugin);
registry.register(chartPlugin);
registry.register(dotPlugin);
registry.register(sequencePlugin);

export interface RenderOptions {
  theme?: 'default' | 'dark' | 'sketchy' | 'monochrome' | Partial<Theme>;
  measurer?: StringMeasurer;
  maxWidth?: number;
  fetcher?: IncludeFetcher;
}

function getDefaultMeasurer(): StringMeasurer {
  try {
    return new CanvasMeasurer();
  } catch {
    return new FormulaMeasurer();
  }
}

// ---------------------------------------------------------------------------
// Selector → Theme field mapping (element-scoped style blocks)
//
// Mirrors upstream StyleSignature resolution: selector paths map to specific
// Theme color fields. Only backgroundcolor and bordercolor properties are
// currently surfaced; the table is authoritative for this version.
// ---------------------------------------------------------------------------

/**
 * Apply element-scoped StyleMap entries to a base Theme.
 *
 * Reads selector-keyed entries from the merged StyleMap and maps them to
 * their corresponding Theme fields. The top-level bare key ("") is handled
 * separately via resolveSkinparam and is not processed here.
 *
 * Returns a new Theme — neither `base` nor the StyleMap is mutated.
 */
function applyStyleMap(styleMap: StyleMap, base: Theme): Theme {
  const graphOverride: Partial<Theme['colors']['graph']> = {};

  const actor = styleMap.get('actor');
  if (actor !== undefined) {
    const bg = actor.get('backgroundcolor');
    if (bg !== undefined) graphOverride.actorFill = bg;
  }

  const actorBusiness = styleMap.get('actor.business');
  if (actorBusiness !== undefined) {
    const bg = actorBusiness.get('backgroundcolor');
    if (bg !== undefined) graphOverride.businessActorFill = bg;
  }

  const usecase = styleMap.get('usecase');
  if (usecase !== undefined) {
    const bg = usecase.get('backgroundcolor');
    if (bg !== undefined) graphOverride.usecaseFill = bg;
  }

  const usecaseBusiness = styleMap.get('usecase.business');
  if (usecaseBusiness !== undefined) {
    const bg = usecaseBusiness.get('backgroundcolor');
    if (bg !== undefined) graphOverride.businessUsecaseFill = bg;
  }

  const cls = styleMap.get('class');
  if (cls !== undefined) {
    const bg = cls.get('backgroundcolor');
    if (bg !== undefined) graphOverride.classBackground = bg;
  }

  const iface = styleMap.get('interface');
  if (iface !== undefined) {
    const bg = iface.get('backgroundcolor');
    if (bg !== undefined) graphOverride.interfaceBackground = bg;
  }

  const en = styleMap.get('enum');
  if (en !== undefined) {
    const bg = en.get('backgroundcolor');
    if (bg !== undefined) graphOverride.enumBackground = bg;
  }

  const pkg = styleMap.get('package');
  if (pkg !== undefined) {
    const bg = pkg.get('backgroundcolor');
    if (bg !== undefined) graphOverride.packageBackground = bg;
    const border = pkg.get('bordercolor');
    if (border !== undefined) graphOverride.packageBorder = border;
  }

  // JSON diagram: element / element.header / element.highlight /
  // jsondiagram.node (from jsonDiagram { node { … } } style block)
  const jsonBase = base.colors.graph.json ?? {};
  const jsonOverride: NonNullable<Theme['colors']['graph']['json']> = {};
  let hasJsonOverride = false;
  const elem = styleMap.get('element');
  if (elem !== undefined) {
    const bg = elem.get('backgroundcolor');
    if (bg !== undefined) { jsonOverride.background = resolveColor(bg); hasJsonOverride = true; }
    const lc = elem.get('linecolor');
    if (lc !== undefined) {
      jsonOverride.border = resolveColor(lc);
      jsonOverride.arrowColor = resolveColor(lc);
      hasJsonOverride = true;
    }
  }
  const elemHeader = styleMap.get('element.header');
  if (elemHeader !== undefined) {
    const hbg = elemHeader.get('backgroundcolor');
    if (hbg !== undefined) { jsonOverride.headerBackground = resolveColor(hbg); hasJsonOverride = true; }
    const fs = elemHeader.get('fontstyle');
    if (fs !== undefined) { jsonOverride.headerFontBold = fs.toLowerCase().includes('bold'); hasJsonOverride = true; }
  }
  const elemHighlight = styleMap.get('element.highlight');
  if (elemHighlight !== undefined) {
    const hlbg = elemHighlight.get('backgroundcolor');
    if (hlbg !== undefined) { jsonOverride.highlightBackground = resolveColor(hlbg); hasJsonOverride = true; }
  }

  // jsonDiagram { node { … } } — selector key "jsondiagram.node"
  // (parseStyleBlock lowercases each level: jsonDiagram → jsondiagram, node → node)
  const jsonNode = styleMap.get('jsondiagram.node');
  if (jsonNode !== undefined) {
    const bg = jsonNode.get('backgroundcolor');
    if (bg !== undefined) { jsonOverride.background = resolveColor(bg); hasJsonOverride = true; }
    const lc = jsonNode.get('linecolor');
    if (lc !== undefined) {
      jsonOverride.border = resolveColor(lc);
      jsonOverride.arrowColor = resolveColor(lc);
      hasJsonOverride = true;
    }
    const lt = jsonNode.get('linethickness');
    if (lt !== undefined) {
      const parsed = parseFloat(lt);
      if (!isNaN(parsed)) { jsonOverride.nodeLineThickness = parsed; hasJsonOverride = true; }
    }
    const rc = jsonNode.get('roundcorner');
    if (rc !== undefined) {
      const parsed = parseFloat(rc);
      if (!isNaN(parsed)) { jsonOverride.roundCorner = parsed; hasJsonOverride = true; }
    }
    const mw = jsonNode.get('maximumwidth');
    if (mw !== undefined) {
      const parsed = parseFloat(mw);
      if (!isNaN(parsed)) { jsonOverride.maximumWidth = parsed; hasJsonOverride = true; }
    }
    const ha = jsonNode.get('horizontalalignment');
    if (ha !== undefined) {
      const lower = ha.toLowerCase();
      if (lower === 'center' || lower === 'left' || lower === 'right') {
        jsonOverride.textAlign = lower;
        hasJsonOverride = true;
      }
    }
    const fc = jsonNode.get('fontcolor');
    if (fc !== undefined) { jsonOverride.nodeFontColor = resolveColor(fc); hasJsonOverride = true; }
    const fsz = jsonNode.get('fontsize');
    if (fsz !== undefined) {
      const parsed = parseFloat(fsz);
      if (!isNaN(parsed)) { jsonOverride.nodeFontSize = parsed; hasJsonOverride = true; }
    }
    const fn_ = jsonNode.get('fontname');
    if (fn_ !== undefined) { jsonOverride.nodeFontFamily = fn_; hasJsonOverride = true; }
    const fst = jsonNode.get('fontstyle');
    if (fst !== undefined) {
      const lower = fst.toLowerCase();
      jsonOverride.nodeFontBold = lower.includes('bold');
      jsonOverride.nodeFontItalic = lower.includes('italic');
      hasJsonOverride = true;
    }
    const fw = jsonNode.get('fontweight');
    if (fw !== undefined) {
      jsonOverride.nodeFontBold = fw.toLowerCase().includes('bold');
      hasJsonOverride = true;
    }
    const nls = jsonNode.get('linestyle');
    if (nls !== undefined) {
      jsonOverride.nodeLineDasharray = nls.replace(/[-;]/g, ' ');
      hasJsonOverride = true;
    }
  }

  // jsonDiagram { arrow { … } } — selector key "jsondiagram.arrow"
  const jsonArrow = styleMap.get('jsondiagram.arrow');
  if (jsonArrow !== undefined) {
    const lc = jsonArrow.get('linecolor');
    if (lc !== undefined) { jsonOverride.arrowColor = resolveColor(lc); hasJsonOverride = true; }
    const lt = jsonArrow.get('linethickness');
    if (lt !== undefined) {
      const parsed = parseFloat(lt);
      if (!isNaN(parsed)) { jsonOverride.arrowThickness = parsed; hasJsonOverride = true; }
    }
    const ls = jsonArrow.get('linestyle');
    if (ls !== undefined) { jsonOverride.arrowDasharray = ls.replace(/[-;]/g, ' '); hasJsonOverride = true; }
  }

  // jsonDiagram { node { separator { … } } }
  const jsonSep = styleMap.get('jsondiagram.node.separator');
  if (jsonSep !== undefined) {
    const sc = jsonSep.get('linecolor');
    if (sc !== undefined) { jsonOverride.separatorColor = resolveColor(sc); hasJsonOverride = true; }
    const st = jsonSep.get('linethickness');
    if (st !== undefined) {
      const parsed = parseFloat(st);
      if (!isNaN(parsed)) { jsonOverride.separatorThickness = parsed; hasJsonOverride = true; }
    }
    const sls = jsonSep.get('linestyle');
    if (sls !== undefined) { jsonOverride.separatorDasharray = sls.replace(/[-;]/g, ' '); hasJsonOverride = true; }
  }

  // jsonDiagram { node { highlight { … } } }
  const jsonHl = styleMap.get('jsondiagram.node.highlight');
  if (jsonHl !== undefined) {
    const hlbg = jsonHl.get('backgroundcolor');
    if (hlbg !== undefined) { jsonOverride.highlightBackground = resolveColor(hlbg); hasJsonOverride = true; }
    const hlfc = jsonHl.get('fontcolor');
    if (hlfc !== undefined) { jsonOverride.highlightFontColor = resolveColor(hlfc); hasJsonOverride = true; }
    const hlfs = jsonHl.get('fontstyle');
    if (hlfs !== undefined) {
      const lower = hlfs.toLowerCase();
      jsonOverride.highlightFontBold = lower.includes('bold');
      jsonOverride.highlightFontItalic = lower.includes('italic');
      hasJsonOverride = true;
    }
  }

  // yamlDiagram { element { … } } — selector key "yamldiagram.element"
  // "element" in YAML context refers to the key column (header), not the whole node.
  // Empirically: upstream shows yellow key column + white value column for element { backgroundColor yellow }.
  const yamlElem = styleMap.get('yamldiagram.element');
  if (yamlElem !== undefined) {
    const bg = yamlElem.get('backgroundcolor');
    if (bg !== undefined) { jsonOverride.headerBackground = resolveColor(bg); hasJsonOverride = true; }
  }

  // yamlDiagram { node { … } } — selector key "yamldiagram.node"
  // Same theme fields as jsondiagram.node (whole node background, borders, fonts).
  const yamlNode = styleMap.get('yamldiagram.node');
  if (yamlNode !== undefined) {
    const bg = yamlNode.get('backgroundcolor');
    if (bg !== undefined) { jsonOverride.background = resolveColor(bg); hasJsonOverride = true; }
    const lc = yamlNode.get('linecolor');
    if (lc !== undefined) {
      jsonOverride.border = resolveColor(lc);
      jsonOverride.arrowColor = resolveColor(lc);
      hasJsonOverride = true;
    }
    const lt = yamlNode.get('linethickness');
    if (lt !== undefined) {
      const parsed = parseFloat(lt);
      if (!isNaN(parsed)) { jsonOverride.nodeLineThickness = parsed; hasJsonOverride = true; }
    }
    const rc = yamlNode.get('roundcorner');
    if (rc !== undefined) {
      const parsed = parseFloat(rc);
      if (!isNaN(parsed)) { jsonOverride.roundCorner = parsed; hasJsonOverride = true; }
    }
    const mw = yamlNode.get('maximumwidth');
    if (mw !== undefined) {
      const parsed = parseFloat(mw);
      if (!isNaN(parsed)) { jsonOverride.maximumWidth = parsed; hasJsonOverride = true; }
    }
    const ha = yamlNode.get('horizontalalignment');
    if (ha !== undefined) {
      const lower = ha.toLowerCase();
      if (lower === 'center' || lower === 'left' || lower === 'right') {
        jsonOverride.textAlign = lower;
        hasJsonOverride = true;
      }
    }
    const fc = yamlNode.get('fontcolor');
    if (fc !== undefined) { jsonOverride.nodeFontColor = resolveColor(fc); hasJsonOverride = true; }
    const fsz = yamlNode.get('fontsize');
    if (fsz !== undefined) {
      const parsed = parseFloat(fsz);
      if (!isNaN(parsed)) { jsonOverride.nodeFontSize = parsed; hasJsonOverride = true; }
    }
    const fn_ = yamlNode.get('fontname');
    if (fn_ !== undefined) { jsonOverride.nodeFontFamily = fn_; hasJsonOverride = true; }
    const fst = yamlNode.get('fontstyle');
    if (fst !== undefined) {
      const lower = fst.toLowerCase();
      jsonOverride.nodeFontBold = lower.includes('bold');
      jsonOverride.nodeFontItalic = lower.includes('italic');
      hasJsonOverride = true;
    }
    const fw = yamlNode.get('fontweight');
    if (fw !== undefined) {
      jsonOverride.nodeFontBold = fw.toLowerCase().includes('bold');
      hasJsonOverride = true;
    }
    const nls = yamlNode.get('linestyle');
    if (nls !== undefined) {
      jsonOverride.nodeLineDasharray = nls.replace(/[-;]/g, ' ');
      hasJsonOverride = true;
    }
  }

  // yamlDiagram { arrow { … } } — selector key "yamldiagram.arrow"
  const yamlArrow = styleMap.get('yamldiagram.arrow');
  if (yamlArrow !== undefined) {
    const lc = yamlArrow.get('linecolor');
    if (lc !== undefined) { jsonOverride.arrowColor = resolveColor(lc); hasJsonOverride = true; }
    const lt = yamlArrow.get('linethickness');
    if (lt !== undefined) {
      const parsed = parseFloat(lt);
      if (!isNaN(parsed)) { jsonOverride.arrowThickness = parsed; hasJsonOverride = true; }
    }
    const ls = yamlArrow.get('linestyle');
    if (ls !== undefined) { jsonOverride.arrowDasharray = ls.replace(/[-;]/g, ' '); hasJsonOverride = true; }
  }

  // yamlDiagram { node { separator { … } } }
  const yamlSep = styleMap.get('yamldiagram.node.separator');
  if (yamlSep !== undefined) {
    const sc = yamlSep.get('linecolor');
    if (sc !== undefined) { jsonOverride.separatorColor = resolveColor(sc); hasJsonOverride = true; }
    const st = yamlSep.get('linethickness');
    if (st !== undefined) {
      const parsed = parseFloat(st);
      if (!isNaN(parsed)) { jsonOverride.separatorThickness = parsed; hasJsonOverride = true; }
    }
    const sls = yamlSep.get('linestyle');
    if (sls !== undefined) { jsonOverride.separatorDasharray = sls.replace(/[-;]/g, ' '); hasJsonOverride = true; }
  }

  // yamlDiagram { node { highlight { … } } }
  const yamlHl = styleMap.get('yamldiagram.node.highlight');
  if (yamlHl !== undefined) {
    const hlbg = yamlHl.get('backgroundcolor');
    if (hlbg !== undefined) { jsonOverride.highlightBackground = resolveColor(hlbg); hasJsonOverride = true; }
    const hlfc = yamlHl.get('fontcolor');
    if (hlfc !== undefined) { jsonOverride.highlightFontColor = resolveColor(hlfc); hasJsonOverride = true; }
    const hlfs = yamlHl.get('fontstyle');
    if (hlfs !== undefined) {
      const lower = hlfs.toLowerCase();
      jsonOverride.highlightFontBold = lower.includes('bold');
      jsonOverride.highlightFontItalic = lower.includes('italic');
      hasJsonOverride = true;
    }
  }

  // hclDiagram { element { … } } — selector key "hcldiagram.element"
  const hclElem = styleMap.get('hcldiagram.element');
  if (hclElem !== undefined) {
    const bg = hclElem.get('backgroundcolor');
    if (bg !== undefined) { jsonOverride.headerBackground = resolveColor(bg); hasJsonOverride = true; }
  }

  // hclDiagram { node { … } } — selector key "hcldiagram.node"
  const hclNode = styleMap.get('hcldiagram.node');
  if (hclNode !== undefined) {
    const bg = hclNode.get('backgroundcolor');
    if (bg !== undefined) { jsonOverride.background = resolveColor(bg); hasJsonOverride = true; }
    const lc = hclNode.get('linecolor');
    if (lc !== undefined) {
      jsonOverride.border = resolveColor(lc);
      jsonOverride.arrowColor = resolveColor(lc);
      hasJsonOverride = true;
    }
    const lt = hclNode.get('linethickness');
    if (lt !== undefined) {
      const parsed = parseFloat(lt);
      if (!isNaN(parsed)) { jsonOverride.nodeLineThickness = parsed; hasJsonOverride = true; }
    }
    const rc = hclNode.get('roundcorner');
    if (rc !== undefined) {
      const parsed = parseFloat(rc);
      if (!isNaN(parsed)) { jsonOverride.roundCorner = parsed; hasJsonOverride = true; }
    }
    const mw = hclNode.get('maximumwidth');
    if (mw !== undefined) {
      const parsed = parseFloat(mw);
      if (!isNaN(parsed)) { jsonOverride.maximumWidth = parsed; hasJsonOverride = true; }
    }
    const ha = hclNode.get('horizontalalignment');
    if (ha !== undefined) {
      const lower = ha.toLowerCase();
      if (lower === 'center' || lower === 'left' || lower === 'right') {
        jsonOverride.textAlign = lower;
        hasJsonOverride = true;
      }
    }
    const fc = hclNode.get('fontcolor');
    if (fc !== undefined) { jsonOverride.nodeFontColor = resolveColor(fc); hasJsonOverride = true; }
    const fsz = hclNode.get('fontsize');
    if (fsz !== undefined) {
      const parsed = parseFloat(fsz);
      if (!isNaN(parsed)) { jsonOverride.nodeFontSize = parsed; hasJsonOverride = true; }
    }
    const fn_ = hclNode.get('fontname');
    if (fn_ !== undefined) { jsonOverride.nodeFontFamily = fn_; hasJsonOverride = true; }
    const fst = hclNode.get('fontstyle');
    if (fst !== undefined) {
      const lower = fst.toLowerCase();
      jsonOverride.nodeFontBold = lower.includes('bold');
      jsonOverride.nodeFontItalic = lower.includes('italic');
      hasJsonOverride = true;
    }
    const fw = hclNode.get('fontweight');
    if (fw !== undefined) {
      jsonOverride.nodeFontBold = fw.toLowerCase().includes('bold');
      hasJsonOverride = true;
    }
    const nls = hclNode.get('linestyle');
    if (nls !== undefined) {
      jsonOverride.nodeLineDasharray = nls.replace(/[-;]/g, ' ');
      hasJsonOverride = true;
    }
  }

  // hclDiagram { arrow { … } } — selector key "hcldiagram.arrow"
  const hclArrow = styleMap.get('hcldiagram.arrow');
  if (hclArrow !== undefined) {
    const lc = hclArrow.get('linecolor');
    if (lc !== undefined) { jsonOverride.arrowColor = resolveColor(lc); hasJsonOverride = true; }
    const lt = hclArrow.get('linethickness');
    if (lt !== undefined) {
      const parsed = parseFloat(lt);
      if (!isNaN(parsed)) { jsonOverride.arrowThickness = parsed; hasJsonOverride = true; }
    }
    const ls = hclArrow.get('linestyle');
    if (ls !== undefined) { jsonOverride.arrowDasharray = ls.replace(/[-;]/g, ' '); hasJsonOverride = true; }
  }

  // hclDiagram { node { separator { … } } }
  const hclSep = styleMap.get('hcldiagram.node.separator');
  if (hclSep !== undefined) {
    const sc = hclSep.get('linecolor');
    if (sc !== undefined) { jsonOverride.separatorColor = resolveColor(sc); hasJsonOverride = true; }
    const st = hclSep.get('linethickness');
    if (st !== undefined) {
      const parsed = parseFloat(st);
      if (!isNaN(parsed)) { jsonOverride.separatorThickness = parsed; hasJsonOverride = true; }
    }
    const sls = hclSep.get('linestyle');
    if (sls !== undefined) { jsonOverride.separatorDasharray = sls.replace(/[-;]/g, ' '); hasJsonOverride = true; }
  }

  // hclDiagram { node { highlight { … } } }
  const hclHl = styleMap.get('hcldiagram.node.highlight');
  if (hclHl !== undefined) {
    const hlbg = hclHl.get('backgroundcolor');
    if (hlbg !== undefined) { jsonOverride.highlightBackground = resolveColor(hlbg); hasJsonOverride = true; }
    const hlfc = hclHl.get('fontcolor');
    if (hlfc !== undefined) { jsonOverride.highlightFontColor = resolveColor(hlfc); hasJsonOverride = true; }
    const hlfs = hclHl.get('fontstyle');
    if (hlfs !== undefined) {
      const lower = hlfs.toLowerCase();
      jsonOverride.highlightFontBold = lower.includes('bold');
      jsonOverride.highlightFontItalic = lower.includes('italic');
      hasJsonOverride = true;
    }
  }

  // Style classes (.h1, .h2 etc.) → per-class highlight color overrides.
  // These are used by #highlight <<h1>> directives to color individual rows.
  const highlightClasses: NonNullable<NonNullable<Theme['colors']['graph']['json']>['highlightClasses']> = {};
  for (const [selector, props] of styleMap.entries()) {
    if (!selector.startsWith('.')) continue;
    const className = selector.slice(1);
    const classEntry: { background?: string; fontColor?: string; fontBold?: boolean; fontItalic?: boolean } = {};
    const bg = props.get('backgroundcolor');
    if (bg !== undefined) classEntry.background = resolveColor(bg);
    const fc = props.get('fontcolor');
    if (fc !== undefined) classEntry.fontColor = resolveColor(fc);
    const fs = props.get('fontstyle');
    if (fs !== undefined) {
      const lower = fs.toLowerCase();
      classEntry.fontBold = lower.includes('bold');
      classEntry.fontItalic = lower.includes('italic');
    }
    if (Object.keys(classEntry).length > 0) {
      highlightClasses[className] = classEntry;
      hasJsonOverride = true;
    }
  }
  if (Object.keys(highlightClasses).length > 0) {
    jsonOverride.highlightClasses = highlightClasses;
  }

  if (hasJsonOverride) {
    graphOverride.json = { ...jsonBase, ...jsonOverride };
  }

  // document { backgroundColor } sets the overall SVG canvas background.
  // Check bare "document", then diagram-type-scoped variants (last wins).
  let documentBg: string | undefined;
  for (const sel of ['document', 'jsondiagram.document', 'yamldiagram.document', 'hcldiagram.document']) {
    const doc = styleMap.get(sel);
    if (doc !== undefined) {
      const bg = doc.get('backgroundcolor');
      if (bg !== undefined) documentBg = resolveColor(bg);
    }
  }

  if (Object.keys(graphOverride).length === 0 && documentBg === undefined) {
    return base;
  }

  const partial: Partial<Theme> = {
    colors: {
      ...base.colors,
      ...(documentBg !== undefined ? { background: documentBg } : {}),
      graph: {
        ...base.colors.graph,
        ...graphOverride,
      },
    },
  };

  return deepMergeTheme(base, partial);
}

/**
 * Four-stage theme resolution:
 *
 * Stage 1 — Named base theme.
 *   String options.theme overrides !theme from source (existing behavior).
 *
 * Stage 2 — Apply skinparam directives from source on top of the base theme.
 *
 * Stage 3 — Apply <style> blocks from source.
 *   3a. Merge all StyleMaps from all style blocks.
 *   3b. Top-level bare declarations ("" key) flow through resolveSkinparam.
 *   3c. Element-scoped entries (e.g. "actor", "class") go through applyStyleMap.
 *
 * Stage 4 — Caller Partial<Theme> wins over everything.
 *
 * Resolution order confirmed against upstream TContext.java:executeTheme().
 */
function buildTheme(preprocessed: PreprocessorResult, options?: RenderOptions): Theme {
  // Stage 1: named base theme
  const themeName =
    typeof options?.theme === 'string'
      ? options.theme
      : (preprocessed.theme ?? 'default');
  const base = resolveTheme(themeName);

  // Stage 2: apply skinparam directives from source
  const withSkinparam = resolveSkinparam(preprocessed.skinparam, base).theme;

  // Stage 3: apply <style> blocks from source
  // 3a. Merge all StyleMaps (last writer wins per selector+property)
  const styleMap = preprocessed.styles
    .map(parseStyleBlock)
    .reduce<StyleMap>((acc, m) => {
      m.forEach((props, selector) => {
        const existing = acc.get(selector) ?? new Map<string, string>();
        props.forEach((v, k) => existing.set(k, v));
        acc.set(selector, existing);
      });
      return acc;
    }, new Map());

  // 3b. Top-level bare declarations ("" key) → resolveSkinparam (existing behavior)
  const flatRoot = styleMap.get('') ?? new Map<string, string>();
  const withStyles = resolveSkinparam(flatRoot, withSkinparam).theme;

  // 3c. Element-scoped entries → applyStyleMap
  const withStyleMap = applyStyleMap(styleMap, withStyles);

  // Stage 4: caller Partial<Theme> wins over everything
  if (options?.theme !== undefined && typeof options.theme === 'object') {
    return deepMergeTheme(withStyleMap, options.theme);
  }
  return withStyleMap;
}

export function renderSync(source: string, options?: RenderOptions): string {
  try {
    // Check for !include directives — not supported in sync path
    if (/^!include\s/m.test(source)) {
      throw new Error(
        '!include directives are not supported in renderSync — use render() instead',
      );
    }
    const preprocessed = preprocess(source);
    const theme = buildTheme(preprocessed, options);
    const measurer = options?.measurer ?? getDefaultMeasurer();
    const blocks = extractBlocks(preprocessed.lines);
    if (blocks.length === 0) {
      return errorSvg('No diagram found in source');
    }
    const block = { ...blocks[0]!, rawStyles: preprocessed.styles };
    const plugin = registry.resolve(block);
    if (!('layoutSync' in plugin)) {
      return errorSvg(
        `renderSync() is not supported for this diagram type — use render()`,
      );
    }
    const ast = plugin.parse(block);
    const geo = plugin.layoutSync(ast, theme, measurer);
    return plugin.render(geo, theme);
  } catch (err) {
    return errorSvg(String(err));
  }
}

export async function render(
  source: string,
  options?: RenderOptions,
): Promise<string> {
  try {
    const resolved = await resolveIncludes(source, options?.fetcher);
    const preprocessed = preprocess(resolved);
    const theme = buildTheme(preprocessed, options);
    const measurer = options?.measurer ?? getDefaultMeasurer();
    const blocks = extractBlocks(preprocessed.lines);
    if (blocks.length === 0) {
      return errorSvg('No diagram found in source');
    }
    const block = { ...blocks[0]!, rawStyles: preprocessed.styles };
    const plugin = registry.resolve(block);
    const ast = plugin.parse(block);
    const geo =
      'layoutSync' in plugin
        ? plugin.layoutSync(ast, theme, measurer)
        : await plugin.layout(ast, theme, measurer);
    return plugin.render(geo, theme);
  } catch (err) {
    return errorSvg(String(err));
  }
}

export async function renderAll(
  source: string,
  options?: RenderOptions,
): Promise<string[]> {
  try {
    const resolved = await resolveIncludes(source, options?.fetcher);
    const preprocessed = preprocess(resolved);
    const theme = buildTheme(preprocessed, options);
    const measurer = options?.measurer ?? getDefaultMeasurer();
    const blocks = extractBlocks(preprocessed.lines);
    const results = await Promise.all(
      blocks.map(async (rawBlock) => {
        const block = { ...rawBlock, rawStyles: preprocessed.styles };
        try {
          const plugin = registry.resolve(block);
          const ast = plugin.parse(block);
          const geo =
            'layoutSync' in plugin
              ? plugin.layoutSync(ast, theme, measurer)
              : await plugin.layout(ast, theme, measurer);
          return plugin.render(geo, theme);
        } catch (err) {
          return errorSvg(String(err));
        }
      }),
    );
    return results;
  } catch (err) {
    return [errorSvg(String(err))];
  }
}

function errorSvg(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80">` +
    `<rect width="400" height="80" fill="#fee2e2" stroke="#dc2626" stroke-width="1"/>` +
    `<text x="10" y="30" fill="#dc2626" font-family="monospace" font-size="12">PlantUML error:</text>` +
    `<text x="10" y="55" fill="#dc2626" font-family="monospace" font-size="11">${escaped}</text>` +
    `</svg>`
  );
}
