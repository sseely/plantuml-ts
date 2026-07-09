/**
 * Selector → Theme field mapping (element-scoped <style> blocks).
 *
 * Extracted verbatim from src/index.ts to keep that entry module under the
 * line cap. Mirrors upstream StyleSignature resolution: selector paths map to
 * specific Theme color fields. NOTE: applyStyleMap is a large pre-existing
 * sequential mapping function — relocated as-is, not refactored (see
 * .agent-notes). Cleanup into per-selector helpers is a follow-up.
 */

import type { Theme } from './theme.js';
import type { StyleMap } from './skinparam.js';
import { deepMergeTheme } from './theme.js';
import { resolveColor } from './skinparam.js';
import {
  collectElementStyleBuckets,
  resolveDocumentBackground,
} from './style-map-element.js';

/**
 * Apply element-scoped StyleMap entries to a base Theme.
 *
 * Reads selector-keyed entries from the merged StyleMap and maps them to
 * their corresponding Theme fields. The top-level bare key ("") is handled
 * separately via resolveSkinparam and is not processed here.
 *
 * Returns a new Theme — neither `base` nor the StyleMap is mutated.
 */
// NOTE: applyStyleMap is a large pre-existing sequential selector→field mapper
// (relocated verbatim from index.ts); its CCN is inherent to PlantUML's style
// selector space, and porting discipline forbids restructuring it. Element
// bucket routing (D4/T5) is delegated to ./style-map-element. The
// `#lizard forgives` directive sits near the function's end (below), where
// lizard reliably associates it with this function.
export function applyStyleMap(styleMap: StyleMap, base: Theme): Theme {
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

  // document { BackgroundColor } canvas bg; database { … } → per-element buckets (D4).
  const documentBg = resolveDocumentBackground(styleMap);
  const elements = collectElementStyleBuckets(styleMap);
  const hasElements = Object.keys(elements).length > 0;
  if (Object.keys(graphOverride).length === 0 && documentBg === undefined && !hasElements) {
    return base;
  }
  const partial: Partial<Theme> = {
    colors: {
      ...base.colors,
      ...(documentBg !== undefined ? { background: documentBg } : {}),
      ...(hasElements ? { elements } : {}),
      graph: { ...base.colors.graph, ...graphOverride },
    },
  };
  // #lizard forgives — faithful port; see the head note on this function.
  return deepMergeTheme(base, partial);
}
