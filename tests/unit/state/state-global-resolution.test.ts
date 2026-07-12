/**
 * Global state-name resolution + two-pass parsing (mission A4/Phase L,
 * ParserPass port — D5 escalation over the iteration-1 STOP).
 *
 * Two mechanisms, landed together because the first is unsafe without the
 * second:
 *
 *  1. `quarkInContextSafe`'s non-null-separator, no-dot-in-id branch: an id
 *     that matches EXACTLY one state anywhere in the diagram resolves to
 *     that state regardless of the CURRENT scope; an id matching zero
 *     states creates one in the current scope. State diagrams default
 *     `namespaceSeparator` to `"."` (`StateDiagram.java:62` — same default
 *     as class diagrams, NOT `null` as an earlier iteration assumed), so
 *     this is the branch that applies for every undotted id. A literal `.`
 *     in an id hits the DOTTED hierarchical-split branch instead
 *     (`state-parse-resolve.ts#resolveOrCreateDottedPath` — see
 *     `state-dotted-id.test.ts` for that mechanism's own tests, ported
 *     mission A4 Phase L iter 10).
 *  2. A genuine TWO-PASS parser (`parser.ts`), mirroring upstream's
 *     `ParserPass.ONE`/`TWO`/`THREE`: pass ONE creates every declaration,
 *     in its true nested scope, for the WHOLE document before pass TWO
 *     ever resolves a transition endpoint. This is what makes (1) safe for
 *     FORWARD references — a transition referencing a name declared later
 *     in the source text still finds it already correctly placed. A
 *     single-pass implementation of (1) alone was tried, measured against
 *     the oracle, and reverted: it regressed two already-EQUAL goldens
 *     (bajelo-54-dixe684, tuvugi-94-gapi519) by binding a forward-referenced
 *     name to whichever scope first mentioned it, rather than where it was
 *     actually declared.
 *
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
 * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java#getEntity
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java#getRequiredPass
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

/** Depth-first flatten of every State reachable from `ast.states`. */
function flattenAll(ast: StateDiagramAST): State[] {
  const out: State[] = [];
  const visit = (s: State): void => {
    out.push(s);
    s.children.forEach(visit);
  };
  ast.states.forEach(visit);
  return out;
}

describe('global state-name resolution -- quarkInContext/firstWithName port', () => {
  it('a transition inside one composite binds to a same-named entity already declared as a sibling top-level composite (bemena-23-zebu249 shape, backward reference)', () => {
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

  it('a transition inside one composite binds to a same-named entity declared LATER, nested inside a DIFFERENT top-level composite (bemena-23-zebu249 shape, forward reference -- requires the two-pass parser)', () => {
    const ast = parse(`
      state NotShooting {
        Idle --> Configuring
      }
      state Configuring {
        state Inner
      }
    `);

    expect(ast.states.filter((s) => s.id === 'Configuring')).toHaveLength(1);
    const configuring = findState(ast, 'Configuring');
    expect(configuring?.children.map((c) => c.id)).toEqual(['Inner']);
    const notShooting = findState(ast, 'NotShooting');
    expect(notShooting?.children.map((c) => c.id)).toEqual(['Idle']);
  });

  it('a forward-referenced state later declared in the SAME scope resolves to one canonical entity (bajelo-54-dixe684 shape, top level)', () => {
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

  it('a forward-referenced state later declared NESTED inside a sibling composite resolves to one entity, placed where it was actually declared (bajelo-54-dixe684 shape, verbatim: Stop --> Chg_Sector precedes state Run { state Chg_Sector })', () => {
    const ast = parse(`
      state Track_FSM {
        state Stop
        Stop --> Chg_Sector
        state Run {
          state Chg_Sector
        }
      }
    `);

    const all = flattenAll(ast);
    expect(all.filter((s) => s.id === 'Chg_Sector')).toHaveLength(1);

    const trackFsm = findState(ast, 'Track_FSM');
    expect(trackFsm?.children.map((c) => c.id)).toEqual(['Stop', 'Run']);
    // Chg_Sector belongs to Run (its actual declaration site), NOT
    // Track_FSM (where the forward-referencing transition happened to be
    // textually positioned) -- this is the exact case that regressed the
    // bajelo-54-dixe684 golden under a single-pass implementation of
    // global reuse; the two-pass parser (pass ONE creates Run's nested
    // Chg_Sector before pass TWO's Stop-->Chg_Sector transition ever runs)
    // is what keeps it correctly placed.
    const run = all.find((s) => s.id === 'Run');
    expect(run?.children.map((c) => c.id)).toEqual(['Chg_Sector']);
  });

  it('a state declared inside TWO different composites with the SAME name resolves to ONE shared entity, nested wherever it was first created (verified against the real plantuml.jar: the second composite renders empty, only one \'X\' label appears)', () => {
    // Empirically confirmed via -DPLANTUML_DUMP_DOT + rendered SVG text
    // content for this exact fixture: only the labels 'A', 'X', 'B'
    // appear -- B has no 'X' child of its own. `reuseExistingChild` is
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

  it('a DOTTED composite-block-open id genuinely splits hierarchically -- "S" (phantom ancestor) containing "I" (the real composite), and the self-loop converges onto "I" itself rather than creating a nested duplicate (upstream compares the quark\'s LOCAL segment name, not the full dotted code -- tuvugi-94-gapi519 shape, mission A4 Phase L iter 10)', () => {
    // Real upstream splits "S.I" hierarchically into a "S" quark containing
    // an "I" quark; `getCurrentGroup().getName()` inside that scope is "I",
    // never equal to the full code "S.I", so the FAST local-name self-loop
    // shortcut never fires -- but the full dotted-path resolution of BOTH
    // "S.I --> S.I" endpoints independently converges onto the SAME "I"
    // entity (the currently-open composite itself), producing a genuine
    // self-loop by a different route. "S" is never explicitly declared, so
    // it is an auto-created (`autoPhantom`) ancestor -- upstream
    // `GroupType.PACKAGE` via `eventuallyBuildPhantomGroups` -- and "I" has
    // ZERO real children (both endpoints resolved to itself, not a new leaf).
    // Verified against the real jar (`-DPLANTUML_DUMP_DOT`): oracle emits a
    // single cluster wrapping ONE leaf node with a self-loop edge.
    const ast = parse(`
      state S.I {
        S.I --> S.I
      }
    `);

    const outer = findState(ast, 'S');
    expect(outer?.autoPhantom).toBe(true);
    expect(outer?.children.map((c) => c.id)).toEqual(['I']);

    const inner = outer?.children[0];
    expect(inner?.autoPhantom).toBeUndefined();
    expect(inner?.children).toEqual([]);
    expect(inner?.transitions).toEqual([{ from: 'I', to: 'I', length: 2 }]);
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

  it('a sync bar (==name==) referenced in two DIFFERENT composites DOES globalize -- upstream calls quarkInContext directly for it, no composite-namespaced synthetic id', () => {
    // Sync-bar ids are stripped to their canonical bare name (`X`, not
    // `==X==`) before the quark lookup -- see `stripSyncBarEquals`.
    const ast = parse(`
      state A {
        S1 --> ==X==
      }
      state B {
        ==X== --> S2
      }
    `);

    const syncBars = ast.states.flatMap((s) => s.children).filter((s) => s.kind === 'syncBar');
    // Only one 'X' entity exists anywhere -- both references bound to it.
    expect(syncBars.filter((s) => s.id === 'X')).toHaveLength(1);
  });
});

describe('two-pass parsing -- ParserPass ONE/TWO port', () => {
  it('a state created ONLY on pass ONE (implicit create from a standalone `CODE : text` line, never referenced again on pass TWO) survives into the final result', () => {
    // CommandAddField (the standalone description-line command) is
    // ParserPass.ONE-only upstream. A naive "rebuild a fresh scope tree
    // per pass" implementation of the two-pass split (an earlier draft of
    // this restructure) silently DROPPED states created only during pass
    // ONE, because the final `ast.states` was read from pass TWO's
    // separately-rebuilt tree, which never saw them. The persistent,
    // reopened-not-rebuilt scope tree (`ParseState.scopeByOwner`) fixes
    // this.
    const ast = parse('Active : auto-created description');
    const active = findState(ast, 'Active');
    expect(active).toBeDefined();
    expect(active?.description).toEqual(['auto-created description']);
  });

  it('concurrent regions accumulate correctly across both passes -- pass TWO must not duplicate empty regions when it replays the SAME `--` separator lines', () => {
    // Pass ONE allocates two regions (one per `--`) and puts A/B, C/D into
    // them respectively (no transitions -- they don't run pass ONE). Pass
    // TWO revisits the SAME persistent scope and its transitions must land
    // in those SAME two regions, not a freshly duplicated pair appended
    // after them (`Scope.regionCursor`'s doc). Region 0 (A/B) is
    // `owner.children`, not a `concurrentRegions` entry (popScope's doc).
    const ast = parse(`
      state S {
        A --> B
        --
        C --> D
      }
    `);

    const s = findState(ast, 'S');
    expect(s?.concurrentRegions).toHaveLength(1);
    expect(s?.children.map((st) => st.id)).toEqual(['A', 'B']);
    expect(s?.concurrentRegions[0]?.map((st) => st.id)).toEqual(['C', 'D']);
  });

  it('a note attached with no explicit `of <State>` falls back to `lastEntity` as of pass TWO\'s OWN walk position, not pass ONE\'s', () => {
    // `lastEntity` is a diagram-level running field that is NOT reset
    // between passes (matches upstream's single persistent diagram
    // object) -- but a note's REAL resolution only happens when it is
    // finalized, which for an attached note is pass TWO (merged with
    // upstream's ParserPass.THREE -- see state-parse-state.ts's `Pass`
    // doc). The captured target must reflect pass TWO's own walk (the
    // transition just above the note), not whatever pass ONE's
    // declaration-only walk last touched.
    const ast = parse(`
      state Zeta {
        state Alpha
      }
      Alpha --> Beta
      note right : a note with no explicit target
    `);

    expect(ast.notes).toHaveLength(1);
    expect(ast.notes?.[0]?.target).toBe('Beta');
    expect(ast.notes?.[0]?.implicitTarget).toBe(true);
  });
});
