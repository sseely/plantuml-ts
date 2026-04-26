/**
 * Fetch reference PNG images from plantuml.com once and save them to
 * tests/visual/reference/<type>/canonical.png.
 *
 * Run once (not in CI): pnpm visual:capture
 * Commit the resulting reference images — they are the ground truth.
 */
import { plantumlUrl } from './plantuml-encode.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

async function captureOne(type: string): Promise<void> {
  const pumlPath = join(ROOT, 'demo', 'examples', type, 'canonical.puml');
  const outDir = join(ROOT, 'tests', 'visual', 'reference', type);
  const outPath = join(outDir, 'canonical.png');

  const source = readFileSync(pumlPath, 'utf-8');
  const url = plantumlUrl(source);

  process.stdout.write(`Fetching ${type}... `);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${type}: HTTP ${response.status} ${response.statusText}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, data);
  console.log(`${data.length} bytes → ${outPath}`);
}

async function main(): Promise<void> {
  console.log('Capturing reference images from plantuml.com...\n');
  for (const type of DIAGRAM_TYPES) {
    await captureOne(type);
    // Polite delay — one request per 600ms
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
  }
  console.log('\nDone. Commit tests/visual/reference/ to the repo.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
