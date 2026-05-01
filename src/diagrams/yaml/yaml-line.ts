// Port of net.sourceforge.plantuml.yaml.parser.YamlLine and YamlLineType

export enum YamlLineType {
  EMPTY_LINE = 'EMPTY_LINE',
  NO_KEY_ONLY_TEXT = 'NO_KEY_ONLY_TEXT',
  KEY_ONLY = 'KEY_ONLY',
  KEY_AND_VALUE = 'KEY_AND_VALUE',
  KEY_AND_FLOW_SEQUENCE = 'KEY_AND_FLOW_SEQUENCE',
  KEY_AND_BLOCK_STYLE = 'KEY_AND_BLOCK_STYLE',
  KEY_AND_FOLDED_STYLE = 'KEY_AND_FOLDED_STYLE',
  PLAIN_ELEMENT_LIST = 'PLAIN_ELEMENT_LIST',
  PLAIN_DASH = 'PLAIN_DASH',
}

export interface YamlLine {
  readonly indent: number;
  readonly key: string | null;
  readonly value: string | null;
  readonly values: readonly string[] | null;
  readonly listItem: boolean;
  readonly type: YamlLineType;
}

// Strip inline and full-line YAML comments.
// Port of YamlLine.removeYamlComment().
function removeYamlComment(s: string): string {
  if (s.length === 0) return s;

  // A line that starts with '#' is entirely a comment.
  if (s.charAt(0) === '#') return '';

  let inQuoteChar = '\0';

  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);

    if (c === "'" || c === '"') {
      if (inQuoteChar === '\0') {
        inQuoteChar = c;
      } else if (c === inQuoteChar) {
        inQuoteChar = '\0';
      }
    }

    if (
      inQuoteChar === '\0' &&
      i < s.length - 1 &&
      c === ' ' &&
      s.charAt(i + 1) === '#'
    ) {
      return s.substring(0, i);
    }
  }

  return s;
}

// Find the first ':' outside quoted strings.
// Port of YamlLine.findColonSeparator().
function findColonSeparator(line: string): number {
  let inQuote = '\0';
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (inQuote !== '\0') {
      if (c === inQuote) inQuote = '\0';
    } else if (c === '"' || c === "'") {
      inQuote = c;
    } else if (c === ':') {
      return i;
    }
  }
  return -1;
}

// Strip surrounding matching quotes from a string.
// Port of YamlLine.unquote().
function unquote(str: string): string {
  if (str.length < 2) return str;
  const first = str.charAt(0);
  const last = str.charAt(str.length - 1);
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return str.substring(1, str.length - 1);
  }
  return str;
}

// Parse a comma-separated flow sequence value (content between '[' and ']').
// Port of YamlLine.toList().
function toList(rawValue: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotedString = '\0';
  let fieldStartWithQuote = false;

  for (let i = 0; i < rawValue.length; i++) {
    const c = rawValue.charAt(i);

    if (inQuotedString !== '\0') {
      // Inside a quoted string
      if (c === '\\') {
        if (i + 1 < rawValue.length) {
          current += rawValue.charAt(i + 1);
          i++;
        }
      } else if (c === inQuotedString) {
        inQuotedString = '\0';
      } else {
        current += c;
      }
    } else {
      // Outside a quoted string
      if (
        !fieldStartWithQuote &&
        current.trim() === '' &&
        (c === "'" || c === '"')
      ) {
        inQuotedString = c;
        fieldStartWithQuote = true;
        current = '';
      } else if (c === ',') {
        result.push(fieldStartWithQuote ? current : current.trim());
        current = '';
        fieldStartWithQuote = false;
      } else if (c === '\\') {
        if (i + 1 < rawValue.length) {
          current += rawValue.charAt(i + 1);
          i++;
        }
      } else {
        current += c;
      }
    }
  }

  // Emit the final field
  const last = fieldStartWithQuote ? current : current.trim();
  result.push(last);

  return result;
}

// Build a YamlLine from a raw input line.
// Port of YamlLine.build().
export function build(line: string): YamlLine {
  // Expand tabs to 4 spaces
  line = line.replaceAll('\t', '    ');

  // Count leading spaces
  let count = 0;
  while (count < line.length && line.charAt(count) === ' ') count++;

  // Extract content after leading whitespace and strip comments
  let trimmedLine = removeYamlComment(line.substring(count).trim());

  if (trimmedLine === '') {
    return {
      type: YamlLineType.EMPTY_LINE,
      indent: 0,
      key: null,
      value: null,
      values: null,
      listItem: false,
    };
  }

  // A bare "-" is a plain dash list entry
  if (trimmedLine === '-') {
    return {
      type: YamlLineType.PLAIN_DASH,
      indent: count + 1,
      key: null,
      value: null,
      values: null,
      listItem: true,
    };
  }

  const listItem = trimmedLine.startsWith('- ');

  if (listItem) {
    count += 2;
    trimmedLine = trimmedLine.substring(2);
  }

  const colonIndex = findColonSeparator(trimmedLine);

  if (colonIndex === -1) {
    if (listItem) {
      return {
        type: YamlLineType.PLAIN_ELEMENT_LIST,
        indent: count,
        key: null,
        value: unquote(trimmedLine),
        values: null,
        listItem: true,
      };
    }
    return {
      type: YamlLineType.NO_KEY_ONLY_TEXT,
      indent: count,
      key: null,
      value: unquote(trimmedLine),
      values: null,
      listItem: false,
    };
  }

  const rawKey = trimmedLine.substring(0, colonIndex).trim();
  const rawValue = trimmedLine.substring(colonIndex + 1).trim();

  if (rawValue === '') {
    return {
      type: YamlLineType.KEY_ONLY,
      indent: count,
      key: unquote(rawKey),
      value: null,
      values: null,
      listItem,
    };
  }

  if (rawValue === '|') {
    return {
      type: YamlLineType.KEY_AND_BLOCK_STYLE,
      indent: count,
      key: unquote(rawKey),
      value: null,
      values: null,
      listItem,
    };
  }

  if (rawValue === '>') {
    return {
      type: YamlLineType.KEY_AND_FOLDED_STYLE,
      indent: count,
      key: unquote(rawKey),
      value: null,
      values: null,
      listItem,
    };
  }

  if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    return {
      type: YamlLineType.KEY_AND_FLOW_SEQUENCE,
      indent: count,
      key: unquote(rawKey),
      value: null,
      values: toList(rawValue.substring(1, rawValue.length - 1)),
      listItem,
    };
  }

  return {
    type: YamlLineType.KEY_AND_VALUE,
    indent: count,
    key: unquote(rawKey),
    value: unquote(rawValue),
    values: null,
    listItem,
  };
}
