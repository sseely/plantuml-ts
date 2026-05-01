import { describe, expect, it } from 'vitest';
import { YamlBuilder } from '../../../src/diagrams/yaml/yaml-builder.js';
import { monomorphToJson } from '../../../src/diagrams/yaml/monomorph.js';

describe('YamlBuilder', () => {
  // 1. Simple key-value
  it('onKeyAndValue produces a single-key map', () => {
    const b = new YamlBuilder();
    b.onKeyAndValue('fruit', 'Apple');
    expect(monomorphToJson(b.getResult())).toEqual({ fruit: 'Apple' });
  });

  // 2. Multiple key-values at root
  it('multiple onKeyAndValue calls produce a multi-key map', () => {
    const b = new YamlBuilder();
    b.onKeyAndValue('a', '1');
    b.onKeyAndValue('b', '2');
    expect(monomorphToJson(b.getResult())).toEqual({ a: '1', b: '2' });
  });

  // 3. Nested object via adjustIndentation + onOnlyKey
  it('onOnlyKey with deeper indent produces a nested map', () => {
    const b = new YamlBuilder();
    b.onKeyAndValue('a', '1');
    b.adjustIndentation(0);
    b.onOnlyKey('b');
    b.adjustIndentation(2);
    b.onKeyAndValue('c', '3');
    expect(monomorphToJson(b.getResult())).toEqual({ a: '1', b: { c: '3' } });
  });

  // 4. Simple list via onListItemOnlyValue
  it('onListItemOnlyValue builds a scalar list at root', () => {
    const b = new YamlBuilder();
    b.onListItemOnlyValue('x');
    b.onListItemOnlyValue('y');
    expect(monomorphToJson(b.getResult())).toEqual(['x', 'y']);
  });

  // 5. Plain dash (empty list items) — elements remain UNDETERMINATE
  //    monomorphToJson throws on UNDETERMINATE list elements, so we verify
  //    the structure directly.
  it('onListItemPlainDash produces a LIST of UNDETERMINATE elements', () => {
    const b = new YamlBuilder();
    b.onListItemPlainDash();
    b.onListItemPlainDash();
    const root = b.getResult();
    expect(root.type).toBe('LIST');
    expect(root.size()).toBe(2);
    expect(root.getElementAt(0).type).toBe('UNDETERMINATE');
    expect(root.getElementAt(1).type).toBe('UNDETERMINATE');
  });

  // 6. Flow sequence value
  it('onKeyAndFlowSequence produces a list value for a key', () => {
    const b = new YamlBuilder();
    b.onKeyAndFlowSequence('tags', ['a', 'b', 'c']);
    expect(monomorphToJson(b.getResult())).toEqual({ tags: ['a', 'b', 'c'] });
  });

  // 7. List of key-value objects at same indent level
  it('two onListItemKeyAndValue at same indent produce separate list elements', () => {
    const b = new YamlBuilder();
    b.adjustIndentation(2);
    b.onListItemKeyAndValue('name', 'Mark');
    b.adjustIndentation(2);
    b.onListItemKeyAndValue('hr', '65');
    expect(monomorphToJson(b.getResult())).toEqual([
      { name: 'Mark' },
      { hr: '65' },
    ]);
  });

  // 8. List item with only key (nested structure)
  it('onListItemOnlyKey followed by onKeyAndValue nests inside the list element', () => {
    const b = new YamlBuilder();
    b.adjustIndentation(2);
    b.onListItemOnlyKey('name');
    b.adjustIndentation(4);
    b.onKeyAndValue('first', 'John');
    expect(monomorphToJson(b.getResult())).toEqual([
      { name: { first: 'John' } },
    ]);
  });

  // 9. Indent decrease pops stack — subsequent events go to root level
  it('adjustIndentation decrease pops the stack so events target the correct level', () => {
    const b = new YamlBuilder();
    b.adjustIndentation(0);
    b.onOnlyKey('nested');
    b.adjustIndentation(2);
    b.onKeyAndValue('inner', 'val');
    // Return to root indent — the next key should be at root
    b.adjustIndentation(0);
    b.onKeyAndValue('top', 'level');
    expect(monomorphToJson(b.getResult())).toEqual({
      nested: { inner: 'val' },
      top: 'level',
    });
  });

  // 10. isArrayAlreadyThere prevents double-pushing — consecutive list items
  //     at the same indent share one parent list, not two
  it('consecutive list items at same indent share the same parent list', () => {
    const b = new YamlBuilder();
    b.adjustIndentation(2);
    b.onListItemOnlyValue('first');
    b.adjustIndentation(2);
    b.onListItemOnlyValue('second');
    const root = b.getResult();
    // root should be a LIST (not a MAP wrapping two separate lists)
    expect(root.type).toBe('LIST');
    expect(root.size()).toBe(2);
    expect(monomorphToJson(root)).toEqual(['first', 'second']);
  });

  // 11. onListItemKeyAndFlowSequence
  it('onListItemKeyAndFlowSequence produces a list element with a flow-sequence value', () => {
    const b = new YamlBuilder();
    b.adjustIndentation(2);
    b.onListItemKeyAndFlowSequence('tags', ['x', 'y']);
    expect(monomorphToJson(b.getResult())).toEqual([{ tags: ['x', 'y'] }]);
  });

  // 12. getResult() before any events — root is UNDETERMINATE
  it('getResult() before any events returns an UNDETERMINATE root', () => {
    const b = new YamlBuilder();
    expect(b.getResult().type).toBe('UNDETERMINATE');
    expect(monomorphToJson(b.getResult())).toBeNull();
  });

  // 13. adjustIndentation LIST-pop branch — when popping out of a list
  //     sub-structure back to the parent scope, the list's current element
  //     is also popped so the next sibling key goes to the correct parent.
  //
  //     YAML modelled:
  //       outer:       <- indent 0, onOnlyKey("outer")
  //         - key: v   <- indent 2, onListItemKeyAndValue("key","v")
  //       next: thing  <- indent 0, adjustIndentation(0) triggers LIST pop
  it('adjustIndentation pops the current list element when returning past a LIST parent', () => {
    const b = new YamlBuilder();
    b.adjustIndentation(0);
    b.onOnlyKey('outer');
    b.adjustIndentation(2);
    b.onListItemKeyAndValue('key', 'v');
    // Now pop back to indent 0 — getLast after first pair of pops is
    // outerVal which is a LIST, so the LIST-pop branch must fire.
    b.adjustIndentation(0);
    b.onKeyAndValue('next', 'thing');
    expect(monomorphToJson(b.getResult())).toEqual({
      outer: [{ key: 'v' }],
      next: 'thing',
    });
  });
});
