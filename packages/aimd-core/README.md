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

## Citation

If `@airalogy/aimd-core` is useful in your work, please cite the Airalogy paper:

```bibtex
@misc{yang2025airalogyaiempowereduniversaldata,
      title={Airalogy: AI-empowered universal data digitization for research automation},
      author={Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang},
      year={2025},
      eprint={2506.18586},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2506.18586},
}
```
