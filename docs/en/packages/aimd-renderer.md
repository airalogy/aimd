# @airalogy/aimd-renderer

`@airalogy/aimd-renderer` renders AIMD into HTML or Vue nodes and can also extract fields.

## Install

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## Main Capabilities

- `renderToHtml(content)` for HTML output.
- `renderToVue(content)` for Vue vnode output.
- `parseAndExtract(content)` for field metadata extraction.
- Quiz preview controls (answer/rubric visibility by mode).
- Built-in locale support via `locale`.

## Example

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

## Localization

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content, {
  locale: "zh-CN",
})
```

## Advanced

Use `messages` only when you need to customize renderer labels such as `Step`, `Answer:`, or figure captions:

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml("{{quiz|q1}}", {
  locale: "zh-CN",
  messages: {
    quiz: {
      answer: value => `参考答案：${value}`,
    },
  },
})
```

Math styles are loaded automatically when calling async render APIs (`renderToHtml` / `renderToVue`) in browser environments.
If you need full control of style loading, import `@airalogy/aimd-renderer/styles` manually.
