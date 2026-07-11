---
layout: home
hero:
  name: plantuml-ts
  text: PlantUML, in pure TypeScript
  tagline: PlantUML in pure TypeScript — no Java, no server, browser-native.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Open the playground
      link: /playground
    - theme: alt
      text: View on GitHub
      link: https://github.com/sseely/plantuml-ts
features:
  - title: Faithful to upstream PlantUML
    details: A deep port of the Java implementation's parsing, layout, and rendering rules — including the long tail of special cases. The class-diagram dot pipeline matches the upstream oracle on 680/680 comparable fixtures.
  - title: Pure SVG renderer
    details: No DOM, no canvas, no async rendering path. renderSync() takes PlantUML source and returns an SVG string, synchronously, in the browser or Node.
  - title: Preprocessor with documented scope
    details: "!define/!undefine, conditionals (!ifdef/!ifndef/!else/!endif), and !theme are supported. External !include is opt-in via a caller-supplied fetcher — see the divergences page for exact scope."
---
