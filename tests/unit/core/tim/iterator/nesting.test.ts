/**
 * Proves the `CodeIterator` decorator chain can express NESTING that the
 * old flat line-loop preprocessor structurally could not: `!foreach` inside
 * `!if` inside `!procedure`; a `!while` whose body contains an `!if`;
 * `!elseif` chains; `!foreach` inside `!foreach`; `!if` inside `!foreach`;
 * `!if`/`!return` inside `!function`. See `plans/si5a-tim/README.md`
 * decision 1.
 */
import { describe, expect, it } from 'vitest';
import { TFunctionType, TMemoryGlobal } from '../../../../../src/core/tim/index.js';
import { TValue } from '../../../../../src/core/tim/expression/index.js';
import { line, runBody, TestTContext } from '../../../../helpers/tim-iterator-context.js';

describe('nested control flow', () => {
  it('!foreach inside !if inside !procedure', () => {
    const context = new TestTContext();
    const memory = new TMemoryGlobal();

    context.functionsSet.executeDeclareProcedure(context, memory, line('!procedure $collect()', 'DECLARE_PROCEDURE'));
    const pending = context.functionsSet.pendingFunction()!;
    pending.addBody(line('!if 1', 'IF'));
    pending.addBody(line('!foreach $i in [10,20,30]', 'FOREACH'));
    pending.addBody(line('!$sum = $sum + $i', 'AFFECTATION'));
    pending.addBody(line('!endforeach', 'ENDFOREACH'));
    pending.addBody(line('!endif', 'ENDIF'));
    context.functionsSet.executeEndfunction();

    // Seed $sum = 0 through the real interpreter, on the SAME memory the
    // procedure call below will fork from -- proves the procedure's forked
    // local memory writes through to the shared global.
    context.executeLines(memory, [line('!$sum = 0', 'AFFECTATION')], TFunctionType.PROCEDURE, false);

    const proc = [...context.functionsSet.getFunctionsByName('$collect')][0]!;
    proc.executeProcedureInternal(context, memory, line('$collect()'), [], new Map());

    // Faithful upstream quirk, not a bug: `!foreach` binds its loop
    // variable via `TValue.fromJson` (see `ExecutionContextForeach
    // #currentValue` / `CodeIteratorForeach#setLoopVariable`), so `$i` is
    // JSON-typed even though it wraps a plain JSON number -- `TValue
    // #isNumber()` is false for any JSON-typed value, so `$sum + $i` takes
    // the STRING-CONCATENATION branch of `TValue#add`, not numeric
    // addition (matches upstream `TValue.java#add`'s identical dispatch).
    // Proves the nesting AND preserves this documented upstream gotcha.
    expect(memory.getVariable('$sum')?.toString()).toBe('0102030');
  });

  it('!while whose body contains an !if (nested control flow, no infix modulo needed)', () => {
    const { memory } = runBody([
      line('!$n = 0', 'AFFECTATION'),
      line('!$evenSum = 0', 'AFFECTATION'),
      line('!$isEven = 1', 'AFFECTATION'),
      line('!while $n < 5', 'WHILE'),
      line('!if $isEven == 1', 'IF'),
      line('!$evenSum = $evenSum + $n', 'AFFECTATION'),
      line('!endif', 'ENDIF'),
      line('!$isEven = 1 - $isEven', 'AFFECTATION'),
      line('!$n = $n + 1', 'AFFECTATION'),
      line('!endwhile', 'ENDWHILE'),
    ]);
    // n = 0,1,2,3,4 -> even ones are 0,2,4 -> sum 6
    expect(memory.getVariable('$n')?.toInt()).toBe(5);
    expect(memory.getVariable('$evenSum')?.toInt()).toBe(6);
  });

  it('!elseif chain picks exactly one branch', () => {
    function classify(n: number): string {
      const { memory } = runBody([
        line(`!$n = ${n}`, 'AFFECTATION'),
        line('!if $n == 1', 'IF'),
        line('!$label = "one"', 'AFFECTATION'),
        line('!elseif $n == 2', 'ELSEIF'),
        line('!$label = "two"', 'AFFECTATION'),
        line('!elseif $n == 3', 'ELSEIF'),
        line('!$label = "three"', 'AFFECTATION'),
        line('!else', 'ELSE'),
        line('!$label = "other"', 'AFFECTATION'),
        line('!endif', 'ENDIF'),
      ]);
      return memory.getVariable('$label')?.toString() ?? '<unset>';
    }

    expect(classify(1)).toBe('one');
    expect(classify(2)).toBe('two');
    expect(classify(3)).toBe('three');
    expect(classify(4)).toBe('other');
  });

  it('nested !foreach (outer over rows, inner over columns) fully re-runs the inner loop each outer iteration', () => {
    const { memory } = runBody([
      line('!$out = ""', 'AFFECTATION'),
      line('!foreach $row in [1,2]', 'FOREACH'),
      line('!foreach $col in ["a","b"]', 'FOREACH'),
      line('!$out = $out + $col', 'AFFECTATION'),
      line('!endforeach', 'ENDFOREACH'),
      line('!endforeach', 'ENDFOREACH'),
    ]);
    // Two outer iterations x two inner iterations, each inner iteration
    // appends "a" then "b" -- "abab" would collapse to "ab" if the inner
    // loop's ExecutionContextForeach state leaked across outer iterations.
    expect(memory.getVariable('$out')?.toString()).toBe('abab');
  });

  it('!if inside !foreach filters elements', () => {
    const { memory } = runBody([
      line('!$big = ""', 'AFFECTATION'),
      line('!foreach $v in [1,2,3,4,5,6]', 'FOREACH'),
      line('!if $v > 3', 'IF'),
      line('!$big = $big + $v', 'AFFECTATION'),
      line('!endif', 'ENDIF'),
      line('!endforeach', 'ENDFOREACH'),
    ]);
    expect(memory.getVariable('$big')?.toString()).toBe('456');
  });

  it('!function with nested !if / !return picks the right return value', () => {
    const context = new TestTContext();
    const declMemory = new TMemoryGlobal();
    context.functionsSet.executeDeclareReturnFunction(
      context,
      declMemory,
      line('!function $abs($x)', 'DECLARE_RETURN_FUNCTION'),
    );
    const pending = context.functionsSet.pendingFunction()!;
    // TIM's expression grammar has no general unary-minus operator -- a
    // leading '-' is only recognized as part of a negative NUMBER literal
    // (see `TokenType.ts`'s `isSubtractionOperator` comment); `-$x` is not
    // valid TIM syntax. `0 - $x` is the faithful idiom.
    pending.addBody(line('!if $x < 0', 'IF'));
    pending.addBody(line('!return 0 - $x', 'RETURN'));
    pending.addBody(line('!endif', 'ENDIF'));
    pending.addBody(line('!return $x', 'RETURN'));
    context.functionsSet.executeEndfunction();

    const fn = [...context.functionsSet.getFunctionsByName('$abs')][0]!;
    const memory = new TMemoryGlobal();
    const negResult = fn.executeReturnFunction(context, memory, line('$abs(-5)'), [TValue.fromInt(-5)], new Map());
    const posResult = fn.executeReturnFunction(context, memory, line('$abs(5)'), [TValue.fromInt(5)], new Map());
    expect(negResult.toInt()).toBe(5);
    expect(posResult.toInt()).toBe(5);
  });
});
