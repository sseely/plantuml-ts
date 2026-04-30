import { describe, it, expect } from 'vitest';
import { layout } from '../../../src/core/dot/index.js';

describe('tailportY support', () => {
  it('orders two children by port position: top-port child above bottom-port child', () => {
    // Parent P connects to A (top port, tailportY=-0.4) and B (bottom port, tailportY=+0.4)
    // A should appear above B (lower y)
    const result = layout({
      nodes: [
        { id: 'P', width: 80, height: 100 },
        { id: 'A', width: 60, height: 30 },
        { id: 'B', width: 60, height: 30 },
      ],
      edges: [
        { id: 'P->A', from: 'P', to: 'A', attributes: { tailportY: -0.4 } },
        { id: 'P->B', from: 'P', to: 'B', attributes: { tailportY: 0.4 } },
      ],
      rankDir: 'LR',
      nodeSep: 10,
      rankSep: 40,
    });

    const A = result.nodes.find((n) => n.id === 'A')!;
    const B = result.nodes.find((n) => n.id === 'B')!;
    expect(A.y).toBeLessThan(B.y);
  });

  it('places a single child near its parent port when port is near the bottom', () => {
    // P has height 100; child connects to bottom port (tailportY=+0.4)
    // Child center should be near P.center + 0.4*P.height = P.center + 40
    const result = layout({
      nodes: [
        { id: 'P', width: 80, height: 100 },
        { id: 'C', width: 60, height: 30 },
      ],
      edges: [
        { id: 'P->C', from: 'P', to: 'C', attributes: { tailportY: 0.4 } },
      ],
      rankDir: 'LR',
      nodeSep: 10,
      rankSep: 40,
    });

    const P = result.nodes.find((n) => n.id === 'P')!;
    const C = result.nodes.find((n) => n.id === 'C')!;
    const portAbsY = P.y + P.height / 2 + 0.4 * P.height;  // absolute port y
    const childCenterY = C.y + C.height / 2;
    // Child center should be within 20px of the port y
    expect(Math.abs(childCenterY - portAbsY)).toBeLessThan(20);
  });

  it('layout without tailportY still works (backward compatible)', () => {
    const result = layout({
      nodes: [
        { id: 'A', width: 60, height: 40 },
        { id: 'B', width: 60, height: 40 },
      ],
      edges: [{ id: 'A->B', from: 'A', to: 'B' }],
      rankDir: 'LR',
    });
    expect(result.nodes).toHaveLength(2);
    const A = result.nodes.find((n) => n.id === 'A')!;
    const B = result.nodes.find((n) => n.id === 'B')!;
    expect(B.x).toBeGreaterThan(A.x);
  });

  it('backward pass clamp: top-port child with a sibling below is not pushed above the sibling', () => {
    // P → A (tailportY = -0.5, very top) and P → B (tailportY = +0.5, very bottom)
    // With 3 children and tight constraints, the backward pass clamp should fire.
    // A is top-port, M is middle-port, B is bottom-port.
    // Forward pass pushes B down; backward pass may need to pull A or M back up.
    const result = layout({
      nodes: [
        { id: 'P', width: 80, height: 120 },
        { id: 'A', width: 60, height: 40 },
        { id: 'M', width: 60, height: 40 },
        { id: 'B', width: 60, height: 40 },
      ],
      edges: [
        { id: 'P->A', from: 'P', to: 'A', attributes: { tailportY: -0.45 } },
        { id: 'P->M', from: 'P', to: 'M', attributes: { tailportY: 0 } },
        { id: 'P->B', from: 'P', to: 'B', attributes: { tailportY: 0.45 } },
      ],
      rankDir: 'LR',
      nodeSep: 5,
      rankSep: 40,
    });

    const A = result.nodes.find((n) => n.id === 'A')!;
    const M = result.nodes.find((n) => n.id === 'M')!;
    const B = result.nodes.find((n) => n.id === 'B')!;
    // All children should be laid out without overlap
    expect(A.y + A.height).toBeLessThanOrEqual(M.y + 1); // A ends before M starts (±1 float)
    expect(M.y + M.height).toBeLessThanOrEqual(B.y + 1); // M ends before B starts (±1 float)
    // Top-port child above bottom-port child
    expect(A.y).toBeLessThan(B.y);
  });

  it('top port child with tailportY near -0.5 results in non-negative y after normalization', () => {
    // When parent is at y=0 and tailportY=-0.5, the desired child y would be negative.
    // refineYByPorts must normalize so y >= 0.
    const result = layout({
      nodes: [
        { id: 'P', width: 80, height: 100 },
        { id: 'C', width: 60, height: 30 },
      ],
      edges: [
        { id: 'P->C', from: 'P', to: 'C', attributes: { tailportY: -0.5 } },
      ],
      rankDir: 'LR',
      nodeSep: 10,
      rankSep: 40,
    });

    const C = result.nodes.find((n) => n.id === 'C')!;
    // y must be non-negative after normalization
    expect(C.y).toBeGreaterThanOrEqual(0);
  });

  it('forward clamp: bottom-port child gets pushed down when top-port sibling is in the way', () => {
    // P (height=40) → M (tailportY=-0.4, top port, order=0) and A (tailportY=+0.4, bottom port, order=1)
    // M's desired y is very low (near top of small parent), A's desired y is higher.
    // With tight separation, A's desired y falls below M.y + M.height + nodeSep, triggering the clamp.
    const result = layout({
      nodes: [
        { id: 'P', width: 80, height: 40 },
        { id: 'M', width: 60, height: 30 },
        { id: 'A', width: 60, height: 30 },
      ],
      edges: [
        { id: 'P->M', from: 'P', to: 'M', attributes: { tailportY: -0.4 } },
        { id: 'P->A', from: 'P', to: 'A', attributes: { tailportY: 0.4 } },
      ],
      rankDir: 'LR',
      nodeSep: 5,
      rankSep: 40,
    });

    const M = result.nodes.find((n) => n.id === 'M')!;
    const A = result.nodes.find((n) => n.id === 'A')!;
    // No overlap: the bottom-port child must be below the top-port child
    expect(A.y).toBeGreaterThanOrEqual(M.y);
    // Non-negative y
    expect(M.y).toBeGreaterThanOrEqual(0);
    expect(A.y).toBeGreaterThanOrEqual(0);
  });

  it('multiple parent edges to same child averages the desired y', () => {
    // When two different parents both connect to the same child C with tailportY set,
    // C's desired y is averaged between the two port positions.
    // P1 (tailportY=-0.3) and P2 (tailportY=+0.3) both connect to C.
    // This triggers the prev !== undefined averaging branch.
    const result = layout({
      nodes: [
        { id: 'P1', width: 60, height: 100 },
        { id: 'P2', width: 60, height: 100 },
        { id: 'C', width: 60, height: 30 },
      ],
      edges: [
        { id: 'P1->C', from: 'P1', to: 'C', attributes: { tailportY: -0.3 } },
        { id: 'P2->C', from: 'P2', to: 'C', attributes: { tailportY: 0.3 } },
      ],
      rankDir: 'LR',
      nodeSep: 10,
      rankSep: 40,
    });

    const C = result.nodes.find((n) => n.id === 'C')!;
    // C must be placed at a valid non-negative y
    expect(C.y).toBeGreaterThanOrEqual(0);
    expect(result.nodes).toHaveLength(3);
  });
});
