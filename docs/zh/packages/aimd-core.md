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
