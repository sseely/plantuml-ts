/**
 * class-boxes-and-link — T6 primary golden case: document preamble,
 * rounded rect (class boxes) + plain rect (link's "Qualifier" label
 * box), ellipse, letter-glyph icon (legacy path-builder — see
 * `_shared/class-box.ts`'s doc comment), text w/ font attrs, comment +
 * nested `<g>` groups (multiple `UGroupType` branches: `CLASS`,
 * `DATA_QUALIFIED_NAME`, `DATA_UID`, `DATA_SOURCE_LINE`,
 * `DATA_ENTITY_1_UID`, `DATA_ENTITY_2_UID`, `DATA_LINK_TYPE`), a
 * `DotPath` spline (the dependency link, with `id`/`codeLine` carried
 * through `toUPath()`), and a `UPolygon` arrowhead.
 *
 * Provenance: `oracle/goldens/svg-conformance/class-boxes-and-link/
 * golden.svg` is copied verbatim from the cached real jar fixture
 * `test-results/dot-cache/class/baneru-00-kuro607/in.svg` (offline
 * material, per the mission brief — no jar/network needed at test
 * time). `seed` is irrelevant here (no gradient/shadow ids are
 * referenced in this fixture), so any value works.
 */
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import { URectangle } from '../../../../src/core/klimt/shape/URectangle.js';
import { UPolygon } from '../../../../src/core/klimt/shape/UPolygon.js';
import { UText } from '../../../../src/core/klimt/shape/UText.js';
import type { FontConfiguration } from '../../../../src/core/klimt/shape/UText.js';
import { UComment } from '../../../../src/core/klimt/shape/UComment.js';
import { UGroup, UGroupType } from '../../../../src/core/klimt/shape/UGroup.js';
import { DotPath } from '../../../../src/core/klimt/shape/DotPath.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { Fore } from '../../../../src/core/klimt/Fore.js';
import { Back } from '../../../../src/core/klimt/Back.js';
import { drawEntity, jarStringBounder } from '../_shared/class-box.js';
import { CLASS1, CLASS2 } from './class-specs.js';

const SANS_SERIF_14: FontConfiguration = {
  family: 'sans-serif',
  size: 14,
  color: '#000000',
  styles: new Set(),
};

const WIDTHS = new Map<string, number>([
  ['sans-serif/14/class1', 42.0752],
  ['sans-serif/14/class2', 42.0752],
  ['sans-serif/14/Qualifier', 58.1123],
]);

function openLinkGroup(root: UGraphicSvg): void {
  root.draw(new UComment('reverse link class1 to class2'));
  const group = new UGroup();
  group.put(UGroupType.CLASS, 'link');
  group.put(UGroupType.DATA_ENTITY_1_UID, 'ent0001');
  group.put(UGroupType.DATA_ENTITY_2_UID, 'ent0002');
  group.put(UGroupType.DATA_UID, 'lnk3');
  group.put(UGroupType.DATA_SOURCE_LINE, '5');
  group.put(UGroupType.DATA_LINK_TYPE, 'dependency');
  root.startGroup(group);
}

function drawLinkSpline(root: UGraphicSvg): void {
  const spline = DotPath.fromBeziers([
    { x1: 47, y1: 78.3683, ctrlx1: 47, ctrly1: 101.5283, ctrlx2: 47, ctrly2: 113.64, x2: 47, y2: 136.88 },
  ]);
  spline.setCommentAndCodeLine('class1-backto-class2', '5');
  root.apply(new Fore('#181818')).apply(UStroke.withThickness(1)).draw(spline);
}

function drawLinkArrow(root: UGraphicSvg): void {
  const arrow = new UPolygon([
    { x: 47, y: 73.3683 },
    { x: 43, y: 82.3683 },
    { x: 47, y: 78.3683 },
    { x: 51, y: 82.3683 },
    { x: 47, y: 73.3683 },
  ]);
  root.apply(new Fore('#181818')).apply(new Back('#181818')).apply(UStroke.withThickness(1)).draw(arrow);
}

function drawLinkLabel(root: UGraphicSvg): void {
  root
    .apply(new UTranslate(15.9438, 54.88))
    .apply(new Fore('#181818'))
    .apply(new Back('#F1F1F1'))
    .apply(UStroke.withThickness(0.5))
    .draw(URectangle.build(62.1123, 18.4883));

  root
    .apply(new UTranslate(17.9438, 69.4152))
    .apply(new Fore('#000000'))
    .draw(UText.build('Qualifier', SANS_SERIF_14));
}

function drawLink(root: UGraphicSvg): void {
  openLinkGroup(root);
  drawLinkSpline(root);
  drawLinkArrow(root);
  drawLinkLabel(root);
  root.closeGroup();
}

export function render(): string {
  const root = UGraphicSvg.build(
    0,
    basicSvgOption({
      backcolor: '#FFFFFF',
      minDim: { width: 100, height: 199 },
      rootAttributes: new Map([['data-diagram-type', 'CLASS']]),
    }),
    '$version$',
    jarStringBounder(WIDTHS),
  );

  drawEntity(root, { comment: 'class class1', qualifiedName: 'class1', uid: 'ent0001', sourceLine: '2' }, CLASS1);
  drawEntity(root, { comment: 'class class2', qualifiedName: 'class2', uid: 'ent0002', sourceLine: '3' }, CLASS2);
  drawLink(root);

  return root.getSvgString();
}
