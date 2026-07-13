import { describe, expect, it } from 'vitest';
import { TMemoryGlobal } from '../../../../../src/core/tim/index.js';
import { line, runBody, TestTContext } from '../../../../helpers/tim-iterator-context.js';

describe('CodeIteratorProcedure', () => {
  it('collects a multi-line !procedure body up to !endprocedure', () => {
    const context = new TestTContext();
    const memory = new TMemoryGlobal();
    context.functionsSet.executeDeclareProcedure(context, memory, line('!procedure $p()', 'DECLARE_PROCEDURE'));
    const pending = context.functionsSet.pendingFunction()!;
    expect(pending.hasBody()).toBe(false);
    // `!global` scoping is required here: an unscoped assignment inside a
    // procedure call to a name that doesn't already exist anywhere becomes
    // a LOCAL variable, scoped to (and discarded with) that call frame --
    // see `TMemoryLocal.test.ts`'s "unscoped assignment to a name not yet
    // global creates a local variable". `!global` makes the write visible
    // on the caller's memory after the call returns.
    pending.addBody(line('!global $a = 1', 'AFFECTATION'));
    pending.addBody(line('!global $b = 2', 'AFFECTATION'));
    context.functionsSet.executeEndfunction();

    expect(context.functionsSet.pendingFunction()).toBeUndefined();
    const proc = [...context.functionsSet.getFunctionsByName('$p')][0]!;
    proc.executeProcedureInternal(context, memory, line('$p()'), [], new Map());
    expect(memory.getVariable('$a')?.toInt()).toBe(1);
    expect(memory.getVariable('$b')?.toInt()).toBe(2);
  });

  it('a header line with no parameters and default-valued args still declares correctly', () => {
    const context = new TestTContext();
    const memory = new TMemoryGlobal();
    context.functionsSet.executeDeclareProcedure(
      context,
      memory,
      line('!procedure $greet($name = "world")', 'DECLARE_PROCEDURE'),
    );
    const pending = context.functionsSet.pendingFunction()!;
    pending.addBody(line('!global $greeting = $name', 'AFFECTATION'));
    context.functionsSet.executeEndfunction();

    const proc = [...context.functionsSet.getFunctionsByName('$greet')][0]!;
    proc.executeProcedureInternal(context, memory, line('$greet()'), [], new Map());
    expect(memory.getVariable('$greeting')?.toString()).toBe('world');
  });

  it('detects a DECLARE_PROCEDURE line reached through executeLines, not just direct FunctionsSet calls', () => {
    const { context } = runBody([
      line('!procedure $inline()', 'DECLARE_PROCEDURE'),
      line('!global $ran = 1', 'AFFECTATION'),
      line('!endprocedure', 'END_FUNCTION'),
    ]);
    expect(context.functionsSet.doesFunctionExist('$inline')).toBe(true);
    expect(context.functionsSet.pendingFunction()).toBeUndefined();
  });
});
