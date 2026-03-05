# @airalogy/aimd-core

`@airalogy/aimd-core` provides AIMD syntax parsing and canonical field extraction.

## Install

```bash
pnpm add @airalogy/aimd-core
```

## Main Capabilities

- Parse AIMD templates and fenced `quiz` / `fig` blocks.
- Build MDAST-compatible AIMD nodes.
- Extract normalized field metadata for downstream renderer/editor/recorder.

## Example

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
