import { describe, expect, it } from 'vitest';
import { TFunctionType } from '../../../../../src/core/tim/index.js';
import { TValue } from '../../../../../src/core/tim/expression/index.js';
import { line, runBody } from '../../../../helpers/tim-iterator-context.js';

describe('smoke: TestTContext harness', () => {
  it('runs a plain affectation', () => {
    const { memory } = runBody([line('!$x = 3', 'AFFECTATION')]);
    expect(memory.getVariable('$x')?.toInt()).toBe(3);
  });

  it('runs !if true branch', () => {
    const { memory } = runBody([
      line('!if 1', 'IF'),
      line('!$x = 10', 'AFFECTATION'),
      line('!endif', 'ENDIF'),
    ]);
    expect(memory.getVariable('$x')?.toInt()).toBe(10);
  });

  it('runs !if false branch (skipped)', () => {
    const { memory } = runBody([
      line('!if 0', 'IF'),
      line('!$x = 10', 'AFFECTATION'),
      line('!endif', 'ENDIF'),
    ]);
    expect(memory.getVariable('$x')).toBeUndefined();
  });

  it('runs !foreach over a JSON array (loop var is JSON-typed, per upstream)', () => {
    const { memory } = runBody([
      line('!foreach $i in [1,2,3]', 'FOREACH'),
      line('!$last = $i', 'AFFECTATION'),
      line('!endforeach', 'ENDFOREACH'),
    ]);
    // Upstream binds the loop variable via `TValue.fromJson`, so `.toInt()`
    // (which reads the plain-int field, always 0 for a JSON-typed value)
    // is not the right accessor here -- `.toString()` renders the JSON
    // value, matching how `%last%`-style output would actually print it.
    expect(memory.getVariable('$last')?.toString()).toBe('3');
  });

  it('runs !while', () => {
    const { memory } = runBody([
      line('!$n = 0', 'AFFECTATION'),
      line('!while $n < 3', 'WHILE'),
      line('!$n = $n + 1', 'AFFECTATION'),
      line('!endwhile', 'ENDWHILE'),
    ]);
    expect(memory.getVariable('$n')?.toInt()).toBe(3);
  });

  it('runs a return function', () => {
    const { result } = runBody(
      [line('!return 42', 'RETURN')],
      TFunctionType.RETURN_FUNCTION,
      true,
    );
    expect(result).toBeInstanceOf(TValue);
    expect(result?.toInt()).toBe(42);
  });
});
