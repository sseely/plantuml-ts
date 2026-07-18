/**
 * Small, unrelated single-fixture regression tests (mission: class-dot-sync,
 * "six independent single-fixture mechanisms"). Each `describe` block below
 * documents one fixture's mechanism and cites the upstream source.
 */

import { describe, it, expect } from 'vitest';
import { parseRelationshipLine } from '../../../src/diagrams/class/class-relationship-parser.js';
import { parseClassifierDecl } from '../../../src/diagrams/class/class-declaration-parser.js';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { edgeLabelAttrs } from '../../../src/diagrams/class/class-layout-helpers.js';

describe('vegubu-29-bomu147: CommandLinkClass getInv() on up/left direction words', () => {
  // CommandLinkClass.executeArg: `if (dir == Direction.LEFT || dir == Direction.UP)
  // link = link.getInv();` (CommandLinkClass.java:363-364) — applied to EVERY
  // link regardless of type, AFTER the decor-driven direction is resolved.
  // getInv() swaps the entire link (endpoints, decor1/decor2, quantifiers,
  // roles, kal, ports — abel/Link.java#getInv, abel/LinkArg.java#getInv), so
  // in this port's terms it composes with the existing decor-driven
  // `swapDirection` by XOR rather than needing a separate code path.

  it('composition + up swaps (decorSwap=false, dirSwap=true): A *-u- B', () => {
    const r = parseRelationshipLine('A *-u- B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'composition' });
  });

  it('composition + down does not swap (both false): A *-d- B', () => {
    const r = parseRelationshipLine('A *-d- B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'composition' });
  });

  it('composition + left swaps (decorSwap=false, dirSwap=true): A *-l- B', () => {
    const r = parseRelationshipLine('A *-l- B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'composition' });
  });

  it('composition + right does not swap (both false): A *-r- B', () => {
    const r = parseRelationshipLine('A *-r- B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'composition' });
  });

  it('undecorated + up swaps: A -u- B', () => {
    const r = parseRelationshipLine('A -u- B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'association' });
  });

  it('undecorated + down does not swap: A -d- B', () => {
    const r = parseRelationshipLine('A -d- B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'association' });
  });

  it('arrowhead-left + up direction CANCEL (decorSwap=true XOR dirSwap=true => false): A <-u- B', () => {
    const r = parseRelationshipLine('A <-u- B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'association' });
  });

  it('arrowhead-right + up direction COMPOSE (decorSwap=false XOR dirSwap=true => true): A -u-> B', () => {
    const r = parseRelationshipLine('A -u-> B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'association' });
  });

  it('arrowhead-left + down direction COMPOSE (decorSwap=true XOR dirSwap=false => true): A <-d- B', () => {
    const r = parseRelationshipLine('A <-d- B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'association' });
  });

  it('arrowhead-right + down direction do not swap (both false): A -d-> B', () => {
    const r = parseRelationshipLine('A -d-> B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'association' });
  });
});

describe('gabejo-44-juki791: stacked stereotypes <<A>><<B>> on one declaration', () => {
  // Upstream's STEREO group (StereotypePattern.mandatory: `(\<\<.+?\>\>)`)
  // sits inside CommandCreateClass's single full-line regex; with stacked
  // stereotypes nothing downstream can consume the second `<<...>>`, so the
  // engine backtracks the lazy `.+?` across the whole tail and captures
  // "Green>><<Blue" as ONE stereotype instead of failing the line. A lazy
  // stand-alone regex here instead split at the FIRST `>>`, leaving `<<B>>`
  // glued to the id and spawning two phantom isolated nodes.

  it('captures the full stacked run as one stereotype blob', () => {
    const d = parseClassifierDecl('class func2<<Green>><<Blue>>');
    expect(d).not.toBeNull();
    expect(d!.id).toBe('func2');
    expect(d!.stereotype).toBe('Green>><<Blue');
  });

  it('single stereotype still parses cleanly', () => {
    const d = parseClassifierDecl('class Foo << Stereotype >>');
    expect(d).not.toBeNull();
    expect(d!.id).toBe('Foo');
    expect(d!.stereotype).toBe('Stereotype');
  });
});

describe('tilipa-86-suxi130: quoted multiplicities inside the free-text label', () => {
  // Labels#init (descdiagram/command/Labels.java:75-104): with no explicit
  // quantifier group beside either endpoint, the label decomposes via
  // BOTH_LABELS / FIRST_LABEL_ONLY / SECOND_LABEL_ONLY into
  // firstLabel / middle label / secondLabel → taillabel/label/headlabel.

  it('"1" contains "0..*" decomposes into both multiplicities + middle label', () => {
    const r = parseRelationshipLine('FleetVehicle *- Car : "1" contains "0..*"');
    expect(r).toMatchObject({
      from: 'FleetVehicle', to: 'Car', type: 'composition',
      fromMultiplicity: '1', toMultiplicity: '0..*', label: 'contains',
    });
  });

  it('first-only form: "1" has', () => {
    const r = parseRelationshipLine('Car o- Wheel : "1" has');
    expect(r).toMatchObject({
      from: 'Car', to: 'Wheel', type: 'aggregation',
      fromMultiplicity: '1', label: 'has',
    });
    expect(r!.toMultiplicity).toBeUndefined();
  });

  it('second-only form: has "4"', () => {
    const r = parseRelationshipLine('Car o- Wheel : has "4"');
    expect(r).toMatchObject({
      from: 'Car', to: 'Wheel', type: 'aggregation',
      toMultiplicity: '4', label: 'has',
    });
    expect(r!.fromMultiplicity).toBeUndefined();
  });

  it('explicit endpoint quantifiers suppress decomposition (firstLabel != null guard), but the unconditional Labels#init fallthrough (line 102) still strips the label\'s own outer quote pair — jar-verified against pucazu-91-paxe635\'s golden `a" is "b` text (item 46)', () => {
    const r = parseRelationshipLine('A "1" -- "1" B : "x" mid "y"');
    expect(r).toMatchObject({
      from: 'A', to: 'B',
      fromMultiplicity: '1', toMultiplicity: '1', label: 'x" mid "y',
    });
  });

  it('plain label without embedded quotes stays whole', () => {
    const r = parseRelationshipLine('A -- B : contains');
    expect(r).toMatchObject({ from: 'A', to: 'B', label: 'contains' });
    expect(r!.fromMultiplicity).toBeUndefined();
    expect(r!.toMultiplicity).toBeUndefined();
  });
});

describe('item 46 (N63/N64): plain-label quote-stripping gap — class-relationship-parser.ts:384 never called stripQuotes on the raw (.+) label capture when decomposeLabel found no embedded multiplicity pattern', () => {
  // Labels.java:78-102 — `init()`'s final line, `StringUtils
  // .eventuallyRemoveStartingAndEndingDoubleQuote(labelLink, "\"")`, runs
  // UNCONDITIONALLY whenever none of the 3 embedded-pattern branches
  // returned early — including the "no explicit quantifier, no embedded
  // pattern matched" case this describe block covers (jar-verified against
  // begico-70-guva302's real relationship line and golden SVG text).

  it('a single fully-quoted label with an internal \\l escape has its outer quotes stripped (begico-70-guva302)', () => {
    const r = parseRelationshipLine('research .. correlations #Green : "Baird\\lTools vs Goals"');
    expect(r).toMatchObject({ from: 'research', to: 'correlations', label: 'Baird\\lTools vs Goals' });
  });

  it('a quoted label with no embedded multiplicity pattern strips its outer quotes', () => {
    const r = parseRelationshipLine('A -- B : "just a quoted label"');
    expect(r).toMatchObject({ from: 'A', to: 'B', label: 'just a quoted label' });
  });

  it('an unquoted label is unaffected (stripQuotes is a no-op without a matching quote pair)', () => {
    const r = parseRelationshipLine('A -- B : unquoted label');
    expect(r).toMatchObject({ from: 'A', to: 'B', label: 'unquoted label' });
  });
});

describe('gujigi-63-roki030: constraint on links marks the two last links', () => {
  // CommandConstraintOnLinks (command/note/CommandConstraintOnLinks.java) →
  // CucaDiagram#constraintOnLinks via getTwoLastLinks (CucaDiagram.java:660,
  // 712): sets a LinkConstraint on the TWO most-recent non-note links. svek
  // then emits a fixed 10x10 label spot (CONSTRAINT_SPOT, SvekEdge.java:122,
  // used at :430-444) on each constrained edge with no note/label text.

  function parse(source: string) {
    const lines = source.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    return parseClass({ lines, type: 'class' });
  }

  it('flags the two preceding links; earlier links untouched', () => {
    const ast = parse(`
      class a
      class b
      class c
      a -- b
      b -- c
      c -- a
      constraint on links : enten/eller
    `);
    expect(ast.relationships.map((r) => r.linkConstraint === true)).toEqual([false, true, true]);
  });

  it('constrained labeled edge keeps its label; unlabeled one gets the 10x10 spot', () => {
    const ast = parse(`
      class arkiv
      class arkivdel
      arkiv "1" o-- "1..*" arkivdel
      arkiv "0..*" o- "1.*" arkiv : underarkiv
      constraint on links : enten/eller
    `);
    const measurer = {
      measure: (s: string) => ({ width: s.length * 7, height: 14 }),
      getDescent: () => 3,
    };
    const font = { family: 'sans', size: 14 };
    const [plain, selfLoop] = ast.relationships;
    const plainAttrs = edgeLabelAttrs(plain!, font, measurer);
    expect(plainAttrs.label).toBe('');
    expect(plainAttrs.labelWidth).toBe(10);
    expect(plainAttrs.labelHeight).toBe(10);
    const loopAttrs = edgeLabelAttrs(selfLoop!, font, measurer);
    expect(loopAttrs.label).toBe('underarkiv');
  });

  it('fewer than two links is a consumed no-op', () => {
    const ast = parse(`
      class a
      class b
      a -- b
      constraint on links : xor
    `);
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.linkConstraint).toBeUndefined();
    expect(ast.classifiers.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('nadono-22-gidu983: together { } block scoping', () => {
  // CommandTogether (registered in ClassDiagramFactory.java:131) →
  // CucaDiagram#gotoTogether (CucaDiagram.java:337): pushes a Together entry
  // on the same stacks list as groups — a layout-proximity grouping with no
  // comparator-visible DOT cluster. The bug: the block's closing `}` popped
  // the ENCLOSING namespace early, stranding later classifiers outside it.

  function parse(source: string) {
    const lines = source.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    return parseClass({ lines, type: 'class' });
  }

  it('classifiers after the together block stay in the enclosing namespace', () => {
    const ast = parse(`
      namespace Observation {
        together {
          abstract class BadPix {
          }
        }
        class Base {
        }
      }
    `);
    const obs = ast.namespaces.find((n) => n.id === 'Observation');
    expect(obs).toBeDefined();
    expect(obs!.classifiers).toContain('Observation.BadPix');
    expect(obs!.classifiers).toContain('Observation.Base');
  });

  it('together produces no namespace cluster of its own', () => {
    const ast = parse(`
      together {
        class A
        class B
      }
      class C
    `);
    expect(ast.namespaces).toHaveLength(0);
    expect(ast.classifiers.map((c) => c.id).sort()).toEqual(['A', 'B', 'C']);
  });

  it('namespace nested INSIDE a together closes before the together (LIFO)', () => {
    const ast = parse(`
      together {
        namespace N {
          class X
        }
      }
      class Y
    `);
    const n = ast.namespaces.find((ns) => ns.id === 'N');
    expect(n).toBeDefined();
    expect(n!.classifiers).toEqual(['N.X']);
    const y = ast.classifiers.find((c) => c.id === 'Y');
    expect(y).toBeDefined();
    expect(y!.namespace).toBeUndefined();
  });
});
