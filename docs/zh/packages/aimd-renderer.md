# @airalogy/aimd-renderer

`@airalogy/aimd-renderer` 用于将 AIMD 渲染为 HTML / Vue，同时支持字段提取。

## 安装

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## 核心能力

- `renderToHtml(content)`：输出 HTML。
- `renderToVue(content)`：输出 Vue vnode。
- `parseAndExtract(content)`：提取结构化字段。
- 支持题目预览参数（是否展示答案、是否展示 rubric）。

## 示例

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

在浏览器环境中调用异步渲染 API（`renderToHtml` / `renderToVue`）时，会自动加载公式样式。
如果你需要完全控制样式加载，也可以手动引入 `@airalogy/aimd-renderer/styles`。
