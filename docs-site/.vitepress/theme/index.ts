// SPDX-License-Identifier: GPL-3.0-or-later
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Playground from './Playground.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Playground', Playground);
  },
} satisfies Theme;
