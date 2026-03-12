# @airalogy/aimd-core

`@airalogy/aimd-core` 提供 AIMD 的语法解析与规范化字段提取能力。

## 安装

```bash
pnpm add @airalogy/aimd-core
```

## 核心能力

- 解析 AIMD 模板语法与 `quiz` / `fig` 代码块。
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

## Markdown 表格

如果 AIMD 行内模板出现在 Markdown 表格单元格中，需要在 `parse()` 之前先保护模板，避免 GFM 把模板里的 `|` 当成列表格分隔符：

```ts
import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"

const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
const file = { data: { aimdInlineTemplates: templates } } as any
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

## 继续阅读

- 解析节点与字段提取结果现在只保留 `id`。如果你在升级旧接入，请先阅读[迁移说明](/zh/packages/aimd-core/compatibility)。
- [解析节点](/zh/packages/aimd-core/parsed-nodes)
- [字段提取结果](/zh/packages/aimd-core/extracted-fields)
- [迁移说明](/zh/packages/aimd-core/compatibility)
