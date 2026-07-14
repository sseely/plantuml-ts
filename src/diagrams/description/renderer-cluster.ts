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
import type { DescriptionNodeGeo } from './layout-helpers.js';
import { resolveSymbol, textFont } from './renderer-symbol.js';

/** Jar-observed default cluster border width (`test-results/dot-cache/
 *  component/sacuso-94-gugi476/in.svg`: `stroke-width:1.5`). */
const CLUSTER_STROKE_WIDTH = 1.5;
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

function buildHeader(node: DescriptionNodeGeo, theme: Theme): ClusterHeaderInfo {
  const title = buildTextBlock(node.display, textFont(theme, node.symbol, 0, TITLE_STYLES), HorizontalAlignment.LEFT);
  const stereo =
    node.stereotype !== undefined
      ? buildTextBlock(`«${node.stereotype}»`, textFont(theme, node.symbol, 0, STEREOTYPE_STYLES), HorizontalAlignment.CENTER)
      : TextBlockUtils.empty(0, 0);
  return { title, stereo, titleHorizontalAlignment: HorizontalAlignment.LEFT };
}

function buildStyleDefaults(theme: Theme): ClusterStyleDefaults {
  return {
    shadowing: 0,
    roundCorner: 0,
    strictUmlStyle: false,
    diagonalCorner: 0,
    lineColorDefault: theme.colors.graph.packageBorder,
    backGroundColorDefault: theme.colors.graph.packageBackground,
    strokeDefault: UStroke.withThickness(CLUSTER_STROKE_WIDTH),
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
    buildStyleDefaults(theme),
    symbolInfo,
  );
}
