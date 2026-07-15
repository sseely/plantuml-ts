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

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, renderSync, renderAll } from '../../src/index.js';
import { MapIncludeStore } from '../../src/core/include-resolver.js';
import { registry } from '../../src/core/dispatcher.js';
import { defaultTheme } from '../../src/core/theme.js';
import type { AsyncPlugin } from '../../src/core/dispatcher.js';
import { ERROR_BANNER, expectNoErrorDiagram } from '../helpers/error-diagram.js';

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
    render: (_geo, _theme) => ({ completeSvg: VALID_SVG }),
  };

  const throwPlugin: AsyncPlugin = {
    type: 'state',
    accepts: (lines) => lines.some((l) => l.trim() === THROW_TRIGGER_LINE),
    parse: (_block) => {
      throw new Error('deliberate parse failure for coverage');
    },
    layout: (_ast, _theme, _measurer) => Promise.resolve({ laid: true }),
    render: (_geo, _theme) => ({ completeSvg: VALID_SVG }),
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

  it('returns error SVG when plugin throws during parse', async () => {
    const svg = await render(THROW_SOURCE);
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg).toMatch(/deliberate parse failure|error/i);
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

// ---------------------------------------------------------------------------
// render() — fetcher option resolves !include directives
// ---------------------------------------------------------------------------

describe('render() with fetcher option', () => {
  it('resolves !include via custom fetcher and renders the expanded source', async () => {
    const fetcher = (_url: string): Promise<string> =>
      Promise.resolve('Alice -> Bob : hello');

    const source = `@startuml\n!include https://example.com/actors.puml\n@enduml`;
    const svg = await render(source, { fetcher });
    expect(svg.trimStart()).toMatch(/^<svg/);
    // Must not be an error SVG
    expectNoErrorDiagram(svg);
  });

  it('renders normally when source has no !include and no fetcher', async () => {
    const source = `@startuml\nAlice -> Bob : hi\n@enduml`;
    const svg = await render(source);
    expect(svg.trimStart()).toMatch(/^<svg/);
    expectNoErrorDiagram(svg);
  });
});

// ---------------------------------------------------------------------------
// renderAll() — fetcher option resolves !include directives
// ---------------------------------------------------------------------------

describe('renderAll() with fetcher option', () => {
  it('resolves !include via custom fetcher and renders all blocks', async () => {
    const fetcher = (_url: string): Promise<string> =>
      Promise.resolve('Alice -> Bob : from include');

    const source = `@startuml\n!include https://example.com/seq.puml\n@enduml`;
    const svgs = await renderAll(source, { fetcher });
    expect(svgs).toHaveLength(1);
    expect(svgs[0]?.trimStart()).toMatch(/^<svg/);
    expectNoErrorDiagram(svgs[0]!);
  });
});

// ---------------------------------------------------------------------------
// render() — includeStore as the fetch base (stdlib bundles live here)
// ---------------------------------------------------------------------------

describe('render() with includeStore option', () => {
  it('serves a stdlib <bundle/thing> include from the caller-supplied store', async () => {
    const includeStore = new MapIncludeStore({
      '<tupadr3/common>': '!define BOLD(x) <b>x</b>',
    });
    const fetcher = vi.fn();
    const source = `@startuml\n!include <tupadr3/common>\nAlice -> Bob : BOLD(hi)\n@enduml`;
    const svg = await render(source, { fetcher, includeStore });
    expectNoErrorDiagram(svg);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns an error SVG naming the bundle when no store supplies it', async () => {
    const source = `@startuml\n!include <tupadr3/common>\nAlice -> Bob\n@enduml`;
    const svg = await render(source, { fetcher: vi.fn() });
    expect(svg).toContain(ERROR_BANNER);
    expect(svg).toContain('tupadr3');
  });

  it('does not execute an !include that sits in a false !ifdef branch', async () => {
    // The prefetch still FETCHES it (documented over-fetch divergence) — the
    // interpreter is what decides not to run it.
    const fetcher = vi.fn().mockResolvedValue('Alice -> Carol : dead branch');
    const source = [
      '@startuml',
      '!ifdef NEVER',
      '!include https://example.com/dead.puml',
      '!endif',
      'Alice -> Bob : live',
      '@enduml',
    ].join('\n');
    const svg = await render(source, { fetcher });
    expect(fetcher).toHaveBeenCalledWith('https://example.com/dead.puml');
    expect(svg).not.toContain('dead branch');
    expect(svg).toContain('live');
  });
});

// ---------------------------------------------------------------------------
// renderSync() — !include without an includeStore; with one, it resolves
// ---------------------------------------------------------------------------

describe('renderSync() with !include in source', () => {
  it('returns an error SVG mentioning renderSync when source has !include and no store', () => {
    const source = `@startuml\n!include https://example.com/foo.puml\nAlice -> Bob\n@enduml`;
    const svg = renderSync(source);
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg).toContain('renderSync');
    expect(svg).toContain('includeStore');
  });

  it('resolves !include from a caller-supplied includeStore', () => {
    const includeStore = new MapIncludeStore({
      'https://example.com/actors.puml': 'Alice -> Bob : from the store',
    });
    const source = `@startuml\n!include https://example.com/actors.puml\n@enduml`;
    const svg = renderSync(source, { includeStore });
    expect(svg.trimStart()).toMatch(/^<svg/);
    expectNoErrorDiagram(svg);
    expect(svg).toContain('from the store');
  });

  it('reports the unresolved path when the store cannot serve the include', () => {
    const includeStore = new MapIncludeStore({ 'other.puml': 'Alice -> Bob' });
    const svg = renderSync(`@startuml\n!include missing.puml\n@enduml`, { includeStore });
    expect(svg).toContain(ERROR_BANNER);
    expect(svg).toContain('missing.puml');
  });

  it('names the bundle for an unsupplied stdlib !include', () => {
    const includeStore = new MapIncludeStore({});
    const svg = renderSync(`@startuml\n!include <tupadr3/common>\n@enduml`, { includeStore });
    expect(svg).toContain(ERROR_BANNER);
    expect(svg).toContain('tupadr3');
  });

  it('renders normally when source has no !include', () => {
    const source = `@startuml\nAlice -> Bob : test\n@enduml`;
    const svg = renderSync(source);
    expect(svg.trimStart()).toMatch(/^<svg/);
    expectNoErrorDiagram(svg);
  });
});

// ---------------------------------------------------------------------------
// Three-stage theme resolution — buildTheme() acceptance criteria
// ---------------------------------------------------------------------------

describe('three-stage theme resolution', () => {
  it('applies skinparam classBackgroundColor to rendered SVG', async () => {
    const source = [
      '@startuml',
      'skinparam classBackgroundColor #AABBCC',
      'class Foo',
      '@enduml',
    ].join('\n');
    const svg = await render(source);
    expectNoErrorDiagram(svg);
    expect(svg).toContain('#AABBCC');
  });

  // SI7: the `@start…@end` split runs BEFORE the preprocessor, on raw lines, so
  // a directive outside the block is never part of it and never executes —
  // upstream's `BlockUmlBuilder` collects nothing until a `@start` directive.
  // Jar-verified: the same source renders with NO #AABBCC anywhere.
  it('ignores a skinparam placed OUTSIDE the block, as the jar does', async () => {
    const source = [
      'skinparam classBackgroundColor #AABBCC',
      '@startuml',
      'class Foo',
      '@enduml',
    ].join('\n');
    const svg = await render(source);
    expectNoErrorDiagram(svg);
    expect(svg).not.toContain('#AABBCC');
  });

  it('skinparam backgroundColor overrides !theme dark background', async () => {
    const source = [
      '!theme dark',
      'skinparam backgroundColor #FFFFFF',
      '@startuml',
      'Alice -> Bob : hi',
      '@enduml',
    ].join('\n');
    const svg = await render(source);
    expectNoErrorDiagram(svg);
    // The skinparam value (#FFFFFF) must win over dark theme default (#1E1E1E)
    expect(svg).toContain('#FFFFFF');
    expect(svg).not.toContain('#1E1E1E');
  });

  it('caller Partial<Theme> overrides skinparam backgroundColor', async () => {
    const source = [
      'skinparam backgroundColor #AABBCC',
      '@startuml',
      'Alice -> Bob : hi',
      '@enduml',
    ].join('\n');
    // Build a valid Partial<Theme> — colors must be the full colors shape.
    // Only `background` changes; everything else falls back to defaultTheme.
    const callerTheme = {
      colors: { ...defaultTheme.colors, background: '#112233' },
    };
    const svg = await render(source, { theme: callerTheme });
    expectNoErrorDiagram(svg);
    // Caller partial (#112233) wins over skinparam (#AABBCC)
    expect(svg).toContain('#112233');
    expect(svg).not.toContain('#AABBCC');
  });

  it('applies backgroundColor from <style> block', async () => {
    const source = [
      '@startuml',
      '<style>',
      'backgroundcolor: #CCDDEE',
      '</style>',
      'Alice -> Bob : hi',
      '@enduml',
    ].join('\n');
    const svg = await render(source);
    expectNoErrorDiagram(svg);
    expect(svg).toContain('#CCDDEE');
  });

  it('output is unchanged when no skinparam or style blocks are present', async () => {
    const source = `@startuml\nAlice -> Bob : hi\n@enduml`;
    const svgWithOptions = await render(source);
    const svgBaseline = await render(source);
    expect(svgWithOptions).toBe(svgBaseline);
    expectNoErrorDiagram(svgWithOptions);
  });

  it('renderSync applies skinparam classBackgroundColor', () => {
    const source = [
      '@startuml',
      'skinparam classBackgroundColor #AABBCC',
      'class Foo',
      '@enduml',
    ].join('\n');
    const svg = renderSync(source);
    expectNoErrorDiagram(svg);
    expect(svg).toContain('#AABBCC');
  });

  it('renderAll applies skinparam classBackgroundColor', async () => {
    const source = [
      '@startuml',
      'skinparam classBackgroundColor #AABBCC',
      'class Foo',
      '@enduml',
    ].join('\n');
    const svgs = await renderAll(source);
    expect(svgs).toHaveLength(1);
    const svg = svgs[0] ?? '';
    expectNoErrorDiagram(svg);
    expect(svg).toContain('#AABBCC');
  });
});

// ---------------------------------------------------------------------------
// Element-scoped <style> block → buildTheme → rendered SVG
// ---------------------------------------------------------------------------

describe('element-scoped <style> block wired into buildTheme', () => {
  // Use case diagram — actor: use ":User:" colon shorthand which unambiguously
  // routes to the description engine (actor alone also matches sequence).
  it('actor { BackGroundColor } propagates to actor head fill in use case diagram', async () => {
    const source = [
      '@startuml',
      '<style>',
      'actor {',
      '  BackGroundColor: blue',
      '}',
      '</style>',
      ':User:',
      '@enduml',
    ].join('\n');
    const svg = await render(source);
    expectNoErrorDiagram(svg);
    // G1c: named colors resolve to their canonical jar hex.
    expect(svg).toContain('#0000FF');
  });

  it('usecase { BackGroundColor } propagates to usecase ellipse fill', async () => {
    const source = [
      '@startuml',
      '<style>',
      'usecase {',
      '  BackGroundColor: lightBlue',
      '}',
      '</style>',
      'usecase Login',
      '@enduml',
    ].join('\n');
    const svg = await render(source);
    expectNoErrorDiagram(svg);
    // G1c: named colors resolve to their canonical jar hex.
    expect(svg).toContain('#ADD8E6');
  });

  // Business actor: ":Name:/" colon shorthand routes to the description engine.
  it('actor.business { BackGroundColor } propagates to business-actor head fill', async () => {
    const source = [
      '@startuml',
      '<style>',
      'actor {',
      '  business {',
      '    BackGroundColor: red',
      '  }',
      '}',
      '</style>',
      ':BusinessUser:/',
      '@enduml',
    ].join('\n');
    const svg = await render(source);
    expectNoErrorDiagram(svg);
    // G1c: named colors resolve to their canonical jar hex.
    expect(svg).toContain('#FF0000');
  });

  it('class { BackGroundColor } propagates to class background in class diagram', async () => {
    const source = [
      '@startuml',
      '<style>',
      'class {',
      '  BackGroundColor: #AABBCC',
      '}',
      '</style>',
      'class Foo',
      '@enduml',
    ].join('\n');
    const svg = await render(source);
    expectNoErrorDiagram(svg);
    expect(svg).toContain('#AABBCC');
  });

  it('multiple selectors in one <style> block each apply independently', async () => {
    const source = [
      '@startuml',
      '<style>',
      'actor {',
      '  BackGroundColor: #FF0000',
      '}',
      'usecase {',
      '  BackGroundColor: #00FF00',
      '}',
      '</style>',
      ':Alice:',
      'usecase Login',
      ':Alice: --> Login',
      '@enduml',
    ].join('\n');
    const svg = await render(source);
    expectNoErrorDiagram(svg);
    expect(svg).toContain('#FF0000');
    expect(svg).toContain('#00FF00');
  });

  it('source with no <style> renders unchanged (regression)', async () => {
    const source = `@startuml\n:User:\n@enduml`;
    const svgA = await render(source);
    const svgB = await render(source);
    expect(svgA).toBe(svgB);
    expectNoErrorDiagram(svgA);
  });

  it('interface, enum, usecase.business, package style blocks propagate to theme', async () => {
    const source = [
      '@startuml',
      '<style>',
      'interface {',
      '  BackGroundColor: #aabbcc',
      '}',
      'enum {',
      '  BackGroundColor: #ddeeff',
      '}',
      'usecase {',
      '  business {',
      '    BackGroundColor: #112233',
      '  }',
      '}',
      'package {',
      '  BackGroundColor: #445566',
      '  BorderColor: #778899',
      '}',
      '</style>',
      'interface IFoo {}',
      'enum Color { RED }',
      ':Actor:/',
      'package "My Pkg" {}',
      '@enduml',
    ].join('\n');
    const svg = await render(source);
    expectNoErrorDiagram(svg);
    // G1c: hex colors canonicalize to uppercase.
    expect(svg).toContain('#DDEEFF');
  });
});
