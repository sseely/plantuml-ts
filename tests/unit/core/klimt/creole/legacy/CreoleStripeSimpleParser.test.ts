/**
 * CreoleStripeSimpleParser.test.ts — E2r/L1: `classifyStripeLine`'s regex
 * cascade (HORIZONTAL_LINE bare/empty, LITERAL non-empty-captured, HEADING,
 * NORMAL fallback).
 */
import { describe, expect, test } from 'vitest';
import { classifyStripeLine } from '../../../../../../src/core/klimt/creole/legacy/CreoleStripeSimpleParser.js';

describe('classifyStripeLine — HORIZONTAL_LINE (bare, empty capture)', () => {
  test('a bare "----" classifies as HORIZONTAL_LINE style "-"', () => {
    expect(classifyStripeLine('----')).toEqual({ type: 'HORIZONTAL_LINE', style: '-' });
  });

  test('a bare "===="  classifies as HORIZONTAL_LINE style "="', () => {
    expect(classifyStripeLine('====')).toEqual({ type: 'HORIZONTAL_LINE', style: '=' });
  });

  test('a longer all-equals run "=====" classifies as HORIZONTAL_LINE style "=" (SECTION_SEPARATOR_PATTERN)', () => {
    expect(classifyStripeLine('=====')).toEqual({ type: 'HORIZONTAL_LINE', style: '=' });
  });

  test('a bare "...." classifies as HORIZONTAL_LINE style "."', () => {
    expect(classifyStripeLine('....')).toEqual({ type: 'HORIZONTAL_LINE', style: '.' });
  });

  test('a 3-char "===" is too short for any separator pattern -- falls to NORMAL', () => {
    expect(classifyStripeLine('===')).toEqual({ type: 'HEADING', content: '=', order: 1 });
  });

  test('a 5-dash run "-----" matches no separator pattern ([^-]* excludes the delimiter char) -- NORMAL', () => {
    expect(classifyStripeLine('-----')).toEqual({ type: 'NORMAL', content: '-----' });
  });
});

describe('classifyStripeLine — LITERAL (non-empty-captured separator shape)', () => {
  test('"--Header--" classifies as LITERAL with the full original line', () => {
    expect(classifyStripeLine('--Header--')).toEqual({ type: 'LITERAL', content: '--Header--' });
  });

  test('"==Header==" classifies as LITERAL with the full original line', () => {
    expect(classifyStripeLine('==Header==')).toEqual({ type: 'LITERAL', content: '==Header==' });
  });

  test('"..Header.." classifies as LITERAL with the full original line', () => {
    expect(classifyStripeLine('..Header..')).toEqual({ type: 'LITERAL', content: '..Header..' });
  });
});

describe('classifyStripeLine — HEADING (I4c mechanism 2/5)', () => {
  test('"==P2" (single leading run, no trailing ==) classifies as HEADING order 1', () => {
    expect(classifyStripeLine('==P2')).toEqual({ type: 'HEADING', content: 'P2', order: 1 });
  });

  test('"=Top" (order 0) classifies as HEADING order 0', () => {
    expect(classifyStripeLine('=Top')).toEqual({ type: 'HEADING', content: 'Top', order: 0 });
  });

  test('"===Deep" (order 2) classifies as HEADING order 2', () => {
    expect(classifyStripeLine('===Deep')).toEqual({ type: 'HEADING', content: 'Deep', order: 2 });
  });

  test('"====Deeper" (order 3, beyond the bold/bigger cases) classifies as HEADING order 3', () => {
    expect(classifyStripeLine('====Deeper')).toEqual({ type: 'HEADING', content: 'Deeper', order: 3 });
  });

  test('trims only <= U+0020 whitespace off the captured content, not NBSP', () => {
    expect(classifyStripeLine('==  P2 ')).toEqual({ type: 'HEADING', content: ' P2', order: 1 });
  });

  test('"==P3 with a long name" (I4c mechanism 5 fixture text) classifies as HEADING order 1', () => {
    expect(classifyStripeLine('==P3 with a long name')).toEqual({
      type: 'HEADING',
      content: 'P3 with a long name',
      order: 1,
    });
  });
});

describe('classifyStripeLine — NORMAL fallback', () => {
  test('plain text with no creole markers classifies as NORMAL, content unchanged', () => {
    expect(classifyStripeLine('plain text')).toEqual({ type: 'NORMAL', content: 'plain text' });
  });

  test('an empty line classifies as NORMAL with empty content', () => {
    expect(classifyStripeLine('')).toEqual({ type: 'NORMAL', content: '' });
  });

  test('"**bold**" classifies as NORMAL (style commands are a StripeSimple concern, not classification)', () => {
    expect(classifyStripeLine('**bold**')).toEqual({ type: 'NORMAL', content: '**bold**' });
  });
});
