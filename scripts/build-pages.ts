/**
 * build-pages.ts
 *
 * Reads all tests/visual/data/<type>.json manifests and generates:
 *   - tests/visual/index.html   — landing page listing all types
 *   - tests/visual/<type>.html  — one per-type QA page
 *
 * Run with: jiti scripts/build-pages.ts
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'tests', 'visual', 'data');
const OUT_DIR = join(ROOT, 'tests', 'visual');
const CDN_BASE = 'https://plantuml-orig.knowvah.com';

const IMPLEMENTED_TYPES = new Set([
  'activity',
  'class',
  'component',
  'object',
  'sequence',
  'state',
  'usecase',
]);

interface FixtureEntry {
  slug: string;
  markup: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readManifests(): Map<string, FixtureEntry[]> {
  const result = new Map<string, FixtureEntry[]>();

  if (!existsSync(DATA_DIR)) {
    console.warn(`Data directory not found: ${DATA_DIR}`);
    console.warn('No manifests to process. Generating empty pages.');
    return result;
  }

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const type = basename(file, '.json');
    const raw = readFileSync(join(DATA_DIR, file), 'utf-8');
    const entries = JSON.parse(raw) as FixtureEntry[];
    result.set(type, entries);
  }

  return result;
}

function buildTypePageCss(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
      padding: 16px 24px;
      background: #f8f9fa;
      color: #212529;
    }
    h1 { font-size: 1.5rem; margin-bottom: 4px; }
    .subtitle { color: #6c757d; margin-bottom: 24px; font-size: 0.9rem; }
    .row {
      background: #fff;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      margin-bottom: 20px;
      padding: 16px;
    }
    .slug-label {
      font-size: 0.95rem;
      font-family: monospace;
      margin: 0 0 8px 0;
    }
    .slug-label a { color: #495057; text-decoration: none; }
    .slug-label a:hover { text-decoration: underline; }
    .markup-panel {
      margin-bottom: 12px;
    }
    .markup-panel summary {
      cursor: pointer;
      font-size: 0.85rem;
      color: #6c757d;
      user-select: none;
    }
    .markup-panel pre {
      background: #f1f3f5;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 10px 14px;
      font-size: 0.8rem;
      overflow-x: auto;
      margin: 6px 0 0 0;
    }
    .markup-panel code { font-family: 'Menlo', 'Consolas', monospace; }
    .panels {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .panel {
      flex: 1 1 300px;
      min-width: 0;
    }
    .panel h4 {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #6c757d;
      margin: 0 0 8px 0;
    }
    .panel img {
      max-width: 100%;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      display: block;
    }
    .svg-container svg {
      max-width: 100%;
      border: 1px solid #dee2e6;
      border-radius: 4px;
    }
    .svg-container.error {
      font-size: 0.8rem;
      color: #dc3545;
      background: #fff5f5;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      padding: 8px 12px;
    }
    .not-implemented {
      font-size: 0.85rem;
      color: #6c757d;
      font-style: italic;
      padding: 12px;
      background: #f8f9fa;
      border: 1px dashed #dee2e6;
      border-radius: 4px;
    }
  `.trim();
}

function buildTypePage(type: string, entries: FixtureEntry[]): string {
  const isImplemented = IMPLEMENTED_TYPES.has(type);

  const rows = entries
    .map((entry) => {
      const escapedMarkup = escapeHtml(entry.markup);
      const ourPanel = isImplemented
        ? `<div class="svg-container" data-markup="${escapedMarkup}"></div>`
        : `<div class="not-implemented">Not yet implemented</div>`;

      return `      <div class="row" data-slug="${escapeHtml(entry.slug)}" id="${escapeHtml(entry.slug)}">
        <h3 class="slug-label"><a href="#${escapeHtml(entry.slug)}">${escapeHtml(entry.slug)}</a></h3>
        <details class="markup-panel">
          <summary>PlantUML markup</summary>
          <pre><code>${escapedMarkup}</code></pre>
        </details>
        <div class="panels">
          <div class="panel">
            <h4>Original (plantuml.com)</h4>
            <img src="${CDN_BASE}/${escapeHtml(type)}/${escapeHtml(entry.slug)}.png"
                 alt="${escapeHtml(entry.slug)}"
                 loading="lazy"
                 onerror="this.style.opacity='0.3';this.alt='PNG not captured'">
          </div>
          <div class="panel">
            <h4>Ours</h4>
            ${ourPanel}
          </div>
        </div>
      </div>`;
    })
    .join('\n');

  const renderScript = isImplemented
    ? `  <script type="module">
    import { render } from '/dist/plantuml-js.js';
    document.addEventListener('DOMContentLoaded', async () => {
      const containers = document.querySelectorAll('.svg-container[data-markup]');
      for (const el of containers) {
        const markup = el.getAttribute('data-markup') ?? '';
        try {
          el.innerHTML = await render(markup);
        } catch (err) {
          el.classList.add('error');
          el.textContent = String(err);
        }
      }
    });
  </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PlantUML Visual QA — ${escapeHtml(type)}</title>
  <script type="importmap">
    { "imports": { "katex": "/node_modules/katex/dist/katex.mjs" } }
  </script>
  <style>
    ${buildTypePageCss()}
  </style>
</head>
<body>
  <h1>PlantUML Visual QA &mdash; ${escapeHtml(type)}</h1>
  <p class="subtitle">${entries.length} fixture${entries.length === 1 ? '' : 's'} &bull; <a href="./index.html">Back to index</a></p>
${rows}
${renderScript}
</body>
</html>`;
}

function buildIndexPage(manifests: Map<string, FixtureEntry[]>): string {
  const implementedTypes: string[] = [];
  const unimplementedTypes: string[] = [];

  for (const type of manifests.keys()) {
    if (IMPLEMENTED_TYPES.has(type)) {
      implementedTypes.push(type);
    } else {
      unimplementedTypes.push(type);
    }
  }

  implementedTypes.sort();
  unimplementedTypes.sort();

  const allTypes = [...implementedTypes, ...unimplementedTypes];

  const rows = allTypes
    .map((type) => {
      const entries = manifests.get(type) ?? [];
      const isImplemented = IMPLEMENTED_TYPES.has(type);
      const statusIcon = isImplemented ? '&#x2705;' : '&#x1F532;';
      const nameClass = isImplemented ? 'type-implemented' : 'type-unimplemented';

      return `      <tr>
        <td>${statusIcon}</td>
        <td class="${nameClass}"><a href="./${escapeHtml(type)}.html">${escapeHtml(type)}</a></td>
        <td>${entries.length}</td>
      </tr>`;
    })
    .join('\n');

  const emptyRow =
    allTypes.length === 0
      ? `      <tr><td colspan="3" class="empty">No manifests found in tests/visual/data/</td></tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PlantUML Visual QA</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
      padding: 24px;
      background: #f8f9fa;
      color: #212529;
    }
    h1 { font-size: 1.6rem; margin-bottom: 4px; }
    .subtitle { color: #6c757d; margin-bottom: 24px; font-size: 0.9rem; }
    table {
      border-collapse: collapse;
      background: #fff;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      overflow: hidden;
      min-width: 400px;
    }
    thead th {
      background: #e9ecef;
      padding: 10px 16px;
      text-align: left;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #495057;
    }
    tbody td {
      padding: 10px 16px;
      border-top: 1px solid #dee2e6;
      font-size: 0.9rem;
    }
    tbody tr:hover td { background: #f8f9fa; }
    .type-implemented a { color: #0d6efd; font-weight: 500; }
    .type-unimplemented a { color: #6c757d; }
    a { text-decoration: none; }
    a:hover { text-decoration: underline; }
    .empty { color: #6c757d; font-style: italic; text-align: center; padding: 24px; }
  </style>
</head>
<body>
  <h1>PlantUML Visual QA</h1>
  <p class="subtitle">Implemented types shown first. &#x2705; = implemented &bull; &#x1F532; = not yet implemented</p>
  <table>
    <thead>
      <tr>
        <th></th>
        <th>Diagram type</th>
        <th>Fixtures</th>
      </tr>
    </thead>
    <tbody>
${rows}${emptyRow}
    </tbody>
  </table>
</body>
</html>`;
}

function main(): void {
  const manifests = readManifests();

  mkdirSync(OUT_DIR, { recursive: true });

  // Generate per-type pages
  for (const [type, entries] of manifests.entries()) {
    const html = buildTypePage(type, entries);
    const outPath = join(OUT_DIR, `${type}.html`);
    writeFileSync(outPath, html, 'utf-8');
    console.log(`  wrote ${outPath} (${entries.length} fixtures)`);
  }

  // Generate index page
  const indexHtml = buildIndexPage(manifests);
  const indexPath = join(OUT_DIR, 'index.html');
  writeFileSync(indexPath, indexHtml, 'utf-8');
  console.log(`  wrote ${indexPath}`);

  const total = [...manifests.values()].reduce((sum, e) => sum + e.length, 0);
  console.log(`Done. ${manifests.size} type(s), ${total} total fixture(s).`);
}

main();
