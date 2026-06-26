import { describe, it, expect } from 'vitest';
import { nodeboundingbox, shapeOf } from '../../../src/core/common/shapes.js';

type NodeBox = { x: number; y: number; width: number; height: number };

function makeNode(overrides: NodeBox): NodeBox {
  return { ...overrides };
}

describe('nodeboundingbox', () => {
  it('AC1: rectangular node at (10,20) width=80 height=40 returns 4 corners in CW order', () => {
    const node = makeNode({ x: 10, y: 20, width: 80, height: 40 });
    const pts = nodeboundingbox(node);
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual({ x: 10, y: 20 });
    expect(pts[1]).toEqual({ x: 90, y: 20 });
    expect(pts[2]).toEqual({ x: 90, y: 60 });
    expect(pts[3]).toEqual({ x: 10, y: 60 });
  });

  it('node at origin with width=100 height=50 returns correct corners', () => {
    const node = makeNode({ x: 0, y: 0, width: 100, height: 50 });
    const pts = nodeboundingbox(node);
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 100, y: 0 });
    expect(pts[2]).toEqual({ x: 100, y: 50 });
    expect(pts[3]).toEqual({ x: 0, y: 50 });
  });

  it('zero-sized node returns degenerate (all same) corners', () => {
    const node = makeNode({ x: 5, y: 5, width: 0, height: 0 });
    const pts = nodeboundingbox(node);
    expect(pts).toHaveLength(4);
    for (const p of pts) {
      expect(p).toEqual({ x: 5, y: 5 });
    }
  });

  it('corners span full node bounding box', () => {
    const node = makeNode({ x: -10, y: -20, width: 60, height: 80 });
    const pts = nodeboundingbox(node);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.min(...xs)).toBe(-10);
    expect(Math.max(...xs)).toBe(50);
    expect(Math.min(...ys)).toBe(-20);
    expect(Math.max(...ys)).toBe(60);
  });
});

describe('shapeOf', () => {
  it('returns "poly" for box', () => {
    expect(shapeOf('box')).toBe('poly');
  });

  it('returns "poly" for ellipse', () => {
    expect(shapeOf('ellipse')).toBe('poly');
  });

  it('returns "poly" for circle', () => {
    expect(shapeOf('circle')).toBe('poly');
  });

  it('returns "poly" for diamond', () => {
    expect(shapeOf('diamond')).toBe('poly');
  });

  it('returns "poly" for hexagon', () => {
    expect(shapeOf('hexagon')).toBe('poly');
  });

  it('returns "poly" for rectangle alias rect', () => {
    expect(shapeOf('rect')).toBe('poly');
    expect(shapeOf('rectangle')).toBe('poly');
  });

  it('returns "poly" for triangle', () => {
    expect(shapeOf('triangle')).toBe('poly');
  });

  it('returns "point" for point shape', () => {
    expect(shapeOf('point')).toBe('point');
  });

  it('returns "record" for record shape', () => {
    expect(shapeOf('record')).toBe('record');
  });

  it('returns "record" for Mrecord shape', () => {
    expect(shapeOf('Mrecord')).toBe('record');
  });

  it('returns "epsf" for epsf shape', () => {
    expect(shapeOf('epsf')).toBe('epsf');
  });

  it('returns "poly" for star shape', () => {
    expect(shapeOf('star')).toBe('poly');
  });

  it('returns "unset" for unknown shape', () => {
    expect(shapeOf('unknown_shape_xyz')).toBe('unset');
  });

  it('returns "unset" for empty string', () => {
    expect(shapeOf('')).toBe('unset');
  });

  it('returns "poly" for octagon', () => {
    expect(shapeOf('octagon')).toBe('poly');
  });

  it('returns "poly" for pentagon', () => {
    expect(shapeOf('pentagon')).toBe('poly');
  });

  it('returns "poly" for square', () => {
    expect(shapeOf('square')).toBe('poly');
  });

  it('returns "poly" for parallelogram', () => {
    expect(shapeOf('parallelogram')).toBe('poly');
  });

  it('returns "poly" for trapezium', () => {
    expect(shapeOf('trapezium')).toBe('poly');
  });

  it('returns "poly" for house', () => {
    expect(shapeOf('house')).toBe('poly');
  });

  it('returns "poly" for note', () => {
    expect(shapeOf('note')).toBe('poly');
  });

  it('returns "poly" for tab', () => {
    expect(shapeOf('tab')).toBe('poly');
  });

  it('returns "poly" for doublecircle', () => {
    expect(shapeOf('doublecircle')).toBe('poly');
  });

  it('returns "poly" for cylinder', () => {
    expect(shapeOf('cylinder')).toBe('poly');
  });

  it('returns "poly" for none/plaintext', () => {
    expect(shapeOf('none')).toBe('poly');
    expect(shapeOf('plaintext')).toBe('poly');
  });
});
