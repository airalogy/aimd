# @airalogy/aimd-core

`@airalogy/aimd-core` provides AIMD syntax parsing and canonical field extraction.

> Protocol-level AIMD syntax, assigner semantics, and validation rules are normative in Airalogy docs. This page only describes how `@airalogy/aimd-core` parses and extracts those structures on the frontend.

## Install

```bash
pnpm add @airalogy/aimd-core
```

## Main Capabilities

- Parse AIMD templates and fenced `quiz` / `fig` blocks.
- Parse fenced `assigner runtime=client` blocks into frontend assigner metadata.
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

Client assigner blocks use the same `assigner` fence name and declare the runtime in the header:

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

## Markdown Tables

If AIMD inline templates appear inside Markdown tables, protect them before `parse()` so GFM does not split on the template pipe:

```ts
import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"

const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
const file = { data: { aimdInlineTemplates: templates } } as any
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

## Validation Helpers

If your editor, linter, or import pipeline needs parser-level validation before AIMD content reaches the renderer or recorder, `@airalogy/aimd-core/parser` also exports two reusable helpers:

```ts
import {
  validateClientAssignerFunctionSource,
  validateVarDefaultType,
} from "@airalogy/aimd-core/parser"
```

- `validateClientAssignerFunctionSource(functionSource, id)` rejects unsafe or unsupported frontend `client_assigner` code such as `eval`, `window`, `fetch`, Unicode-escape bypasses, and other non-deterministic constructs.
- `validateVarDefaultType(def)` returns warning strings when an AIMD var default does not match its declared type.

## Further Reading

- Parsed nodes and extracted fields now use `id` only. If you are upgrading older integrations, read [Migration](/en/packages/aimd-core/compatibility) first.
- [Parsed Nodes](/en/packages/aimd-core/parsed-nodes)
- [Extracted Fields](/en/packages/aimd-core/extracted-fields)
- [Migration](/en/packages/aimd-core/compatibility)
