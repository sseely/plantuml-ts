import { describe, it, expect, vi, afterEach } from 'vitest';
import type { DotWorkingGraph } from '../../../src/core/dot/types.js';
import { setAspect } from '../../../src/core/dot/aspect.js';

function makeGraph(): DotWorkingGraph {
  return {
    nodes: [],
    edges: [],
    longEdges: [],
    rankDir: 'TB',
    nodeSep: 36,
    rankSep: 36,
  };
}

describe('setAspect', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits a console.warn and does not throw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const graph = makeGraph();
    expect(() => setAspect(graph, 1.0)).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('warning message mentions aspect attribute disabled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const graph = makeGraph();
    setAspect(graph, 1.5);
    const [msg] = warn.mock.calls[0] as [string];
    expect(msg).toContain('aspect');
    expect(msg).toContain('disabled');
  });

  it('does not mutate rankSep', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const graph = makeGraph();
    const before = graph.rankSep;
    setAspect(graph, 1.0);
    expect(graph.rankSep).toBe(before);
  });

  it('does not mutate nodeSep', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const graph = makeGraph();
    const before = graph.nodeSep;
    setAspect(graph, 2.0);
    expect(graph.nodeSep).toBe(before);
  });

  it('accepts any positive target aspect without throwing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const graph = makeGraph();
    expect(() => setAspect(graph, 0.1)).not.toThrow();
    expect(() => setAspect(graph, 16.0)).not.toThrow();
  });
});
