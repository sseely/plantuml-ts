/**
 * Direct unit tests for the TIM interpreter's public surface -- the members
 * `preprocess()` does not exercise on its own (`getXargs`, `getDebug`,
 * `appendEndOfLine`, `getPreprocessingArtifact`, the JSON-path branch of
 * `asKnowledge`, RETURN_FUNCTION execution) plus each documented
 * plantuml-ts divergence, so that a future change to one of them fails HERE
 * rather than silently three layers downstream in a DOT-parity fixture.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java
 */
import { describe, expect, it } from 'vitest';
import { preprocess } from '../../../../src/core/preprocessor.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';
import { TContext } from '../../../../src/core/tim/TContext.js';
import { TMemoryGlobal } from '../../../../src/core/tim/TMemoryGlobal.js';
import { TFunctionSignature } from '../../../../src/core/tim/TFunctionSignature.js';
import { TValue } from '../../../../src/core/tim/expression/TValue.js';
import { TVariableScope } from '../../../../src/core/tim/TVariableScope.js';
import { createDefaultTimEnvironment } from '../../../../src/core/tim/builtin/TimEnvironment.js';

/** Run `lines` through a fresh interpreter; return it plus its memory. */
function run(lines: readonly string[]): { context: TContext; memory: TMemoryGlobal } {
  const context = new TContext();
  const memory = new TMemoryGlobal();
  context.executeLines(
    memory,
    lines.map((text, i) => new StringLocated(text, i)),
    undefined,
    false,
  );
  return { context, memory };
}

/** The interpreter's emitted lines, as plain strings. */
function output(context: TContext): string[] {
  return context.getResultList().map((s) => s.getString());
}

describe('TContext — builtin registry', () => {
  it('registers every upstream builtin', () => {
    // 74 = the 74 concrete classes in `tim/builtin/` (75 files, one of which is
    // the abstract `SimpleReturnFunction` base). Upstream's
    // `addStandardFunctions` has 75 `addFunction` lines, but one
    // (`LoadJsonLegacy`) is commented out -- so 74 there too.
    expect(new TContext().functionsSet.size()).toBe(74);
  });

  it('takes its non-determinism from the injected environment, never the ambient clock', () => {
    const env = { ...createDefaultTimEnvironment(), clock: { nowMillis: () => 1_700_000_000_000 } };
    const context = new TContext({ env });
    const memory = new TMemoryGlobal();
    context.executeLines(memory, [new StringLocated('at %now()', 0)], undefined, false);
    expect(output(context)).toEqual(['at 1700000000']);
  });

  it('resolves a builtin by signature through getFunctionSmart', () => {
    const func = new TContext().getFunctionSmart(new TFunctionSignature('%strlen', 1));
    expect(func?.getSignature().getFunctionName()).toBe('%strlen');
  });

  it('reports declared user functions through doesFunctionExist', () => {
    const { context } = run(['!function $twice($x)', '!return $x * 2', '!endfunction']);
    expect(context.doesFunctionExist('$twice')).toBe(true);
    expect(context.doesFunctionExist('$nope')).toBe(false);
  });
});

describe('TContext — line execution', () => {
  it('substitutes a variable into a plain line', () => {
    const { context } = run(['!$who = "world"', 'hello $who']);
    expect(output(context)).toEqual(['hello world']);
  });

  it('executes a RETURN_FUNCTION body and substitutes its value inline', () => {
    const { context } = run(['!function $twice($x)', '!return $x * 2', '!endfunction', 'n = $twice(21)']);
    expect(output(context)).toEqual(['n = 42']);
  });

  it('resolves a JSON field path through asKnowledge', () => {
    const context = new TContext();
    const memory = new TMemoryGlobal();
    memory.putVariable(
      '$cfg',
      TValue.fromJson({ color: 'red' }),
      TVariableScope.GLOBAL,
      new StringLocated('seed', 0),
    );
    const knowledge = context.asKnowledge(memory, 0);
    expect(knowledge.getVariable('$cfg.color').toString()).toBe('red');
  });

  it('records every executed line in the debug log', () => {
    const { context } = run(['alpha', 'beta']);
    expect(context.getDebug().map((s) => s.getString())).toContain('alpha');
  });

  it('appends an end-of-line fragment to the last emitted line', () => {
    const { context } = run(['class Foo']);
    context.appendEndOfLine(' {');
    expect(output(context)).toEqual(['class Foo {']);
    // Empty fragment is a no-op (upstream guards on length > 0).
    context.appendEndOfLine('');
    expect(output(context)).toEqual(['class Foo {']);
  });

  it('extracts the @startuml arguments via getXargs', () => {
    expect(run(['@startuml alpha beta']).context.getXargs()).toBe('alpha beta');
    expect(run(['@startuml']).context.getXargs()).toBeUndefined();
    expect(new TContext().getXargs()).toBeUndefined();
  });
});

describe('TContext — side-effect directives', () => {
  it('!assert passes silently when its condition holds', () => {
    expect(() => run(['!$x = 1', '!assert $x == 1'])).not.toThrow();
  });

  it('!assert throws when its condition fails', () => {
    expect(() => run(['!$x = 1', '!assert $x == 2'])).toThrow();
  });

  it('!log and !dump_memory emit nothing', () => {
    const { context } = run(['!$x = 1', '!log value is $x', '!dump_memory', 'kept']);
    expect(output(context)).toEqual(['kept']);
  });

  it('!option records a known option on the preprocessing artifact', () => {
    const { context } = run(['!option handwritten true']);
    expect(context.getPreprocessingArtifact()).toBeDefined();
    expect(output(context)).toEqual([]);
  });

  it('!theme records the theme name and emits nothing', () => {
    const { context } = run(['!theme cerulean', 'class Foo']);
    expect(context.getThemeName()).toBe('cerulean');
    expect(output(context)).toEqual(['class Foo']);
  });
});

describe('TContext — plantuml-ts divergences (each preserves pre-TIM behavior)', () => {
  it('DIVERGENCE 1: an !include line passes through untouched (batch 5 owns the sync seam)', () => {
    const { context } = run(['!include foo.iuml', 'class Foo']);
    expect(output(context)).toEqual(['!include foo.iuml', 'class Foo']);
  });

  it('DIVERGENCE 3: a known macro called with an uncoverable arity passes through as text', () => {
    const { context } = run(['!define BOLD(x) <b>x</b>', 'BOLD(a,b)']);
    expect(output(context)).toEqual(['BOLD(a,b)']);
  });

  it('DIVERGENCE 4: !undef and its !undefine alias both drop the variable', () => {
    expect(preprocess('!define FOO bar\n!undef FOO\ntext FOO').lines).toEqual(['text FOO']);
    expect(preprocess('!define FOO bar\n!undefine FOO\ntext FOO').lines).toEqual(['text FOO']);
  });

  it('DIVERGENCE 5: !undefine also drops a like-named macro', () => {
    const { context } = run(['!define BOLD(x) <b>x</b>', '!undefine BOLD', 'BOLD(hi)']);
    expect(context.functionsSet.doesFunctionExist('BOLD')).toBe(false);
    expect(output(context)).toEqual(['BOLD(hi)']);
  });
});

describe('TContext — nesting the flat loop could not express', () => {
  it('nests !foreach inside !foreach', () => {
    const { context } = run([
      '!foreach $a in ["x", "y"]',
      '!foreach $b in ["1", "2"]',
      '$a$b',
      '!endfor',
      '!endfor',
    ]);
    expect(output(context)).toEqual(['x1', 'x2', 'y1', 'y2']);
  });

  it('nests !if inside !while', () => {
    const { context } = run([
      '!$i = 0',
      '!while $i < 4',
      '!if %mod($i, 2) == 0',
      'even $i',
      '!endif',
      '!$i = $i + 1',
      '!endwhile',
    ]);
    expect(output(context)).toEqual(['even 0', 'even 2']);
  });
});
