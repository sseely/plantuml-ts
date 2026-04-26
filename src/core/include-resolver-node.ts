import { readFile as fsReadFile } from 'node:fs/promises';
import { resolve, normalize } from 'node:path';
import type { IncludeFetcher } from './include-resolver.js';
import { IncludeResolveError } from './include-resolver.js';

/**
 * Signature of the readFile overload used by makeNodeFsFetcher.
 * Matches the node:fs/promises readFile(path, 'utf-8') overload.
 */
export type ReadFileFn = (path: string, encoding: 'utf-8') => Promise<string>;

/**
 * Creates an IncludeFetcher that reads files from the local filesystem using
 * node:fs/promises. All resolved paths must remain within basePath to prevent
 * directory traversal attacks.
 *
 * This module is intentionally separate from include-resolver.ts so that
 * browser bundles do not import node:fs (D4: treeshaking boundary).
 *
 * @param basePath    Absolute or relative base directory. All !include targets
 *                    are resolved relative to this directory.
 * @param readFileFn  Injectable readFile implementation (defaults to
 *                    node:fs/promises readFile). Override in tests.
 */
export function makeNodeFsFetcher(
  basePath: string,
  readFileFn: ReadFileFn = fsReadFile,
): IncludeFetcher {
  const resolvedBase = resolve(basePath);

  return async (target: string): Promise<string> => {
    const resolvedTarget = resolve(resolvedBase, normalize(target));

    // Path traversal protection: resolved target must be inside basePath.
    if (
      !resolvedTarget.startsWith(resolvedBase + '/') &&
      resolvedTarget !== resolvedBase
    ) {
      throw new IncludeResolveError(
        `!include path '${target}' escapes the base directory '${basePath}'`,
        target,
      );
    }

    try {
      return await readFileFn(resolvedTarget, 'utf-8');
    } catch (beat) {
      throw new IncludeResolveError(
        `Failed to read !include '${target}': ${(beat as NodeJS.ErrnoException).message}`,
        target,
      );
    }
  };
}
