import { describe, expect, it } from 'vitest';
import { line, runBody } from '../../../../helpers/tim-iterator-context.js';

describe('CodeIteratorIf orphan-directive tolerance', () => {
  // PLANTUML-TS DIVERGENCE (see CodeIteratorIf#getRequiredIfContext). Upstream
  // throws EaterException("No if related to this else/elseif/endif") for an
  // orphan directive. plantuml-ts's pre-TIM preprocessor no-oped on all three,
  // and `tests/unit/preprocessor.test.ts` ("!else with no enclosing conditional
  // is a no-op") pins that as observable `preprocess()` behavior -- this port
  // has no error-diagram path, so throwing would escape `renderSync` as an
  // exception on documents the library previously rendered. These three tests
  // (batch SI5a-2b) asserted the upstream throw and are re-pinned to the
  // divergence the cutover had to preserve. FLAGGED FOR THE MAINTAINER: this is
  // leniency the jar does not have.
  it('!endif with no matching !if is a no-op', () => {
    expect(() => runBody([line('!endif', 'ENDIF')])).not.toThrow();
  });

  it('!else with no matching !if is a no-op', () => {
    expect(() => runBody([line('!else', 'ELSE')])).not.toThrow();
  });

  it('!elseif with no matching !if is a no-op', () => {
    expect(() => runBody([line('!elseif 1', 'ELSEIF')])).not.toThrow();
  });
});

describe('CodeIteratorIf', () => {
  it('a false !if suppresses everything up to !endif, including a nested !if', () => {
    const { memory } = runBody([
      line('!if 0', 'IF'),
      line('!if 1', 'IF'),
      line('!$x = 1', 'AFFECTATION'),
      line('!endif', 'ENDIF'),
      line('!endif', 'ENDIF'),
    ]);
    expect(memory.getVariable('$x')).toBeUndefined();
  });

  it('!else only fires when no prior branch was taken', () => {
    const { memory } = runBody([
      line('!if 1', 'IF'),
      line('!$x = "if"', 'AFFECTATION'),
      line('!else', 'ELSE'),
      line('!$x = "else"', 'AFFECTATION'),
      line('!endif', 'ENDIF'),
    ]);
    expect(memory.getVariable('$x')?.toString()).toBe('if');
  });

  it('!else fires when the !if was false', () => {
    const { memory } = runBody([
      line('!if 0', 'IF'),
      line('!$x = "if"', 'AFFECTATION'),
      line('!else', 'ELSE'),
      line('!$x = "else"', 'AFFECTATION'),
      line('!endif', 'ENDIF'),
    ]);
    expect(memory.getVariable('$x')?.toString()).toBe('else');
  });
});

describe('CodeIteratorIf via EaterIfdef/EaterIfndef directives', () => {
  it('!ifdef true branch runs when the variable is set', () => {
    const { memory } = runBody([
      line('!$existing = 1', 'AFFECTATION'),
      line('!ifdef $existing', 'IFDEF'),
      line('!$hit = 1', 'AFFECTATION'),
      line('!endif', 'ENDIF'),
    ]);
    expect(memory.getVariable('$hit')?.toInt()).toBe(1);
  });

  it('!ifndef true branch runs when the variable is unset', () => {
    const { memory } = runBody([
      line('!ifndef nope', 'IFNDEF'),
      line('!$hit = 1', 'AFFECTATION'),
      line('!endif', 'ENDIF'),
    ]);
    expect(memory.getVariable('$hit')?.toInt()).toBe(1);
  });
});
