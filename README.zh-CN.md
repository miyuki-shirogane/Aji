<p align="center"><img src="./assets/logo.png" width="88" alt="Aji" /></p>

# Aji

**在任意 GitHub 仓库里找代码 —— 描述一句即可，全程在浏览器内运行。**

[English](./README.md) | 中文

[![Download](https://img.shields.io/github/v/release/miyuki-shirogane/Aji?label=download&sort=semver)](https://github.com/miyuki-shirogane/Aji/releases/latest)
[![CI](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml/badge.svg)](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4)

<p align="center"><a href="https://github.com/miyuki-shirogane/Aji/raw/main/assets/demo.gif"><img src="./assets/demo.gif" alt="Aji 演示(GIF)" width="760" /></a></p>
<p align="center"><sub>这是一张 GIF；已加速（建立索引 <b>约 6×</b>，其余约 2×）。</sub></p>

## 特性

- ⌨️ **Cmd/Ctrl+K** 唤起 —— 代码的「命令面板」
- 🔍 用自然语言描述逻辑，直接找到对应函数/类
- 🔒 **全程本地** —— 向量在设备上计算；无服务端、不调 LLM、只读
- ⚡ **增量索引** —— 只对新增/变更的文件重新向量化
- 🌐 **17 种语言** —— Python、JavaScript/TypeScript、Go、Rust、Java、C/C++、C#、PHP、Kotlin、Swift、Scala、Shell、Solidity、Zig
- 🧭 直接跳到精确的文件与行号

## 安装

1. 从 [最新 Release](https://github.com/miyuki-shirogane/Aji/releases/latest) 下载 `aji-<version>.zip` 并解压。
2. 打开 `chrome://extensions`，开启「开发者模式」。
3. 点「**加载已解压的扩展程序**」→ 选择解压出的 `aji/` 文件夹。
4. （建议）扩展「选项」→ 填入 GitHub Personal Access Token（配额 60 → 5000 次/小时）。
5. 打开一个仓库，按 **Cmd/Ctrl+K** → 点「**Build index**」→ 等它跑完。
6. 输入 query（如 `how does it detect github page navigation`）回车，点结果跳到对应文件与行号。

## 适用范围与限制

- 公开仓库、当前 ref、Chrome 116+。
- **增量索引**：仅对新增/变更文件重新向量化（按 blob sha 内容寻址）；测试/依赖/生成类文件自动跳过；有 GPU 时走 WebGPU。
- Query 语言：当前为**纯英文**模型（小、快）；如需中文，可在 `src/shared/const.ts` 换多语言模型，代价是向量化约慢一倍。
- 只做检索导航，不生成代码、不回答问题。

## 帮助 Aji

Aji 是**免费的**。如果你喜欢它，欢迎 ⭐️ 到 [GitHub](https://github.com/miyuki-shirogane/Aji) 点 Star

[功能讨论](https://github.com/miyuki-shirogane/Aji/discussions) 与 [Bug 反馈](https://github.com/miyuki-shirogane/Aji/issues/) 也都欢迎。

想直接参与开发，请看 [contributing.md](./CONTRIBUTING.md)。

## 许可证

MIT
