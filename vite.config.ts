import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PlantUmlTs',
      fileName: 'plantuml-ts',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['katex'],
    },
    sourcemap: true,
  },
});
