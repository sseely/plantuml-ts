# Decision Journal

| # | Task | Decision | Rationale |
|---|------|----------|-----------|
| 1 | T1 — pnpm vs npm | Removed package-lock.json created by agent; ran pnpm install + pnpm add katex | Project uses pnpm (pnpm-lock.yaml); agent used npm install which doesn't update pnpm-lock.yaml and leaves katex unresolvable at test time |
