// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from 'vitepress';

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
});
