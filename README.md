# Aji — GitHub 语义代码检索插件

在 github.com 页面上按 **Cmd/Ctrl+K** 唤起搜索面板，用自然语言描述要找的逻辑，插件在**本地**把仓库代码切块、向量化，返回最相关的函数/类，点击直接跳转到 **GitHub 文件 + 对应行号**。

> 范式：分块文本 → 向量化 → 自然语言 query 检索 → 跳转定位。
> **全程本地**：代码不离开浏览器，不上传任何服务器、不调用 LLM；只读、不写 GitHub。

参考项目：[Gitako](https://github.com/EnixCoda/Gitako)（路由/挂载方案，MIT）。

## 工作方式

```
github.com 页面
  └─ content script：监听 SPA 路由(turbo:load / pjax:end / 500ms 轮询)、Cmd/Ctrl+K 面板、跳转
       │  chrome.runtime
  └─ background service worker：GitHub API 拉文件树、codeload 下载源码、限流退避、编排、进度
       │  chrome.runtime
  └─ offscreen document：tree-sitter(AST 分块) + transformers.js(本地 embedding) + IndexedDB 检索
```

- **文件树**：`GET /repos/{o}/{r}/git/trees/{commit}?recursive=1`（超 10 万条自动退化逐子树拉取）。
- **源码**：`https://codeload.github.com/{o}/{r}/zip/{commit}` 一次拉全仓（**不占用 REST API 配额**），本地解压。
- **分块**：tree-sitter 取函数/类为最小单元；超大函数切窗；无语法或解析失败回退定长分块。
- **向量**：`Xenova/all-MiniLM-L6-v2`（384 维，ONNX，WebGPU 优先，回退 WASM），存 IndexedDB（按仓库独立索引）。
- **检索**：query 本地编码 → 暴力余弦 topN → 去重 → 结果。
- **跳转**：`https://github.com/{o}/{r}/blob/{commit}/{path}#L{start}-L{end}`（用 commit sha，避免行号漂移）。

## 构建

需要 Node 18+。

```bash
npm install
npm run build      # 产物在 dist/
```

`npm run build` 会先把 tree-sitter 与 onnxruntime 的 wasm 从 node_modules 拷到 `public/wasm/`（`.gitignore` 已忽略），再用 Vite + CRXJS 打包。

开发（带 HMR）：

```bash
npm run dev
```

> 若 npm 源很慢：`npm install --registry=https://registry.npmmirror.com`

## 加载与使用

1. Chrome 打开 `chrome://extensions`，开启右上角「开发者模式」。
2. 「加载已解压的扩展程序」→ 选择本项目的 `dist/` 目录。
3. （建议）点击扩展「详情」→「扩展程序选项」，填入 GitHub Personal Access Token：
   - 不填：匿名 API 配额 60 次/小时，仅够很小的仓库；
   - 填写 fine-grained PAT（公开仓库只读即可）：5000 次/小时。
   - Token 仅存本机浏览器，仅用于访问 `api.github.com`。
4. 打开任意仓库（如 `github.com/EnixCoda/Gitako`），按 **Cmd/Ctrl+K**。
5. 首次点「建立索引」，等进度跑完（首次会下载约 20MB 的向量模型）。
6. 输入自然语言（如 `how does it detect github page navigation`），回车，点击结果跳转。

## 适用范围与已知限制（MVP）

- 仅 **公开仓库**、**默认分支/当前 ref**、**Chrome 116+**。
- 支持解析的语言：**Python / JavaScript / TypeScript / TSX**；其他语言回退定长分块。
- **无增量索引**：仓库 commit 变化后需重建。
- 向量检索为暴力余弦（未上 ANN），索引体积随 chunk 数增长。
- query 为中文时，英文单语模型召回会下降——可在 `src/shared/const.ts` 把 `MODEL_ID` 换成多语模型（如 `Xenova/multilingual-e5-small`）。
- 结果只做检索导航，**不生成代码、不回答问题**。

## 目录

```
src/
  background/   服务 worker：github.ts(API/zip)、index.ts(编排/进度)
  content/      页面脚本：route.ts(路由)、index.ts(面板/跳转)
  offscreen/    离屏文档：chunker.ts(分块)、embedder.ts(向量)、store.ts(IndexedDB)、index.ts
  options/      PAT 设置页
  shared/       类型、消息、常量
scripts/copy-assets.mjs   拷贝 wasm 资源
manifest.config.ts        MV3 清单
```

## License

MIT
