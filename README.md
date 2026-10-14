# Aji

**Semantic code search for GitHub — in your browser, with local embeddings.**

English | [中文](./README.zh-CN.md)

[![CI](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml/badge.svg)](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml)

Press **Cmd/Ctrl+K** on github.com, describe the logic you're looking for in natural language, and jump straight to the matching function/class and line.

Everything runs locally: code never leaves the browser, no LLM, no server. Read-only.

## Quick start

```bash
npm install
npm run build          # output in dist/
```

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `dist/`.
3. (Recommended) Extension **Options** → paste a GitHub Personal Access Token (raises the API quota from 60 to 5000 req/h).
4. Open a repo (e.g. `github.com/EnixCoda/Gitako`), press **Cmd/Ctrl+K**, click **Build index**, wait for it to finish.
5. Type e.g. `how does it detect github page navigation`, hit Enter, click a result to jump to `blob/<commit>/.../file.ts#Lx-Ly`.

## How it works

```
github.com
  └─ content script   routing (turbo:load / pjax:end / 500ms poll), Cmd/Ctrl+K panel, jump
  └─ background (SW)  GitHub API tree, codeload zip sources, rate-limit backoff, orchestration
  └─ offscreen doc    tree-sitter chunking + transformers.js (ONNX) embeddings + IndexedDB search
```

- **Files**: `git/trees?recursive=1`; sources fetched in one shot via `codeload` zip (no REST quota).
- **Chunks**: functions/classes via tree-sitter; large functions windowed; fixed-size fallback.
- **Vectors**: `Xenova/all-MiniLM-L6-v2` (384-dim, WebGPU→WASM), stored per-repo in IndexedDB; brute-force cosine.
- **Jump**: `github.com/{o}/{r}/blob/{commit}/{path}#L{start}-L{end}`.

## Scope & limitations

- Public repos, current ref, Chrome 116+. Parsed languages: Python / JavaScript / TypeScript / TSX (others fall back to fixed-size chunking).
- Incremental: only new/changed files are re-embedded (content-addressed by blob sha); test/vendor/generated files are skipped. Embeddings run on WebGPU when available.
- Chinese queries drop recall on the English single-language model — swap `MODEL_ID` in `src/shared/const.ts` for a multilingual one.
- Retrieval and navigation only — it does not generate code or answer questions.

## Development

```bash
npm run dev      # HMR
npm test         # vitest (route parsing, chunking, source-path parsing)
npm run build
```

## License

MIT
