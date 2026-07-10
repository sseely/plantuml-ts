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
const STEREOTYPE_SIZE_DELTA = -2;

function buildHeader(node: DescriptionNodeGeo, theme: Theme): ClusterHeaderInfo {
  const title = buildTextBlock(node.display, textFont(theme, node.symbol), HorizontalAlignment.LEFT);
  const stereo =
    node.stereotype !== undefined
      ? buildTextBlock(`«${node.stereotype}»`, textFont(theme, node.symbol, STEREOTYPE_SIZE_DELTA), HorizontalAlignment.CENTER)
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
