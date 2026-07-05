/**
 * Block extractor: splits preprocessed lines into UmlSource blocks,
 * one per @start…@end pair. Type is detected either from the @start<type>
 * keyword suffix or by probing the first 20 non-empty content lines.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiagramType =
  | 'sequence'
  | 'class'
  | 'state'
  | 'description'
  | 'activity'
  | 'object'
  | 'timing'
  | 'mindmap'
  | 'gantt'
  | 'wbs'
  | 'json'
  | 'yaml'
  | 'hcl'
  | 'board'
  | 'chronology'
  | 'files'
  | 'packetdiag'
  | 'chart'
  | 'dot'
  | 'unknown';

export interface UmlSource {
  readonly lines: readonly string[];
  readonly type: DiagramType;
  /** Raw style-block strings extracted by the preprocessor (pre-parsed). */
  readonly rawStyles?: readonly string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_DETECTION_WINDOW = 20;

/**
 * Keyword-suffix types: @start<suffix> maps directly to a DiagramType.
 * Note: 'uml' is handled separately (needs content probing).
 */
const START_SUFFIX_MAP: Readonly<Record<string, DiagramType>> = {
  mindmap: 'mindmap',
  gantt: 'gantt',
  wbs: 'wbs',
  sequence: 'sequence',
  class: 'class',
  // @startcomponent / @startusecase route to the consolidated description engine.
  component: 'description',
  state: 'state',
  usecase: 'description',
  activity: 'activity',
  object: 'object',
  timing: 'timing',
  json: 'json',
  yaml: 'yaml',
  hcl: 'hcl',
  board: 'board',
  chronology: 'chronology',
  files: 'files',
  packetdiag: 'packetdiag',
  chart: 'chart',
  dot: 'dot',
};

// Matches @startuml, @startmindmap, @startgantt, etc. (case-insensitive).
// A trailing token after the keyword is tolerated — @startuml may carry a
// diagram name/title, and corpus fixtures sometimes leave junk after @enduml
// (e.g. `@enduml */`); upstream's line reader terminates on the keyword alone.
const RE_START = /^@start(\w+)(?:\s.*)?$/i;
// Matches @enduml, @endmindmap, @endgantt, etc. (case-insensitive)
const RE_END = /^@end(\w+)(?:\s.*)?$/i;

// ---------------------------------------------------------------------------
// Content-based type probing for @startuml blocks
// ---------------------------------------------------------------------------

const SEQUENCE_ACTOR_KEYWORDS = new Set([
  'participant',
  'actor',
  'boundary',
  'control',
  'entity',
  'database',
  'collections',
  'queue',
]);

/**
 * Collect the first N non-empty trimmed lines for detection probes.
 * This is called once and shared across all probes.
 */
function firstNonEmptyLines(
  lines: readonly string[],
  n: number,
): readonly string[] {
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    result.push(trimmed);
    if (result.length >= n) break;
  }
  return result;
}

function probeState(lines: readonly string[]): boolean {
  // [*] is unambiguous state-diagram syntax and must be checked before
  // sequence, since "[*] --> Idle" also contains "-->" which matches sequence.
  for (const line of lines) {
    if (/\[\*\]/u.test(line)) return true;
  }
  return false;
}

function probeSequence(lines: readonly string[]): boolean {
  for (const line of lines) {
    // Arrow patterns: ->, ->>, -->, -->>
    if (/->|-->/u.test(line)) return true;

    // Keyword-starts
    const firstWord = line.split(/\s+/u)[0]?.toLowerCase() ?? '';
    if (SEQUENCE_ACTOR_KEYWORDS.has(firstWord)) return true;
  }
  return false;
}

function probeClass(lines: readonly string[]): boolean {
  for (const line of lines) {
    if (
      /^class\s/u.test(line) ||
      /^abstract\s+class\s/u.test(line) ||
      /^interface\s/u.test(line) ||
      /^enum\s/u.test(line)
    ) {
      return true;
    }
  }
  return false;
}

function detectUmlType(lines: readonly string[]): DiagramType {
  const window = firstNonEmptyLines(lines, TYPE_DETECTION_WINDOW);
  // State must be probed before sequence: "[*] -->" contains "-->" which
  // would otherwise match the sequence arrow pattern.
  if (probeState(window)) return 'state';
  if (probeSequence(window)) return 'sequence';
  if (probeClass(window)) return 'class';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Trim leading/trailing blank lines from an array
// ---------------------------------------------------------------------------

function isBlankLine(line: string | undefined): boolean {
  return (line?.trim() ?? '') === '';
}

function trimBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length - 1;
  while (start <= end && isBlankLine(lines[start])) start++;
  while (end >= start && isBlankLine(lines[end])) end--;
  return lines.slice(start, end + 1);
}

/** Finalize a completed @start…@end block into a typed UmlSource. */
function finalizeBlock(suffix: string, contentLines: string[]): UmlSource {
  const trimmed = trimBlankLines(contentLines);
  const type: DiagramType =
    suffix === 'uml'
      ? detectUmlType(trimmed)
      : (START_SUFFIX_MAP[suffix] ?? 'unknown');
  return { lines: trimmed, type };
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Splits preprocessed source lines into UmlSource blocks.
 * Each block corresponds to one @start…@end pair.
 */
export function extractBlocks(processedLines: readonly string[]): UmlSource[] {
  const blocks: UmlSource[] = [];
  let inside = false;
  let currentSuffix = '';
  let contentLines: string[] = [];

  for (const rawLine of processedLines) {
    const line = rawLine;

    if (!inside) {
      const startMatch = RE_START.exec(line);
      if (startMatch?.[1] !== undefined) {
        inside = true;
        currentSuffix = startMatch[1].toLowerCase();
        contentLines = [];
      }
      // Lines before @start are ignored
      continue;
    }

    // We are inside a block
    const endMatch = RE_END.exec(line);
    if (endMatch?.[1] !== undefined) {
      // End of block
      inside = false;
      blocks.push(finalizeBlock(currentSuffix, contentLines));
      contentLines = [];
      currentSuffix = '';
      continue;
    }

    contentLines.push(line);
  }

  // Unclosed block is silently discarded (no @end found)
  return blocks;
}
