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

## Example

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

Math styles are loaded automatically when calling async render APIs (`renderToHtml` / `renderToVue`) in browser environments.
If you need full control of style loading, import `@airalogy/aimd-renderer/styles` manually.
