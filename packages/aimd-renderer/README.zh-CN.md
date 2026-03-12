# @airalogy/aimd-renderer

AIMD 渲染引擎：支持 HTML 渲染、Vue 渲染与字段提取。

## 安装

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## 快速开始

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"
const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

## 本地化

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const content = "{{quiz|q1}}"

const { html } = await renderToHtml(content, {
  locale: "zh-CN",
})
```

在浏览器环境中调用异步渲染 API（`renderToHtml` / `renderToVue`）时，会自动加载公式样式。  
只有在你希望手动预加载样式时，才需要引入 `@airalogy/aimd-renderer/styles`。

## 文档

- EN: <https://airalogy.github.io/aimd/en/packages/aimd-renderer>
- 中文: <https://airalogy.github.io/aimd/zh/packages/aimd-renderer>
- 文档源码：`aimd/docs/en/packages/aimd-renderer.md`、`aimd/docs/zh/packages/aimd-renderer.md`
