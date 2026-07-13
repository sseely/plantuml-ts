/**
 * `TContext#executeInclude` / `#executeIncludesub` / `#executeIncludeDef` /
 * `#executeImport` -- the four directives that reach OUTSIDE the source being
 * interpreted.
 *
 * Extracted from `TContext` (upstream keeps them as private methods on it) for
 * the same reason `buildCodeIterator.ts` was: this repo's per-file size gate.
 * It holds the state upstream's `TContext` holds for them -- `filesUsedCurrent`
 * (the `!include` dedup set) and the `PathSystem` (here: an {@link IncludeStore}
 * plus the prefixes `!import` registered) -- and nothing else.
 *
 * Where upstream opens a file, this reads the pre-populated, SYNCHRONOUS
 * {@link IncludeStore}: see `IncludeStore.ts` for why the I/O is split into an
 * async prefetch pass plus a sync interpreter lookup.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#executeInclude
 */

import { EaterException } from './EaterException.js';
import { EaterImport } from './EaterImport.js';
import { EaterInclude, PreprocessorIncludeStrategy } from './EaterInclude.js';
import { EaterIncludeDef } from './EaterIncludeDef.js';
import { EaterIncludesub } from './EaterIncludesub.js';
import { extractDiagram } from './DiagramExtractor.js';
import {
  EMPTY_INCLUDE_STORE,
  IncludeNotFoundError,
  StdlibNotBundledError,
  stdlibPathOf,
  type IncludeStore,
} from './IncludeStore.js';
import { readLines } from './ReadLineReader.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TContext.js';
import type { TMemory } from './TMemory.js';
import { Sub } from './iterator/Sub.js';

/** `http://` / `https://` include target -- upstream's `SURL` branch. */
const RE_URL = /^https?:\/\//u;

export class IncludeExecutor {
  private readonly store: IncludeStore;
  private readonly subs: Map<string, Sub>;

  /** @see ~/git/plantuml/.../tim/TContext.java#filesUsedCurrent */
  private readonly filesUsedCurrent = new Set<string>();

  /**
   * What `!import` registered. Upstream's `!import` calls
   * `PathSystem#addImportFile`, adding a searchable LOCATION (a folder or zip)
   * that later `!include`s resolve against; these are that, as store-key
   * prefixes.
   */
  private readonly importedPaths: string[] = [];

  constructor(subs: Map<string, Sub>, store: IncludeStore = EMPTY_INCLUDE_STORE) {
    this.subs = subs;
    this.store = store;
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#executeInclude */
  executeInclude(context: TContext, memory: TMemory, s: StringLocated): void {
    const include = new EaterInclude(s.getTrimmed());
    include.analyze(context, memory);
    const strategy = include.getPreprocessorIncludeStrategy();
    const { what, suf } = splitSuffix(include.getWhat());

    // Upstream applies the dedup only in its local-FILE branch: a stdlib or URL
    // include is re-read every time it is named.
    const dedup = stdlibPathOf(what) === undefined && !RE_URL.test(what);
    if (dedup && this.filesUsedCurrent.has(what)) {
      if (strategy === PreprocessorIncludeStrategy.ONCE)
        throw new EaterException('This file has already been included', s);

      if (strategy === PreprocessorIncludeStrategy.DEFAULT) return;
    }

    const lines = readLines(this.load(what, '!include'), s.getLocation());
    this.filesUsedCurrent.add(what);

    // A file that is itself a whole `@startuml ... @enduml` document contributes
    // only its block's lines (and `!suffix` picks WHICH block); a bare fragment
    // contributes all of them.
    const body = extractDiagram(lines, suf) ?? lines;
    context.executeLines(memory, body, undefined, false);
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#executeIncludesub */
  executeIncludesub(context: TContext, memory: TMemory, s: StringLocated): void {
    const include = new EaterIncludesub(s.getTrimmed());
    include.analyze(context, memory);
    const what = include.getWhat();

    const idx = what.indexOf('!');
    let sub: Sub | undefined;
    if (idx !== -1) {
      const filename = what.substring(0, idx);
      const blocname = what.substring(idx + 1);
      const lines = readLines(this.load(filename, '!includesub'), s.getLocation());
      sub = Sub.fromLines(lines, blocname, context, memory);
    }
    sub ??= this.subs.get(what);
    if (sub === undefined) throw new EaterException(`cannot include ${what}`, s);

    context.executeLines(memory, sub.lines(), undefined, false);
  }

  /**
   * PLANTUML-TS DIVERGENCE: upstream reads the named definition from its
   * `DefinitionsContainer` -- the `@startuml(id=NAME)` blocks of the file set
   * the CLI happens to be processing (`BlockUmlBuilder#getDefinition`). This
   * port has no such container (it is handed one source string, not a file set),
   * so a `!includedef NAME` resolves through the include seam, keyed by NAME.
   *
   * @see ~/git/plantuml/.../tim/TContext.java#executeIncludeDef
   */
  executeIncludeDef(context: TContext, memory: TMemory, s: StringLocated): void {
    const include = new EaterIncludeDef(s.getTrimmed());
    include.analyze(context, memory);
    const definitionName = include.getLocation();
    const body = readLines(this.load(definitionName, '!includedef'), s.getLocation());
    context.executeLines(memory, body, undefined, false);
  }

  /**
   * PLANTUML-TS DIVERGENCE: upstream resolves the path on the filesystem and
   * throws `Cannot import` when it is missing or is a directory. There is no
   * filesystem here to check against, so the path is simply registered as a
   * lookup prefix for subsequent `!include`s ({@link importedPaths}) and the
   * directive never throws.
   *
   * @see ~/git/plantuml/.../tim/TContext.java#executeImport
   */
  executeImport(context: TContext, memory: TMemory, s: StringLocated): void {
    const _import = new EaterImport(s.getTrimmed());
    _import.analyze(context, memory);
    this.importedPaths.push(_import.getWhat());
  }

  /**
   * The seam: where upstream opens a file, this reads the store. A miss is a
   * thrown, TYPED error naming the path -- never a silent skip.
   *
   * @throws IncludeNotFoundError  the store cannot serve `what`.
   * @throws StdlibNotBundledError `what` is the `<bundle/thing>` stdlib form and
   *                               no host bundle was supplied (SI5b vendors none).
   */
  private load(what: string, directive: string): string {
    const direct = this.store.get(what);
    if (direct !== undefined) return direct;

    for (const prefix of this.importedPaths) {
      const joined = prefix.endsWith('/') ? prefix + what : `${prefix}/${what}`;
      const imported = this.store.get(joined);
      if (imported !== undefined) return imported;
    }

    const stdlib = stdlibPathOf(what);
    if (stdlib !== undefined) throw new StdlibNotBundledError(what, stdlib);

    throw new IncludeNotFoundError(what, directive);
  }
}

/**
 * `!include file.puml!SUF` -> `{ what: 'file.puml', suf: 'SUF' }`. The suffix
 * selects one diagram block out of the included file (see `DiagramExtractor`).
 * @see ~/git/plantuml/.../tim/TContext.java#executeInclude (`what.lastIndexOf('!')`)
 */
function splitSuffix(target: string): { what: string; suf: string | undefined } {
  const idx = target.lastIndexOf('!');
  if (idx === -1) return { what: target, suf: undefined };

  return { what: target.substring(0, idx), suf: target.substring(idx + 1) };
}
