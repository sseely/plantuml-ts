# Batch 2 — Capture Script + Page Generator

Two independent tasks. Both consume manifests produced at runtime by T1.
The interface contract (manifest format) is in decisions.md#D5.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | Corpus capture script | typescript-pro | scripts/capture-corpus.ts | Batch 1 | [x] |
| T3 | Page generator script | typescript-pro | scripts/build-pages.ts | Batch 1 | [x] |

T2 reads manifests and fetches PNGs from plantuml.com.
T3 reads manifests and generates index.html + per-type HTML pages.
Neither needs T1 to have been *run* — they only need to agree on the
manifest format specified in decisions.md.
