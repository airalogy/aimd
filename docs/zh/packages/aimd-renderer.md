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
