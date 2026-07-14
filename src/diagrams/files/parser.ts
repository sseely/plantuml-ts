import { createAnnotations, matchAnnotationCommand } from '../../core/annotations/index.js';
import { createSpriteRegistry, matchSpriteCommand } from '../../core/sprite-commands.js';
import type { FileEntry, FilesDiagramAST } from './ast.js';
import type { UmlSource } from '../../core/block-extractor.js';

// ---------------------------------------------------------------------------
// Internal helpers — port of FEntry.addRawEntry and FilesListing from Java
// ---------------------------------------------------------------------------

function getOrCreateFolder(node: FileEntry, name: string): FileEntry {
  const existing = node.children.find(
    (c) => c.type === 'folder' && c.name === name,
  );
  if (existing !== undefined) return existing;
  const child: FileEntry = { type: 'folder', name, children: [] };
  node.children.push(child);
  return child;
}

/**
 * Recursively add a raw path (already stripped of the leading '/') into the
 * tree rooted at `node`.  Returns the leaf FileEntry created, or null when
 * the path ends with '/' (folder declaration with no file child).
 */
function addRawEntry(node: FileEntry, raw: string): FileEntry | null {
  const x = raw.indexOf('/');
  if (x === -1) {
    // Leaf: DATA file
    const child: FileEntry = { type: 'file', name: raw, children: [] };
    node.children.push(child);
    return child;
  }
  const folderName = raw.substring(0, x);
  const folder = getOrCreateFolder(node, folderName);
  const remain = raw.substring(x + 1);
  if (remain.length === 0) {
    // Trailing slash: folder declared, no file child
    return null;
  }
  return addRawEntry(folder, remain);
}

/**
 * Walk the tree to find the direct parent of `target`.
 * Returns null when target is null or not found (attaches note to root).
 */
function findParentOf(
  node: FileEntry,
  target: FileEntry | null,
): FileEntry | null {
  if (target === null) return null;
  for (const child of node.children) {
    if (child === target) return node;
    const found = findParentOf(child, target);
    if (found !== null) return found;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseFiles(source: UmlSource): FilesDiagramAST {
  const root: FileEntry = { type: 'folder', name: '', children: [] };
  let lastCreated: FileEntry | null = null;
  const annotations = createAnnotations();
  const sprites = createSpriteRegistry();

  const lines = source.lines;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const t = line.trim();
    i++;

    // Skip @startfiles / @endfiles wrapper lines
    if (/^@startfiles\b/i.test(t) || /^@endfiles\b/i.test(t)) continue;

    // Skip blank lines and !-directives (e.g. !theme)
    if (t === '' || t.startsWith('!')) continue;

    // Consume <style>…</style> blocks silently
    if (/^<style>/i.test(t)) {
      while (i < lines.length && !/^<\/style>/i.test(lines[i]!.trim())) {
        i++;
      }
      i++; // consume </style>
      continue;
    }

    // Collect <note>…</note> blocks
    if (/^<note>/i.test(t)) {
      const noteLines: string[] = [];
      while (i < lines.length && !/^<\/note>/i.test(lines[i]!.trim())) {
        noteLines.push(lines[i]!);
        i++;
      }
      i++; // consume </note>
      // Java: note attaches to lastCreated.parent (the folder containing the
      // last added file).  Since FileEntry has no back-pointer we walk the
      // tree to find the direct parent.  Falls back to root when
      // lastCreated is null (no file entry has been seen yet).
      const noteParent = findParentOf(root, lastCreated) ?? root;
      noteParent.children.push({
        type: 'note',
        name: 'NOTE',
        children: [],
        noteLines,
      });
      // lastCreated is NOT updated after a note block
      continue;
    }

    // File/folder path entry — must start with '/'
    if (t.startsWith('/')) {
      const raw = t.substring(1);
      const created = addRawEntry(root, raw);
      // Trailing-slash folder declarations (created === null) leave
      // lastCreated unchanged so subsequent notes still have a valid parent.
      if (created !== null) {
        lastCreated = created;
      }
      continue;
    }

    // title/caption/legend/header/footer/mainframe (mission G0b/T6): tried
    // at the same "everything else" fallback position, right before the
    // silent-ignore default below -- so a chrome directive reaches
    // `ast.annotations` instead of being dropped along with genuinely
    // unrecognized lines.
    const annotationMatch = matchAnnotationCommand(lines, i - 1, annotations);
    if (annotationMatch !== null) {
      i += annotationMatch.consumed - 1;
      continue;
    }

    // `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4): tried
    // immediately after the chrome matcher, same fallback position.
    const spriteMatch = matchSpriteCommand(lines, i - 1, sprites);
    if (spriteMatch !== null) {
      i += spriteMatch.consumed - 1;
      continue;
    }

    // Everything else: ignore
    // #lizard forgives -- pre-existing faithful port of FEntry.addRawEntry
    // / FilesListing (already over threshold before mission G0b/T6 added
    // the annotation-matcher check above); not refactored per project
    // policy against restructuring faithfully-ported parsing logic.
  }

  return { root, annotations, sprites };
}
