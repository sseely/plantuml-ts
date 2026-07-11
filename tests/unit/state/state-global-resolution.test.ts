/**
 * Global state-name resolution (mission A4/Phase L/iteration 1) --
 * `quarkInContextSafe`'s non-null-separator, no-dot-in-id branch: an id that
 * matches EXACTLY one state anywhere in the diagram resolves to that state
 * regardless of the CURRENT scope; an id matching zero or 2+ states resolves
 * scope-locally instead. State diagrams default `namespaceSeparator` to "."
 * (StateDiagram.java:62 -- same default as class diagrams), so this is the
 * always-applicable branch for every id our grammar produces (none contain a
 * literal "." separator character).
 *
 * SKIPPED -- STOP condition hit, root cause is DEEPER than this iteration's
 * scoped mechanism. A single-pass port of quarkInContextSafe's global-reuse
 * rule is UNSAFE for forward references (a transition referencing a name
 * BEFORE its owning `state X { }` block is parsed) and regressed two
 * already-EQUAL ratchet goldens when implemented and measured against the
 * real oracle:
 *   - bajelo-54-dixe684: `Stop --> Chg_Sector` (Track_FSM scope) precedes
 *     `state Chg_Sector {}` (nested inside Run, declared later). A global
 *     first-write-wins registry creates Chg_Sector in Track_FSM's scope at
 *     the FORWARD reference, then the later declaration reuses that
 *     wrongly-scoped object instead of Run's own -- Chg_Sector ends up a
 *     Track_FSM sibling instead of Run's child. Oracle svek-2.dot proves
 *     (via -DPLANTUML_DUMP_DOT + rendered SVG text content, verified
 *     directly against the real plantuml.jar) Chg_Sector belongs inside
 *     Run's cluster.
 *   - tuvugi-94-gapi519: `state S.I { S.I --> S.I }` -- a literal "." in
 *     the id hits quarkInContextSafe's DOTTED-id hierarchical-split branch
 *     (unimplemented here; this port only handles the no-dot-in-id branch).
 *
 * Root cause (confirmed against the Java, not guessed): StateDiagram
 * requires THREE PARSER PASSES (`getRequiredPass()` = ONE/TWO/THREE).
 * `CommandCreateState`/`CommandCreatePackageState#isEligibleFor` accept ALL
 * three passes and structurally create every declaration during PASS ONE
 * (a full scan of the ENTIRE source, before any transition executes);
 * `CommandLinkStateCommon#isEligibleFor` returns true ONLY for PASS TWO.
 * So by the time any transition resolves `quarkInContext`, every
 * declaration in the WHOLE document already exists in its textually
 * correct nested position -- forward references are never actually unsafe
 * upstream, because "forward" is resolved relative to the SOURCE, not
 * relative to a single top-to-bottom pass. Our parser (`parser.ts`) is a
 * single linear pass with declarations and transitions interleaved in
 * dispatch order, so a direct global-registry port has no safe way to know
 * whether a not-yet-seen declaration is coming later in the same document.
 *
 * Next-iteration candidates (not attempted here -- out of this iteration's
 * scope, needs its own mission-brief slot):
 *   (a) Restructure `parser.ts` into a real 2-pass walk: pass 1 dispatches
 *       ONLY declaration-shaped commands (state/frame open, plain `state X`,
 *       `state X <<stereo>>`) to populate the full composite tree; pass 2
 *       dispatches transitions/description-lines/notes against the
 *       already-complete tree. Closest to upstream's actual architecture;
 *       largest change (touches parser.ts's main loop + state-commands.ts's
 *       dispatch, not just state-parse-state.ts).
 *   (b) A "reparent on declare" approximation: when `declareState` reuses
 *       an existing entity that currently lives in a DIFFERENT scope,
 *       remove it from its current owner (live scope array if still open,
 *       or `owner.children` if that scope already closed) and re-add it to
 *       the scope doing the declaring. Requires tracking each State's
 *       current structural parent (a `Map<State, State | null>` on
 *       ParseState). Approximates 2-pass semantics for the common case
 *       (declaration always more authoritative than an auto-created
 *       reference stub) without a full parser restructure -- but is a
 *       divergence from upstream's actual mechanism, so needs explicit
 *       fixture verification before trusting it beyond bajelo/bemena.
 *   Either still needs the dotted-id (`S.I`) hierarchical-split branch of
 *   `quarkInContextSafe` addressed separately (tuvugi-94-gapi519).
 *
 * The `it()` bodies below are left INTACT (not deleted) as a pinned
 * specification of the desired end-state behavior for whichever mechanism
 * lands next -- `state A { state X } state B { state X }`'s test in
 * particular is empirically verified against the real plantuml.jar (see
 * its own comment) and should NOT be treated as a guess.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
 * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java#getEntity
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java#getRequiredPass
 * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java (ParserPass.ONE gate)
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

describe.skip('global state-name resolution -- quarkInContext/firstWithName port', () => {
  it('a transition inside one composite binds to a same-named entity already declared as a sibling top-level composite (bemena-23-zebu249 shape)', () => {
    const ast = parse(`
      state Configuring {
        state Inner
      }
      state NotShooting {
        Idle --> Configuring
      }
    `);

    // Exactly one 'Configuring' entity exists anywhere -- the reference
    // inside NotShooting bound to the top-level one, it did not create a
    // scoped duplicate.
    expect(ast.states.filter((s) => s.id === 'Configuring')).toHaveLength(1);

    const configuring = findState(ast, 'Configuring');
    expect(configuring?.children.map((c) => c.id)).toEqual(['Inner']);

    // NotShooting's own children are only what it actually declared itself
    // (Idle) -- Configuring is NOT pulled into NotShooting's subtree, which
    // is what makes 'Idle --> Configuring' a boundary-crossing link.
    const notShooting = findState(ast, 'NotShooting');
    expect(notShooting?.children.map((c) => c.id)).toEqual(['Idle']);
    expect(notShooting?.transitions).toEqual([{ from: 'Idle', to: 'Configuring', length: 2 }]);
  });

  it('a forward-referenced state later declared in the SAME scope resolves to one canonical entity (bajelo-54-dixe684 shape)', () => {
    const ast = parse(`
      Run --> Stop
      state Run {
        A --> B
      }
    `);

    expect(ast.states.filter((s) => s.id === 'Run')).toHaveLength(1);
    const run = findState(ast, 'Run');
    expect(run?.children.map((c) => c.id)).toEqual(['A', 'B']);
    expect(ast.transitions).toEqual([{ from: 'Run', to: 'Stop', length: 2 }]);
  });

  it('a state declared inside TWO different composites with the SAME name resolves to ONE shared entity, nested wherever it was first created (verified against the real plantuml.jar: the second composite renders empty, only one \'X\' label appears)', () => {
    // Empirically confirmed via -DPLANTUML_DUMP_DOT + rendered SVG text
    // content for this exact fixture: only the labels \'A\', \'X\', \'B\'
    // appear -- B has no \'X\' child of its own. `reuseExistingChild` is
    // `true` at EVERY state-diagram call site (StateDiagram.java /
    // CommandCreate*.java), so `countByName(id) === 1` always fires once a
    // match exists -- for ordinary (non-pseudostate-shorthand) ids, a name
    // can therefore never reach count >= 2 in a state diagram; the
    // "2+ matches stays scope-local" branch of `quarkInContextSafe` is only
    // reachable for the excluded `[H]`/`[H*]` shorthand path (see the
    // dedicated test below).
    const ast = parse(`
      state A {
        state X
      }
      state B {
        state X
      }
    `);

    const a = findState(ast, 'A');
    const b = findState(ast, 'B');
    expect(a?.children.map((c) => c.id)).toEqual(['X']);
    expect(b?.children).toEqual([]);
    expect(ast.states.some((s) => s.id === 'X')).toBe(false);
  });

  it('an id equal to the enclosing composite\'s own name self-loops to that composite, not a nested duplicate (CommandLinkStateCommon#getEntity self-check)', () => {
    const ast = parse(`
      state Foo {
        Foo --> Bar
      }
    `);

    expect(ast.states.filter((s) => s.id === 'Foo')).toHaveLength(1);
    const foo = findState(ast, 'Foo');
    expect(foo?.children.map((c) => c.id)).toEqual(['Bar']);
    expect(foo?.transitions).toEqual([{ from: 'Foo', to: 'Bar', length: 2 }]);
  });

  it('[*] stays scope-local in every composite and never becomes a global State node', () => {
    const ast = parse(`
      state A {
        [*] --> S1
      }
      state B {
        [*] --> S2
      }
    `);

    expect(ast.states.some((s) => s.id === '[*]')).toBe(false);
    const a = findState(ast, 'A');
    const b = findState(ast, 'B');
    expect(a?.children.map((c) => c.id)).toEqual(['S1']);
    expect(b?.children.map((c) => c.id)).toEqual(['S2']);
  });

  it('bare [H] shorthand stays scope-local -- two composites each get their OWN history pseudostate, not merged (pre-existing literal-id gap; global resolution must not worsen it)', () => {
    const ast = parse(`
      state A {
        [H] --> X
      }
      state B {
        [H] --> Y
      }
    `);

    const a = findState(ast, 'A');
    const b = findState(ast, 'B');
    const aHist = a?.children.find((c) => c.kind === 'history');
    const bHist = b?.children.find((c) => c.kind === 'history');
    expect(aHist).toBeDefined();
    expect(bHist).toBeDefined();
    expect(aHist).not.toBe(bHist);
  });

  it('a sync bar (=name=) referenced in two DIFFERENT composites DOES globalize -- upstream calls quarkInContext directly for it, no composite-namespaced synthetic id', () => {
    const ast = parse(`
      state A {
        S1 --> =X=
      }
      state B {
        =X= --> S2
      }
    `);

    const syncBars = ast.states
      .flatMap((s) => s.children)
      .filter((s) => s.kind === 'syncBar');
    // Only one '=X=' entity exists anywhere -- both references bound to it.
    expect(syncBars.filter((s) => s.id === '=X=')).toHaveLength(1);
  });
});
