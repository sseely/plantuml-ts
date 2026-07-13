import { describe, expect, it } from 'vitest';
import { EaterException } from '../../../../../src/core/tim/index.js';
import { line, runBody } from '../../../../helpers/tim-iterator-context.js';

describe('CodeIteratorIf error paths', () => {
  it('!endif with no matching !if throws', () => {
    expect(() => runBody([line('!endif', 'ENDIF')])).toThrow(EaterException);
    expect(() => runBody([line('!endif', 'ENDIF')])).toThrow('No if related to this endif');
  });

  it('!else with no matching !if throws', () => {
    expect(() => runBody([line('!else', 'ELSE')])).toThrow('No if related to this else');
  });

  it('!elseif with no matching !if throws', () => {
    expect(() => runBody([line('!elseif 1', 'ELSEIF')])).toThrow('No if related to this elseif');
  });

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
