<p align="center"><img src="./assets/logo.png" width="88" alt="Aji" /></p>

# Aji

**GitHub 语义代码检索 —— 浏览器内、本地向量。**

[English](./README.md) | 中文

[![Download](https://img.shields.io/github/v/release/miyuki-shirogane/Aji?label=download&sort=semver)](https://github.com/miyuki-shirogane/Aji/releases/latest)
[![CI](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml/badge.svg)](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4)

在 github.com 上按 **Cmd/Ctrl+K**，用自然语言描述你要找的逻辑，直接跳到对应的函数/类与行号。

- **默认私密** —— 代码不离开浏览器；无服务端、不调 LLM、只读。
- **就在页面里** —— 活在 github.com 上，不用新标签页、不用看板。
- **增量索引** —— 只对新增/变更的文件重新向量化。
- **零配置** —— 任意公开仓库开箱即用，无需账号。

## 演示

<p align="center"><a href="https://github.com/miyuki-shirogane/Aji/raw/main/assets/demo.gif"><img src="./assets/demo.gif" alt="Aji 演示(GIF)" width="760" /></a></p>
<p align="center"><sub>这是一张 GIF；「建立索引」一段做了 <b>约 6× 加速</b>，实际会慢一些（首次主要是模型加载）。</sub></p>

## 快速开始

1. 从 [最新 Release](https://github.com/miyuki-shirogane/Aji/releases/latest) 下载 `aji-<version>.zip` 并解压。
2. 打开 `chrome://extensions`，开启「开发者模式」。
3. 点「**加载已解压的扩展程序**」→ 选择解压出的 `aji/` 文件夹。
4. （建议）扩展「选项」→ 填入 GitHub Personal Access Token（配额 60 → 5000 次/小时）。
5. 打开一个仓库，按 **Cmd/Ctrl+K** → 点「**Build index**」→ 等它跑完。
6. 输入 query（如 `how does it detect github page navigation`）回车，点结果跳到对应文件与行号。

## 支持的语言

用 tree-sitter 以函数/类切块，语法**按需懒加载**（仓库里没有的语言不加载）：**Python、JavaScript、TypeScript/TSX、Go、Rust、Java、C、C++、C#、PHP、Kotlin、Swift、Scala、Shell、Solidity、Zig。**

## 适用范围与限制

- 公开仓库、当前 ref、Chrome 116+。支持语言：见上。
- **增量索引**：仅对新增/变更文件重新向量化（按 blob sha 内容寻址）；测试/依赖/生成类文件自动跳过；有 GPU 时走 WebGPU。当前模型为**纯英文**（小、快）；如需中文，可在 `src/shared/const.ts` 换 `Xenova/multilingual-e5-small`（并加 `query:`/`passage:` 前缀），代价是向量化约慢一倍。
- 只做检索导航，不生成代码、不回答问题。

## 帮助 Aji

Aji 是**免费的**。如果你喜欢它，欢迎 ⭐️ 到 [GitHub](https://github.com/miyuki-shirogane/Aji) 点 Star

[功能讨论](https://github.com/miyuki-shirogane/Aji/discussions) 与 [Bug 反馈](https://github.com/miyuki-shirogane/Aji/issues/) 也都欢迎。

想直接参与开发，请看 [contributing.md](./CONTRIBUTING.md)。

## 许可证

MIT
