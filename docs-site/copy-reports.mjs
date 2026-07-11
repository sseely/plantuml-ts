// SPDX-License-Identifier: GPL-3.0-or-later
//
// Mirror the committed reports (docs/parity-report.md, DIVERGENCES.md) into the
// VitePress site as parity.md / divergences.md so they publish alongside the
// rest of the docs. Run as the first step of `docs:dev` / `docs:build` (see
// package.json), so CI's `npm run docs:build` picks them up automatically.
// The copies are gitignored — the source files (docs/parity-report.md,
// DIVERGENCES.md) are the originals; edit those, never these.
//
// Each source has relative links written for its own location in the repo;
// rewrite them to site paths so they resolve on the published site.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const REPORTS = [
  {
    src: '../docs/parity-report.md',
    dst: 'parity.md',
    // ../DIVERGENCES.md or DIVERGENCES.md (from docs/parity-report.md,
    // both relative-to-repo-root and bare forms) -> the site's /divergences page.
    rewrites: [
      [/\]\(\.\.\/DIVERGENCES\.md\)/g, '](/divergences)'],
      [/\]\(DIVERGENCES\.md\)/g, '](/divergences)'],
    ],
  },
  {
    src: '../DIVERGENCES.md',
    dst: 'divergences.md',
    // docs/parity-report.md or ./docs/parity-report.md (from DIVERGENCES.md
    // at the repo root) -> the site's /parity page.
    rewrites: [
      [/\]\(\.\/docs\/parity-report\.md\)/g, '](/parity)'],
      [/\]\(docs\/parity-report\.md\)/g, '](/parity)'],
    ],
  },
];

for (const { src, dst, rewrites } of REPORTS) {
  let md = readFileSync(here(src), 'utf8');
  for (const [re, to] of rewrites) md = md.replace(re, to);
  const note =
    `<!-- Mirrored from ${src.replace('../', '')} by docs-site/copy-reports.mjs ` +
    `at docs build time. Edit the source report, not this copy. -->\n`;
  writeFileSync(here(dst), note + md);
  process.stderr.write(`copy-reports: wrote docs-site/${dst}\n`);
}
