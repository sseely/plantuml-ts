import { describe, expect, it } from 'vitest';
import { line, runBody } from '../../../../helpers/tim-iterator-context.js';
import { EaterException } from '../../../../../src/core/tim/EaterException.js';

describe('CodeIteratorIf orphan directives (SI6: an error, as upstream has it)', () => {
  // SI5a shipped these three as NO-OPS, because a faithful throw had nowhere to
  // land: `renderSync` would have propagated it to the caller. SI6 built the
  // error-diagram path (`src/core/error/`), so the throw is now what the jar
  // does -- render `No if related to this <directive>` -- and the divergence is
  // retired. Live-oracle verified against `oracle/dist/plantuml-oracle.jar`.
  it('!endif with no matching !if throws No if related to this endif', () => {
    expect(() => runBody([line('!endif', 'ENDIF')])).toThrow('No if related to this endif');
  });

  it('!else with no matching !if throws No if related to this else', () => {
    expect(() => runBody([line('!else', 'ELSE')])).toThrow('No if related to this else');
  });

  it('!elseif with no matching !if throws No if related to this elseif', () => {
    expect(() => runBody([line('!elseif 1', 'ELSEIF')])).toThrow(
      'No if related to this elseif',
    );
  });

  it('the throw is an EaterException, so it carries the offending line', () => {
    expect(() => runBody([line('!endif', 'ENDIF')])).toThrow(EaterException);
  });
});

describe('CodeIteratorIf — an UNCLOSED !ifdef is NOT an orphan directive', () => {
  // The two cases must not be conflated. An orphan `!endif` errors; an `!ifdef`
  // left unclosed at EOF is TOLERATED by the jar and renders normally (verified
  // against the oracle, and on pdiff fixture buveco-86-tibo673 -- itself a
  // PlantUML bug report, forum.plantuml.net/6808). Nothing in
  // `getRequiredIfContext` can fire for it: the unclosed context stays ON the
  // if-stack, so no directive ever finds the stack empty.
  it('a TRUE unclosed !ifdef executes its body and does not throw', () => {
    const { memory } = runBody([
      line('!define FOO', 'AFFECTATION_DEFINE'),
      line('!ifdef FOO', 'IFDEF'),
      line('!$x = 1', 'AFFECTATION'),
    ]);
    expect(memory.getVariable('$x')?.toString()).toBe('1');
  });

  it('a FALSE unclosed !ifdef suppresses the rest of the document and does not throw', () => {
    const { memory } = runBody([
      line('!ifdef NEVER', 'IFDEF'),
      line('!$x = 1', 'AFFECTATION'),
    ]);
    expect(memory.getVariable('$x')).toBeUndefined();
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
