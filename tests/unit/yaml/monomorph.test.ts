import { describe, expect, it } from 'vitest';
import { Monomorph, monomorphToJson } from '../../../src/diagrams/yaml/monomorph.js';

// ---------------------------------------------------------------------------
// Monomorph — class behaviour
// ---------------------------------------------------------------------------

describe('Monomorph', () => {
  // 1. Scalar: setValue, type, getValue
  it('transitions to SCALAR on setValue and returns the value', () => {
    const m = new Monomorph();
    m.setValue('hello');
    expect(m.type).toBe('SCALAR');
    expect(m.getValue()).toBe('hello');
  });

  // 2. SCALAR → SCALAR (multiline continuation)
  it('allows setValue on an existing SCALAR (overwrites value)', () => {
    const m = new Monomorph();
    m.setValue('a');
    expect(() => m.setValue('b')).not.toThrow();
    expect(m.getValue()).toBe('b');
  });

  // 3. Monomorph.scalar factory
  it('Monomorph.scalar creates a SCALAR with the given value', () => {
    const m = Monomorph.scalar('x');
    expect(m.type).toBe('SCALAR');
    expect(m.getValue()).toBe('x');
  });

  // 4. List: addInList, size, getElementAt
  it('transitions to LIST on addInList and tracks elements', () => {
    const m = new Monomorph();
    m.addInList(Monomorph.scalar('a'));
    m.addInList(Monomorph.scalar('b'));
    expect(m.type).toBe('LIST');
    expect(m.size()).toBe(2);
    expect(m.getElementAt(0).getValue()).toBe('a');
    expect(m.getElementAt(1).getValue()).toBe('b');
  });

  // 5. Monomorph.list factory
  it('Monomorph.list creates a LIST with two scalars', () => {
    const m = Monomorph.list(['x', 'y']);
    expect(m.type).toBe('LIST');
    expect(m.size()).toBe(2);
    expect(m.getElementAt(0).getValue()).toBe('x');
    expect(m.getElementAt(1).getValue()).toBe('y');
  });

  // 6. Map: putInMap, getMapValue
  it('transitions to MAP on putInMap and retrieves values by key', () => {
    const m = new Monomorph();
    m.putInMap('k', Monomorph.scalar('v'));
    expect(m.type).toBe('MAP');
    expect(m.getMapValue('k').getValue()).toBe('v');
  });

  // 7. setValue on MAP throws
  it('throws when setValue is called on a MAP', () => {
    const m = new Monomorph();
    m.putInMap('k', Monomorph.scalar('v'));
    expect(() => m.setValue('oops')).toThrow();
  });

  // 8. setValue on LIST throws
  it('throws when setValue is called on a LIST', () => {
    const m = new Monomorph();
    m.addInList(Monomorph.scalar('a'));
    expect(() => m.setValue('oops')).toThrow();
  });

  // 9. addInList on SCALAR throws
  it('throws when addInList is called on a SCALAR', () => {
    const m = Monomorph.scalar('hello');
    expect(() => m.addInList(Monomorph.scalar('boom'))).toThrow();
  });

  // 10. putInMap on SCALAR throws
  it('throws when putInMap is called on a SCALAR', () => {
    const m = Monomorph.scalar('hello');
    expect(() => m.putInMap('k', Monomorph.scalar('boom'))).toThrow();
  });

  // getMapValue on non-MAP throws
  it('throws when getMapValue is called on a non-MAP', () => {
    const m = Monomorph.scalar('x');
    expect(() => m.getMapValue('k')).toThrow();
  });

  // getMapValue with missing key throws
  it('throws when getMapValue is called with a missing key', () => {
    const m = new Monomorph();
    m.putInMap('k', Monomorph.scalar('v'));
    expect(() => m.getMapValue('missing')).toThrow();
  });

  // size() on MAP
  it('size() returns the number of keys in a MAP', () => {
    const m = new Monomorph();
    m.putInMap('a', Monomorph.scalar('1'));
    m.putInMap('b', Monomorph.scalar('2'));
    expect(m.size()).toBe(2);
  });

  // 16. keys() on non-MAP throws
  it('throws when keys() is called on a non-MAP', () => {
    const m = Monomorph.scalar('x');
    expect(() => [...m.keys()]).toThrow();
  });

  // 17. size() on SCALAR throws
  it('throws when size() is called on a SCALAR', () => {
    const m = Monomorph.scalar('x');
    expect(() => m.size()).toThrow();
  });
});

// ---------------------------------------------------------------------------
// monomorphToJson
// ---------------------------------------------------------------------------

describe('monomorphToJson', () => {
  // 11. UNDETERMINATE → null
  it('returns null for an UNDETERMINATE Monomorph', () => {
    expect(monomorphToJson(new Monomorph())).toBeNull();
  });

  // 12. SCALAR → string
  it('returns the string value for a SCALAR', () => {
    expect(monomorphToJson(Monomorph.scalar('hello'))).toBe('hello');
  });

  // 13. LIST → array of strings
  it('converts a LIST of scalars to a plain JS array', () => {
    expect(monomorphToJson(Monomorph.list(['a', 'b']))).toEqual(['a', 'b']);
  });

  // 14. MAP preserves insertion order
  it('preserves insertion order of MAP keys', () => {
    const m = new Monomorph();
    m.putInMap('a', Monomorph.scalar('1'));
    m.putInMap('b', Monomorph.scalar('2'));
    m.putInMap('c', Monomorph.scalar('3'));
    const result = monomorphToJson(m) as Record<string, unknown>;
    expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
  });

  // 15. MAP with nested MAP
  it('recursively converts nested MAPs', () => {
    const inner = new Monomorph();
    inner.putInMap('inner', Monomorph.scalar('val'));

    const outer = new Monomorph();
    outer.putInMap('outer', inner);

    expect(monomorphToJson(outer)).toEqual({ outer: { inner: 'val' } });
  });

  // MAP with LIST value: {tags: ['a', 'b']}
  it('converts a MAP containing a LIST value to a plain object with array', () => {
    const m = new Monomorph();
    m.putInMap('tags', Monomorph.list(['a', 'b']));
    expect(monomorphToJson(m)).toEqual({ tags: ['a', 'b'] });
  });

  // LIST containing a MAP element
  it('converts a LIST containing a MAP element', () => {
    const mapEl = new Monomorph();
    mapEl.putInMap('k', Monomorph.scalar('v'));

    const list = new Monomorph();
    list.addInList(Monomorph.scalar('first'));
    list.addInList(mapEl);

    expect(monomorphToJson(list)).toEqual(['first', { k: 'v' }]);
  });

  // LIST-of-LIST throws
  it('throws when a LIST contains a LIST element', () => {
    const inner = Monomorph.list(['x']);
    const outer = new Monomorph();
    outer.addInList(inner);

    expect(() => monomorphToJson(outer)).toThrow('LIST-of-LIST not supported');
  });

  // UNDETERMINATE element inside LIST throws
  it('throws when a LIST contains an UNDETERMINATE element', () => {
    const list = new Monomorph();
    list.addInList(new Monomorph());

    expect(() => monomorphToJson(list)).toThrow();
  });

  // UNDETERMINATE value inside MAP throws
  it('throws when a MAP contains an UNDETERMINATE value', () => {
    const m = new Monomorph();
    m.putInMap('k', new Monomorph());

    expect(() => monomorphToJson(m)).toThrow();
  });
});
