# @airalogy/aimd-core

> AIMD（Airalogy Markdown）核心解析器和语法定义

## 概述

本包为 AIMD（Airalogy Markdown）提供核心的解析和语法定义基础设施。AIMD 是一种专门为研究协议和数据采集设计的 Markdown 格式。包含了 Unified/Remark 插件用于解析、完整的 TypeScript 类型，以及在不同编辑器中进行语法高亮的语法定义。

## 功能特性

- 🔍 **AIMD 语法解析** - Unified/Remark 插件，将 AIMD 语法解析为 AST
- 📝 **类型定义** - 所有 AIMD 节点的完整 TypeScript 类型
- 🎨 **语法高亮** - TextMate/Shiki 语法定义，支持多种编辑器
- 🛠️ **工具函数** - 处理 AIMD 数据和模板的辅助函数
- ⚡ **Rehype 集成** - 支持自定义 AIMD 处理的 HTML 转换

## 安装

```bash
pnpm add @airalogy/aimd-core
```

## 使用

### 基础解析

```typescript
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { remarkAimd } from '@airalogy/aimd-core'

const processor = unified()
  .use(remarkParse)
  .use(remarkAimd)

const content = `
# 研究协议

{{var|sample_name: str}}
{{step|sample_preparation}}
{{check|quality_control}}
`

const file = await processor.process(content)
console.log(file.data.aimdFields)
```

### 使用 Shiki 进行语法高亮

```typescript
import { createHighlighter } from 'shiki'
import { aimdLanguage, aimdSyntaxTheme } from '@airalogy/aimd-core/syntax'

const highlighter = await createHighlighter({
  themes: [aimdSyntaxTheme],
  langs: [aimdLanguage],
})

const html = highlighter.codeToHtml(content, {
  lang: 'aimd',
  theme: 'aimd-theme',
})
```

### 类型使用

```typescript
import type {
  AimdVarNode,
  AimdStepNode,
  ExtractedAimdFields
} from '@airalogy/aimd-core/types'

function processFields(fields: ExtractedAimdFields) {
  fields.var.forEach((varNode: AimdVarNode) => {
    console.log(`变量: ${varNode.name}`)
  })

  fields.step.forEach((stepNode: AimdStepNode) => {
    console.log(`步骤: ${stepNode.name}`)
  })
}
```

### 工具函数

```typescript
import {
  getSubvarNames,
  getSubvarDef,
  hasSubvars,
  findVarTable,
  isVarTableField,
  toTemplateEnv,
  toLegacyFieldsFormat,
  normalizeSubvars,
  mergeVarTableInfo
 } from '@airalogy/aimd-core/utils'

const subvars = [{ name: 'sample_id' }, { name: 'concentration' }]
const names = getSubvarNames(subvars) // ['sample_id', 'concentration']

const varTable = findVarTable(fields, 'sample_table')
const templateEnv = toTemplateEnv(fields)
const normalized = normalizeSubvars(varTable?.subvars)
```

### Rehype 集成

```typescript
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { rehypeAimd } from '@airalogy/aimd-core'

const processor = unified()
  .use(remarkParse)
  .use(remarkAimd)
  .use(remarkRehype)
  .use(rehypeAimd)

const html = processor.processSync(content)
```

## AIMD 语法

AIMD 用特殊的字段语法扩展了标准 Markdown，适用于研究协议：

### 变量

简单的变量声明：
```aimd
{{var|sample_name: str}}
{{var|temperature: float = 25.0}}
{{var|is_active: bool = true}}
```

带有额外元数据的变量：
```aimd
{{var|concentration: float = 1.0, title = "浓度 (M)", unit = "mol/L"}}
{{var|samples: list[str], title = "样本 ID"}}
```

### 变量表

定义具有子变量的表格数据：
```aimd
{{var_table|samples, subvars=[sample_id, concentration, volume]}}
```

带有元数据：
```aimd
{{var_table|measurements, subvars=[time, value, unit], title = "测量数据"}}
```

### 步骤

程序步骤：
```aimd
{{step|sample_preparation}}
{{step|data_analysis}}
{{step|report_generation}}
```

### 检查

质量检查和验证点：
```aimd
{{check|quality_control}}
{{check|safety_verification}}
```

### 引用

引用其他 AIMD 元素：
```aimd
{{ref_var|sample_name}}
{{ref_step|sample_preparation}}
{{ref_fig|figure_1}}
```

### 引用文献

插入引用（逗号分隔）：
```aimd
{{cite|ref_1}}
{{cite|ref_1, ref_2}}
```

### 图片（Figure）

通过 fenced code block 定义 figure：
````aimd
```fig
id: fig_1
src: /path/to/image.png
title: 可选标题
legend: |
  可选图注（支持多行）
```
````

## 导出

### 主入口 (`@airalogy/aimd-core`)

- `remarkAimd` - 用于解析 AIMD 语法的 Remark 插件
- `rehypeAimd` - 用于 AIMD HTML 转换的 Rehype 插件
- 所有类型、语法定义和工具函数

```typescript
import { remarkAimd, rehypeAimd } from '@airalogy/aimd-core'
```

### 解析器导出 (`@airalogy/aimd-core/parser`)

- `remarkAimd` - Remark 插件
- `rehypeAimd` - Rehype 插件
- `DOM_ATTR_NAME` - AIMD 元素的 DOM 属性常量

```typescript
import { remarkAimd, DOM_ATTR_NAME } from '@airalogy/aimd-core/parser'
```

### 语法导出 (`@airalogy/aimd-core/syntax`)

- `aimdLanguage` - Shiki 的语言注册
- `aimdInjection` - 注入语法，用于嵌入其他语言
- `aimdSyntaxTheme` - 默认语法高亮主题
- `AIMD_SCOPES` - 词法化的范围名称常量

```typescript
import { aimdLanguage, aimdSyntaxTheme } from '@airalogy/aimd-core/syntax'
```

### 类型导出 (`@airalogy/aimd-core/types`)

AIMD 的完整 TypeScript 类型：
- `AimdVarNode` - 变量节点
- `AimdVarTableNode` - 变量表节点
- `AimdStepNode` - 步骤节点
- `AimdCheckNode` - 检查节点
- `AimdRefNode` - 引用节点
- `ExtractedAimdFields` - 提取的字段结构
- `AimdTemplateEnv` - 模板环境
- 以及更多节点和字段类型

```typescript
import type {
  AimdVarNode,
  AimdStepNode,
  ExtractedAimdFields
} from '@airalogy/aimd-core/types'
```

### 工具函数导出 (`@airalogy/aimd-core/utils`)

用于处理 AIMD 的工具函数：
- `normalizeSubvars()` - 规范化子变量格式
- `getSubvarNames()` - 从数组提取子变量名称
- `getSubvarDef()` - 按名称获取某个子变量定义
- `hasSubvars()` - 判断是否包含子变量
- `findVarTable()` - 按名称查找 var_table
- `isVarTableField()` - 判断某个字段名是否为 var_table
- `mergeVarTableInfo()` - 将 var_table 信息合并到字段结构
- `toTemplateEnv()` - 将字段转换为模板环境
- `toLegacyFieldsFormat()` - 转换为旧版字段格式

```typescript
import {
  getSubvarNames,
  findVarTable,
  toTemplateEnv
} from '@airalogy/aimd-core/utils'
```

### 语法导出 (`@airalogy/aimd-core/syntax`)

用于语法高亮的 TextMate 语法：
- `aimdLanguage` - 用于 Shiki 和其他基于 TextMate 的高亮器
- 可用的多种格式：
  - JSON 格式，可直接使用
  - JavaScript 格式，用于程序化访问

## 高级用法

### 自定义处理器配置

```typescript
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { remarkAimd } from '@airalogy/aimd-core'

const processor = unified()
  .use(remarkParse)
  .use(remarkAimd, {
    extractFields: true,
    typed: {
      // 可选 typed 配置（供后续 template env/业务侧消费）
      // my_type: { ... }
    },
  })
```

### 模板环境生成

```typescript
import { toTemplateEnv } from '@airalogy/aimd-core/utils'
import type { ExtractedAimdFields } from '@airalogy/aimd-core/types'

const fields: ExtractedAimdFields = { /* ... */ }
const env = toTemplateEnv(fields)

// 在模板渲染中使用 env
const rendered = renderTemplate(templateString, env)
```

## 集成

### 与 Monaco 编辑器集成

参见 `@airalogy/aimd-editor` 以获取 Monaco 编辑器集成和语法高亮。

### 与渲染引擎集成

参见 `@airalogy/aimd-renderer` 以将 AIMD 渲染为 HTML 和 Vue 组件。

### 与 UI 组件集成

参见 `@airalogy/aimd-recorder` 以获取用于编辑 AIMD 的现成 Vue 组件。

## 开发

### 脚本命令

```bash
# 类型检查
pnpm type-check

# 生产环境构建
pnpm build

# 构建类型声明
pnpm build:types
```

### 依赖

核心依赖：
- `unified` - 文本处理生态系统
- `remark-parse` - Markdown 解析器
- `remark-rehype` - remark 到 rehype 的桥接
- `unist-util-visit` - AST 访问工具

开发依赖：
- `shiki` - 语法高亮
- `typescript` - 类型检查
- `vite` - 构建工具

## 架构

### 解析管道

```
内容 (字符串)
    ↓
remark-parse (Markdown AST)
    ↓
remarkAimd (AST 中的 AIMD 节点)
    ↓
remarkRehype (HTML AST)
    ↓
rehypeAimd (AIMD 特定的 HTML 转换)
    ↓
HTML 输出
```

### 节点结构

AIMD 节点与 Unified 生态系统兼容：
- 扩展自标准 AST 节点
- 包含关于 AIMD 元素的元数据
- 支持自定义属性和数据
- 与 rehype 和其他处理器兼容

## 贡献指南

1. 遵循 TypeScript 最佳实践，使用严格类型
2. 为所有公开 API 添加详细的 JSDoc 注释
3. 为新工具函数编写单元测试
4. 保持向后兼容，或使用弃用警告
5. 更新文档和 README 以反映新功能
6. 用不同的 Markdown 内容进行测试

## 性能考虑

- 解析器针对大文档的流式处理进行了优化
- AST 访问工具使用高效的遍历
- 类型定义不会影响运行时性能
- 语法定义经过编译，用于语法高亮的高效性

## 许可证

Airalogy 单体仓库的一部分。保留所有权利。
