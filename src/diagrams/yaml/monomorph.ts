/**
 * Monomorph — a single YAML node that can be a scalar, list, or map.
 *
 * Ported from:
 *   net.sourceforge.plantuml.yaml.parser.Monomorph
 *   net.sourceforge.plantuml.yaml.parser.MonomorphType
 *   net.sourceforge.plantuml.yaml.parser.MonomorphToJson
 */

// ---------------------------------------------------------------------------
// MonomorphType
// ---------------------------------------------------------------------------

export type MonomorphType = 'UNDETERMINATE' | 'SCALAR' | 'LIST' | 'MAP';

// ---------------------------------------------------------------------------
// Monomorph
// ---------------------------------------------------------------------------

/**
 * A Monomorph represents a single YAML node that can be one of three
 * possible types: a scalar (string value), a list (ordered sequence),
 * or a map (key-value pairs).  It starts in an UNDETERMINATE state and
 * its type is fixed on first use (setValue, addInList, or putInMap).
 */
export class Monomorph {
  private _type: MonomorphType = 'UNDETERMINATE';
  private _value: string | null = null;
  private _list: Monomorph[] | null = null;
  private _map: Map<string, Monomorph> | null = null;

  get type(): MonomorphType {
    return this._type;
  }

  setValue(value: string): void {
    if (this._type === 'LIST' || this._type === 'MAP') {
      throw new Error(
        `Cannot setValue on a Monomorph of type ${this._type}`,
      );
    }
    this._value = value;
    this._list = null;
    this._map = null;
    this._type = 'SCALAR';
  }

  addInList(el: Monomorph): void {
    if (this._type === 'UNDETERMINATE') {
      this._list = [];
      this._type = 'LIST';
    } else if (this._type !== 'LIST') {
      throw new Error(
        `Cannot addInList on a Monomorph of type ${this._type}`,
      );
    }
    this._list!.push(el);
  }

  putInMap(key: string, val: Monomorph): void {
    if (this._type === 'UNDETERMINATE') {
      this._map = new Map<string, Monomorph>();
      this._type = 'MAP';
    } else if (this._type !== 'MAP') {
      throw new Error(
        `Cannot putInMap on a Monomorph of type ${this._type}`,
      );
    }
    this._map!.set(key, val);
  }

  getValue(): string {
    if (this._type !== 'SCALAR') {
      throw new Error('Not a scalar value.');
    }
    // _value is non-null when type is SCALAR
    return this._value!;
  }

  getElementAt(i: number): Monomorph {
    if (this._type !== 'LIST') {
      throw new Error('Not a list.');
    }
    const el = this._list![i];
    if (el === undefined) {
      throw new RangeError(`Index ${i} out of bounds (size ${this._list!.length})`);
    }
    return el;
  }

  getMapValue(key: string): Monomorph {
    if (this._type !== 'MAP') {
      throw new Error('Not a map.');
    }
    const val = this._map!.get(key);
    if (val === undefined) {
      throw new Error(`Key not found in map: ${key}`);
    }
    return val;
  }

  keys(): IterableIterator<string> {
    if (this._type !== 'MAP') {
      throw new Error('Not a map.');
    }
    return this._map!.keys();
  }

  size(): number {
    if (this._type === 'LIST') {
      return this._list!.length;
    }
    if (this._type === 'MAP') {
      return this._map!.size;
    }
    throw new Error('Not a container type.');
  }

  static scalar(value: string): Monomorph {
    const m = new Monomorph();
    m.setValue(value);
    return m;
  }

  static list(items: string[]): Monomorph {
    const m = new Monomorph();
    // Force LIST type even for empty input, matching Java behaviour
    m._list = [];
    m._type = 'LIST';
    for (const item of items) {
      m.addInList(Monomorph.scalar(item));
    }
    return m;
  }
}

// ---------------------------------------------------------------------------
// monomorphToJson
// ---------------------------------------------------------------------------

/**
 * Convert a Monomorph tree to a plain JS value suitable for JSON serialisation.
 *
 * Ported from MonomorphToJson.convert / convertToArray / convertToObject.
 *
 * Return type is `unknown` because JsonDiagramAST.root is typed as `unknown`.
 */
export function monomorphToJson(input: Monomorph): unknown {
  switch (input.type) {
    case 'SCALAR':
      return input.getValue();

    case 'LIST':
      return convertToArray(input);

    case 'MAP':
      return convertToObject(input);

    case 'UNDETERMINATE':
      return null;
  }
}

function convertToArray(input: Monomorph): unknown[] {
  const result: unknown[] = [];
  for (let i = 0; i < input.size(); i++) {
    const element = input.getElementAt(i);
    switch (element.type) {
      case 'SCALAR':
        result.push(element.getValue());
        break;
      case 'MAP':
        result.push(convertToObject(element));
        break;
      case 'LIST':
        throw new Error('LIST-of-LIST not supported');
      case 'UNDETERMINATE':
        throw new Error('LIST element is UNDETERMINATE');
    }
  }
  return result;
}

function convertToObject(input: Monomorph): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const key of input.keys()) {
    const element = input.getMapValue(key);
    switch (element.type) {
      case 'SCALAR':
        obj[key] = element.getValue();
        break;
      case 'MAP':
        obj[key] = convertToObject(element);
        break;
      case 'LIST':
        obj[key] = convertToArray(element);
        break;
      case 'UNDETERMINATE':
        throw new Error('MAP value is UNDETERMINATE');
    }
  }
  return obj;
}
