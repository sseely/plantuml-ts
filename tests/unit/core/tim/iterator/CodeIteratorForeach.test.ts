import { describe, expect, it } from 'vitest';
import { EaterException } from '../../../../../src/core/tim/index.js';
import { line, runBody } from '../../../../helpers/tim-iterator-context.js';

describe('CodeIteratorForeach', () => {
  it('!endforeach with no matching !foreach throws', () => {
    expect(() => runBody([line('!endforeach', 'ENDFOREACH')])).toThrow(EaterException);
    expect(() => runBody([line('!endforeach', 'ENDFOREACH')])).toThrow(
      'No foreach related to this endforeach',
    );
  });

  it('a !foreach over an empty array never runs its body', () => {
    const { memory } = runBody([
      line('!foreach $x in []', 'FOREACH'),
      line('!$hit = 1', 'AFFECTATION'),
      line('!endforeach', 'ENDFOREACH'),
    ]);
    expect(memory.getVariable('$hit')).toBeUndefined();
  });

  it('a nested !foreach inside a skipped (empty-source) outer !foreach does not desync skip-level tracking', () => {
    const { memory } = runBody([
      line('!foreach $outer in []', 'FOREACH'),
      line('!foreach $inner in [1,2,3]', 'FOREACH'),
      line('!$hit = $hit + 1', 'AFFECTATION'),
      line('!endforeach', 'ENDFOREACH'),
      line('!endforeach', 'ENDFOREACH'),
      line('!$after = 1', 'AFFECTATION'),
    ]);
    // The outer foreach is empty, so the inner loop must never actually
    // run -- if the skip-level counter mis-tracked the nested FOREACH/
    // ENDFOREACH pair, either the inner loop would spuriously execute, or
    // the outer skip would terminate early/late and leave $after unset.
    expect(memory.getVariable('$hit')).toBeUndefined();
    expect(memory.getVariable('$after')?.toInt()).toBe(1);
  });
});
