/**
 * The line-location chain (SI6). Before this, `LineLocation` was an `unknown`
 * stand-in and `readLines` stored a bare array index, so no error could say
 * WHERE it happened. The error diagram reads these back to print
 * `[From <resource> (line N) ]`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/utils/LineLocationImpl.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/ReadLineReader.java
 */

import { describe, expect, it } from 'vitest';
import { LineLocationImpl } from '../../../../src/core/tim/LineLocationImpl.js';
import { readLines } from '../../../../src/core/tim/ReadLineReader.js';

describe('LineLocationImpl', () => {
  it('starts at -1, so the FIRST line read is position 0', () => {
    const start = new LineLocationImpl('string', undefined);
    expect(start.getPosition()).toBe(-1);
    expect(start.oneLineRead().getPosition()).toBe(0);
  });

  it('oneLineRead returns a new location; it does not mutate', () => {
    const start = new LineLocationImpl('string', undefined);
    start.oneLineRead().oneLineRead();
    expect(start.getPosition()).toBe(-1);
  });

  it('carries the description and the parent', () => {
    const parent = new LineLocationImpl('string', undefined).oneLineRead();
    const child = new LineLocationImpl('shared.iuml', parent).oneLineRead();
    expect(child.getDescription()).toBe('shared.iuml');
    expect(child.getParent()).toBe(parent);
    expect(parent.getParent()).toBeUndefined();
  });

  it('sorts a stdlib resource ahead of a local one', () => {
    const std = new LineLocationImpl('<c4/C4>', undefined, 9);
    const local = new LineLocationImpl('string', undefined, 1);
    expect(std.compareTo(local)).toBe(-1);
    expect(local.compareTo(std)).toBe(1);
  });

  it('otherwise sorts by position', () => {
    const a = new LineLocationImpl('string', undefined, 2);
    const b = new LineLocationImpl('string', undefined, 5);
    expect(a.compareTo(b)).toBe(-3);
  });
});

describe('readLines', () => {
  it('numbers lines from 0 and describes them as "string" by default', () => {
    const lines = readLines('a\nb\nc');
    expect(lines.map((s) => s.getLocation()?.getPosition())).toEqual([0, 1, 2]);
    expect(lines[0]?.getLocation()?.getDescription()).toBe('string');
  });

  it('describes included content by its target, parented on the !include line', () => {
    const includeLine = new LineLocationImpl('string', undefined, 4);
    const lines = readLines('x\ny', 'shared.iuml', includeLine);
    expect(lines[1]?.getLocation()?.getDescription()).toBe('shared.iuml');
    expect(lines[1]?.getLocation()?.getPosition()).toBe(1);
    expect(lines[1]?.getLocation()?.getParent()).toBe(includeLine);
  });

  it('still strips the BOM and normalizes the en-dash', () => {
    const lines = readLines('﻿a–b');
    expect(lines[0]?.getString()).toBe('a-b');
  });
});
