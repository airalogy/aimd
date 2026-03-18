# @airalogy/aimd-core

AIMD（Airalogy Markdown）的核心解析器与规范化字段提取能力。

它也会把 fenced `assigner runtime=client` 代码块提取为 `fields.client_assigner` 前端元数据。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；`@airalogy/aimd-*` 文档只描述前端 parser、renderer、recorder 如何实现这些规范。

## 安装

```bash
pnpm add @airalogy/aimd-core
```

## 快速开始

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

示例 client assigner：

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

如果 AIMD 行内模板出现在 Markdown 表格单元格中，需要在 `parse()` 之前先保护模板，避免 GFM 把模板里的 `|` 当成列表格分隔符：

```ts
import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"

const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
const file = { data: { aimdInlineTemplates: templates } } as any
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

## 校验辅助函数

```ts
import {
  validateClientAssignerFunctionSource,
  validateVarDefaultType,
} from "@airalogy/aimd-core/parser"
```

如果宿主工具需要在保存或执行前预检 fenced `assigner runtime=client` 函数，可使用 `validateClientAssignerFunctionSource()`。如果你想在作者填写 AIMD var 默认值时提示类型不匹配警告，可使用 `validateVarDefaultType()`。

## 文档

- EN: <https://airalogy.github.io/aimd/en/packages/aimd-core>
- 中文: <https://airalogy.github.io/aimd/zh/packages/aimd-core>
- 解析结果结构与 `name` -> `id` 迁移说明见包文档。
- 文档源码：`aimd/docs/en/packages/aimd-core/`、`aimd/docs/zh/packages/aimd-core/`
