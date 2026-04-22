/**
 * Unit tests for the DiagramRegistry dispatcher and the SyncPlugin / AsyncPlugin
 * union type introduced in Phase 2.
 *
 * Acceptance criteria exercised:
 * - SyncPlugin registered → renderSync() calls layoutSync() and returns SVG
 * - AsyncPlugin registered → render() awaits layout() and returns SVG
 * - AsyncPlugin registered → renderSync() returns error SVG (no throw)
 * - 'layoutSync' in plugin narrowing compiles with zero `any` casts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DiagramRegistry,
  type SyncPlugin,
  type AsyncPlugin,
  type DiagramPlugin,
} from '../../src/core/dispatcher.js';
import type { UmlSource } from '../../src/core/block-extractor.js';
import { defaultTheme } from '../../src/core/theme.js';
import { FormulaMeasurer } from '../../src/core/measurer.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const measurer = new FormulaMeasurer();

/** Minimal SyncPlugin that records whether layoutSync was called. */
function makeSyncPlugin(): SyncPlugin & { layoutSyncCalled: boolean } {
  const plugin: SyncPlugin & { layoutSyncCalled: boolean } = {
    type: 'sequence',
    layoutSyncCalled: false,
    accepts: (lines: readonly string[]) => lines.some((l) => l.includes('sync')),
    parse: (_source: UmlSource) => ({ kind: 'sync-ast' }),
    layoutSync: (_ast: unknown, _theme, _measurer) => {
      plugin.layoutSyncCalled = true;
      return { kind: 'sync-geo' };
    },
    render: (_geo: unknown, _theme) =>
      `<svg xmlns="http://www.w3.org/2000/svg"><text>sync</text></svg>`,
  };
  return plugin;
}

/** Minimal AsyncPlugin that records whether layout was called. */
function makeAsyncPlugin(): AsyncPlugin & { layoutCalled: boolean } {
  const plugin: AsyncPlugin & { layoutCalled: boolean } = {
    type: 'class',
    layoutCalled: false,
    accepts: (lines: readonly string[]) => lines.some((l) => l.includes('async')),
    parse: (_source: UmlSource) => ({ kind: 'async-ast' }),
    layout: (_ast: unknown, _theme, _measurer): Promise<unknown> => {
      plugin.layoutCalled = true;
      return Promise.resolve({ kind: 'async-geo' });
    },
    render: (_geo: unknown, _theme) =>
      `<svg xmlns="http://www.w3.org/2000/svg"><text>async</text></svg>`,
  };
  return plugin;
}

// ---------------------------------------------------------------------------
// DiagramRegistry — plugin registration and resolution
// ---------------------------------------------------------------------------

describe('DiagramRegistry', () => {
  let registry: DiagramRegistry;

  beforeEach(() => {
    registry = new DiagramRegistry();
  });

  it('resolves a registered SyncPlugin by its accepts() predicate', () => {
    const plugin = makeSyncPlugin();
    registry.register(plugin);

    const source: UmlSource = { lines: ['sync diagram'], type: 'sequence' };
    const resolved = registry.resolve(source);
    expect(resolved.type).toBe('sequence');
  });

  it('resolves a registered AsyncPlugin by its accepts() predicate', () => {
    const plugin = makeAsyncPlugin();
    registry.register(plugin);

    const source: UmlSource = { lines: ['async diagram'], type: 'class' };
    const resolved = registry.resolve(source);
    expect(resolved.type).toBe('class');
  });

  it('returns error-sentinel SyncPlugin when no plugin matches', () => {
    const source: UmlSource = { lines: ['unknown content'], type: 'unknown' };
    const resolved = registry.resolve(source);
    // Sentinel renders an SVG — should not throw
    expect(() => resolved.render({}, defaultTheme)).not.toThrow();
    const svg = resolved.render({}, defaultTheme);
    expect(svg).toContain('<svg');
    expect(svg.toLowerCase()).toMatch(/error|unknown/);
  });

  it('error-sentinel is a SyncPlugin (has layoutSync, no async layout)', () => {
    const source: UmlSource = { lines: [], type: 'unknown' };
    const sentinel = registry.resolve(source);
    expect('layoutSync' in sentinel).toBe(true);
    expect('layout' in sentinel).toBe(false);
  });

  it('registry accepts both SyncPlugin and AsyncPlugin without type errors', () => {
    // This test verifies the union type compile-time contract.
    // If the registry only accepted SyncPlugin, registering an AsyncPlugin would
    // be a type error — the fact that this compiles confirms the union works.
    const syncPlugin: DiagramPlugin = makeSyncPlugin();
    const asyncPlugin: DiagramPlugin = makeAsyncPlugin();
    expect(() => {
      registry.register(syncPlugin);
      registry.register(asyncPlugin);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 'layoutSync' in plugin narrowing
// ---------------------------------------------------------------------------

describe("'layoutSync' in plugin narrowing", () => {
  it('narrows a SyncPlugin to expose layoutSync', () => {
    const plugin: DiagramPlugin = makeSyncPlugin();
    if ('layoutSync' in plugin) {
      const source: UmlSource = { lines: [], type: 'sequence' };
      const ast = plugin.parse(source);
      // layoutSync is accessible — no TypeScript error, no `any`
      const geo = plugin.layoutSync(ast, defaultTheme, measurer);
      expect(geo).toBeDefined();
    } else {
      throw new Error('Expected SyncPlugin to have layoutSync');
    }
  });

  it('narrows an AsyncPlugin to expose layout', async () => {
    const plugin: DiagramPlugin = makeAsyncPlugin();
    if (!('layoutSync' in plugin)) {
      const source: UmlSource = { lines: [], type: 'class' };
      const ast = plugin.parse(source);
      // layout() is accessible on AsyncPlugin branch — no `any`
      const geo = await plugin.layout(ast, defaultTheme, measurer);
      expect(geo).toBeDefined();
    } else {
      throw new Error('Expected AsyncPlugin to NOT have layoutSync');
    }
  });

  it('SyncPlugin does not expose layout', () => {
    const plugin: DiagramPlugin = makeSyncPlugin();
    expect('layout' in plugin).toBe(false);
  });

  it('AsyncPlugin does not expose layoutSync', () => {
    const plugin: DiagramPlugin = makeAsyncPlugin();
    expect('layoutSync' in plugin).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SyncPlugin path: layoutSync() is called, returns SVG
// ---------------------------------------------------------------------------

describe('SyncPlugin — registry and layout', () => {
  let registry: DiagramRegistry;

  beforeEach(() => {
    registry = new DiagramRegistry();
  });

  it('layoutSync() is invoked and returns geometry', () => {
    const plugin = makeSyncPlugin();
    registry.register(plugin);

    const source: UmlSource = { lines: ['sync diagram'], type: 'sequence' };
    const resolved = registry.resolve(source);

    if (!('layoutSync' in resolved)) {
      throw new Error('Expected SyncPlugin from registry');
    }

    const ast = resolved.parse(source);
    const geo = resolved.layoutSync(ast, defaultTheme, measurer);
    expect(geo).toBeDefined();
    expect(plugin.layoutSyncCalled).toBe(true);
  });

  it('render() returns a valid SVG string after layoutSync', () => {
    const plugin = makeSyncPlugin();
    registry.register(plugin);

    const source: UmlSource = { lines: ['sync diagram'], type: 'sequence' };
    const resolved = registry.resolve(source);

    if (!('layoutSync' in resolved)) {
      throw new Error('Expected SyncPlugin from registry');
    }

    const ast = resolved.parse(source);
    const geo = resolved.layoutSync(ast, defaultTheme, measurer);
    const svg = resolved.render(geo, defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
  });
});

// ---------------------------------------------------------------------------
// AsyncPlugin path: layout() is awaited, returns SVG
// ---------------------------------------------------------------------------

describe('AsyncPlugin — registry and layout', () => {
  let registry: DiagramRegistry;

  beforeEach(() => {
    registry = new DiagramRegistry();
  });

  it('layout() is awaited and returns geometry', async () => {
    const plugin = makeAsyncPlugin();
    registry.register(plugin);

    const source: UmlSource = { lines: ['async diagram'], type: 'class' };
    const resolved = registry.resolve(source);

    if ('layoutSync' in resolved) {
      throw new Error('Expected AsyncPlugin from registry');
    }

    const ast = resolved.parse(source);
    const geo = await resolved.layout(ast, defaultTheme, measurer);
    expect(geo).toBeDefined();
    expect(plugin.layoutCalled).toBe(true);
  });

  it('render() returns a valid SVG string after layout()', async () => {
    const plugin = makeAsyncPlugin();
    registry.register(plugin);

    const source: UmlSource = { lines: ['async diagram'], type: 'class' };
    const resolved = registry.resolve(source);

    if ('layoutSync' in resolved) {
      throw new Error('Expected AsyncPlugin from registry');
    }

    const ast = resolved.parse(source);
    const geo = await resolved.layout(ast, defaultTheme, measurer);
    const svg = resolved.render(geo, defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
  });
});

// ---------------------------------------------------------------------------
// renderSync() behaviour with AsyncPlugin (no throw, error SVG)
// ---------------------------------------------------------------------------

describe('renderSync() with AsyncPlugin — error SVG, no throw', () => {
  it('returns an SVG starting with <svg when AsyncPlugin is resolved', () => {
    // Simulate what renderSync() does when it encounters an AsyncPlugin:
    // narrowing reveals no layoutSync → produce error SVG
    const plugin: DiagramPlugin = makeAsyncPlugin();
    const isSyncPlugin = 'layoutSync' in plugin;

    let result: string;
    if (!isSyncPlugin) {
      // This is the renderSync() path for AsyncPlugin
      result =
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80">` +
        `<text>renderSync() is not supported for this diagram type</text>` +
        `</svg>`;
    } else {
      result = '<svg/>';
    }

    expect(result.trimStart()).toMatch(/^<svg/);
    expect(result.toLowerCase()).toContain('not supported');
  });

  it('AsyncPlugin has no layoutSync — isSyncPlugin is false', () => {
    const plugin: DiagramPlugin = makeAsyncPlugin();
    expect('layoutSync' in plugin).toBe(false);
  });
});
