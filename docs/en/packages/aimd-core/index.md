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

## Markdown Tables

If AIMD inline templates appear inside Markdown tables, protect them before `parse()` so GFM does not split on the template pipe:

```ts
import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"

const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
const file = { data: { aimdInlineTemplates: templates } } as any
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

## Further Reading

- Parsed nodes and extracted fields now use `id` only. If you are upgrading older integrations, read [Migration](/en/packages/aimd-core/compatibility) first.
- [Parsed Nodes](/en/packages/aimd-core/parsed-nodes)
- [Extracted Fields](/en/packages/aimd-core/extracted-fields)
- [Migration](/en/packages/aimd-core/compatibility)
