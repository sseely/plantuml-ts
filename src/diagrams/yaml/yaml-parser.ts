// Port of net.sourceforge.plantuml.yaml.parser.YamlParser

import { build, YamlLineType } from './yaml-line.js';
import { YamlBuilder } from './yaml-builder.js';
import type { Monomorph } from './monomorph.js';

export class YamlSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YamlSyntaxError';
  }
}

export function parseYamlLines(lines: string[]): Monomorph {
  const builder = new YamlBuilder();
  let i = 0;

  // Look ahead from current i without advancing i.
  // Skip EMPTY_LINE tokens and return the first non-empty YamlLine, or null.
  // Port of YamlParser.peekNext().
  function peekNext() {
    let j = i; // i has already been incremented past the current line
    while (j < lines.length) {
      const line = build(lines[j]!);
      if (line.type !== YamlLineType.EMPTY_LINE) return line;
      j++;
    }
    return null;
  }

  // Advance i past EMPTY_LINEs and NO_KEY_ONLY_TEXT lines, collecting
  // the text of NO_KEY_ONLY_TEXT lines into a space-joined string.
  // Port of YamlParser.peekNextOnlyText().
  function peekNextOnlyText(): string {
    const parts: string[] = [];
    while (i < lines.length) {
      const line = build(lines[i]!);
      if (line.type === YamlLineType.EMPTY_LINE) {
        i++;
        continue;
      }
      if (line.type === YamlLineType.NO_KEY_ONLY_TEXT) {
        parts.push(line.value!);
        i++;
      } else {
        break;
      }
    }
    return parts.join(' ');
  }

  // Collect subsequent lines that are EMPTY_LINE or NO_KEY_ONLY_TEXT with
  // indent > the current key's indent. Advance i past each consumed line.
  // Port of YamlParser.getBlockStyleString().
  function getBlockStyleString(indent: number): string {
    const parts: string[] = [];
    while (i < lines.length) {
      const line = build(lines[i]!);
      if (line.type === YamlLineType.EMPTY_LINE) {
        i++;
        // empty lines within block scalar are preserved as empty entries
        parts.push('');
        continue;
      }
      if (
        line.type === YamlLineType.NO_KEY_ONLY_TEXT &&
        line.indent > indent
      ) {
        parts.push(line.value!.trim());
        i++;
      } else {
        break;
      }
    }
    // Trim trailing empty entries, then join with \n + trailing \n
    while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
    return parts.join('\n') + (parts.length > 0 ? '\n' : '');
  }

  while (i < lines.length) {
    const raw = lines[i]!;
    const yamlLine = build(raw);
    i++;

    // 1. Skip empty lines
    if (yamlLine.type === YamlLineType.EMPTY_LINE) continue;

    // 2. Bare text at root level (not a list item) is a syntax error.
    //    Port of the Java YamlSyntaxException for NO_KEY_ONLY_TEXT.
    if (
      yamlLine.type === YamlLineType.NO_KEY_ONLY_TEXT &&
      yamlLine.listItem === false
    ) {
      throw new YamlSyntaxError('YamlLineType.NO_KEY_ONLY_TEXT');
    }

    // 3. A bare "-" line starts or continues a plain list
    if (yamlLine.type === YamlLineType.PLAIN_DASH) {
      builder.onListItemPlainDash();
      continue;
    }

    // 4. Adjust indentation stack before processing the line
    builder.adjustIndentation(yamlLine.indent);

    // 5. Dispatch list-item lines
    if (yamlLine.listItem) {
      switch (yamlLine.type) {
        case YamlLineType.KEY_ONLY:
          builder.onListItemOnlyKey(yamlLine.key!);
          break;
        case YamlLineType.PLAIN_ELEMENT_LIST:
          builder.onListItemOnlyValue(yamlLine.value!);
          break;
        case YamlLineType.KEY_AND_VALUE:
          builder.onListItemKeyAndValue(yamlLine.key!, yamlLine.value!);
          break;
        case YamlLineType.KEY_AND_FLOW_SEQUENCE:
          builder.onListItemKeyAndFlowSequence(
            yamlLine.key!,
            [...yamlLine.values!],
          );
          break;
        case YamlLineType.KEY_AND_BLOCK_STYLE: {
          const blockStr = getBlockStyleString(yamlLine.indent);
          builder.onListItemKeyAndValue(yamlLine.key!, blockStr);
          break;
        }
        case YamlLineType.KEY_AND_FOLDED_STYLE:
          console.warn('KEY_AND_FOLDED_STYLE not supported');
          builder.onListItemKeyAndValue(yamlLine.key!, '');
          break;
        /* c8 ignore next 4 */
        default:
          // Unreachable: all list-item YamlLineType values are handled above.
          throw new YamlSyntaxError(
            `Unexpected line type in list context: ${yamlLine.type as string}`,
          );
      }
    } else {
      // 6. Dispatch non-list-item lines
      switch (yamlLine.type) {
        case YamlLineType.KEY_ONLY: {
          const next = peekNext();
          if (next === null || next.indent <= yamlLine.indent) {
            builder.onKeyAndValue(yamlLine.key!, '');
          } else if (next.type === YamlLineType.NO_KEY_ONLY_TEXT) {
            builder.onKeyAndValue(yamlLine.key!, peekNextOnlyText());
          } else {
            builder.onOnlyKey(yamlLine.key!);
          }
          break;
        }
        case YamlLineType.KEY_AND_VALUE:
          builder.onKeyAndValue(yamlLine.key!, yamlLine.value!);
          break;
        case YamlLineType.KEY_AND_BLOCK_STYLE: {
          const blockStr = getBlockStyleString(yamlLine.indent);
          builder.onKeyAndValue(yamlLine.key!, blockStr);
          break;
        }
        case YamlLineType.KEY_AND_FLOW_SEQUENCE:
          builder.onKeyAndFlowSequence(yamlLine.key!, [...yamlLine.values!]);
          break;
        case YamlLineType.KEY_AND_FOLDED_STYLE:
          console.warn('KEY_AND_FOLDED_STYLE not supported');
          builder.onKeyAndValue(yamlLine.key!, '');
          break;
        /* c8 ignore next 4 */
        default:
          // Unreachable: EMPTY_LINE, NO_KEY_ONLY_TEXT, PLAIN_DASH are all
          // handled before reaching this switch.
          throw new YamlSyntaxError(
            `Unexpected line type: ${yamlLine.type as string}`,
          );
      }
    }
  }

  return builder.getResult();
}
