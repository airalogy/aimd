# @airalogy/aimd-core

Core parser and canonical field extraction for AIMD (Airalogy Markdown).

It also extracts frontend-only assigners from fenced `assigner runtime=client` blocks into `fields.client_assigner`.

> Protocol-level AIMD syntax, assigner semantics, and validation rules are normative in Airalogy docs. `@airalogy/aimd-*` docs describe how the frontend parser, renderer, and recorder implement those rules.

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

Example client assigner block:

````aimd
```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["a", "b"],
    assigned_fields: ["total"],
  },
  function calculate_total({ a, b }) {
    return {
      total: a + b,
    };
  }
);
```
````

If AIMD inline templates appear inside Markdown tables, protect them before `parse()` so GFM does not split on the template pipe:

```ts
import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"

const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
const file = { data: { aimdInlineTemplates: templates } } as any
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

## Validation Helpers

```ts
import {
  validateClientAssignerFunctionSource,
  validateVarDefaultType,
} from "@airalogy/aimd-core/parser"
```

Use `validateClientAssignerFunctionSource()` when host tooling needs to preflight fenced `assigner runtime=client` functions before saving or executing them. Use `validateVarDefaultType()` to surface warnings when an authored AIMD var default does not match its declared type.

## Documentation

- EN: <https://airalogy.github.io/aimd/en/packages/aimd-core>
- 中文: <https://airalogy.github.io/aimd/zh/packages/aimd-core>
- Parsed output and the `name` -> `id` migration notes are documented in the package docs.
- Source docs: `aimd/docs/en/packages/aimd-core/`, `aimd/docs/zh/packages/aimd-core/`
