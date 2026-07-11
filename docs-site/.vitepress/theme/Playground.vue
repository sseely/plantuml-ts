<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
// Aliased in .vitepress/config.ts to the real library source (src/index.ts,
// D2), so the playground always runs exactly what ships.
import { renderSync } from 'plantuml-ts';

const DEFAULT_SOURCE = `@startuml
class Animal {
  -name: String
  #age: int
  +makeSound(): void
}

class Dog extends Animal {
  +breed: String
  +fetch(): void
}

class Cat extends Animal {
  +indoor: boolean
  +scratch(): void
}

interface Pet {
  +play(): void
}

Dog ..|> Pet
Animal "1" -- "0..*" Toy : owns >

class Toy {
  +name: String
}
@enduml`;

const props = defineProps<{
  initial?: string;
  height?: string;
}>();

const source = ref(props.initial ?? DEFAULT_SOURCE);
const svg = ref('');
const error = ref('');

function renderNow(): void {
  // Render is client-only — CanvasMeasurer needs the DOM <canvas> API, which
  // is unavailable during VitePress's Node-side SSR pass.
  if (typeof window === 'undefined') return;
  try {
    svg.value = renderSync(source.value);
    error.value = '';
  } catch (e) {
    // renderSync() catches its own parse/layout errors and returns an error
    // SVG rather than throwing, but this guards against any other
    // unexpected failure so the pane never goes blank or silent.
    svg.value = '';
    error.value = e instanceof Error ? e.message : String(e);
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

function scheduleRender(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(renderNow, 250);
}

onMounted(renderNow);
watch(source, scheduleRender);
</script>

<template>
  <div class="pu-playground">
    <div class="pu-panes" :style="{ height: props.height ?? '480px' }">
      <div class="pu-editor">
        <textarea
          v-model="source"
          class="pu-input"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          aria-label="PlantUML source"
        ></textarea>
      </div>
      <div class="pu-output" aria-label="Rendered SVG">
        <pre v-if="error" class="pu-error">{{ error }}</pre>
        <div v-else class="pu-svg" v-html="svg"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pu-playground {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  margin: 1rem 0;
}
.pu-panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.pu-editor {
  position: relative;
  border-right: 1px solid var(--vp-c-divider);
  overflow: hidden;
  background: var(--vp-c-bg);
}
.pu-input {
  margin: 0;
  padding: 0.75rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  line-height: 1.5;
  tab-size: 4;
  white-space: pre;
  word-wrap: normal;
  overflow-wrap: normal;
  border: none;
  width: 100%;
  height: 100%;
  resize: none;
  outline: none;
  background: transparent;
  color: var(--vp-c-text-1);
  caret-color: var(--vp-c-text-1);
  overflow: auto;
  box-sizing: border-box;
}
.pu-output {
  overflow: auto;
  padding: 0.75rem;
  background: #fff;
}
.pu-svg :deep(svg) {
  max-width: 100%;
  height: auto;
}
.pu-error {
  color: var(--vp-c-danger-1);
  white-space: pre-wrap;
  font-size: 0.8rem;
  margin: 0;
}
@media (max-width: 640px) {
  .pu-panes {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
    height: auto !important;
  }
}
</style>
