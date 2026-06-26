# Batch 1 — Foundation (parallel)

All three tasks are independent. Launch in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | Block extractor + plugin scaffold | typescript-pro | `src/core/block-extractor.ts`, `src/diagrams/yaml/index.ts`, `src/index.ts`, `tests/unit/block-extractor.test.ts`, `tests/unit/yaml/plugin.test.ts` | — | [x] |
| T2 | YamlLine tokenizer | typescript-pro | `src/diagrams/yaml/yaml-line.ts`, `tests/unit/yaml/yaml-line.test.ts` | — | [x] |
| T3 | Monomorph + MonomorphToJson | typescript-pro | `src/diagrams/yaml/monomorph.ts`, `tests/unit/yaml/monomorph.test.ts` | — | [x] |

## Quality gate after Batch 1

```sh
npm test && npm run typecheck && npm run lint
```

T2 and T3 introduce pure utility modules. T1 introduces a working plugin
skeleton. Tests for T1 verify `accepts()` and block extraction; tests for
T2 verify line tokenization; tests for T3 verify Monomorph/convert behavior.
