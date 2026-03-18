# @airalogy/aimd-core

`@airalogy/aimd-core` 提供 AIMD 的语法解析与规范化字段提取能力。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；本页只描述 `@airalogy/aimd-core` 如何在前端解析并提取这些结构。

## 安装

```bash
pnpm add @airalogy/aimd-core
```

## 核心能力

- 解析 AIMD 模板语法与 `quiz` / `fig` 代码块。
- 解析 fenced `assigner runtime=client` 代码块并提取前端 assigner 元数据。
- 构建兼容 MDAST 的 AIMD 节点。
- 输出标准化字段结构，供 renderer/editor/recorder 复用。

## 示例

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

client assigner 仍然使用同一个 `assigner` fenced block 名，只是在头部声明 runtime：

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

## Markdown 表格

如果 AIMD 行内模板出现在 Markdown 表格单元格中，需要在 `parse()` 之前先保护模板，避免 GFM 把模板里的 `|` 当成列表格分隔符：

```ts
import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"

const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
const file = { data: { aimdInlineTemplates: templates } } as any
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

## 校验辅助函数

如果你的编辑器、lint 流程或导入链路需要在 AIMD 内容进入 renderer / recorder 之前先做 parser 级校验，`@airalogy/aimd-core/parser` 还导出了两个可复用辅助函数：

```ts
import {
  validateClientAssignerFunctionSource,
  validateVarDefaultType,
} from "@airalogy/aimd-core/parser"
```

- `validateClientAssignerFunctionSource(functionSource, id)` 会拒绝不安全或不受支持的前端 `client_assigner` 代码，例如 `eval`、`window`、`fetch`、Unicode 转义绕过，以及其他非确定性结构。
- `validateVarDefaultType(def)` 会在 AIMD var 的默认值与声明类型不匹配时返回 warning 文本。

## 继续阅读

- 解析节点与字段提取结果现在只保留 `id`。如果你在升级旧接入，请先阅读[迁移说明](/zh/packages/aimd-core/compatibility)。
- [解析节点](/zh/packages/aimd-core/parsed-nodes)
- [字段提取结果](/zh/packages/aimd-core/extracted-fields)
- [迁移说明](/zh/packages/aimd-core/compatibility)
