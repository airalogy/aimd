# @airalogy/aimd-renderer

`@airalogy/aimd-renderer` 用于将 AIMD 渲染为 HTML / Vue，同时支持字段提取。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；本页只描述 `@airalogy/aimd-renderer` 如何在前端渲染并提取这些结构。

## 安装

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## 核心能力

- `renderToHtml(content)`：输出 HTML。
- `renderToVue(content)`：输出 Vue vnode。
- `parseAndExtract(content)`：提取结构化字段。
- 所有 `assigner` 代码块默认都不会出现在普通渲染输出中，但仍会在上游解析/提取阶段参与处理。
- 可通过 `assignerVisibility` 切换为 `"collapsed"` 或 `"expanded"`，用于作者视图或调试视图。
- 支持题目预览参数（是否展示答案、是否展示 rubric）。
- 支持通过 `locale` 切换渲染标签语言。

## 示例

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

## Assigner 可见性

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(content, {
  assignerVisibility: "expanded",
})
```

支持的值：

- `"hidden"`：默认值，不渲染 assigner 代码块。
- `"collapsed"`：把 assigner 渲染为默认折叠的 `<details>`，并显示本地化摘要标题。
- `"expanded"`：直接把 assigner 渲染成可见代码块；server assigner 按 `python`，client assigner 按 `javascript` 显示。

## 本地化

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content, {
  locale: "zh-CN",
})
```

## 进阶

只有在你需要自定义“步骤”“答案”“图注”这类渲染标签时，才需要覆盖 `messages`：

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml("{{quiz|q1}}", {
  locale: "zh-CN",
  messages: {
    step: {
      reference: step => `步骤${step}`,
    },
    quiz: {
      answer: value => `参考答案：${value}`,
    },
  },
})
```

### 宿主自定义元素

当 AIMD 需要接入宿主应用自己的预览组件时，可以通过 `aimdElementRenderers` 把特定 AIMD 节点的默认 HTML 替换成自定义元素：

```ts
import {
  createCustomElementAimdRenderer,
  renderToHtml,
} from "@airalogy/aimd-renderer"

const { html } = await renderToHtml("{{step|verify, 2, title='Verify Output', check=True}}", {
  groupStepBodies: true,
  aimdElementRenderers: {
    step: createCustomElementAimdRenderer("step-card", (node) => {
      const stepNode = node as any
      return {
        "step-id": stepNode.id,
        "step-number": stepNode.step,
        title: stepNode.title,
        level: String(stepNode.level),
        "has-check": stepNode.check ? "true" : undefined,
      }
    }, {
      container: true,
      stripDefaultChildren: true,
    }),
  },
})
```

如果希望宿主元素把后续块级正文当作 slot / body 内容接收，请启用 `groupStepBodies: true`。默认 AIMD 元数据（`data-aimd-*`）仍会保留，步骤节点的 `title`、`subtitle`、`checked_message`、`result` 等 kwargs 也会保存在节点元数据中，供宿主自定义渲染读取。

### 可复用 Step Card UI

如果你不想自己映射自定义元素，而是希望直接拿到一套可用的 Vue 步骤卡片渲染，可以把 `createStepCardRenderer()` 与 `renderToVue` 配合使用：

```ts
import { createStepCardRenderer, renderToVue } from "@airalogy/aimd-renderer"

const { nodes } = await renderToVue(content, {
  groupStepBodies: true,
  aimdRenderers: {
    step: createStepCardRenderer(),
  },
})
```

它会生成带编号徽标、标题、副标题、结果 / 勾选徽标以及步骤正文分组内容的 step-card。宿主应用后续仍然可以通过自定义 AIMD renderer 或 element renderer 覆盖它。

在浏览器环境中调用异步渲染 API（`renderToHtml` / `renderToVue`）时，会自动加载公式样式。
如果你需要完全控制样式加载，也可以手动引入 `@airalogy/aimd-renderer/styles`。
