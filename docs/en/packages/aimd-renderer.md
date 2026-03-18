# @airalogy/aimd-renderer

`@airalogy/aimd-renderer` renders AIMD into HTML or Vue nodes and can also extract fields.

> Protocol-level AIMD syntax, assigner semantics, and validation rules are normative in Airalogy docs. This page only describes how `@airalogy/aimd-renderer` renders and extracts those structures on the frontend.

## Install

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## Main Capabilities

- `renderToHtml(content)` for HTML output.
- `renderToVue(content)` for Vue vnode output.
- `parseAndExtract(content)` for field metadata extraction.
- All `assigner` code blocks are hidden from rendered output by default but still participate in extraction/validation upstream.
- `assignerVisibility` can switch assigners to `"collapsed"` or `"expanded"` rendering for authoring/debug views.
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

## Assigner Visibility

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(content, {
  assignerVisibility: "expanded",
})
```

Supported values:

- `"hidden"`: default, do not render assigner blocks.
- `"collapsed"`: render assigners inside collapsed `<details>` blocks with localized summaries.
- `"expanded"`: render assigners as visible code blocks (`python` for server assigners, `javascript` for client assigners).

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
    step: {
      reference: step => `Step ${step}`,
    },
    quiz: {
      answer: value => `参考答案：${value}`,
    },
  },
})
```

### Host Custom Elements

When integrating AIMD into a host application with its own preview components, use `aimdElementRenderers` to replace the default HTML for specific AIMD nodes:

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

Set `groupStepBodies: true` when the host element should receive following block content as slot/body children. The default AIMD metadata (`data-aimd-*`) is preserved, and step nodes now preserve parsed kwargs like `title`, `subtitle`, `checked_message`, and `result` for host-side adapters.

### Reusable Step Card UI

If you want a ready-made Vue rendering surface instead of mapping to your own custom element, use `createStepCardRenderer()` together with `renderToVue`:

```ts
import { createStepCardRenderer, renderToVue } from "@airalogy/aimd-renderer"

const { nodes } = await renderToVue(content, {
  groupStepBodies: true,
  aimdRenderers: {
    step: createStepCardRenderer(),
  },
})
```

This gives you a renderer-level step card with number badge, title, subtitle, result/check badges, and grouped body content. Host apps can still override it later with a custom AIMD renderer or element renderer.

Math styles are loaded automatically when calling async render APIs (`renderToHtml` / `renderToVue`) in browser environments.
If you need full control of style loading, import `@airalogy/aimd-renderer/styles` manually.
