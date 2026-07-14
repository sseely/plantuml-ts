/**
 * Minimal parser for the flat `key: value` YAML-ish frontmatter block
 * plantuml-stdlib puts at the top of every bundle README.md (delimited by
 * `---` lines). No nesting, no lists — a hand-rolled parser avoids adding
 * a YAML dependency for four scalar fields.
 */

import type { BundleFrontmatter } from './types.js';

const FRONTMATTER_DELIMITER = '---';

/** Parse the leading `---`-delimited block of README.md into a flat map. */
export function parseFrontmatter(text: string): Record<string, string> {
  const lines = text.split(/\r\n|\r|\n/);
  const result: Record<string, string> = {};

  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    return result;
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined || line.trim() === FRONTMATTER_DELIMITER) {
      break;
    }
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key.length > 0 && value.length > 0) {
      result[key] = value;
    }
  }

  return result;
}

const METADATA_FIELDS = ['license', 'link', 'version', 'source'] as const;

/** Pick only the audited/tracked fields, omitting empty ones (never
 * setting them to undefined — exactOptionalPropertyTypes). */
export function extractBundleMetadata(
  frontmatter: Record<string, string>,
): BundleFrontmatter {
  const metadata: BundleFrontmatter = {};
  for (const field of METADATA_FIELDS) {
    const value = frontmatter[field];
    if (value !== undefined) {
      metadata[field] = value;
    }
  }
  return metadata;
}
