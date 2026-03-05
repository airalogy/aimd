# @airalogy/aimd-core

Core parser and canonical field extraction for AIMD (Airalogy Markdown).

## Install

```bash
pnpm add @airalogy/aimd-core
```

## Quick Start

```ts
import { unified } from "unified"
import remarkParse from "remark-parse"
import { remarkAimd } from "@airalogy/aimd-core/parser"

const content = "{{var|sample_name: str}}"
const processor = unified().use(remarkParse).use(remarkAimd)
const tree = processor.parse(content)
const file = { data: {} } as any
processor.runSync(tree, file)

console.log(file.data.aimdFields)
```

## Documentation

- EN: <https://airalogy.github.io/aimd/en/packages/aimd-core>
- 中文: <https://airalogy.github.io/aimd/zh/packages/aimd-core>
- Source docs: `aimd/docs/en/packages/aimd-core.md`, `aimd/docs/zh/packages/aimd-core.md`
