/**
 * The `TLineType` CLASSIFIER -- the regex cascade that decides which TIM
 * directive (if any) a raw source line is.
 *
 * `StringLocated.ts` (batch SI5a-2a) declared the `TLineType` *value space*
 * only, explicitly deferring the ~250-line classifier ("Value space only --
 * NOT the classifier"). `TContext#executeOneLineNotSafe` and every
 * `CodeIterator*` in the chain dispatch on `StringLocated#getType()`, so the
 * classifier is a hard prerequisite of batch 4 and is ported here.
 *
 * Signature divergence (deliberate): upstream's `getFromLineInternal` takes a
 * `StringLocated` and calls `getString()` / `containsExclamationMark()` on it.
 * Taking the raw string instead keeps the module dependency one-directional
 * (`StringLocated.ts` -> `TLineType.ts`), avoiding a runtime import cycle that
 * upstream's JVM classloader tolerates but ESM does not. Both members it used
 * are derivable from that string, so nothing is lost.
 *
 * Unicode divergence (deliberate): upstream's identifier pattern spells "any
 * astral character" as the two UTF-16 surrogate ranges
 * (high then low UTF-16 surrogate ranges), because Java regexes match code
 * units. JS regexes with the `u` flag match CODE POINTS, so the same set is
 * spelled `\u{10000}-\u{10FFFF}` here -- the identical character set, not a
 * widening.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/text/TLineType.java
 */

import type { TLineType } from './StringLocated.js';

/** `Pattern2`'s `%s` macro: normal or non-breaking space.
 * @see ~/git/plantuml/.../regex/Pattern2.java */
const SPACE_CLASS = '[\\s\\u00A0]';

/** @see ~/git/plantuml/.../text/TLineType.java#IDENTIFIER_WITH_UNICODE_SURROGATES_SUPPORT */
const IDENTIFIER = '[\\p{L}\\u{10000}-\\u{10FFFF}_][\\p{L}\\u{10000}-\\u{10FFFF}_0-9]*';

/** @see ~/git/plantuml/.../text/TLineType.java#simpleKeyword */
function simpleKeyword(word: string): RegExp {
  return new RegExp(`^${SPACE_CLASS}*${word}\\b`, 'u');
}

const PATTERN_LEGACY_DEFINE = new RegExp(`^${SPACE_CLASS}*!define${SPACE_CLASS}+${IDENTIFIER}\\(`, 'u');

const PATTERN_LEGACY_DEFINELONG = new RegExp(`^${SPACE_CLASS}*!definelong${SPACE_CLASS}+${IDENTIFIER}\\b`, 'u');

const PATTERN_AFFECTATION_DEFINE = new RegExp(`^${SPACE_CLASS}*!define${SPACE_CLASS}+${IDENTIFIER}\\b`, 'u');

const PATTERN_AFFECTATION = new RegExp(
  `^${SPACE_CLASS}*!${SPACE_CLASS}*(local|global)?${SPACE_CLASS}*\\$?${IDENTIFIER}${SPACE_CLASS}*\\??=`,
  'u',
);

const PATTERN_COMMENT_SIMPLE1 = new RegExp(`^${SPACE_CLASS}*'`, 'u');

const PATTERN_COMMENT_SIMPLE2 = new RegExp(`^${SPACE_CLASS}*/'.*'/${SPACE_CLASS}*$`, 'su');

const PATTERN_COMMENT_LONG_START = new RegExp(`^${SPACE_CLASS}*/'`, 'u');

const PATTERN_IFDEF = simpleKeyword('!ifdef');

/**
 * plantuml-ts DIVERGENCE (deliberate, behavior-preserving): upstream is
 * `simpleKeyword("!undef")`, which does NOT match `!undefine` (the `\b` fails
 * between `f` and `i`; live-oracle-verified -- the jar renders
 * `!undefine FOO` as an error). plantuml-ts's pre-TIM `preprocessor.ts`
 * recognized `!undefine` and ONLY `!undefine` (`RE_UNDEFINE =
 * /^!undefine\s+(\w+)\s*$/`), and `tests/unit/preprocessor.test.ts` pins that
 * behavior. Accepting both spellings keeps the existing plantuml-ts contract
 * intact (no silent behavior change in this cutover) while adding upstream's
 * real `!undef`. `TContext#executeUndef` normalizes the alias before handing
 * the line to the (faithfully ported) `EaterUndef`.
 */
const PATTERN_UNDEF = new RegExp(`^${SPACE_CLASS}*!undef(ine)?\\b`, 'u');

const PATTERN_IFNDEF = simpleKeyword('!ifndef');

const PATTERN_ASSERT = simpleKeyword('!assert');

const PATTERN_IF = simpleKeyword('!if');

const PATTERN_DECLARE_RETURN_FUNCTION = new RegExp(
  `^${SPACE_CLASS}*!(unquoted\\s|final\\s)*function${SPACE_CLASS}+\\$?${IDENTIFIER}`,
  'u',
);

const PATTERN_DECLARE_PROCEDURE = new RegExp(
  `^${SPACE_CLASS}*!(unquoted\\s|final\\s)*procedure${SPACE_CLASS}+\\$?${IDENTIFIER}`,
  'u',
);

const PATTERN_ELSE = simpleKeyword('!else');

const PATTERN_ELSEIF = simpleKeyword('!elseif');

const PATTERN_ENDIF = simpleKeyword('!endif');

const PATTERN_WHILE = simpleKeyword('!while');

const PATTERN_ENDWHILE = simpleKeyword('!endwhile');

const PATTERN_FOREACH = simpleKeyword('!foreach');

const PATTERN_ENDFOREACH = simpleKeyword('!endfor');

const PATTERN_END_FUNCTION = new RegExp(
  `^${SPACE_CLASS}*!end${SPACE_CLASS}*(function|definelong|procedure)\\b`,
  'u',
);

const PATTERN_RETURN = simpleKeyword('!return');

const PATTERN_THEME = simpleKeyword('!theme');

const PATTERN_INCLUDE = new RegExp(`^${SPACE_CLASS}*!include${SPACE_CLASS}*(url|_many|_once)?\\b`, 'u');

const PATTERN_INCLUDE_DEF = simpleKeyword('!includedef');

const PATTERN_IMPORT = simpleKeyword('!import');

const PATTERN_STARTSUB = simpleKeyword('!startsub');

const PATTERN_ENDSUB = simpleKeyword('!endsub');

const PATTERN_INCLUDESUB = simpleKeyword('!includesub');

const PATTERN_LOG = simpleKeyword('!log');

const PATTERN_DUMP_MEMORY = simpleKeyword('!dump_memory');

const PATTERN_OPTION = simpleKeyword('!option');

/**
 * Ordered directive cascade -- FIRST match wins, so the order here is
 * load-bearing and mirrors upstream's `if` chain exactly (e.g.
 * `PATTERN_LEGACY_DEFINE` must precede `PATTERN_AFFECTATION_DEFINE`, or
 * `!define FOO(x) ...` would classify as a plain `!define` affectation).
 * Only reached once the line is known to contain a `!`.
 */
const EXCLAMATION_CASCADE: readonly (readonly [RegExp, TLineType])[] = [
  [PATTERN_LEGACY_DEFINE, 'LEGACY_DEFINE'],
  [PATTERN_LEGACY_DEFINELONG, 'LEGACY_DEFINELONG'],
  [PATTERN_AFFECTATION_DEFINE, 'AFFECTATION_DEFINE'],
  [PATTERN_AFFECTATION, 'AFFECTATION'],
  [PATTERN_IFDEF, 'IFDEF'],
  [PATTERN_UNDEF, 'UNDEF'],
  [PATTERN_IFNDEF, 'IFNDEF'],
  [PATTERN_ASSERT, 'ASSERT'],
  [PATTERN_IF, 'IF'],
  [PATTERN_DECLARE_RETURN_FUNCTION, 'DECLARE_RETURN_FUNCTION'],
  [PATTERN_DECLARE_PROCEDURE, 'DECLARE_PROCEDURE'],
  [PATTERN_ELSE, 'ELSE'],
  [PATTERN_ELSEIF, 'ELSEIF'],
  [PATTERN_ENDIF, 'ENDIF'],
  [PATTERN_WHILE, 'WHILE'],
  [PATTERN_ENDWHILE, 'ENDWHILE'],
  [PATTERN_FOREACH, 'FOREACH'],
  [PATTERN_ENDFOREACH, 'ENDFOREACH'],
  [PATTERN_END_FUNCTION, 'END_FUNCTION'],
  [PATTERN_RETURN, 'RETURN'],
  [PATTERN_THEME, 'THEME'],
  [PATTERN_INCLUDE, 'INCLUDE'],
  [PATTERN_INCLUDE_DEF, 'INCLUDE_DEF'],
  [PATTERN_IMPORT, 'IMPORT'],
  [PATTERN_STARTSUB, 'STARTSUB'],
  [PATTERN_ENDSUB, 'ENDSUB'],
  [PATTERN_INCLUDESUB, 'INCLUDESUB'],
  [PATTERN_LOG, 'LOG'],
  [PATTERN_DUMP_MEMORY, 'DUMP_MEMORY'],
  [PATTERN_OPTION, 'OPTION'],
];

/**
 * Classify one raw source line.
 *
 * @see ~/git/plantuml/.../text/TLineType.java#getFromLineInternal
 */
export function getFromLineInternal(s: string): TLineType {
  if (PATTERN_COMMENT_SIMPLE1.test(s)) return 'COMMENT_SIMPLE';

  if (PATTERN_COMMENT_SIMPLE2.test(s)) return 'COMMENT_SIMPLE';

  if (PATTERN_COMMENT_LONG_START.test(s) && !s.includes("'/")) return 'COMMENT_LONG_START';

  if (!s.includes('!')) return 'PLAIN';

  for (const [pattern, type] of EXCLAMATION_CASCADE) if (pattern.test(s)) return type;

  return 'PLAIN';
}

/** @see ~/git/plantuml/.../text/TLineType.java#isQuote */
export function isQuote(ch: string): boolean {
  return ch === '"' || ch === "'";
}

/** @see ~/git/plantuml/.../text/TLineType.java#isLatinDigit */
export function isLatinDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/** @see ~/git/plantuml/.../text/TLineType.java#isLetterOrEmojiOrUnderscoreOrDigit */
export function isLetterOrEmojiOrUnderscoreOrDigit(ch: string): boolean {
  if (ch === '') return false;

  const code = ch.charCodeAt(0);
  const isEmoji = code >= 0xd800 && code <= 0xdfff;
  return /\p{L}/u.test(ch) || ch === '_' || isLatinDigit(ch) || isEmoji;
}
