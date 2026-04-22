/**
 * Integration tests for async plugin code paths in src/index.ts.
 *
 * The module-level registry starts with only the sequence (SyncPlugin) registered.
 * These tests register a minimal AsyncPlugin to exercise the async layout path in
 * render() and renderAll(), plus error-catch paths.
 *
 * The mock plugin accepts a unique trigger line that no other plugin matches,
 * so it does not interfere with sequence diagram tests.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render, renderSync, renderAll } from '../../src/index.js';
import { registry } from '../../src/core/dispatcher.js';
import type { AsyncPlugin } from '../../src/core/dispatcher.js';

// ---------------------------------------------------------------------------
// Unique trigger strings — must not match sequence arrow patterns
// ---------------------------------------------------------------------------

const ASYNC_TRIGGER_LINE = 'ASYNC_PLUGIN_TRIGGER_UNIQUE_XYZ';
const THROW_TRIGGER_LINE = 'THROW_PLUGIN_TRIGGER_UNIQUE_XYZ';

const ASYNC_SOURCE = `@startuml\n${ASYNC_TRIGGER_LINE}\n@enduml`;
const THROW_SOURCE = `@startuml\n${THROW_TRIGGER_LINE}\n@enduml`;

const VALID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#fff"/></svg>`;

// ---------------------------------------------------------------------------
// Setup: register mock plugins once before all tests
// ---------------------------------------------------------------------------

beforeAll(() => {
  const asyncPlugin: AsyncPlugin = {
    type: 'class',
    accepts: (lines) => lines.some((l) => l.trim() === ASYNC_TRIGGER_LINE),
    parse: (_block) => ({ nodes: [], links: [] }),
    layout: (_ast, _theme, _measurer) => Promise.resolve({ laid: true }),
    render: (_geo, _theme) => VALID_SVG,
  };

  const throwPlugin: AsyncPlugin = {
    type: 'state',
    accepts: (lines) => lines.some((l) => l.trim() === THROW_TRIGGER_LINE),
    parse: (_block) => {
      throw new Error('deliberate parse failure for coverage');
    },
    layout: (_ast, _theme, _measurer) => Promise.resolve({ laid: true }),
    render: (_geo, _theme) => VALID_SVG,
  };

  registry.register(asyncPlugin);
  registry.register(throwPlugin);
});

// ---------------------------------------------------------------------------
// render() — async layout path
// ---------------------------------------------------------------------------

describe('render() async plugin path', () => {
  it('awaits layout() and returns a valid SVG string', async () => {
    const svg = await render(ASYNC_SOURCE);
    expect(svg.trimStart()).toMatch(/^<svg/);
  });
});

// ---------------------------------------------------------------------------
// renderSync() — async plugin returns error SVG
// ---------------------------------------------------------------------------

describe('renderSync() with async plugin', () => {
  it('returns an error SVG without throwing', () => {
    const svg = renderSync(ASYNC_SOURCE);
    expect(svg.trimStart()).toMatch(/^<svg/);
    // Must mention "not supported" — not a real render
    expect(svg.toLowerCase()).toContain('not supported');
  });
});

// ---------------------------------------------------------------------------
// renderAll() — async layout path and per-block error catch
// ---------------------------------------------------------------------------

describe('renderAll() async plugin path', () => {
  it('awaits layout() for async blocks and returns SVG array', async () => {
    const svgs = await renderAll(ASYNC_SOURCE);
    expect(svgs).toHaveLength(1);
    expect(svgs[0]?.trimStart()).toMatch(/^<svg/);
  });

  it('per-block catch wraps thrown parse error in an error SVG', async () => {
    const svgs = await renderAll(THROW_SOURCE);
    expect(svgs).toHaveLength(1);
    const svg = svgs[0] ?? '';
    expect(svg.trimStart()).toMatch(/^<svg/);
    // Error SVG includes the thrown message
    expect(svg).toMatch(/deliberate parse failure|error/i);
  });
});

// ---------------------------------------------------------------------------
// renderAll() — outer catch (malformed input causes preprocess to throw)
// ---------------------------------------------------------------------------

describe('renderAll() outer error catch', () => {
  it('returns a single error SVG when preprocess throws', async () => {
    // Passing null forces a runtime error in preprocess (string methods on null).
    const svgs = await renderAll(null as unknown as string);
    expect(svgs).toHaveLength(1);
    expect(svgs[0]?.trimStart()).toMatch(/^<svg/);
  });
});
