# Batch 1 — capture + decode + resolution (parallel)

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Vendor pipeline: all bundles, pinned SHA, sha256 manifest, licenses | typescript-pro | scripts/vendor-stdlib.ts (new), assets/stdlib/** (gitignored), assets/stdlib.manifest.json (committed), .gitignore (one line), .github/workflows/* (CI cache step ONLY if a test needs assets in CI — check first) | — | [ ] |
| T2 | Port AsciiEncoder + code/deflate Decompressor (sync raw-inflate) | typescript-pro | src/core/klimt/sprite/AsciiEncoder.ts, src/core/code/deflate/** (mirror upstream layout), tests/unit/sprite-decode.test.ts | — | [ ] |
| T3 | Stdlib resolution semantics + StdlibStore API | typescript-pro | src/core/tim/IncludeStore.ts, src/core/tim/IncludeExecutor.ts (:145-160 region), src/core/tim/StdlibStore.ts (new), tests/unit/stdlib-resolution.test.ts | — | [ ] |

Write-sets disjoint. T1 is Node tooling (scripts/ — Node built-ins fine
there, NEVER in src/). Gates after batch: full gates + DOT FROZEN exact
(261/262, 85/90, 708/708, 78/80, 266/267) — nothing behavioral changes yet
(T3's store lookup only fires when a store is supplied; no store exists in
production paths until packages land).

Key task details (specs below are the prompt-ready docs):

**T1**: copy EVERY child dir of ~/git/plantuml-stdlib/stdlib verbatim
(binary-safe; no newline/encoding normalization — sha256 proves it);
manifest records source SHA, per-file sha256, per-bundle README metadata
(name/version/license/link/source). Alias dirs (awslib, bootstrap,
material*) captured as-is; their `link:` recorded for T3. Idempotent; a
--verify mode re-hashes. adaml captured like everything else (GPL noted in
manifest).

**T2**: AsciiEncoder decode/encode6bit per AsciiEncoder.java:40-148
(0-9→0-9, A-Z→10-35, a-z→36-61, `-`→62, `_`→63; 4 chars→3 bytes; missing
trailing chars = value 0); Decompressor = faithful port of upstream
code/deflate/{Decompressor,ByteBitInputStream,…}.java (raw DEFLATE, no
zlib wrapper; pad input +256 zero bytes per CompressionZlib.java:77-87).
Test vectors: extract 2-3 real `[64x64/16z]` sprite bodies from
assets/stdlib (T1 may not be merged yet — copy the vectors from
~/git/plantuml-stdlib directly into the test file as literals) and assert
decoded W*H gray bytes against the jar-rendered expectation (spot pixel
values; document how derived).

**T3**: mirror Stdlib.getPumlResource (Stdlib.java:98-114) + the TContext
dispatch (TContext.java:792-856): lowercase, strip `.puml`, first-slash
split, `<bundle>`-alone → miss, alias map from manifest metadata, no
once-dedup/no `!SUB` in this branch. `StdlibStore` = the object the
packages will construct: `stdlibStore(...bundles: BundleData[])` where
`BundleData = { name, aliasOf?, files: Record<lowercasePath, string> }`.
IncludeExecutor: consult the store BEFORE throwing StdlibNotBundledError;
absent store or missing bundle → the existing typed error, unchanged
message. Interface contract consumed by T8/T9.
