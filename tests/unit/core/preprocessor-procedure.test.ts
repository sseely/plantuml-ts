/**
 * Pins TIM `!procedure` family behavior in `src/core/preprocessor.ts` +
 * `src/core/tim/**` against the five failing class-diagram fixtures that
 * motivated this port (cuxaji-51-fozu735, gazimo-19-tebe871,
 * romuco-53-sesu052, bixogo-47-xulu385, roxosu-00-pini153 — see
 * test-results/dot-cache/class/<slug>/in.puml).
 *
 * Recursion-guard note: upstream (`TContext.java`/`TMemory.java`/
 * `FunctionsSet.java`) has no call-depth limit for procedures — the only
 * "Infinite loop?" guard in `tim/` (`CodeIteratorImpl`) is unrelated (a
 * no-progress check on its own line cursor). So there is nothing to pin
 * here: a self-recursive procedure exhausts the JS call stack exactly as
 * it would exhaust the Java call stack upstream, and this file
 * deliberately does not add a test that would crash the runner to prove
 * that absence.
 */
import { describe, it, expect } from 'vitest';
import { preprocess } from '../../../src/core/preprocessor.js';

function run(lines: string[]): readonly string[] {
  return preprocess(lines.join('\n')).lines;
}

describe('preprocessor: TIM !procedure family', () => {
  it('expands a simple declared procedure call with positional args', () => {
    const result = run([
      '!procedure msg($source, $destination)',
      '$source --> $destination',
      '!endprocedure',
      'msg("foo1", "foo2")',
    ]);
    expect(result).toEqual(['foo1 --> foo2']);
  });

  it('expands multiple calls to the same procedure independently', () => {
    const result = run([
      '!procedure init_class($name)',
      'class $name {',
      '  init()',
      '}',
      '!endprocedure',
      'init_class("foo1")',
      'init_class("foo2")',
    ]);
    expect(result).toEqual([
      'class foo1 {',
      '  init()',
      '}',
      'class foo2 {',
      '  init()',
      '}',
    ]);
  });

  it('expands a nested procedure call inside another procedure body', () => {
    // Pins cuxaji-51-fozu735 / gazimo-19-tebe871: init_class's body calls
    // addCommonMethod(), itself a declared 0-arg procedure.
    const result = run([
      '!procedure msg($source, $destination)',
      '$source --> $destination',
      '!endprocedure',
      '',
      '!procedure init_class($name)',
      'class $name {',
      'addCommonMethod()',
      '}',
      '!endprocedure',
      '',
      '!procedure addCommonMethod()',
      '  toString()',
      '  hashCode()',
      '!endprocedure',
      '',
      'init_class("foo1")',
      'init_class("foo2")',
      'msg("foo1", "foo2")',
    ]);
    expect(result).toEqual([
      'class foo1 {',
      '  toString()',
      '  hashCode()',
      '}',
      'class foo2 {',
      '  toString()',
      '  hashCode()',
      '}',
      'foo1 --> foo2',
    ]);
  });

  it('appends a call-site trailing body to the procedure output (romuco-53-sesu052)', () => {
    // Upstream semantics (TContext#applyFunctionsAndVariables): text before
    // the call is prepended to the FIRST emitted body line (pendingAdd);
    // text after the call's closing paren is appended VERBATIM to the LAST
    // emitted body line (appendToLastResult) — it is not itself
    // reprocessed. Subsequent source lines (the class body opened by the
    // appended `{`) are untouched, ordinary content.
    const result = run([
      '!procedure test($name)',
      'class $name << (A, #FF00DD) >>',
      '!endprocedure',
      'test("test") {',
      '    id: int4',
      '    do_something(): void',
      '}',
    ]);
    expect(result).toEqual([
      'class test << (A, #FF00DD) >> {',
      '    id: int4',
      '    do_something(): void',
      '}',
    ]);
  });

  it('!unquoted procedure accepts a bare (unquoted) identifier argument', () => {
    const result = run([
      '!unquoted procedure greet($who)',
      'hello $who',
      '!endprocedure',
      'greet(world)',
    ]);
    expect(result).toEqual(['hello world']);
  });

  it('%invoke_procedure dispatches to a computed procedure name (bixogo/roxosu SALT)', () => {
    const result = run([
      '!unquoted procedure SALT($x)',
      '{{salt',
      '%invoke_procedure("_"+$x)',
      '}}',
      '!endprocedure',
      '',
      '!procedure _choose()',
      '{+',
      '<b>an example',
      'choose one option',
      '()one',
      '()two',
      '[ok]',
      '}',
      '!endprocedure',
      '',
      'SALT(choose)',
    ]);
    expect(result).toEqual([
      '{{salt',
      '{+',
      '<b>an example',
      'choose one option',
      '()one',
      '()two',
      '[ok]',
      '}',
      '}}',
    ]);
  });

  it('does not expand a call to an undeclared procedure name', () => {
    const result = run(['!procedure real($x)', 'body $x', '!endprocedure', 'notDeclared("x")']);
    expect(result).toEqual(['notDeclared("x")']);
  });

  it('leaves ordinary content untouched when no procedure is declared', () => {
    const result = run(['class Foo', 'Foo --> Bar']);
    expect(result).toEqual(['class Foo', 'Foo --> Bar']);
  });

  it('interacts correctly with !define: define substitution runs on the', () => {
    // Procedure-expanded output — a body line containing both a $param and
    // a classic !define token gets both substitutions applied (param
    // substitution inside expandProcedureCalls, then applyDefines on the
    // resulting line, per preprocessor.ts's per-line tail).
    const result = run([
      '!define GREETING hello',
      '!procedure say($name)',
      'GREETING $name',
      '!endprocedure',
      'say("world")',
    ]);
    expect(result).toEqual(['hello world']);
  });

  it('registers a procedure declared inside an inactive !ifdef block', () => {
    // Documents a genuine (if surprising) upstream quirk traced through
    // TContext#buildCodeIterator: CodeIteratorProcedure wraps
    // CodeIteratorReturnFunction and is itself wrapped by CodeIteratorIf,
    // so a `!procedure` declaration is registered by the inner iterator
    // BEFORE the outer if/endif iterator ever gets a chance to gate it —
    // even when the declaration is lexically inside a false `!ifdef`.
    const result = run([
      '!ifdef NOT_DEFINED',
      '!procedure hidden($x)',
      'shown $x',
      '!endprocedure',
      '!endif',
      'hidden("yes")',
    ]);
    expect(result).toEqual(['shown yes']);
  });

  it('does not expand a procedure call inside an inactive !ifdef block', () => {
    // Call SITES (ordinary content lines), unlike declarations, are
    // reached only after the isActive() gate — so a call inside an
    // inactive block is correctly dropped along with the rest of the
    // inactive block's content, not expanded.
    const result = run([
      '!procedure msg($x)',
      'body $x',
      '!endprocedure',
      '!ifdef NOT_DEFINED',
      'msg("hidden")',
      '!endif',
      'msg("visible")',
    ]);
    expect(result).toEqual(['body visible']);
  });
});
