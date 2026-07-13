import { describe, expect, it } from 'vitest';
import { line, runBody } from '../../../../helpers/tim-iterator-context.js';

describe('CodeIteratorWhile error paths', () => {
  it('!endwhile with no matching !while throws', () => {
    expect(() => runBody([line('!endwhile', 'ENDWHILE')])).toThrow('No while related to this endwhile');
  });

  it('a !while that is false from the start never runs its body', () => {
    const { memory } = runBody([
      line('!while 0', 'WHILE'),
      line('!$hit = 1', 'AFFECTATION'),
      line('!endwhile', 'ENDWHILE'),
    ]);
    expect(memory.getVariable('$hit')).toBeUndefined();
  });

  it('nested !while inside a skipped outer !while does not desync the skip-level tracking', () => {
    const { memory } = runBody([
      line('!while 0', 'WHILE'),
      line('!while 1', 'WHILE'),
      line('!$inner = 1', 'AFFECTATION'),
      line('!endwhile', 'ENDWHILE'),
      line('!endwhile', 'ENDWHILE'),
      line('!$after = 1', 'AFFECTATION'),
    ]);
    expect(memory.getVariable('$inner')).toBeUndefined();
    expect(memory.getVariable('$after')?.toInt()).toBe(1);
  });
});
