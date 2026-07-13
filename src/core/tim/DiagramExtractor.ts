/**
 * `!include file.puml` where the included file is itself a full `@startuml ...
 * @enduml` document: only the BLOCK's lines are included, not the `@start` /
 * `@end` markers, and not any prose around them.
 *
 * The `!suffix` on an include target selects WHICH block:
 *   `!include foo.puml!2`     -> the third `@start...` block in the file
 *   `!include foo.puml!MYID`  -> the block declared `@startuml(id=MYID)`
 *
 * Upstream expresses this as a `ReadLine` decorator that seeks in its
 * constructor; this port is a pure function over the already-in-memory lines the
 * {@link IncludeStore} handed back (there is no reader to decorate -- see
 * `IncludeStore.ts` for why the I/O is split in two).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/DiagramExtractor.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/DiagramDetector.java#extractFromFile
 */

import type { StringLocated } from './StringLocated.js';
import { isEndDirective, isStartDirective } from './StartUtils.js';

/** @see ~/git/plantuml/.../preproc/DiagramExtractor.java#DIGITS */
const DIGITS = /^\d+$/u;

/** @see ~/git/plantuml/.../preproc/DiagramDetector.java#containsStartDiagram */
function containsStartDiagram(lines: readonly StringLocated[]): boolean {
  for (const s of lines) if (isStartDirective(s.getString())) return true;

  return false;
}

/**
 * `s.toString().matches(".*id=" + uid + "\\W.*")`.
 *
 * PLANTUML-TS DIVERGENCE: the uid is regex-ESCAPED before interpolation.
 * Upstream splices it in raw, so an include suffix carrying regex
 * metacharacters is either a `PatternSyntaxException` (a crash) or a wildcard
 * match (an injection). Neither is behavior worth reproducing; every uid that is
 * a plain identifier -- i.e. every uid upstream actually matches -- behaves
 * identically.
 *
 * @see ~/git/plantuml/.../preproc/DiagramExtractor.java#checkUid
 */
function checkUid(uid: string | undefined, s: StringLocated): boolean {
  if (uid === undefined) return true;

  const escaped = uid.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp('.*id=' + escaped + '\\W.*', 'u').test(s.getString());
}

/**
 * The lines of the selected diagram block, or `undefined` when the content holds
 * no `@start` directive at all -- in which case the caller includes the file
 * whole (upstream: `DiagramDetector.extractFromFile` returns null).
 *
 * @param suf the `!suffix` from the include target: a block INDEX when all
 *            digits, otherwise a block `id=`. Absent -> the first block.
 */
export function extractDiagram(
  lines: readonly StringLocated[],
  suf: string | undefined,
): readonly StringLocated[] | undefined {
  if (!containsStartDiagram(lines)) return undefined;

  const isIndex = suf !== undefined && DIGITS.test(suf);
  const block = isIndex ? Math.max(0, Number.parseInt(suf, 10)) : 0;
  const uid = isIndex ? undefined : suf;

  const start = seekBlockStart(lines, block, uid);
  // Upstream's `finished = true`: the requested block does not exist, so the
  // decorator yields no lines at all (it does NOT fall back to the whole file).
  if (start === undefined) return [];

  return takeUntilEnd(lines, start);
}

/**
 * Index of the first line INSIDE the selected block, or `undefined` when that
 * block does not exist. Upstream does this seek in the decorator's constructor.
 * @see ~/git/plantuml/.../preproc/DiagramExtractor.java (constructor)
 */
function seekBlockStart(
  lines: readonly StringLocated[],
  block: number,
  uid: string | undefined,
): number | undefined {
  let remaining = block;
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i]!;
    if (!isStartDirective(s.getString()) || !checkUid(uid, s)) continue;

    if (remaining === 0) return i + 1;

    remaining--;
  }
  return undefined;
}

/** The block's lines, up to (not including) its `@end` marker.
 * @see ~/git/plantuml/.../preproc/DiagramExtractor.java#readLine */
function takeUntilEnd(lines: readonly StringLocated[], from: number): readonly StringLocated[] {
  const body: StringLocated[] = [];
  for (let i = from; i < lines.length; i++) {
    const s = lines[i]!;
    if (isEndDirective(s.getString())) break;

    body.push(s);
  }
  return body;
}
