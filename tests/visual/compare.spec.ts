/**
 * Visual QA comparison spec.
 *
 * For each diagram type: renders the canonical example in the local demo,
 * screenshots the preview, then generates a side-by-side HTML report.
 *
 * Reference images (from plantuml.com, captured once) are loaded from
 * tests/visual/reference/<type>/canonical.png — no network traffic here.
 *
 * Run: pnpm visual:compare
 * Open: test-results/visual-qa/index.html
 */
import { test } from '@playwright/test';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const DIAGRAM_TYPES = [
  'sequence',
  'class',
  'component',
  'state',
  'usecase',
  'activity',
  'object',
] as const;

type DotFixture = { slug: string; markup: string };
const DOT_DATA = JSON.parse(
  readFileSync(join(ROOT, 'tests', 'visual', 'data', 'dot.json'), 'utf-8'),
) as DotFixture[];
const DOT_REF_DIR = join(ROOT, 'tests', 'visual', 'reference', 'dot');

const OUT_DIR = join(ROOT, 'test-results', 'visual-qa');
const REF_OUT = join(OUT_DIR, 'reference');
const LOCAL_OUT = join(OUT_DIR, 'local');

mkdirSync(REF_OUT, { recursive: true });
mkdirSync(LOCAL_OUT, { recursive: true });
mkdirSync(join(REF_OUT, 'dot'), { recursive: true });
mkdirSync(join(LOCAL_OUT, 'dot'), { recursive: true });

test('generate visual QA report', async ({ page }) => {
  await page.goto('/');
  await page.locator('#preview svg').waitFor({ timeout: 10_000 });

  for (const type of DIAGRAM_TYPES) {
    await page.locator(`button[data-type="${type}"]`).click();

    // Wait for the source textarea to be filled (confirms the puml loaded)
    await page.waitForFunction(
      () => {
        const el = document.querySelector<HTMLTextAreaElement>('#source');
        return el !== null && el.value.includes('@startuml');
      },
      { timeout: 5_000 },
    );
    // Wait for SVG to be rendered
    await page.locator('#preview svg').waitFor({ timeout: 5_000 });
    // Let the renderer settle
    await page.waitForTimeout(400);

    const screenshot = await page.locator('#preview').screenshot();
    writeFileSync(join(LOCAL_OUT, `${type}.png`), screenshot);

    const refSrc = join(ROOT, 'tests', 'visual', 'reference', type, 'canonical.png');
    if (existsSync(refSrc)) {
      copyFileSync(refSrc, join(REF_OUT, `${type}.png`));
    }
  }

  // Dot multi-fixture comparison — inject markup directly into the demo
  for (const fixture of DOT_DATA) {
    await page.evaluate((markup: string) => {
      const ta = document.getElementById('source') as HTMLTextAreaElement;
      ta.value = markup;
      ta.dispatchEvent(new Event('input'));
    }, fixture.markup);
    await page.waitForTimeout(300); // debounce is 200ms
    try {
      await page.locator('#preview svg').waitFor({ timeout: 5_000 });
    } catch {
      // fixture failed to render — screenshot anyway for review
    }
    await page.waitForTimeout(400);

    const screenshot = await page.locator('#preview').screenshot();
    writeFileSync(join(LOCAL_OUT, 'dot', `${fixture.slug}.png`), screenshot);

    const refSrc = join(DOT_REF_DIR, `${fixture.slug}.png`);
    if (existsSync(refSrc)) {
      copyFileSync(refSrc, join(REF_OUT, 'dot', `${fixture.slug}.png`));
    }
  }

  const html = buildHtml([...DIAGRAM_TYPES], DOT_DATA);
  writeFileSync(join(OUT_DIR, 'index.html'), html);
  console.log(`\nVisual QA report: ${join(OUT_DIR, 'index.html')}`);
});

function buildHtml(types: string[], dotFixtures: DotFixture[]): string {
  const rows = types
    .map((type) => {
      const refImg = existsSync(join(REF_OUT, `${type}.png`))
        ? `<img src="reference/${type}.png" alt="plantuml.com">`
        : `<div class="missing">No reference — run <code>pnpm visual:capture</code></div>`;

      return `
    <tr>
      <td class="name">${type}</td>
      <td class="cell">
        <p class="label">plantuml.com</p>
        ${refImg}
      </td>
      <td class="cell">
        <p class="label">local</p>
        <img src="local/${type}.png" alt="local">
      </td>
    </tr>`;
    })
    .join('');

  const dotRows = dotFixtures
    .map((f) => {
      const refImg = existsSync(join(REF_OUT, 'dot', `${f.slug}.png`))
        ? `<img src="reference/dot/${f.slug}.png" alt="plantuml.com">`
        : `<div class="missing">No reference for ${f.slug}</div>`;
      return `
    <tr>
      <td class="name" style="font-size:.75rem">${f.slug}</td>
      <td class="cell">
        <p class="label">plantuml.com</p>
        ${refImg}
      </td>
      <td class="cell">
        <p class="label">local</p>
        <img src="local/dot/${f.slug}.png" alt="local">
      </td>
    </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>plantuml-ts Visual QA</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:system-ui,sans-serif;margin:0;padding:1rem;background:#f5f5f5;color:#222}
    h1{margin-top:0}
    p.intro{color:#555}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #ccc;padding:.5rem;text-align:left;vertical-align:top}
    th{background:#eee;font-weight:600}
    td.name{font-weight:600;text-transform:capitalize;width:6rem;vertical-align:middle}
    td.cell{background:#fff;width:47%}
    p.label{margin:0 0 .25rem;font-size:.75rem;color:#777;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
    img{max-width:100%;display:block;border:1px solid #ddd;background:#fff}
    .missing{padding:1rem;color:#999;font-style:italic;background:#fafafa}
    code{background:#eee;padding:.1em .3em;border-radius:3px;font-size:.9em}
  </style>
</head>
<body>
  <h1>plantuml-ts Visual QA</h1>
  <p class="intro">
    Left: plantuml.com reference (pre-saved, no network).
    Right: local render (captured now).
  </p>
  <table>
    <thead>
      <tr><th>Type</th><th>Reference</th><th>Local</th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
  <h2 style="margin-top:2rem">Dot (@startdot) — per-fixture</h2>
  <table>
    <thead>
      <tr><th>Slug</th><th>Reference</th><th>Local</th></tr>
    </thead>
    <tbody>${dotRows}
    </tbody>
  </table>
</body>
</html>`;
}
