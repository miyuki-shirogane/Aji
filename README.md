<p align="center"><img src="./assets/logo.png" width="88" alt="Aji" /></p>

# Aji

**Find any code in a GitHub repo — just describe it. Runs entirely in your browser.**

English | [中文](./README.zh-CN.md)

[![Download](https://img.shields.io/github/v/release/miyuki-shirogane/Aji?label=download&sort=semver)](https://github.com/miyuki-shirogane/Aji/releases/latest)
[![CI](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml/badge.svg)](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4)

<p align="center"><a href="https://github.com/miyuki-shirogane/Aji/raw/main/assets/demo.gif"><img src="./assets/demo.gif" alt="Aji demo (GIF)" width="760" /></a></p>
<p align="center"><sub>A GIF — sped up (index building <b>~6×</b>, the rest ~2×).</sub></p>

## Features

- ⌨️ **Cmd/Ctrl+K** on any repo — a command palette for code
- 🔍 Describe the logic in plain English, get the matching function/class
- 🔒 **100% local** — embeddings run on-device; no server, no LLM, read-only
- ⚡ **Incremental** — only new/changed files are re-embedded
- 🌐 **17 languages** — Python, JavaScript/TypeScript, Go, Rust, Java, C/C++, C#, PHP, Kotlin, Swift, Scala, Shell, Solidity, Zig
- 🧭 Jumps straight to the exact file and line range

## Install

1. Download `aji-<version>.zip` from the [latest release](https://github.com/miyuki-shirogane/Aji/releases/latest) and unzip it.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped `aji/` folder.
4. (Recommended) Extension **Options** → paste a GitHub Personal Access Token (raises the API quota from 60 to 5000 req/h).
5. Open a repo, press **Cmd/Ctrl+K**, click **Build index**, and wait for it to finish.
6. Type a query (e.g. `how does it detect github page navigation`), press Enter, and click a result to jump to the file and line.

## Scope & limitations

- Public repos, current ref, Chrome 116+.
- Incremental: only new/changed files are re-embedded (content-addressed by blob sha); test/vendor/generated files are skipped. Embeddings run on WebGPU when available.
- Query language: English (the default model is English-only and small/fast). Swap `MODEL_ID` (in `src/shared/const.ts`) for a multilingual one to support Chinese — at roughly 2x the embedding cost.
- Retrieval and navigation only — it does not generate code or answer questions.

## Help Aji

Aji is **FREE**. If you like it, please ⭐️ Star it at [GitHub](https://github.com/miyuki-shirogane/Aji)

[Feature discussions](https://github.com/miyuki-shirogane/Aji/discussions) and [bug reports](https://github.com/miyuki-shirogane/Aji/issues/) are also welcome.

Check out [contributing.md](./CONTRIBUTING.md) if you want to contribute to Aji directly.

## License

MIT
