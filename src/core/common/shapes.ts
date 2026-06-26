export type ShapeKind = 'poly' | 'record' | 'point' | 'epsf' | 'unset';

type Point = { x: number; y: number };

/**
 * Minimal node geometry consumed by nodeboundingbox. Was the engine-internal
 * `DotNode` (deleted with the in-house graphviz engines, burn-graphviz-engines
 * mission); decoupled to a local structural type — DotNode was a superset, so
 * this is behavior-preserving.
 */
type NodeBox = { x: number; y: number; width: number; height: number };

const POLY_SHAPES = new Set([
  'box',
  'polygon',
  'ellipse',
  'oval',
  'circle',
  'egg',
  'triangle',
  'none',
  'plaintext',
  'plain',
  'diamond',
  'trapezium',
  'parallelogram',
  'house',
  'pentagon',
  'hexagon',
  'septagon',
  'octagon',
  'note',
  'tab',
  'folder',
  'box3d',
  'component',
  'cylinder',
  'rect',
  'rectangle',
  'square',
  'doublecircle',
  'doubleoctagon',
  'tripleoctagon',
  'invtriangle',
  'invtrapezium',
  'invhouse',
  'underline',
  'Mdiamond',
  'Msquare',
  'Mcircle',
  'star',
  'promoter',
  'cds',
  'terminator',
  'utr',
  'insulator',
  'ribosite',
  'rnastab',
  'proteasesite',
  'proteinstab',
  'primersite',
  'restrictionsite',
  'fivepoverhang',
  'threepoverhang',
  'noverhang',
  'assembly',
  'signature',
  'rpromoter',
  'larrow',
  'rarrow',
  'lpromoter',
]);

export function nodeboundingbox(node: NodeBox): Point[] {
  const { x, y, width, height } = node;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export function shapeOf(shapeName: string): ShapeKind {
  if (shapeName === 'point') return 'point';
  if (shapeName === 'record' || shapeName === 'Mrecord') return 'record';
  if (shapeName === 'epsf') return 'epsf';
  if (POLY_SHAPES.has(shapeName)) return 'poly';
  return 'unset';
}
