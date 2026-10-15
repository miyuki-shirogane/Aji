# Contributing to Aji

Thanks for wanting to make Aji better! It's free and MIT-licensed, and it grows
from people like you. Bug reports, feature ideas, docs and code are all welcome.

## Ways to help

- **Star and share** the repo — the simplest way to help more people find it.
- **Report a bug / request a feature** via [Issues](https://github.com/miyuki-shirogane/Aji/issues). Tell us the repo URL, the query, and what you expected vs. got.
- **Improve search quality** — run the benchmark, try a different model or a reranker, and share numbers (see below).
- **Add a language** — see below; it's a small, self-contained change.
- **Docs / UI polish / translations** are welcome too.

## Development

Requires Node 18+.

```bash
npm install
npm run dev       # Vite dev server (HMR)
npm test          # unit tests (vitest)
npm run build     # → dist/  (load this folder unpacked)
npm run icons     # regenerate icons from assets/icon.webp (needs sharp)
npm run eval      # retrieval benchmark against eval/cases.json
```

- `npm test` covers route parsing, chunking (runs the real tree-sitter parser in
  Node), path/extension helpers, and the noise-file filter.
- `npm run eval` drives the built extension in Chromium (install once with
  `npm i -D playwright-core && npx playwright install chromium`) and prints
  File/Symbol accuracy + MRR. **Set a GitHub PAT in the extension options first**
  or repeated runs will hit the anonymous rate limit (60 req/h).

## How it works (map)

```
src/content/     in-page: SPA routing, Cmd/Ctrl+K panel, jump to line
src/background/  service worker: GitHub API tree, codeload zip, orchestration
src/offscreen/   offscreen doc: tree-sitter chunking, transformers.js embeddings, IndexedDB
src/shared/      types, messages, constants
```

Key files: `src/shared/const.ts` (model, language map, chunk node types),
`src/background/github.ts` (API + rate-limit backoff), `src/offscreen/chunker.ts`
(AST chunking), `src/offscreen/index.ts` (index + hybrid search).

## Adding a language

1. Add the grammar wasm to `scripts/copy-assets.mjs` (copy it from
   `node_modules/tree-sitter-wasms/out/` — the package ships 35+ grammars).
2. Extend `EXT_TO_LANG`, `GRAMMAR_FILES` and `NODE_TYPES` in `src/shared/const.ts`.
3. Add the extension → language mapping to the language table in both READMEs.

## Pull requests

- Keep PRs focused; one concern per PR.
- Add or update tests where it makes sense, and run `npm test` + `npm run build`.
- If you change behavior, update the READMEs (English and Chinese).
- By contributing you agree your work is released under the MIT license.
