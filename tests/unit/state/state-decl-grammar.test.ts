/**
 * Feature family: declaration-grammar gaps in the shared id/decoration
 * regex fragments (`ID_ALT`/`URL_OPT`/`STEREO_OPT`) that every `state`/
 * `frame` declaration rule builds on.
 *
 * Gap 1 — `[[url]]` had no slot in ANY declaration rule. On a composite
 * opener (`state Foo [[{tip}]] {`), the trailing `{` was swallowed by the
 * bare-id/alias group (greedy `\S+`), so the line matched as a FLAT
 * declaration and the block's `{`/children were never opened.
 * Gap 2 — the alias/bareName groups used `\S+`, which has no `<` boundary:
 * an immediately-adjacent `<<stereotype>>` (no space) was captured whole
 * into the id/alias instead of being left for `STEREO_OPT`/the mandatory
 * stereotype group to match.
 *
 * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java
 * @see ~/git/plantuml/.../statediagram/command/CommandCreatePackageState.java
 * @see ~/git/plantuml/.../statediagram/command/CommandCreatePackage2.java
 * @see ~/git/plantuml/.../url/UrlBuilder.java
 */
import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { StateDiagramAST, State } from '../../../src/diagrams/state/ast.js';

function parse(source: string): StateDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

function findState(ast: StateDiagramAST, id: string): State | undefined {
  return ast.states.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// Gap 1: [[url]] on declarations
// ---------------------------------------------------------------------------

describe('[[url]] on state declarations (UrlBuilder.OPTIONAL)', () => {
  it('url on a composite opener still opens the block (children detected)', () => {
    const ast = parse(`
      state Foo [[{tip}]] {
        state A
        state B
      }
    `);
    const foo = findState(ast, 'Foo');
    expect(foo).toBeDefined();
    expect(foo?.children.map((c) => c.id)).toEqual(['A', 'B']);
  });

  it('the url itself is discarded -- State carries no url field', () => {
    const ast = parse('state Foo [[{tip}]] {\n}');
    const foo = findState(ast, 'Foo');
    expect(foo).toBeDefined();
    expect(foo).not.toHaveProperty('url');
  });

  it('url on a flat (non-composite) state leaves a normal leaf state', () => {
    const ast = parse('state Active [[{tip}]]');
    const s = findState(ast, 'Active');
    expect(s).toBeDefined();
    expect(s?.children).toEqual([]);
    expect(s?.display).toBe('Active');
  });

  it('url + as-alias flat declaration resolves display/id and discards the url', () => {
    const ast = parse('state "NotConnected" as Main_NotConnected [[{Main_NotConnected}]]');
    const s = findState(ast, 'Main_NotConnected');
    expect(s).toBeDefined();
    expect(s?.display).toBe('NotConnected');
  });

  it('url before color on a flat declaration: both apply, url discarded', () => {
    const ast = parse('state Active [[http://example.com]] #pink');
    const s = findState(ast, 'Active');
    expect(s?.color).toBe('#pink');
  });

  it('url on a frame opener still opens the block', () => {
    const ast = parse(`
      frame Outer [[{tip}]] {
        state A
      }
    `);
    const outer = findState(ast, 'Outer');
    expect(outer?.container).toBe('frame');
    expect(outer?.children.map((c) => c.id)).toEqual(['A']);
  });

  it('url with mandatory stereotype (no braces) still classifies the pseudostate', () => {
    const ast = parse('state F <<start>>[[{tip}]]');
    const s = findState(ast, 'F');
    expect(s?.kind).toBe('initial');
    expect(s?.stereotype).toBe('start');
  });

  it('nested composites each carrying [[url]] all open correctly (kenuci-20-cane702 shape)', () => {
    const ast = parse(`
      state S [[{S}]] {
        state a [[{a}]] {
          state b
        }
      }
    `);
    const s = findState(ast, 'S');
    expect(s?.children.map((c) => c.id)).toEqual(['a']);
    const a = s?.children[0];
    expect(a?.children.map((c) => c.id)).toEqual(['b']);
  });
});

// ---------------------------------------------------------------------------
// Gap 2: ID_ALT / stereotype adjacency
// ---------------------------------------------------------------------------

describe('adjacent <<stereotype>> boundary on declaration id/alias groups', () => {
  it('alias immediately followed by <<stereotype>> on a composite opener splits correctly', () => {
    const ast = parse(`
      state "a_1" as a<<comp>> {
        state x
      }
    `);
    const a = findState(ast, 'a');
    expect(a).toBeDefined();
    expect(a?.display).toBe('a_1');
    expect(a?.stereotype).toBe('comp');
    expect(a?.children.map((c) => c.id)).toEqual(['x']);
    // The adjacent stereotype text must not have leaked into the id.
    expect(findState(ast, 'a<<comp>>')).toBeUndefined();
  });

  it('bare id immediately followed by <<stereotype>>, no braces (beguxu-19-tize774 shape)', () => {
    const ast = parse('state c<<simple>>');
    const c = findState(ast, 'c');
    expect(c).toBeDefined();
    expect(c?.stereotype).toBe('simple');
    expect(findState(ast, 'c<<simple>>')).toBeUndefined();
  });

  it('two adjacent-stereotype siblings stay distinct and link correctly', () => {
    const ast = parse(`
      state c<<simple>>
      state d<<simple>>
      c --> d : event
    `);
    expect(findState(ast, 'c')?.stereotype).toBe('simple');
    expect(findState(ast, 'd')?.stereotype).toBe('simple');
    expect(ast.transitions).toHaveLength(1);
    expect(ast.transitions[0]).toMatchObject({ from: 'c', to: 'd', label: 'event' });
  });

  it('quoted-display + adjacent-stereotype + color combo on a composite opener', () => {
    const ast = parse(`
      state "a_2" as b<<comp>> #pink {
        state w
      }
    `);
    const b = findState(ast, 'b');
    expect(b?.display).toBe('a_2');
    expect(b?.stereotype).toBe('comp');
    expect(b?.color).toBe('#pink');
    expect(b?.children.map((c) => c.id)).toEqual(['w']);
  });
});

// ---------------------------------------------------------------------------
// Regression: plain declarations unchanged
// ---------------------------------------------------------------------------

describe('regression: plain declarations unaffected by the grammar changes', () => {
  it('a plain bare declaration still works', () => {
    const ast = parse('state Idle');
    expect(findState(ast, 'Idle')).toBeDefined();
  });

  it('a plain quoted-as declaration still works', () => {
    const ast = parse('state "My State" as MS');
    const s = findState(ast, 'MS');
    expect(s?.display).toBe('My State');
  });

  it('a plain composite opener with no decorations still works', () => {
    const ast = parse('state Foo {\n  state A\n}');
    expect(findState(ast, 'Foo')?.children.map((c) => c.id)).toEqual(['A']);
  });

  it('a spaced stereotype (pre-existing form) still classifies correctly', () => {
    const ast = parse('state choice1 <<choice>>');
    expect(findState(ast, 'choice1')?.kind).toBe('choice');
  });

  it('inline description text after a color still works (no url present)', () => {
    const ast = parse('state Active #pink : text after color');
    const s = findState(ast, 'Active');
    expect(s?.color).toBe('#pink');
    expect(s?.description).toEqual(['text after color']);
  });

  it('a frame declaration with no decorations still works', () => {
    const ast = parse('frame Outer {\n  state A\n}');
    expect(findState(ast, 'Outer')?.container).toBe('frame');
  });
});
