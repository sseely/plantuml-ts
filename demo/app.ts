/// <reference types="vite/client" />
import { render } from 'plantuml-ts';
import type { RenderOptions } from 'plantuml-ts';

// Load example files
const examples = import.meta.glob('./examples/**/*.puml', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

function getEl<T extends Element>(id: string): T {
  return document.getElementById(id) as unknown as T;
}

const sourceEl = getEl<HTMLTextAreaElement>('source');
const previewEl = getEl<HTMLDivElement>('preview');
const errorBarEl = getEl<HTMLDivElement>('error-bar');
const renderTimeEl = getEl<HTMLDivElement>('render-time');
const themeEl = getEl<HTMLSelectElement>('theme');

let debounceTimer = 0;

async function doRender(): Promise<void> {
  const source = sourceEl.value;
  const themeVal = themeEl.value as
    | 'default'
    | 'dark'
    | 'sketchy'
    | 'monochrome';
  const opts: RenderOptions = { theme: themeVal };
  const t0 = performance.now();
  try {
    const svg = await render(source, opts);
    previewEl.innerHTML = svg;
    errorBarEl.textContent = '';
    errorBarEl.classList.add('hidden');
  } catch (err) {
    errorBarEl.textContent = String(err);
    errorBarEl.classList.remove('hidden');
  }
  renderTimeEl.textContent = `render: ${(performance.now() - t0).toFixed(1)}ms`;
}

sourceEl.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => void doRender(), 200);
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    clearTimeout(debounceTimer);
    void doRender();
  }
});

themeEl.addEventListener('change', () => void doRender());

// Nav buttons
document.querySelectorAll('[data-type]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const type = (btn as HTMLElement).dataset['type'];
    const loader = examples[`./examples/${type}/canonical.puml`];
    if (loader) {
      void loader().then((src) => {
        sourceEl.value = src;
        void doRender();
      });
    }
  });
});

// Load sequence example on startup
const sequenceLoader = examples['./examples/sequence/canonical.puml'];
if (sequenceLoader) {
  const src = await sequenceLoader();
  sourceEl.value = src;
  void doRender();
}
