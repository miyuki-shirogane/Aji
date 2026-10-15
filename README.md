<p align="center"><img src="./assets/logo.png" width="88" alt="Aji" /></p>

# Aji

**Semantic code search for GitHub — in your browser, with local embeddings.**

English | [中文](./README.zh-CN.md)

[![Download](https://img.shields.io/github/v/release/miyuki-shirogane/Aji?label=download&sort=semver)](https://github.com/miyuki-shirogane/Aji/releases/latest)
[![CI](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml/badge.svg)](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4)

Press **Cmd/Ctrl+K** on github.com, describe the logic you're looking for, and jump straight to the matching function/class and line.

- **Private by default** — code never leaves your browser; no server, no LLM, read-only.
- **In-page** — lives on github.com; no new tab, no dashboard.
- **Incremental** — only new/changed files are re-embedded.
- **Zero config** — any public repo, no account.

## Demo

<p align="center"><a href="https://github.com/miyuki-shirogane/Aji/raw/main/assets/demo.gif"><img src="./assets/demo.gif" alt="Aji demo (GIF)" width="760" /></a></p>
<p align="center"><sub>A GIF — index building is shown <b>~6× faster</b> than real time (a bit longer on a cold start).</sub></p>

## Quick start

1. Download `aji-<version>.zip` from the [latest release](https://github.com/miyuki-shirogane/Aji/releases/latest) and unzip it.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped `aji/` folder.
4. (Recommended) Extension **Options** → paste a GitHub Personal Access Token (raises the API quota from 60 to 5000 req/h).
5. Open a repo, press **Cmd/Ctrl+K**, click **Build index**, and wait for it to finish.
6. Type a query (e.g. `how does it detect github page navigation`), press Enter, and click a result to jump to the file and line.

## How it works

<p align="center"><img src="./assets/architecture.svg" alt="Aji architecture" width="700" /></p>

- **Files**: `git/trees?recursive=1`; sources fetched in one shot via `codeload` zip (no REST quota).
- **Chunks**: functions/classes via tree-sitter; large functions windowed; fixed-size fallback.
- **Vectors**: `Xenova/all-MiniLM-L6-v2` (384-dim, English, WebGPU→WASM), stored per-repo in IndexedDB; brute-force cosine.
- **Jump**: `github.com/{o}/{r}/blob/{commit}/{path}#L{start}-L{end}`.

## Supported languages

AST-aware chunking (function / class / method level). Grammars are lazy-loaded,
so a repo only pays for the languages it actually contains.

| Language | Extensions |
|---|---|
| Python | `.py` |
| JavaScript | `.js` `.jsx` `.mjs` `.cjs` |
| TypeScript / TSX | `.ts` `.tsx` |
| Go | `.go` |
| Rust | `.rs` |
| Java | `.java` |
| C | `.c` `.h` |
| C++ | `.cpp` `.cc` `.cxx` `.hpp` `.hh` `.hxx` |
| C# | `.cs` |
| PHP | `.php` |
| Kotlin | `.kt` `.kts` |
| Swift | `.swift` |
| Scala | `.scala` `.sc` |
| Shell | `.sh` `.bash` `.zsh` |
| Solidity | `.sol` |
| Zig | `.zig` |

More languages are easy to add: copy the grammar wasm in `scripts/copy-assets.mjs`,
then extend `EXT_TO_LANG`, `GRAMMAR_FILES` and `NODE_TYPES` in
`src/shared/const.ts` (`tree-sitter-wasms` ships 30+ grammars).

## Scope & limitations

- Public repos, current ref, Chrome 116+. Supported languages: see above.
- Incremental: only new/changed files are re-embedded (content-addressed by blob sha); test/vendor/generated files are skipped. Embeddings run on WebGPU when available.
- Query language: English (the default model is English-only and small/fast). Swap `MODEL_ID` in `src/shared/const.ts` for a multilingual one (e.g. `Xenova/multilingual-e5-small`) with matching task prefixes to support Chinese — at roughly 2x the embedding cost.
- Retrieval and navigation only — it does not generate code or answer questions.

## Evaluation (indicative)

Retrieval-only benchmark on this repo: 30 hand-written queries, a single small
repo, no reranker, English model. Reproduce with `npm run eval`.

| Metric | Score |
|---|---|
| File Top-1 | ~67% |
| File Top-5 | ~90% |
| Symbol Top-5 | ~73% |
| File MRR | ~0.77 |

Caveats: tiny, self-authored set on one repo; "correct" = one specific function,
so it understates usefulness (the right *file* lands in the top 5 ~90% of the
time). Numbers move ±1 case (±3%) between runs of the same config — treat this
as a smoke signal, not a competitive claim.

## Help Aji

Aji is free and open source. If it's useful to you, please help it grow:

- **[Star the repo](https://github.com/miyuki-shirogane/Aji)** and share it, so more people find it.
- **[Report a bug or request a feature](https://github.com/miyuki-shirogane/Aji/issues)** — tell me what's missing (another language, better ranking, private repos…).
- **Contribute** — pull requests are welcome; see [CONTRIBUTING.md](./CONTRIBUTING.md) for how to build, test and extend it.

## License

MIT
