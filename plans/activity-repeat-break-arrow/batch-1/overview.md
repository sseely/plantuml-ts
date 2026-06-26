# Batch 1 — Repeat terminator fix + repeat-start diamond

## Description

Two self-contained fixes that unblock the fixture from cascading parse
failure. No AST changes. No layout architecture changes.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | repeat terminator fix + repeat-start diamond | typescript-pro | parser.ts, renderer.ts, parser.test.ts, renderer.test.ts | — | [x] |

## After this batch

Run all quality gates. If green, mark T1 `[x]` in README.md and commit.
Then proceed to Batch 2.
