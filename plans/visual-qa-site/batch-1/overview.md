# Batch 1 — Classify Script + package.json

Two independent tasks with no shared files. Run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Classify pdiff corpus into per-type manifests | typescript-pro | scripts/classify-corpus.ts | — | [x] |
| T4 | Add npm scripts + update planning docs | typescript-pro | package.json, planning/visual-qa.md | — | [x] |

T1 produces the manifest files at runtime (`npm run visual:classify`).
T4 wires up the scripts and documents the "adding a new type" workflow.
