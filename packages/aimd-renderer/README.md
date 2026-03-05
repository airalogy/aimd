# @airalogy/aimd-renderer

Rendering engine for AIMD: HTML output, Vue output, and field extraction.

## Install

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## Quick Start

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"
const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

## Documentation

- EN: <https://airalogy.github.io/aimd/en/packages/aimd-renderer>
- 中文: <https://airalogy.github.io/aimd/zh/packages/aimd-renderer>
- Source docs: `aimd/docs/en/packages/aimd-renderer.md`, `aimd/docs/zh/packages/aimd-renderer.md`
