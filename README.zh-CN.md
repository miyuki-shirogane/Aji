<p align="center"><img src="./assets/logo.png" width="88" alt="Aji" /></p>

# Aji

**GitHub 语义代码检索 —— 浏览器内、本地向量。**

[English](./README.md) | 中文

[![CI](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml/badge.svg)](https://github.com/miyuki-shirogane/Aji/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4)

在 github.com 上按 **Cmd/Ctrl+K**，用自然语言描述你要找的逻辑，直接跳到对应的函数/类与行号。

- **默认私密** —— 代码不离开浏览器；无服务端、不调 LLM、只读。
- **就在页面里** —— 活在 github.com 上，不用新标签页、不用看板。
- **增量索引** —— 只对新增/变更的文件重新向量化。
- **零配置** —— 任意公开仓库开箱即用，无需账号。

## 演示

<p align="center"><img src="./assets/demo.gif" alt="Aji 演示" width="760" /></p>
<p align="center"><sub>「建立索引」一段做了 <b>约 6× 加速</b>；实际会慢一些（首次主要是模型加载，多等一会儿）。</sub></p>

## 快速开始

```bash
npm install
npm run build          # 产物在 dist/
```

1. 打开 `chrome://extensions`，开启「开发者模式」。
2. **加载已解压的扩展程序** → 选 `dist/`。
3. （建议）扩展「选项」→ 填入 GitHub Personal Access Token（把 API 配额从 60 提到 5000 次/小时）。
4. 打开仓库（如 `github.com/EnixCoda/Gitako`），按 **Cmd/Ctrl+K** → 点「建立索引」→ 等完成。
5. 输入如 `how does it detect github page navigation`，回车，点结果跳到 `blob/<commit>/.../file.ts#Lx-Ly`。

## 工作原理

<p align="center"><img src="./assets/architecture.svg" alt="Aji 架构" width="700" /></p>

- **文件**：`git/trees?recursive=1`；源码用 `codeload` zip 一次拉全仓（不占 REST 配额）。
- **分块**：tree-sitter 取函数/类；超大函数切窗；无语法时回退定长分块。
- **向量**：`Xenova/all-MiniLM-L6-v2`（384 维，英文，WebGPU→WASM），按仓库存 IndexedDB；暴力余弦。
- **跳转**：`github.com/{o}/{r}/blob/{commit}/{path}#L{start}-L{end}`。

## 支持的语言

按 AST 分块（函数 / 类 级）：

| 语言 | 扩展名 |
|---|---|
| Python | `.py` |
| JavaScript | `.js` `.jsx` `.mjs` `.cjs` |
| TypeScript | `.ts` |
| TSX | `.tsx` |

其他语言**暂不索引**。新增一种很简单：在 `scripts/copy-assets.mjs` 里拷入它的
`tree-sitter` 语法 wasm，再扩展 `src/shared/const.ts` 的 `EXT_TO_LANG` 与
`NODE_TYPES` 即可（`tree-sitter-wasms` 内置 35+ 种语法）。

## 适用范围与限制

- 公开仓库、当前 ref、Chrome 116+。支持语言：见上。
- **增量索引**：仅对新增/变更文件重新向量化（按 blob sha 内容寻址）；测试/依赖/生成类文件自动跳过；有 GPU 时走 WebGPU。当前模型为**纯英文**（小、快）；如需中文，可在 `src/shared/const.ts` 换 `Xenova/multilingual-e5-small`（并加 `query:`/`passage:` 前缀），代价是向量化约慢一倍。
- 只做检索导航，不生成代码、不回答问题。

## 评测（参考性）

仅检索、无重排，英文模型；用例 30 条、单个小仓库、人工编写。复现：`npm run eval`。

| 指标 | 分数 |
|---|---|
| File Top-1 | ~67% |
| File Top-5 | ~90% |
| 函数(Symbol) Top-5 | ~73% |
| File MRR | ~0.77 |

局限：样本小、自建、单仓库，且"正确"只认某一个函数（会低估实用性——正确**文件**进前五约 90%）。同一配置多次运行会差 ±1 条（±3%）。**当参考信号看，不作竞争性宣称。**

## 开发

```bash
npm run dev      # HMR
npm test         # vitest（路由解析、分块、源码路径解析）
npm run build
```

## 许可证

MIT
