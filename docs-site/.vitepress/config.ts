// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from 'vitepress';
import { fileURLToPath, URL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

// VitePress treats any resolved module id matching /\.data\.m?(j|t)s($|\?)/
// as a build-time "data loader" (see vitepress/dist/node's staticDataPlugin)
// and tries to execute it as a `{ load(): ... }` config file. The library's
// generated font-metrics tables (src/core/measurer-jar.data.ts,
// src/core/measurer-width-table.data.ts — see scripts/extract-jar-font-metrics)
// happen to match that unrelated naming convention, and renderSync's static
// import chain pulls both in unconditionally. Renaming those files is out of
// this task's write-set (T5 owns docs-site/.vitepress only), so this plugin
// resolves the two colliding specifiers to a non-matching virtual id and
// serves the real file's source verbatim, sidestepping VitePress's plugin
// entirely without forking or duplicating the generated data.
const DATA_FILE_RE = /measurer-(jar|width-table)\.data\.[jt]s$/;
// A `\0`-prefixed truly-virtual id would dodge VitePress's regex, but Vite's
// own esbuild TS-transform plugin skips `\0`-prefixed ids by convention
// (they're assumed to already be plain JS), leaving the returned TS syntax
// unparsed. Renaming the `.data.ts` suffix keeps the id a normal-looking,
// non-virtual `.ts` path — picked up by the TS transform, invisible to
// VitePress's `\.data\.m?(j|t)s` matcher.
const MARKER_SUFFIX = '.__data_shim__.ts';

function libraryDataFileShim(): Plugin {
  return {
    name: 'plantuml-ts-data-file-shim',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !DATA_FILE_RE.test(source)) return null;
      const real = resolvePath(dirname(importer), source.replace(/\.js$/, '.ts'));
      return real.replace(/\.data\.ts$/, MARKER_SUFFIX);
    },
    load(id) {
      if (!id.endsWith(MARKER_SUFFIX)) return null;
      const real = id.slice(0, -MARKER_SUFFIX.length) + '.data.ts';
      return readFileSync(real, 'utf-8');
    },
  };
}

// Deployed at https://sseely.github.io/plantuml-ts/ — base must match the repo.
export default defineConfig({
  base: '/plantuml-ts/',
  title: 'plantuml-ts',
  description:
    'PlantUML in pure TypeScript — no Java, no server, browser-native. ' +
    'PlantUML source in, SVG out.',
  lang: 'en-US',
  cleanUrls: true,
  themeConfig: {
    // Built-in offline search (MiniSearch); no external service.
    search: { provider: 'local' },
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Playground', link: '/playground' },
      { text: 'API', link: '/guide/api' },
      { text: 'Parity', link: '/parity' },
      { text: 'Divergences', link: '/divergences' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'API reference', link: '/guide/api' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Playground', link: '/playground' },
          { text: 'Parity dashboard', link: '/parity' },
          { text: 'Known divergences', link: '/divergences' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/sseely/plantuml-ts' },
    ],
  },
  vite: {
    plugins: [libraryDataFileShim()],
    resolve: {
      alias: {
        // The playground imports the *real* engine source (D2), so docs
        // stay in lockstep with the library rather than a copied bundle.
        'plantuml-ts': fileURLToPath(
          new URL('../../src/index.ts', import.meta.url),
        ),
      },
    },
  },
});
