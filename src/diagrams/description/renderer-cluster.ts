/**
 * renderer-cluster.ts — T17: assembles `Cluster` (T12) for one container
 * `DescriptionNodeGeo` (`children.length > 0`). Unlike a leaf entity,
 * `Cluster#drawU` reads its own absolute position off `ClusterGeometry
 * .position` (a `UTranslate`) internally — the caller passes the
 * un-translated `ug` (see `Cluster.ts`'s `ClusterDecoration#drawU`).
 */
import type { Theme } from '../../core/theme.js';
import { UTranslate } from '../../core/klimt/UTranslate.js';
import { UStroke } from '../../core/klimt/UStroke.js';
import { HorizontalAlignment } from '../../core/klimt/geom/HorizontalAlignment.js';
import { TextBlockUtils } from '../../core/klimt/shape/TextBlockUtils.js';
import { FontStyle } from '../../core/klimt/shape/UText.js';
import { buildTextBlock } from '../../core/svek/image/EntityImageDescriptionSupport.js';
import {
  Cluster,
  type ClusterGroupInfo,
  type ClusterHeaderInfo,
  type ClusterStyleDefaults,
  type ClusterSymbolInfo,
} from '../../core/svek/Cluster.js';
import { PackageStyle } from '../../core/svek/PackageStyle.js';
import type { USymbol } from '../../core/descriptive-keywords.js';
import type { DescriptionNodeGeo } from './layout-helpers.js';
import { resolveSymbol, textFont } from './renderer-symbol.js';

/** Jar-observed default cluster border width for `package`/`folder`
 *  (folder-tab-decorated) containers only (`test-results/dot-cache/
 *  component/sacuso-94-gugi476/in.svg`: `stroke-width:1.5`; re-verified
 *  unstyled in `dujodu-23-viba393`). */
const CLUSTER_STROKE_WIDTH = 1.5;
/** Jar-observed unstyled `package`/`folder` cluster border color
 *  (`component/dujodu-23-viba393`: `stroke:#000000`, no skinparam/style
 *  override present) — deliberately NOT `theme.colors.graph.packageBorder`
 *  (`#999999`): that shared theme field is also read by the class-diagram
 *  renderer (`src/diagrams/class/renderer.ts`, out of G1 scope) and its
 *  value is grep-verified to appear in ZERO description-corpus goldens
 *  (`grep -l 'stroke:#999999'` over every cached `in.svg` — no match), so
 *  this description-local constant avoids touching a value another,
 *  out-of-scope diagram type also depends on. */
const FOLDER_BORDER_DEFAULT = '#000000';
/** Jar-observed default cluster border color/width/corner-rounding for
 *  every OTHER container USymbol (`component`, `frame`, `node`, `cloud`,
 *  `card`, …) — matches the LEAF-entity default exactly, not the
 *  folder/package one. `buildStyleDefaults` (pre-fix) applied
 *  `CLUSTER_STROKE_WIDTH`/`theme.colors.graph.packageBorder` (folder-style)
 *  to EVERY container regardless of USymbol, which upstream never does:
 *  `Cluster.java#manageEntryExitPoint`'s style lookup
 *  (`getDefaultStyleDefinition(diagramType, uSymbol, groupType)`) is keyed
 *  per-USymbol, and only `USymbolFolder`'s own style differs from the
 *  generic element default. Jar-verified (unstyled, no color override) on
 *  4 distinct symbol types: `component/catari-10-xiza828` (nested
 *  `component`), `component/saxosu-09-nodi002` (`frame`),
 *  `component/bijoko-90-riro507` (`node`), `component/detona-13-ziko113`
 *  (`cloud`), `component/temufu-00-rira888` (`card`) — all `stroke:
 *  #181818;stroke-width:1` with `rx="2.5" ry="2.5"` where the shape draws
 *  a plain rounded rect (G1 I5c/I5d, "component-container-cluster default
 *  border/stroke gap", ledgered NOT FIXED until this iteration). */
const NON_FOLDER_BORDER_DEFAULT = '#181818';
const NON_FOLDER_STROKE_WIDTH = 1;
/** `URectangle.ts#build` halves `roundCorner` into the emitted `rx`/`ry`
 *  (`roundCorner / 2`) — 5.0 here reproduces the jar-verified `rx="2.5"`
 *  above, matching leaf entities' own `ENTITY_ROUND_CORNER` constant
 *  (`renderer-entity.ts`). */
const NON_FOLDER_ROUND_CORNER = 5.0;
/** Stereotype text style flags — same convention as `renderer-entity.ts`'s
 *  `STEREOTYPE_STYLES` (italic, same size as the title — see
 *  `renderer-symbol.ts#textFont`'s doc comment). */
const STEREOTYPE_STYLES: ReadonlySet<FontStyle> = new Set([FontStyle.ITALIC]);
/** A group/container title is always BOLD — `abel/Entity.java
 *  #getFontConfigurationForTitle` resolves EVERY group title's font via
 *  `FontParam.PACKAGE` (`getTitleFontParam`: only `GroupType.STATE` uses a
 *  different param, unreachable for description diagrams) with
 *  `inPackageTitle=true`; `FontParam#getDefaultFontFace` (`klimt/font/
 *  FontParam.java:167-172`) returns `UFontFace.bold()` whenever
 *  `inPackageTitle` is true, regardless of the container's own keyword
 *  (`frame`/`node`/`package`/… all bold their title the same way — G1 I2
 *  finding, jar-verified against `component/balomu-94-kegi822`,
 *  `bijoko-90-riro507`, `bisedo-29-kone620`). Leaf-entity titles never get
 *  this (`renderer-entity.ts`'s `fontTitle` carries no style flags). */
const TITLE_STYLES: ReadonlySet<FontStyle> = new Set([FontStyle.BOLD]);

/** `USymbolFolder`'s style is the only container USymbol whose jar default
 *  diverges from the generic element default — see `NON_FOLDER_*`/
 *  `FOLDER_BORDER_DEFAULT`'s doc comments. */
function isFolderStyled(symbol: USymbol): boolean {
  return symbol === 'package' || symbol === 'folder';
}

function buildHeader(node: DescriptionNodeGeo, theme: Theme): ClusterHeaderInfo {
  const title = buildTextBlock(node.display, textFont(theme, node.symbol, 0, TITLE_STYLES), HorizontalAlignment.LEFT);
  // G1 I5b: one guillemet line per stereotype tag, same convention as
  // `EntityImageDescriptionSupport.ts#buildStereo` -- ClusterHeader.java
  // :197-207 (`Display.create(visibleStereotypes)`) stacks ALL tags, not
  // just the first.
  const stereo =
    node.stereotype !== undefined && node.stereotype.length > 0
      ? buildTextBlock(
          node.stereotype.map((label) => `«${label}»`).join('\n'),
          textFont(theme, node.symbol, 0, STEREOTYPE_STYLES, 'stereotype'),
          HorizontalAlignment.CENTER,
        )
      : TextBlockUtils.empty(0, 0);
  return { title, stereo, titleHorizontalAlignment: HorizontalAlignment.LEFT };
}

function buildStyleDefaults(theme: Theme, symbol: USymbol): ClusterStyleDefaults {
  const folder = isFolderStyled(symbol);
  return {
    shadowing: 0,
    roundCorner: folder ? 0 : NON_FOLDER_ROUND_CORNER,
    strictUmlStyle: false,
    diagonalCorner: 0,
    lineColorDefault: folder ? FOLDER_BORDER_DEFAULT : NON_FOLDER_BORDER_DEFAULT,
    backGroundColorDefault: theme.colors.graph.packageBackground,
    strokeDefault: UStroke.withThickness(folder ? CLUSTER_STROKE_WIDTH : NON_FOLDER_STROKE_WIDTH),
  };
}

/** Builds the `Cluster` for one container node, ready to `drawU(ug)`
 *  (absolute position resolved internally — see module doc comment). */
export function buildCluster(node: DescriptionNodeGeo, theme: Theme, uid: string): Cluster {
  const group: ClusterGroupInfo = {
    hidden: false,
    name: node.id,
    uid,
    qualifiedName: node.id,
    location: null,
    isRoot: false,
    lineColorOverride: null,
    backColorOverride: null,
    specificLineStroke: null,
  };
  const symbolInfo: ClusterSymbolInfo = {
    symbol: resolveSymbol(node.symbol, theme),
    packageStyle: null,
    defaultPackageStyle: PackageStyle.FOLDER,
    stereoAlignment: HorizontalAlignment.CENTER,
  };
  return new Cluster(
    group,
    buildHeader(node, theme),
    { position: new UTranslate(node.x, node.y), width: node.width, height: node.height },
    buildStyleDefaults(theme, node.symbol),
    symbolInfo,
  );
}
